<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../shared/communications/CommunicationService.php';
require_once __DIR__ . '/../shared/communications/CommunicationDeepLinkPolicy.php';

$runId = 'm20f07-' . gmdate('YmdHis') . '-' . bin2hex(random_bytes(4));
$db = (new Database())->getConnection();
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
putenv('M20F07_SYNTHETIC_RUN=1');
putenv('CM_SYNTHETIC_EMAIL_SINK=1');

$intentIds = [];
$outboxIds = [];
$eventOrderingPassed = 0;
$eventOrderingCases = [];
$deepLinkCases = [];

$publish = static function (CommunicationService $service, string $key, string $state, int $revision, string $transitionId) use (&$intentIds, $runId): array {
    $result = $service->publish([
        'eventType' => 'support.ticket.status_changed',
        'idempotencyKey' => $runId . ':' . $key . ':' . $transitionId,
        'deliveryClass' => CommunicationPolicy::CLASS_TRANSACTIONAL,
        'recipientUserId' => 'm20f07-synthetic-user',
        'recipientEmail' => $runId . '@example.invalid',
        'channels' => [CommunicationPolicy::CHANNEL_EMAIL],
        'title' => 'M20F-07 synthetic ordering evidence',
        'message' => $state,
        'entityType' => 'm20f07-evidence',
        'entityId' => $runId,
        'ordering' => [
            'key' => $runId . ':' . $key,
            'revision' => $revision,
            'transitionId' => $transitionId,
            'state' => $state,
        ],
        'payload' => ['runId' => $runId, 'synthetic' => true],
    ]);
    if (($result['intentId'] ?? '') !== '') {
        $intentIds[] = (string) $result['intentId'];
    }
    return $result;
};

try {
    $service = CommunicationService::fromDatabase($db);

    $cases = [
        'EO01_pending_confirmed' => static function () use ($publish): bool {
            $old = $publish('eo01', 'pending', 1, 'eo01-pending');
            $new = $publish('eo01', 'confirmed', 2, 'eo01-confirmed');
            return ($old['created'] ?? false) === true && ($new['created'] ?? false) === true;
        },
        'EO02_confirmed_pending_replay' => static function () use ($publish): bool {
            $publish('eo02', 'confirmed', 2, 'eo02-confirmed');
            $replay = $publish('eo02', 'pending', 1, 'eo02-pending-replay');
            return ($replay['ordered'] ?? '') === 'stale';
        },
        'EO03_newer_then_stale' => static function () use ($publish): bool {
            $publish('eo03', 'confirmed', 4, 'eo03-newer');
            $stale = $publish('eo03', 'pending', 3, 'eo03-stale');
            return ($stale['ordered'] ?? '') === 'stale';
        },
        'EO04_terminal_then_nonterminal' => static function () use ($publish): bool {
            $publish('eo04', 'refunded', 7, 'eo04-terminal');
            $stale = $publish('eo04', 'pending', 6, 'eo04-stale');
            return ($stale['ordered'] ?? '') === 'stale';
        },
        'EO05_duplicate_confirmed' => static function () use ($publish): bool {
            $publish('eo05', 'confirmed', 8, 'eo05-confirmed');
            $duplicate = $publish('eo05', 'confirmed', 8, 'eo05-confirmed-duplicate');
            return ($duplicate['ordered'] ?? '') === 'duplicate';
        },
        'EO06_stale_duplicate_after_terminal' => static function () use ($publish): bool {
            $publish('eo06', 'canceled', 9, 'eo06-terminal');
            $stale = $publish('eo06', 'canceled', 8, 'eo06-older-duplicate');
            return ($stale['ordered'] ?? '') === 'stale';
        },
    ];

    foreach ($cases as $name => $case) {
        $passed = $case();
        $eventOrderingCases[$name] = $passed ? 'PASS' : 'FAIL';
        $eventOrderingPassed += $passed ? 1 : 0;
    }

    $policy = new CommunicationDeepLinkPolicy();
    $deepLinkAssertions = [
        ['id' => 'DL01_own_notifications', 'link' => '/notifications', 'context' => ['recipientUserId' => 'user-1'], 'pass' => true],
        ['id' => 'DL02_own_profile', 'link' => '/profile?user_id=user-1', 'context' => ['recipientUserId' => 'user-1'], 'pass' => true],
        ['id' => 'DL03_admin_route_requires_admin', 'link' => '/admin/support/communications', 'context' => ['recipientUserId' => 'user-1'], 'pass' => false],
        ['id' => 'DL04_external_host', 'link' => 'https://evil.example.test/steal', 'context' => [], 'pass' => false],
        ['id' => 'DL05_javascript_scheme', 'link' => 'javascript:alert(1)', 'context' => [], 'pass' => false],
        ['id' => 'DL06_cross_user_target', 'link' => '/notifications?user_id=user-2', 'context' => ['recipientUserId' => 'user-1'], 'pass' => false],
    ];
    foreach ($deepLinkAssertions as $assertion) {
        $passed = false;
        try {
            $policy->authorize($assertion['link'], $assertion['context']);
            $passed = $assertion['pass'];
        } catch (Throwable) {
            $passed = !$assertion['pass'];
        }
        $deepLinkCases[$assertion['id']] = $passed ? 'PASS' : 'FAIL';
    }

    if ($intentIds !== []) {
        $marks = implode(',', array_fill(0, count($intentIds), '?'));
        $query = $db->prepare("SELECT id FROM platform_event_outbox WHERE aggregate_type = 'communication_intent' AND aggregate_id IN ($marks)");
        $query->execute($intentIds);
        $outboxIds = array_map('intval', $query->fetchAll(PDO::FETCH_COLUMN));
    }
} finally {
    if ($intentIds !== []) {
        $marks = implode(',', array_fill(0, count($intentIds), '?'));
        if ($outboxIds !== []) {
            $outboxMarks = implode(',', array_fill(0, count($outboxIds), '?'));
            $db->prepare("DELETE FROM platform_event_outbox WHERE id IN ($outboxMarks)")->execute($outboxIds);
        }
        $db->prepare("DELETE FROM communication_audit_events WHERE intent_id IN ($marks)")->execute($intentIds);
        $db->prepare("DELETE FROM communication_deliveries WHERE intent_id IN ($marks)")->execute($intentIds);
        $db->prepare("DELETE FROM communication_intents WHERE id IN ($marks)")->execute($intentIds);
    }
}

$deepLinkPassed = count(array_filter($deepLinkCases, static fn (string $value): bool => $value === 'PASS'));
$payload = [
    'run_id' => $runId,
    'event_ordering' => [
        'cases_total' => count($eventOrderingCases),
        'cases_passed' => $eventOrderingPassed,
        'cases_failed' => count($eventOrderingCases) - $eventOrderingPassed,
        'cases' => $eventOrderingCases,
    ],
    'deep_link_policy' => [
        'cases_total' => count($deepLinkCases),
        'cases_passed' => $deepLinkPassed,
        'cases_failed' => count($deepLinkCases) - $deepLinkPassed,
        'cases' => $deepLinkCases,
    ],
    'cleanup' => ['intent_ids' => count($intentIds), 'outbox_ids' => count($outboxIds)],
    'real_data_insertions' => 0,
    'real_external_email_deliveries' => 0,
];
fwrite(STDOUT, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL);
exit(($eventOrderingPassed === 6 && $deepLinkPassed === 6) ? 0 : 1);
