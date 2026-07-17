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

function assertVpsGate(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assertVpsGateContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function runVpsGate(array $arguments): array
{
    $script = dirname(__DIR__) . '/scripts/tasks/vps_operations_gate.php';
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

function removeVpsGateFixture(string $path): void
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
$script = $base . '/scripts/tasks/vps_operations_gate.php';
$runbook = dirname(__DIR__, 2) . '/docs/PRODUCTION_RELEASE_RUNBOOK.md';

assertVpsGateContains($script, "PHP_SAPI !== 'cli'", 'VPS operations gate must be CLI-only.');
assertVpsGateContains($script, 'production_preflight.php', 'VPS operations gate must run production preflight.');
assertVpsGateContains($script, 'operational_log_maintenance.php', 'VPS operations gate must run log maintenance.');
assertVpsGateContains($script, 'production_log_audit.php', 'VPS operations gate must run production log audit.');
assertVpsGateContains($script, 'operational_log_alerts.php', 'VPS operations gate must run operational log alerts.');
assertVpsGateContains($script, 'backup_restore_rehearsal.php', 'VPS operations gate must run backup restore rehearsal.');
assertVpsGateContains($script, "'require-files' => 'true'", 'VPS operations gate must require operational log files.');
assertVpsGateContains($script, "'fail-on-alert' => 'true'", 'VPS operations gate must fail on critical alerts.');
assertVpsGateContains($script, 'blocked_precheck', 'VPS operations gate must stop before executing unsafe plans.');
assertVpsGateContains($script, 'vpsGateWriteReportIfPrivate', 'VPS operations gate must not write reports to unsafe paths.');

$fixture = sys_get_temp_dir() . '/cm-vps-operations-gate-' . bin2hex(random_bytes(4));
$reportFile = $fixture . '/operations.json';
$publicReportFile = $base . '/api/operations-gate.json';
@mkdir($fixture, 0770, true);
@unlink($publicReportFile);

try {
    $blocked = runVpsGate([
        'profile' => 'production',
        'report-file' => $publicReportFile,
        'dry-run' => 'true',
    ]);

    assertVpsGate($blocked['exit_code'] === 2, 'VPS operations gate must reject public api/ report paths.');
    assertVpsGate(is_array($blocked['payload']), 'Blocked VPS operations gate must return JSON.');
    assertVpsGate(($blocked['payload']['status'] ?? '') === 'blocked_precheck', 'Blocked VPS operations gate must report blocked_precheck.');
    assertVpsGate(!is_file($publicReportFile), 'Blocked VPS operations gate must not write public api/ reports.');

    $planned = runVpsGate([
        'profile' => 'production',
        'report-file' => $reportFile,
        'restore-target-db' => 'concursomestre_restore_test',
        'dry-run' => 'true',
    ]);

    assertVpsGate($planned['exit_code'] === 0, 'VPS operations gate dry-run must succeed. Output: ' . $planned['raw_output']);
    assertVpsGate(is_array($planned['payload']), 'Planned VPS operations gate must return JSON.');
    assertVpsGate(($planned['payload']['status'] ?? '') === 'planned', 'Planned VPS operations gate must report planned status.');
    assertVpsGate(isset($planned['payload']['planned']['production_preflight']), 'Planned gate must include preflight.');
    assertVpsGate(isset($planned['payload']['planned']['operational_log_maintenance']), 'Planned gate must include log maintenance.');
    assertVpsGate(isset($planned['payload']['planned']['production_log_audit']), 'Planned gate must include log audit.');
    assertVpsGate(isset($planned['payload']['planned']['operational_log_alerts']), 'Planned gate must include log alerts.');
    assertVpsGate(isset($planned['payload']['planned']['backup_restore_rehearsal']), 'Planned gate must include restore rehearsal.');
    assertVpsGate(is_file($reportFile), 'Planned VPS operations gate must write evidence report.');
} finally {
    removeVpsGateFixture($fixture);
}

assertVpsGateContains(
    $runbook,
    'vps_operations_gate.php',
    'Production runbook must document the VPS operations gate.'
);

fwrite(STDOUT, "VPS operations gate wiring assertions passed.\n");
