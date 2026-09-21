<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cron_lock.php';
require_once __DIR__ . '/../../modules/marketing_automation/services/MarketingAutomationService.php';

function marketingAutomationCliOption(string $name, ?string $fallback = null): ?string
{
    global $argv;

    foreach ($argv as $argument) {
        if (strpos($argument, '--' . $name . '=') === 0) {
            return substr($argument, strlen($name) + 3);
        }
    }

    return $fallback;
}

function marketingAutomationBoolOption(string $name, bool $fallback): bool
{
    $value = marketingAutomationCliOption($name);
    if ($value === null) {
        return $fallback;
    }

    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

$executeToken = (string) marketingAutomationCliOption('execute', '');
$dryRun = marketingAutomationBoolOption('dry-run', $executeToken !== 'PROCESS_MARKETING_AUTOMATIONS');
$limit = max(1, min(500, (int) marketingAutomationCliOption('limit', '100')));
$campaignId = trim((string) marketingAutomationCliOption('campaign-id', ''));
$afterUserId = trim((string) marketingAutomationCliOption('after-user-id', ''));

try {
    $lock = acquireCronLockOrThrow('marketing_automations', 1800);
    $database = new Database();
    $db = $database->getConnection();
    $service = new MarketingAutomationService(new MarketingAutomationRepository($db));
    $result = $service->run([
        'dry_run' => $dryRun,
        'limit' => $limit,
        'campaign_id' => $campaignId,
        'after_user_id' => $afterUserId,
    ]);
    $lock->release();

    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(($result['summary']['failed'] ?? 0) > 0 ? 2 : 0);
} catch (Throwable $e) {
    if (isset($lock) && $lock instanceof CronLockHandle) {
        $lock->release();
    }

    fwrite(STDERR, json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
}
