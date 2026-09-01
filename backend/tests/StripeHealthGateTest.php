<?php

declare(strict_types=1);

if (!function_exists('getEnvString')) {
    function getEnvString(string $key, string $fallback = ''): string
    {
        $value = $_ENV[$key] ?? getenv($key);
        return $value === false || $value === null || trim((string) $value) === ''
            ? $fallback
            : trim((string) $value);
    }
}

require_once __DIR__ . '/../config/StripeHealthGate.php';
require_once __DIR__ . '/../config/production_preflight.php';

function stripeHealthAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function stripeHealthEnv(array $values): void
{
    foreach ($values as $key => $value) {
        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
    }
}

$stateDirectory = sys_get_temp_dir() . '/concursomestre-stripe-health-' . bin2hex(random_bytes(6));
mkdir($stateDirectory, 0700, true);
$statePath = $stateDirectory . '/freeze-state.json';
$keyPath = $stateDirectory . '/freeze.key';
$key = str_repeat('stripe-health-test-key-', 2);
file_put_contents($keyPath, $key, LOCK_EX);

$frozenState = DatasetAvailabilitySafeFreezeState::sign([
    'createdAt' => gmdate(DATE_ATOM),
    'deadlineEpoch' => time() + 3600,
    'frozenUnits' => ['cron.service'],
    'httpWriteBoundary' => [
        'allowedMethods' => ['GET', 'HEAD', 'OPTIONS'],
        'path' => '/run/concursomestre/http-freeze.conf',
        'sha256' => str_repeat('a', 64),
    ],
    'phase' => 'frozen',
    'publicServingUnits' => ['nginx.service'],
    'runId' => 'phase13x-stripe-health-test',
    'startEpoch' => time() - 60,
    'status' => 'FROZEN',
], $key);
file_put_contents($statePath, json_encode($frozenState, JSON_THROW_ON_ERROR), LOCK_EX);

stripeHealthEnv([
    'B13X_STRIPE_HEALTH_FREEZE_EXPECTED' => 'true',
    'B13X_AVAILABILITY_SAFE_FREEZE_STATE_FILE' => $statePath,
    'B13X_AVAILABILITY_SAFE_FREEZE_KEY_FILE' => $keyPath,
    'B13X_AVAILABILITY_SAFE_FREEZE_RUN_ID' => 'phase13x-stripe-health-test',
]);
$freezeContext = StripeHealthGate::expectedFreezeFromEnvironment();
stripeHealthAssert(StripeHealthGate::isExpectedFreezeValid($freezeContext), 'A valid signed B13X freeze must be accepted.');

$staleCron = buildStripeCronHealthPreflightCheck(
    sys_get_temp_dir() . '/missing-cron-health-' . bin2hex(random_bytes(4)) . '.json',
    30,
    true,
    $freezeContext
);
stripeHealthAssert(($staleCron['classification'] ?? '') === 'EXPECTED_FROZEN', 'An authorized frozen scheduler must not be reported as normally healthy.');

$tampered = $frozenState;
$tampered['frozenUnits'] = ['unexpected.service'];
file_put_contents($statePath, json_encode($tampered, JSON_THROW_ON_ERROR), LOCK_EX);
$invalidContext = StripeHealthGate::expectedFreezeFromEnvironment();
stripeHealthAssert(!StripeHealthGate::isExpectedFreezeValid($invalidContext), 'A tampered or non-allowlisted freeze must fail closed.');

$webhookPath = sys_get_temp_dir() . '/missing-webhook-health-' . bin2hex(random_bytes(4)) . '.json';
$idle = buildStripeWebhookHealthPreflightCheck($webhookPath, 1440, true, false, true);
stripeHealthAssert(($idle['classification'] ?? '') === 'HEALTHY_IDLE', 'Configured webhook health without activity must be healthy idle.');

$staleWebhookPath = sys_get_temp_dir() . '/stale-webhook-health-' . bin2hex(random_bytes(4)) . '.json';
file_put_contents($staleWebhookPath, json_encode([
    'last_event_at' => gmdate(DATE_ATOM, time() - 172800),
    'status' => 'processed',
], JSON_THROW_ON_ERROR), LOCK_EX);
$staleIdle = buildStripeWebhookHealthPreflightCheck($staleWebhookPath, 1440, true, false, true);
stripeHealthAssert(($staleIdle['classification'] ?? '') === 'HEALTHY_IDLE', 'Stale activity must remain healthy idle when endpoint configuration is valid.');

$recentPath = sys_get_temp_dir() . '/recent-webhook-health-' . bin2hex(random_bytes(4)) . '.json';
file_put_contents($recentPath, json_encode([
    'last_event_at' => gmdate(DATE_ATOM),
    'status' => 'processed',
], JSON_THROW_ON_ERROR), LOCK_EX);
$active = buildStripeWebhookHealthPreflightCheck($recentPath, 1440, true, false, true);
stripeHealthAssert(($active['classification'] ?? '') === 'HEALTHY_ACTIVE', 'A recent valid webhook event must be healthy active.');

$unauthorizedFreeze = buildStripeCronHealthPreflightCheck(
    sys_get_temp_dir() . '/missing-cron-health-' . bin2hex(random_bytes(4)) . '.json',
    30,
    true,
    ['expected' => true, 'valid' => false, 'blockers' => ['B13X_FREEZE_NOT_ACTIVE']]
);
stripeHealthAssert(($unauthorizedFreeze['status'] ?? '') === 'fail', 'An invalid expected freeze must fail closed.');

@unlink($statePath);
@unlink($keyPath);
@unlink($recentPath);
@unlink($staleWebhookPath);
@rmdir($stateDirectory);

echo "Stripe health gate tests passed.\n";
