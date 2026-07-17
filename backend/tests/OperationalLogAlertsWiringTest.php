<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

function assertOperationalLogAlerts(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assertOperationalLogAlertsContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function runOperationalLogAlerts(array $arguments): array
{
    $script = dirname(__DIR__) . '/scripts/tasks/operational_log_alerts.php';
    $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($script);
    foreach ($arguments as $name => $value) {
        $command .= ' --' . $name . '=' . escapeshellarg((string) $value);
    }

    $output = [];
    $exitCode = 0;
    exec($command . ' 2>&1', $output, $exitCode);

    $body = trim(implode("\n", $output));
    $payload = json_decode($body, true);

    return [
        'exit_code' => $exitCode,
        'payload' => is_array($payload) ? $payload : null,
        'raw_output' => $body,
    ];
}

function removeOperationalLogAlertsFixture(string $path): void
{
    if (!is_dir($path)) {
        return;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );

    foreach ($iterator as $fileInfo) {
        if ($fileInfo->isDir()) {
            @rmdir($fileInfo->getPathname());
        } else {
            @unlink($fileInfo->getPathname());
        }
    }

    @rmdir($path);
}

$base = dirname(__DIR__) . '';
$script = $base . '/scripts/tasks/operational_log_alerts.php';
$runbook = dirname(__DIR__, 2) . '/docs/PRODUCTION_RELEASE_RUNBOOK.md';

assertOperationalLogAlertsContains(
    $script,
    "PHP_SAPI !== 'cli'",
    'Operational log alerts must be CLI-only.'
);
assertOperationalLogAlertsContains(
    $script,
    'production_log_audit.php',
    'Operational log alerts must reuse the official log audit.'
);
assertOperationalLogAlertsContains(
    $script,
    'LOG_ALERT_DEDUPE_MINUTES',
    'Operational log alerts must support deduplication windows.'
);
assertOperationalLogAlertsContains(
    $script,
    'createAdminNotification',
    'Operational log alerts must support admin notifications.'
);

$fixture = sys_get_temp_dir() . '/cm-log-alerts-' . bin2hex(random_bytes(4));
$logPath = $fixture . '/error.log';
$healthPath = $fixture . '/health.json';
$ledgerPath = $fixture . '/alerts.ndjson';

@mkdir($fixture, 0770, true);
$timestamp = date('D M d H:i:s') . '.000000 ' . date('Y');
$criticalLine = '[' . $timestamp . '] [php:error] [pid 1234:tid 5678] [client ::1:12345] PHP Fatal error: Uncaught Exception: Database connection failed: SQLSTATE[HY000] [2006] MySQL server has gone away in C:\\xampp\\htdocs\\questao-pro-backend\\config\\database.php:37';
file_put_contents($logPath, $criticalLine . PHP_EOL, LOCK_EX);

try {
    $firstRun = runOperationalLogAlerts([
        'files' => $logPath,
        'health-path' => $healthPath,
        'ledger-path' => $ledgerPath,
        'since-minutes' => '60',
        'alert-on' => 'critical',
        'dedupe-minutes' => '360',
        'notify-admins' => 'false',
        'require-files' => 'true',
    ]);
    assertOperationalLogAlerts($firstRun['exit_code'] === 0, 'First alert run must succeed. Output: ' . $firstRun['raw_output']);
    assertOperationalLogAlerts(is_array($firstRun['payload']), 'First alert run must return JSON.');
    assertOperationalLogAlerts(($firstRun['payload']['status'] ?? '') === 'alert', 'First alert run must report alert status.');
    assertOperationalLogAlerts((int) ($firstRun['payload']['alert_count'] ?? 0) === 1, 'First alert run must find one alert.');
    assertOperationalLogAlerts((int) ($firstRun['payload']['new_alert_count'] ?? 0) === 1, 'First alert run must create one new alert.');
    assertOperationalLogAlerts(is_file($healthPath), 'Alert run must write health JSON.');
    assertOperationalLogAlerts(is_file($ledgerPath), 'Alert run must write ledger JSONL.');

    $secondRun = runOperationalLogAlerts([
        'files' => $logPath,
        'health-path' => $healthPath,
        'ledger-path' => $ledgerPath,
        'since-minutes' => '60',
        'alert-on' => 'critical',
        'dedupe-minutes' => '360',
        'notify-admins' => 'false',
        'require-files' => 'true',
    ]);
    assertOperationalLogAlerts($secondRun['exit_code'] === 0, 'Second alert run must succeed. Output: ' . $secondRun['raw_output']);
    assertOperationalLogAlerts((int) ($secondRun['payload']['alert_count'] ?? 0) === 1, 'Second alert run must still detect the active alert.');
    assertOperationalLogAlerts((int) ($secondRun['payload']['new_alert_count'] ?? 0) === 0, 'Second alert run must dedupe already recorded alert.');

    $strictRun = runOperationalLogAlerts([
        'files' => $logPath,
        'health-path' => $healthPath,
        'ledger-path' => $ledgerPath,
        'since-minutes' => '60',
        'alert-on' => 'critical',
        'dedupe-minutes' => '360',
        'notify-admins' => 'false',
        'require-files' => 'true',
        'fail-on-alert' => 'true',
    ]);
    assertOperationalLogAlerts($strictRun['exit_code'] === 2, 'Strict alert run must fail when an active critical alert exists.');
} finally {
    removeOperationalLogAlertsFixture($fixture);
}

assertOperationalLogAlertsContains(
    $runbook,
    'operational_log_alerts.php',
    'Production runbook must document operational log alerts cron.'
);

fwrite(STDOUT, "Operational log alerts wiring assertions passed.\n");
