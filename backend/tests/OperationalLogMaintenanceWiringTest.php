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

function assertOperationalLogMaintenance(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assertOperationalLogMaintenanceContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function runOperationalLogMaintenance(array $arguments): array
{
    $script = 'C:/xampp/htdocs/questao-pro-backend/scripts/tasks/operational_log_maintenance.php';
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

function removeOperationalLogMaintenanceFixture(string $path): void
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

$base = 'C:/xampp/htdocs/questao-pro-backend';
$script = $base . '/scripts/tasks/operational_log_maintenance.php';
$runbook = 'C:/dev/concursomestre/docs/PRODUCTION_RELEASE_RUNBOOK.md';

assertOperationalLogMaintenanceContains(
    $script,
    "PHP_SAPI !== 'cli'",
    'Operational log maintenance must be CLI-only.'
);
assertOperationalLogMaintenanceContains(
    $script,
    'LOG_MAINTENANCE_FILES',
    'Operational log maintenance must support configurable files.'
);
assertOperationalLogMaintenanceContains(
    $script,
    'LOG_ROTATE_MAX_BYTES',
    'Operational log maintenance must support configurable rotation threshold.'
);
assertOperationalLogMaintenanceContains(
    $script,
    'LOG_RETENTION_DAYS',
    'Operational log maintenance must support retention cleanup.'
);
assertOperationalLogMaintenanceContains(
    $script,
    'LOG_MAINTENANCE_HEALTH_PATH',
    'Operational log maintenance must write a health heartbeat.'
);
assertOperationalLogMaintenance(
    strpos((string) file_get_contents($script), '/api') !== false,
    'Operational log maintenance must explicitly guard against logs inside public api/.'
);

$fixture = sys_get_temp_dir() . '/cm-log-maintenance-' . bin2hex(random_bytes(4));
$archiveDir = $fixture . '/archive';
$healthPath = $fixture . '/health.json';
$logPath = $fixture . '/app.log';

@mkdir($fixture, 0770, true);
@mkdir($archiveDir, 0770, true);
file_put_contents($logPath, str_repeat('A', 2048), LOCK_EX);
$oldArchive = $archiveDir . '/app.log.20200101-000000.rotated.log';
file_put_contents($oldArchive, 'old archive', LOCK_EX);
touch($oldArchive, time() - (40 * 86400));

try {
    $dryRun = runOperationalLogMaintenance([
        'files' => $logPath,
        'archive-dir' => $archiveDir,
        'health-path' => $healthPath,
        'rotate-max-bytes' => '1024',
        'retention-days' => '14',
        'require-files' => 'true',
        'dry-run' => 'true',
    ]);
    assertOperationalLogMaintenance($dryRun['exit_code'] === 0, 'Dry-run maintenance must succeed. Output: ' . $dryRun['raw_output']);
    assertOperationalLogMaintenance(filesize($logPath) === 2048, 'Dry-run must not truncate the source log.');
    assertOperationalLogMaintenance(is_file($oldArchive), 'Dry-run must not remove old archives.');

    $run = runOperationalLogMaintenance([
        'files' => $logPath,
        'archive-dir' => $archiveDir,
        'health-path' => $healthPath,
        'rotate-max-bytes' => '1024',
        'retention-days' => '14',
        'require-files' => 'true',
    ]);
    assertOperationalLogMaintenance($run['exit_code'] === 0, 'Maintenance must succeed. Output: ' . $run['raw_output']);
    assertOperationalLogMaintenance(is_array($run['payload']) && !empty($run['payload']['success']), 'Maintenance must return success JSON.');
    assertOperationalLogMaintenance((int) ($run['payload']['rotated_count'] ?? 0) === 1, 'Maintenance must rotate oversized logs.');
    assertOperationalLogMaintenance(filesize($logPath) === 0, 'Maintenance must truncate rotated source log.');
    assertOperationalLogMaintenance(!is_file($oldArchive), 'Maintenance must remove archives older than retention.');
    assertOperationalLogMaintenance(is_file($healthPath), 'Maintenance must write health JSON.');

    $archiveFiles = glob($archiveDir . '/*.rotated.log') ?: [];
    assertOperationalLogMaintenance(count($archiveFiles) === 1, 'Maintenance must create exactly one new rotated archive.');
    assertOperationalLogMaintenance(filesize($archiveFiles[0]) === 2048, 'Rotated archive must preserve the source content.');

    $health = json_decode((string) file_get_contents($healthPath), true);
    assertOperationalLogMaintenance(is_array($health) && ($health['task'] ?? '') === 'operational_log_maintenance', 'Health JSON must identify the task.');
    assertOperationalLogMaintenance(($health['status'] ?? '') === 'ok', 'Health JSON must report ok status after success.');
} finally {
    removeOperationalLogMaintenanceFixture($fixture);
}

assertOperationalLogMaintenanceContains(
    $runbook,
    'operational_log_maintenance.php',
    'Production runbook must document operational log maintenance cron.'
);

fwrite(STDOUT, "Operational log maintenance wiring assertions passed.\n");
