<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cron_lock.php';
require_once __DIR__ . '/../../modules/users/services/UnverifiedAccountCleanupService.php';

function cleanupOption(string $name, ?string $fallback = null): ?string
{
    global $argv;
    foreach ($argv as $argument) {
        if (strpos($argument, '--' . $name . '=') === 0) {
            return substr($argument, strlen($name) + 3);
        }
    }
    return $fallback;
}

$execute = strtolower((string) cleanupOption('execute', '')) === 'unverified_account_cleanup';
$mode = $execute ? 'execute' : 'dry-run';

try {
    $lock = acquireCronLockOrThrow('cleanup_unverified_accounts', 1800);
    $database = new Database();
    $service = new UnverifiedAccountCleanupService($database->getConnection());
    $result = $service->run([
        'mode' => $mode,
        'execute_token' => $execute ? 'UNVERIFIED_ACCOUNT_CLEANUP' : '',
        'limit' => (int) cleanupOption('limit', '100'),
    ]);
    $lock->release();
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $exception) {
    if (isset($lock) && $lock instanceof CronLockHandle) {
        $lock->release();
    }
    fwrite(STDERR, json_encode([
        'success' => false,
        'message' => $exception->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
}
