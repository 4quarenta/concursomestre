<?php

declare(strict_types=1);

function b13xRunnerAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$runner = (string) file_get_contents(__DIR__ . '/../scripts/data/b13x_coverage_runner.php');
$availability = (string) file_get_contents(__DIR__ . '/../scripts/data/DatasetAvailabilitySafeFreezeState.php');
$coverageState = (string) file_get_contents(__DIR__ . '/../scripts/data/DatasetWriterCoverageState.php');
$resumeScript = (string) file_get_contents(__DIR__ . '/../scripts/data/b13x_coverage_resume.sh');
$rollbackScript = (string) file_get_contents(__DIR__ . '/../scripts/data/b13x_coverage_rollback.sh');
$reconciliation = (string) file_get_contents(__DIR__ . '/../scripts/tasks/reconcile_stripe_subscriptions.php');
$webhookConsumer = (string) file_get_contents(__DIR__ . '/../scripts/tasks/process_stripe_webhook_jobs.php');
$cardExpiry = (string) file_get_contents(__DIR__ . '/../scripts/tasks/check_subscription_card_expiry.php');
$referrals = (string) file_get_contents(__DIR__ . '/../scripts/tasks/process_referral_rewards.php');
$operationalAlerts = (string) file_get_contents(__DIR__ . '/../scripts/tasks/operational_log_alerts.php');

foreach ([
    'inventory',
    'preflight',
    'dry-run',
    'resume',
    'run-writer',
    'run-all',
    'verify',
    'cleanup-synthetic',
    'finalize',
    'rollback',
    'SUPERSEDED',
    'REMAINS_AUTHORITATIVE',
    'capture_write_sentinel.php',
    'STRICT_NOT_ZERO',
    'unexpectedStrictDiffs',
    'systemd-state-file',
    'systemd-key-file',
    'Systemd state must be RESUMED',
] as $required) {
    b13xRunnerAssert(str_contains($runner, $required), 'Coverage runner contract missing: ' . $required);
}

b13xRunnerAssert(str_contains($availability, 'AVAILABILITY_SAFE_FREEZE_V1'), 'Availability-safe helper must validate the canonical state schema.');
b13xRunnerAssert(str_contains($availability, 'SUPERSEDED_BY_METHOD_CHANGE'), 'Availability-safe helper must support canonical methodology supersession.');
b13xRunnerAssert(str_contains($coverageState, 'B13X_COVERAGE_STATE_V1'), 'Coverage state helper schema version drifted.');
b13xRunnerAssert(str_contains($coverageState, 'markSupersededRun'), 'Coverage state must expose an explicit supersession transition.');
b13xRunnerAssert(str_contains($resumeScript, 'manage_writer_systemd_freeze.php'), 'Coverage resume must delegate the systemd portion to the canonical freeze manager.');
b13xRunnerAssert(str_contains($resumeScript, 'systemd-freeze.key'), 'Coverage resume must use the systemd freeze signing key for systemd state.');
b13xRunnerAssert(str_contains($resumeScript, 'DATASET_WRITER_FREEZE_OPERATION_ALLOWED=1'), 'Coverage resume must set the explicit operation guard for the canonical manager.');
b13xRunnerAssert(str_contains($resumeScript, 'DATASET_WRITER_FREEZE_PRODUCTION_ALLOWED=1'), 'Coverage resume must set the explicit production guard for the canonical manager.');
b13xRunnerAssert(str_contains($resumeScript, 'cm-phase13x-strict-window1-monitor.timer'), 'Coverage resume must retire the old time-based window monitors.');
b13xRunnerAssert(!str_contains($resumeScript, 'second-window'), 'Coverage resume must not start a second time-based observation window.');
b13xRunnerAssert(str_contains($rollbackScript, '--mode=freeze'), 'Coverage rollback must restore a canonical frozen state through the freeze manager.');

foreach ([$reconciliation, $webhookConsumer, $cardExpiry, $referrals, $operationalAlerts] as $script) {
    b13xRunnerAssert(str_contains($script, 'coverage-noop'), 'Mutating writer entrypoint must expose a reviewed coverage-noop path.');
}

fwrite(STDOUT, "B13X coverage runner wiring assertions passed.\n");
