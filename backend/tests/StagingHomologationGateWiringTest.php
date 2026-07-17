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

function assertHomologationGate(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assertHomologationGateContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function runHomologationGate(array $arguments): array
{
    $script = dirname(__DIR__) . '/scripts/tasks/staging_homologation_gate.php';
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

function removeHomologationGateFixture(string $path): void
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
$script = $base . '/scripts/tasks/staging_homologation_gate.php';
$runbook = dirname(__DIR__, 2) . '/docs/PRODUCTION_RELEASE_RUNBOOK.md';

assertHomologationGateContains($script, "PHP_SAPI !== 'cli'", 'Homologation gate must be CLI-only.');
assertHomologationGateContains($script, 'production_readiness_suite.php', 'Homologation gate must run the readiness suite.');
assertHomologationGateContains($script, 'operational_log_alerts.php', 'Homologation gate must run operational log alerts.');
assertHomologationGateContains($script, "'auth-required' => 'true'", 'Homologation gate must force authenticated smoke.');
assertHomologationGateContains($script, "'admin-required' => 'true'", 'Homologation gate must force admin smoke.');
assertHomologationGateContains($script, "'with-backup-rehearsal' => 'true'", 'Homologation gate must force backup restore rehearsal.');
assertHomologationGateContains($script, 'homologationValidatePublicHttpsUrl', 'Homologation gate must reject non-public HTTPS URLs.');
assertHomologationGateContains($script, 'blocked_precheck', 'Homologation gate must stop before network calls when prechecks fail.');
assertHomologationGateContains($script, 'homologationWriteReportIfPrivate', 'Homologation gate must not write reports to unsafe paths.');

$fixture = sys_get_temp_dir() . '/cm-homologation-gate-' . bin2hex(random_bytes(4));
$reportFile = $fixture . '/homologation.json';
$suiteReportFile = $fixture . '/suite.json';
@mkdir($fixture, 0770, true);

try {
    $blocked = runHomologationGate([
        'profile' => 'staging',
        'api-base-url' => 'http://localhost/questao-pro-backend/api',
        'web-base-url' => 'http://localhost:3000',
        'report-file' => $reportFile,
        'suite-report-file' => $suiteReportFile,
        'dry-run' => 'true',
    ]);

    assertHomologationGate($blocked['exit_code'] === 2, 'Homologation gate must reject local HTTP staging URLs.');
    assertHomologationGate(is_array($blocked['payload']), 'Blocked homologation gate must return JSON.');
    assertHomologationGate(($blocked['payload']['status'] ?? '') === 'blocked_precheck', 'Blocked homologation gate must report blocked_precheck.');
    assertHomologationGate(is_file($reportFile), 'Blocked homologation gate must write evidence report.');

    @unlink($reportFile);
    $planned = runHomologationGate([
        'profile' => 'staging',
        'api-base-url' => 'https://api.staging.concursomestre.example/api',
        'web-base-url' => 'https://app.staging.concursomestre.example',
        'report-file' => $reportFile,
        'suite-report-file' => $suiteReportFile,
        'dry-run' => 'true',
    ]);

    assertHomologationGate($planned['exit_code'] === 0, 'Homologation gate dry-run with HTTPS URLs must succeed. Output: ' . $planned['raw_output']);
    assertHomologationGate(is_array($planned['payload']), 'Planned homologation gate must return JSON.');
    assertHomologationGate(($planned['payload']['status'] ?? '') === 'planned', 'Planned homologation gate must report planned status.');
    assertHomologationGate(($planned['payload']['planned']['readiness_suite']['arguments']['with-backup-rehearsal'] ?? '') === 'true', 'Planned suite must include backup rehearsal.');
    assertHomologationGate(($planned['payload']['planned']['readiness_suite']['arguments']['auth-required'] ?? '') === 'true', 'Planned suite must require auth.');
    assertHomologationGate(($planned['payload']['planned']['readiness_suite']['arguments']['admin-required'] ?? '') === 'true', 'Planned suite must require admin.');
    assertHomologationGate(is_file($reportFile), 'Planned homologation gate must write evidence report.');
} finally {
    removeHomologationGateFixture($fixture);
}

assertHomologationGateContains(
    $runbook,
    'staging_homologation_gate.php',
    'Production runbook must document the staging homologation gate.'
);

fwrite(STDOUT, "Staging homologation gate wiring assertions passed.\n");
