<?php

declare(strict_types=1);

require_once __DIR__ . '/../shared/observability/RuntimeMutationEvidence.php';
require_once __DIR__ . '/../scripts/data/DatasetRuntimeEvidenceCollector.php';
require_once __DIR__ . '/../scripts/data/DatasetResetStateValidator.php';

function runtimeEvidenceAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$logPath = sys_get_temp_dir() . '/cm-runtime-evidence-' . bin2hex(random_bytes(6)) . '.log';
$previousLog = ini_get('error_log');
$previousLogErrors = ini_get('log_errors');
ini_set('log_errors', '1');
ini_set('error_log', $logPath);
$_SERVER['HTTP_X_REQUEST_ID'] = 'runtime-evidence-test-0001';

try {
    RuntimeMutationEvidence::record('auth_sessions', 'INSERT', 'http-auth-account', 'auth_login', 1);
    RuntimeMutationEvidence::record('auth_refresh_tokens', 'INSERT', 'http-auth-account', 'auth_login', 1);
    RuntimeMutationEvidence::record('user_cards', 'INSERT', 'http-auth-account', 'billing_card_save', 1);
    RuntimeMutationEvidence::record('user_cards', 'DELETE', 'http-auth-account', 'billing_card_delete', -1);
    RuntimeMutationEvidence::record(
        'user_statistics',
        'UPSERT',
        'http-practice-user-activity',
        'statistics_study_session_recorded',
        1
    );
    RuntimeMutationEvidence::record('auth_sessions', 'INSERT', 'unexpected-writer', 'unknown_event', 1);

    $lines = file($logPath, FILE_IGNORE_NEW_LINES) ?: [];
    $collected = DatasetRuntimeEvidenceCollector::collect($lines);
    runtimeEvidenceAssert($collected['invalidRecords'] === 0, 'Structured runtime evidence was malformed.');
    runtimeEvidenceAssert(count($collected['records']) === 6, 'Runtime evidence records were lost.');
    runtimeEvidenceAssert(
        count(array_filter($collected['records'], static fn (array $record): bool => ($record['allowlisted'] ?? false) !== true)) === 1,
        'Unknown runtime writer/event must be identified automatically.'
    );

    $allowedRecords = array_values(array_filter(
        $collected['records'],
        static fn (array $record): bool => ($record['allowlisted'] ?? false) === true
    ));
    $evidence = DatasetRuntimeEvidenceCollector::validatorEvidence($allowedRecords);
    runtimeEvidenceAssert(
        array_sum(array_column($evidence['user_cards'] ?? [], 'attributedRows')) === 0,
        'Insert/delete card evidence must have a zero net cardinality delta.'
    );

    $counts = array_fill_keys(DatasetResetPolicyV2::knownTables(), 0);
    $counts['auth_sessions'] = 1;
    $counts['auth_refresh_tokens'] = 1;
    $counts['user_statistics'] = 1;
    $preserve = [];
    foreach (DatasetResetPolicyV2::preserveTables() as $table) {
        $preserve[$table] = ['rows' => 0, 'digest' => hash('sha256', $table)];
    }
    $result = DatasetResetStateValidator::evaluatePostResumeSteadyState($counts, $preserve, $preserve, $evidence);
    runtimeEvidenceAssert($result['ok'], 'Allowlisted runtime evidence must satisfy the automatic attribution gate.');

    $unknownEvidence = DatasetRuntimeEvidenceCollector::validatorEvidence($collected['records']);
    $unknownResult = DatasetResetStateValidator::evaluatePostResumeSteadyState(
        $counts,
        $preserve,
        $preserve,
        $unknownEvidence
    );
    runtimeEvidenceAssert(!$unknownResult['ok'], 'Unknown writer/event evidence must fail closed.');
    runtimeEvidenceAssert(
        in_array('UNAUTHORIZED_RUNTIME_EVIDENCE:auth_sessions', $unknownResult['blockers'], true),
        'Unknown writer blocker was not reported.'
    );

    $rawLog = (string) file_get_contents($logPath);
    foreach (['password', 'access_token', 'refresh_token_value', 'card_number', 'cvv'] as $forbidden) {
        runtimeEvidenceAssert(!str_contains($rawLog, $forbidden), 'Runtime evidence contains forbidden secret field: ' . $forbidden);
    }

    fwrite(STDOUT, "RuntimeMutationEvidenceTest: PASS\n");
} finally {
    ini_set('error_log', (string) $previousLog);
    ini_set('log_errors', (string) $previousLogErrors);
    @unlink($logPath);
}
