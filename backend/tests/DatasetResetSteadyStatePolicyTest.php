<?php

declare(strict_types=1);

require_once __DIR__ . '/../scripts/data/DatasetResetStateValidator.php';

function steadyStateAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$counts = array_fill_keys(DatasetResetPolicyV2::knownTables(), 0);
$counts['users'] = 6;
$preserve = [];
foreach (DatasetResetPolicyV2::preserveTables() as $table) {
    $preserve[$table] = ['rows' => $table === 'users' ? 6 : 0, 'digest' => 'digest-' . $table];
}

$completion = DatasetResetStateValidator::evaluateResetCompletion($counts, $preserve, $preserve);
steadyStateAssert($completion['ok'], 'All resettable tables at zero must pass reset completion.');
steadyStateAssert($completion['gate'] === 'RESET_COMPLETION_GATE', 'Completion gate identity drifted.');

$runtimeResidue = $counts;
$runtimeResidue['auth_sessions'] = 1;
$completionWithRuntime = DatasetResetStateValidator::evaluateResetCompletion($runtimeResidue, $preserve, $preserve);
steadyStateAssert(!$completionWithRuntime['ok'], 'Runtime tables must still be zero at reset completion.');
steadyStateAssert(
    in_array('RESET_COMPLETION_RUNTIME_RESIDUE', $completionWithRuntime['blockers'], true),
    'Completion must expose runtime residue.'
);

$strictResidue = $counts;
$strictResidue['questions'] = 1;
$completionWithStrict = DatasetResetStateValidator::evaluateResetCompletion($strictResidue, $preserve, $preserve);
steadyStateAssert(!$completionWithStrict['ok'], 'Strict tables must be zero at reset completion.');

$steadyCounts = $counts;
$steadyCounts['auth_refresh_tokens'] = 2;
$steadyCounts['auth_sessions'] = 1;
$steadyCounts['user_cards'] = 1;
$steadyCounts['user_statistics'] = 1;
$evidence = [
    'auth_refresh_tokens' => [
        ['writerId' => 'http-auth-account', 'event' => 'auth_login', 'attributedRows' => 1],
        ['writerId' => 'http-auth-account', 'event' => 'auth_token_refresh', 'attributedRows' => 1],
    ],
    'auth_sessions' => [
        ['writerId' => 'http-auth-account', 'event' => 'auth_login', 'attributedRows' => 1],
    ],
    'user_cards' => [
        ['writerId' => 'http-auth-account', 'event' => 'profile_billing_card_sync', 'attributedRows' => 1],
    ],
    'user_statistics' => [
        ['writerId' => 'http-practice-user-activity', 'event' => 'statistics_study_session_recorded', 'attributedRows' => 1],
    ],
];

$steady = DatasetResetStateValidator::evaluatePostResumeSteadyState($steadyCounts, $preserve, $preserve, $evidence);
steadyStateAssert($steady['ok'], 'Forensically attributed runtime rows must pass steady state.');
steadyStateAssert($steady['gate'] === 'POST_RESUME_STEADY_STATE_GATE', 'Steady-state gate identity drifted.');

$arbitraryCardinality = $steadyCounts;
$arbitraryCardinality['auth_refresh_tokens'] = 17;
$arbitraryEvidence = $evidence;
$arbitraryEvidence['auth_refresh_tokens'][1]['attributedRows'] = 16;
steadyStateAssert(
    DatasetResetStateValidator::evaluatePostResumeSteadyState(
        $arbitraryCardinality,
        $preserve,
        $preserve,
        $arbitraryEvidence
    )['ok'],
    'Steady state must validate attribution, not hardcoded 2/1/1/1 counts.'
);

$unknownWriterEvidence = $evidence;
$unknownWriterEvidence['auth_sessions'][0]['writerId'] = 'unknown-writer';
$unknownWriter = DatasetResetStateValidator::evaluatePostResumeSteadyState(
    $steadyCounts,
    $preserve,
    $preserve,
    $unknownWriterEvidence
);
steadyStateAssert(!$unknownWriter['ok'], 'Unknown runtime writer must fail closed.');
steadyStateAssert(
    in_array('UNAUTHORIZED_RUNTIME_EVIDENCE:auth_sessions', $unknownWriter['blockers'], true),
    'Unknown runtime writer blocker is missing.'
);

$wrongEventEvidence = $evidence;
$wrongEventEvidence['user_cards'][0]['event'] = 'test_billing_backfill';
steadyStateAssert(
    !DatasetResetStateValidator::evaluatePostResumeSteadyState(
        $steadyCounts,
        $preserve,
        $preserve,
        $wrongEventEvidence
    )['ok'],
    'Unallowlisted runtime event must fail closed.'
);

$missingAttribution = $evidence;
unset($missingAttribution['user_statistics']);
$missingResult = DatasetResetStateValidator::evaluatePostResumeSteadyState(
    $steadyCounts,
    $preserve,
    $preserve,
    $missingAttribution
);
steadyStateAssert(
    in_array('UNATTRIBUTED_RUNTIME_ROWS:user_statistics', $missingResult['blockers'], true),
    'Every runtime row must be attributed.'
);

$strictSteady = $steadyCounts;
$strictSteady['transactions'] = 1;
$strictResult = DatasetResetStateValidator::evaluatePostResumeSteadyState(
    $strictSteady,
    $preserve,
    $preserve,
    $evidence
);
steadyStateAssert(!$strictResult['ok'], 'Strict billing history must not repopulate silently.');
steadyStateAssert(
    in_array('POST_RESUME_STRICT_REPOPULATION', $strictResult['blockers'], true),
    'Strict repopulation blocker is missing.'
);

$changedPreserve = $preserve;
$changedPreserve['users']['digest'] = 'changed';
steadyStateAssert(
    !DatasetResetStateValidator::evaluatePostResumeSteadyState(
        $steadyCounts,
        $preserve,
        $changedPreserve,
        $evidence
    )['ok'],
    'Preserve mismatch must fail in steady state.'
);

steadyStateAssert(
    DatasetResetPolicyV2::isRuntimeEvidenceAllowed('user_cards', 'http-auth-account', 'profile_billing_card_sync'),
    'Known profile billing sync must be allowlisted.'
);
steadyStateAssert(
    !DatasetResetPolicyV2::isRuntimeEvidenceAllowed('user_cards', 'manual-backfills-migrations-reset', 'backfill'),
    'Manual maintenance must not be allowlisted after resume.'
);

fwrite(STDOUT, "RESET_POLICY_V2 steady-state assertions passed.\n");
