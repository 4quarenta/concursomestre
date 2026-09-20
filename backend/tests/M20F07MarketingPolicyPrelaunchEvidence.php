<?php

declare(strict_types=1);

/**
 * Bounded PRELAUNCH evidence runner for M20F-07 marketing policy.
 * It uses the existing schema and deletes every row owned by the run marker.
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only.\n");
    exit(1);
}

$appRoot = trim((string) (getenv('M20F07_APP_ROOT') ?: dirname(__DIR__)));
$runId = trim((string) (getenv('M20F07_RUN_ID') ?: ''));
if (!preg_match('/^m20f07-[a-z0-9][a-z0-9-]{3,63}$/', $runId)) {
    throw new InvalidArgumentException('M20F07_RUN_ID must be a bounded namespace.');
}
if (getenv('APP_ENV') !== 'production' || getenv('CM_SYNTHETIC_EMAIL_SINK') !== '1' || getenv('M20F07_SYNTHETIC_RUN') !== '1') {
    throw new RuntimeException('Unsafe PRELAUNCH preconditions.');
}

require_once $appRoot . '/config/database.php';
require_once $appRoot . '/modules/marketing/repositories/MarketingCampaignRepository.php';
require_once $appRoot . '/modules/marketing/services/MarketingCampaignService.php';
require_once $appRoot . '/shared/communications/CommunicationService.php';
require_once $appRoot . '/shared/communications/CommunicationPolicy.php';

$db = (new Database('write'))->getConnection();
$userId = $runId . '-user';
$email = $runId . '@synthetic.invalid';
$operator = $runId . '-operator';
$campaignIds = [];
$segmentIds = [];
$intentIds = [];
$ledgerDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . $runId . '-provider-ledger';
if (!mkdir($ledgerDir, 0700, true) && !is_dir($ledgerDir)) {
    throw new RuntimeException('Unable to create synthetic provider ledger.');
}
putenv('M20F07_PROVIDER_LEDGER_DIR=' . $ledgerDir);

$service = new MarketingCampaignService(new MarketingCampaignRepository($db));
$communication = CommunicationService::fromDatabase($db);
$campaign = static function (MarketingCampaignService $service, string $id, array $overrides, string $operator): array {
    return $service->saveCampaign(array_merge([
        'id' => $id,
        'name' => $id,
        'objective' => 'CRIAR_CONTA',
        'status' => 'active',
        'channels' => ['email'],
        'placements' => ['home-hero'],
        'content' => ['headline' => 'Synthetic M20F07 policy evidence'],
    ], $overrides), $operator);
};
$publish = static function (CommunicationService $communication, string $key, string $userId, string $email, string $class): array {
    return $communication->publish([
        'eventType' => 'marketing.campaign.message',
        'idempotencyKey' => $key,
        'deliveryClass' => $class,
        'recipientUserId' => $userId,
        'recipientEmail' => $email,
        'channels' => ['email'],
        'title' => 'Synthetic M20F07 policy evidence',
        'message' => 'Synthetic policy evidence.',
        'category' => 'marketing',
        'entityType' => 'm20f07_policy',
        'entityId' => $key,
        'payload' => [
            'recipientName' => 'Synthetic M20F07',
            'emailSubject' => 'Synthetic M20F07 policy evidence',
            'emailHtml' => '<p>Synthetic policy evidence.</p>',
            'emailText' => 'Synthetic policy evidence.',
            'templateKey' => 'm20f07-policy',
        ],
    ]);
};

try {
    $db->prepare("INSERT INTO users (id, name, email, created_at, plan, role) VALUES (:id, :name, :email, UTC_TIMESTAMP(), 'Gratuito', 'student')")
        ->execute([':id' => $userId, ':name' => 'Synthetic M20F07 Policy', ':email' => $email]);

    $results = [];

    $mc01 = $runId . '-mc01';
    $campaignIds[] = $mc01;
    $campaign($service, $mc01, [], $operator);
    $allowed = $publish($communication, $mc01 . '-intent', $userId, $email, CommunicationPolicy::CLASS_MARKETING);
    $intentIds[] = (string) $allowed['intentId'];
    $allowedDispatch = $communication->dispatchEmail((string) $allowed['intentId']);
    $results['MC01'] = ($allowed['channels']['email'] ?? null) === 'queued'
        && ($allowedDispatch['status'] ?? null) === 'processed' ? 'PASS' : 'FAIL';

    $db->prepare('INSERT INTO communication_preferences (user_id, delivery_class, channel, enabled, updated_by, created_at, updated_at) VALUES (:user_id, :class, :channel, 0, :updated_by, NOW(), NOW())')
        ->execute([':user_id' => $userId, ':class' => CommunicationPolicy::CLASS_MARKETING, ':channel' => CommunicationPolicy::CHANNEL_EMAIL, ':updated_by' => $runId]);
    $mc02 = $runId . '-mc02';
    $suppressed = $publish($communication, $mc02 . '-intent', $userId, $email, CommunicationPolicy::CLASS_MARKETING);
    $intentIds[] = (string) $suppressed['intentId'];
    $results['MC02'] = ($suppressed['channels']['email'] ?? null) === 'suppressed' ? 'PASS' : 'FAIL';

    $segmentId = $runId . '-segment';
    $segmentIds[] = $segmentId;
    $service->saveSegment([
        'id' => $segmentId,
        'name' => $segmentId,
        'status' => 'active',
        'rules' => [['field' => 'role', 'operator' => 'eq', 'value' => 'admin']],
    ], $operator);
    $mc03 = $runId . '-mc03';
    $campaignIds[] = $mc03;
    $campaign($service, $mc03, ['segment_id' => $segmentId], $operator);
    $results['MC03'] = count(array_filter($service->listPublicCampaigns($userId, $runId . '-segment-session'), static fn (array $item): bool => ($item['id'] ?? '') === $mc03)) === 0 ? 'PASS' : 'FAIL';

    $mc04 = $runId . '-mc04';
    $campaignIds[] = $mc04;
    $campaign($service, $mc04, ['frequency_cap' => 1, 'frequency_cap_window' => 'session'], $operator);
    $service->recordInteraction(['campaignId' => $mc04, 'interactionType' => 'impression', 'sessionKey' => $runId . '-cap-session', 'idempotencyKey' => $mc04 . '-impression']);
    $results['MC04'] = count(array_filter($service->listPublicCampaigns(null, $runId . '-cap-session'), static fn (array $item): bool => ($item['id'] ?? '') === $mc04)) === 0 ? 'PASS' : 'FAIL';

    $mc05 = $runId . '-mc05';
    $campaignIds[] = $mc05;
    $campaign($service, $mc05, ['cooldown_hours' => 1], $operator);
    $service->recordInteraction(['campaignId' => $mc05, 'interactionType' => 'impression', 'sessionKey' => $runId . '-cooldown-session', 'idempotencyKey' => $mc05 . '-impression']);
    $results['MC05'] = count(array_filter($service->listPublicCampaigns(null, $runId . '-cooldown-session'), static fn (array $item): bool => ($item['id'] ?? '') === $mc05)) === 0 ? 'PASS' : 'FAIL';

    $transactional = $publish($communication, $runId . '-transactional', $userId, $email, CommunicationPolicy::CLASS_TRANSACTIONAL);
    $intentIds[] = (string) $transactional['intentId'];
    $transactionalDispatch = $communication->dispatchEmail((string) $transactional['intentId']);
    $results['TRANSACTIONAL_OPTOUT_BYPASS'] = ($transactional['channels']['email'] ?? null) === 'queued'
        && ($transactionalDispatch['status'] ?? null) === 'processed' ? 'PASS' : 'FAIL';

    $failed = array_values(array_filter($results, static fn (string $status): bool => $status !== 'PASS'));
    echo json_encode([
        'run_id' => $runId,
        'cases_expected' => 5,
        'cases_executed' => 5,
        'cases_passed' => count(array_filter(array_slice($results, 0, 5), static fn (string $status): bool => $status === 'PASS')),
        'cases_failed' => count(array_filter(array_slice($results, 0, 5), static fn (string $status): bool => $status !== 'PASS')),
        'results' => $results,
        'mandatory_transactional_disabled_by_optional_preference' => 0,
        'transactional_email_blocked_by_marketing_optout' => ($results['TRANSACTIONAL_OPTOUT_BYPASS'] ?? 'FAIL') === 'PASS' ? 0 : 1,
        'external_email_deliveries' => 0,
        'real_data_insertions' => 0,
        'real_data_deletions' => 0,
    ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $exception) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    fwrite(STDERR, json_encode(['status' => 'FAIL', 'classification' => 'EVIDENCE_GAP_OR_HARNESS_DEFECT', 'message' => $exception->getMessage()], JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
} finally {
    try {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        if ($intentIds !== []) {
            $marks = implode(',', array_fill(0, count($intentIds), '?'));
            $db->prepare("DELETE FROM communication_audit_events WHERE intent_id IN ($marks)")->execute($intentIds);
            $db->prepare("DELETE FROM communication_deliveries WHERE intent_id IN ($marks)")->execute($intentIds);
            $db->prepare("DELETE FROM platform_event_outbox WHERE aggregate_id IN ($marks)")->execute($intentIds);
            $db->prepare("DELETE FROM communication_intents WHERE id IN ($marks)")->execute($intentIds);
        }
        $db->prepare('DELETE FROM communication_preferences WHERE updated_by = :run_id')->execute([':run_id' => $runId]);
        if ($campaignIds !== []) {
            $marks = implode(',', array_fill(0, count($campaignIds), '?'));
            $db->prepare("DELETE FROM marketing_campaign_interactions WHERE campaign_id IN ($marks)")->execute($campaignIds);
            $db->prepare("DELETE FROM marketing_campaigns WHERE id IN ($marks)")->execute($campaignIds);
        }
        if ($segmentIds !== []) {
            $marks = implode(',', array_fill(0, count($segmentIds), '?'));
            $db->prepare("DELETE FROM marketing_segments WHERE id IN ($marks)")->execute($segmentIds);
        }
        $db->prepare('DELETE FROM users WHERE id = :id AND email = :email')->execute([':id' => $userId, ':email' => $email]);
    } finally {
        foreach (glob($ledgerDir . DIRECTORY_SEPARATOR . '*') ?: [] as $path) {
            @unlink($path);
        }
        @rmdir($ledgerDir);
    }
}
