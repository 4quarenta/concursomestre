<?php

declare(strict_types=1);

/**
 * Rehearsal descartavel da autoridade server-side de governanca de campanhas.
 * Executa somente em MySQL local loopback e remove o banco no finally.
 */
function marketingGovernanceAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$host = (string) (getenv('MARKETING_TEST_DB_HOST') ?: '127.0.0.1');
marketingGovernanceAssert(in_array($host, ['127.0.0.1', 'localhost', '::1'], true), 'Este rehearsal aceita somente banco local descartavel.');
$port = (int) (getenv('MARKETING_TEST_DB_PORT') ?: 3306);
$user = (string) (getenv('MARKETING_TEST_DB_USER') ?: 'root');
$password = (string) (getenv('MARKETING_TEST_DB_PASSWORD') ?: '');
$databaseName = 'm20f02_governance_test_' . bin2hex(random_bytes(5));
$dsn = "mysql:host={$host};port={$port};charset=utf8mb4";
$server = new PDO($dsn, $user, $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$server->exec('CREATE DATABASE `' . $databaseName . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$db = new PDO("mysql:host={$host};port={$port};dbname={$databaseName};charset=utf8mb4", $user, $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$db->exec("SET time_zone = '+00:00'");

require_once dirname(__DIR__) . '/modules/marketing/repositories/MarketingCampaignRepository.php';
require_once dirname(__DIR__) . '/modules/marketing/services/MarketingCampaignService.php';

try {
    $baseMigration = require dirname(__DIR__) . '/database/migrations/20260905_120000_marketing_campaign_operations.php';
    $governanceMigration = require dirname(__DIR__) . '/database/migrations/20260906_120000_marketing_governance_enforcement.php';
    $baseMigration($db);
    $governanceMigration($db);
    $db->exec("CREATE TABLE users (
        id VARCHAR(64) PRIMARY KEY, created_at DATETIME(6) NOT NULL, plan VARCHAR(80) NULL, role VARCHAR(40) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->exec("CREATE TABLE analytics_lifecycle_events (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, event_name VARCHAR(80) NOT NULL, user_id VARCHAR(80) NULL,
        session_key VARCHAR(255) NULL, metadata_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $repo = new MarketingCampaignRepository($db);
    $service = new MarketingCampaignService($repo);
    $operator = 'm20f02-test-admin';
    $session = 'm20f02-test-session';

    $save = static function (MarketingCampaignService $service, string $id, array $overrides = []) use ($operator): array {
        return $service->saveCampaign(array_merge([
            'id' => $id, 'name' => $id, 'objective' => 'CRIAR_CONTA', 'status' => 'active', 'priority' => 10,
            'channels' => ['in_app'], 'placements' => ['topbar'], 'content' => ['headline' => 'Synthetic campaign'],
        ], $overrides), $operator);
    };
    $throws = static function (callable $callback): void {
        try {
            $callback();
        } catch (InvalidArgumentException) {
            return;
        }
        throw new RuntimeException('Expected governance rejection was not raised.');
    };

    $capId = 'm20f02-cap-' . bin2hex(random_bytes(8));
    $save($service, $capId, ['frequency_cap' => 2, 'frequency_cap_window' => 'session']);
    marketingGovernanceAssert(count($service->listPublicCampaigns(null, $session)) === 1, 'Campaign should be initially eligible.');
    marketingGovernanceAssert($service->recordInteraction(['campaignId' => $capId, 'interactionType' => 'impression', 'sessionKey' => $session, 'idempotencyKey' => 'cap-key-01'])['recorded'] === true, 'First impression was not recorded.');
    marketingGovernanceAssert($service->recordInteraction(['campaignId' => $capId, 'interactionType' => 'impression', 'sessionKey' => $session, 'idempotencyKey' => 'cap-key-02'])['recorded'] === true, 'Second impression was not recorded.');
    marketingGovernanceAssert(count($service->listPublicCampaigns(null, $session)) === 0, 'Frequency cap did not hide campaign.');
    $throws(fn() => $service->recordInteraction(['campaignId' => $capId, 'interactionType' => 'impression', 'sessionKey' => $session, 'idempotencyKey' => 'cap-key-03']));
    marketingGovernanceAssert($service->recordInteraction(['campaignId' => $capId, 'interactionType' => 'impression', 'sessionKey' => $session, 'idempotencyKey' => 'cap-key-02'])['recorded'] === false, 'Idempotent replay created a duplicate.');

    foreach ([['day', 2], ['week', 14], ['ever', 30]] as [$window, $daysAgo]) {
        $windowId = 'm20f02-window-' . $window . '-' . bin2hex(random_bytes(4));
        $windowSession = 'window-session-' . $window;
        $save($service, $windowId, ['frequency_cap' => 1, 'frequency_cap_window' => $window]);
        $service->recordInteraction([
            'campaignId' => $windowId, 'interactionType' => 'impression', 'sessionKey' => $windowSession,
            'idempotencyKey' => 'window-old-' . $window,
        ]);
        $db->prepare('UPDATE marketing_campaign_interactions SET created_at = DATE_SUB(UTC_TIMESTAMP(6), INTERVAL :days DAY) WHERE campaign_id = :campaign_id')
            ->execute([':days' => $daysAgo, ':campaign_id' => $windowId]);
        $visibleAfterWindow = count(array_filter($service->listPublicCampaigns(null, $windowSession), static fn(array $item): bool => $item['id'] === $windowId));
        marketingGovernanceAssert($visibleAfterWindow === ($window === 'ever' ? 0 : 1), 'Frequency window ' . $window . ' did not use server UTC boundaries.');
        if ($window !== 'ever') {
            marketingGovernanceAssert($service->recordInteraction([
                'campaignId' => $windowId, 'interactionType' => 'impression', 'sessionKey' => $windowSession,
                'idempotencyKey' => 'window-current-' . $window,
            ])['recorded'] === true, 'Current ' . $window . ' impression was not recorded.');
            marketingGovernanceAssert(count(array_filter($service->listPublicCampaigns(null, $windowSession), static fn(array $item): bool => $item['id'] === $windowId)) === 0, 'Current ' . $window . ' cap did not hide campaign.');
        }
    }

    $maxId = 'm20f02-max-' . bin2hex(random_bytes(6));
    $save($service, $maxId, ['max_impressions' => 1]);
    marketingGovernanceAssert($service->recordInteraction(['campaignId' => $maxId, 'interactionType' => 'impression', 'sessionKey' => 'max-session', 'idempotencyKey' => 'max-key-01'])['recorded'] === true, 'Maximum impression fixture was not recorded.');
    marketingGovernanceAssert(count(array_filter($service->listPublicCampaigns(null, 'max-session'), static fn(array $item): bool => $item['id'] === $maxId)) === 0, 'Maximum impression limit did not hide campaign.');
    $throws(fn() => $service->recordInteraction(['campaignId' => $maxId, 'interactionType' => 'impression', 'sessionKey' => 'max-session', 'idempotencyKey' => 'max-key-02']));

    $cooldownId = 'm20f02-cooldown-' . bin2hex(random_bytes(6));
    $save($service, $cooldownId, ['cooldown_hours' => 1]);
    $service->recordInteraction(['campaignId' => $cooldownId, 'interactionType' => 'impression', 'sessionKey' => $session, 'idempotencyKey' => 'cooldown-01']);
    marketingGovernanceAssert(count(array_filter($service->listPublicCampaigns(null, $session), static fn(array $item): bool => $item['id'] === $cooldownId)) === 0, 'Cooldown did not hide campaign.');
    marketingGovernanceAssert($service->recordInteraction(['campaignId' => $cooldownId, 'interactionType' => 'cta_clicked', 'sessionKey' => $session, 'idempotencyKey' => 'cooldown-cta'])['recorded'] === true, 'CTA should remain usable after an impression.');
    $service->recordInteraction(['campaignId' => $cooldownId, 'interactionType' => 'dismissal', 'sessionKey' => $session, 'idempotencyKey' => 'cooldown-dismiss']);
    marketingGovernanceAssert(count(array_filter($service->listPublicCampaigns(null, $session), static fn(array $item): bool => $item['id'] === $cooldownId)) === 0, 'Dismissal did not persist.');

    $groupA = 'm20f02-group-a-' . bin2hex(random_bytes(4));
    $groupB = 'm20f02-group-b-' . bin2hex(random_bytes(4));
    $save($service, $groupA, ['priority' => 20, 'mutual_exclusion_group' => 'm20f02-exclusive']);
    $save($service, $groupB, ['priority' => 10, 'mutual_exclusion_group' => 'm20f02-exclusive']);
    $selected = array_values(array_filter($service->listPublicCampaigns(null, 'exclusive-session'), static fn(array $item): bool => in_array($item['id'], [$groupA, $groupB], true)));
    marketingGovernanceAssert(count($selected) === 1 && $selected[0]['id'] === $groupA, 'Mutual exclusion winner was not deterministic.');
    $service->recordInteraction(['campaignId' => $groupA, 'interactionType' => 'impression', 'sessionKey' => 'exclusive-session', 'idempotencyKey' => 'exclusive-01']);
    $throws(fn() => $service->recordInteraction(['campaignId' => $groupB, 'interactionType' => 'impression', 'sessionKey' => 'exclusive-session', 'idempotencyKey' => 'exclusive-02']));

    $db->prepare("INSERT INTO users (id, created_at, plan, role) VALUES ('m20f02-user-match', UTC_TIMESTAMP(), 'free', 'student')")->execute();
    $segmentId = 'm20f02-segment-' . bin2hex(random_bytes(6));
    $service->saveSegment(['id' => $segmentId, 'name' => 'Synthetic segment', 'status' => 'active', 'rules' => [['field' => 'role', 'operator' => 'eq', 'value' => 'student']]], $operator);
    $segmentCampaignId = 'm20f02-segment-campaign-' . bin2hex(random_bytes(4));
    $save($service, $segmentCampaignId, ['segment_id' => $segmentId]);
    marketingGovernanceAssert(count(array_filter($service->listPublicCampaigns('m20f02-user-match', 'segment-session'), static fn(array $item): bool => $item['id'] === $segmentCampaignId)) === 1, 'Matching segment user was not eligible.');
    marketingGovernanceAssert(count(array_filter($service->listPublicCampaigns(null, 'segment-session'), static fn(array $item): bool => $item['id'] === $segmentCampaignId)) === 0, 'Segment campaign leaked without user context.');

    $conversionId = 'm20f02-conversion-' . bin2hex(random_bytes(5));
    $save($service, $conversionId, ['suppress_after_conversion' => true]);
    $stmt = $db->prepare("INSERT INTO analytics_lifecycle_events (event_name, user_id, session_key, metadata_json) VALUES ('signup_completed', 'm20f02-user-match', NULL, :metadata)");
    $stmt->execute([':metadata' => json_encode(['campaignId' => $conversionId], JSON_THROW_ON_ERROR)]);
    marketingGovernanceAssert(count(array_filter($service->listPublicCampaigns('m20f02-user-match', 'conversion-session'), static fn(array $item): bool => $item['id'] === $conversionId)) === 0, 'Converted user was not suppressed.');

    $futureId = 'm20f02-future-' . bin2hex(random_bytes(5));
    $save($service, $futureId, ['status' => 'scheduled', 'starts_at' => gmdate('Y-m-d H:i:s', time() + 3600), 'ends_at' => gmdate('Y-m-d H:i:s', time() + 7200)]);
    marketingGovernanceAssert(count(array_filter($service->listPublicCampaigns(null, 'future-session'), static fn(array $item): bool => $item['id'] === $futureId)) === 0, 'Future campaign was activated early.');

    $missingSegmentId = 'm20f02-missing-segment-' . bin2hex(random_bytes(4));
    $throws(fn() => $save($service, 'm20f02-invalid-' . bin2hex(random_bytes(4)), ['segment_id' => $missingSegmentId]));
    echo "Marketing campaign governance MySQL integration: PASS\n";
} finally {
    $server->exec('DROP DATABASE IF EXISTS `' . $databaseName . '`');
}
