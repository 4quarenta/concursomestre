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

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/env.php';

function vpsGateCliOption(string $name, ?string $fallback = null): ?string
{
    global $argv;

    foreach ($argv as $argument) {
        if (strpos($argument, '--' . $name . '=') === 0) {
            return substr($argument, strlen($name) + 3);
        }
    }

    return $fallback;
}

function vpsGateBoolOption(string $name, bool $fallback): bool
{
    $value = vpsGateCliOption($name);
    if ($value === null) {
        return $fallback;
    }

    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

function vpsGateNormalizePath(?string $path): string
{
    return rtrim(str_replace('\\', '/', trim((string) $path)), '/');
}

function vpsGateStoragePath(string $relativePath): string
{
    return vpsGateNormalizePath(dirname(__DIR__, 2) . '/storage/logs/readiness/' . ltrim($relativePath, '/'));
}

function vpsGateEnsureDirectory(string $path): void
{
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
        throw new RuntimeException('Nao foi possivel criar o diretorio do relatorio: ' . $directory);
    }
}

function vpsGateWriteReport(string $path, array $payload): void
{
    if ($path === '') {
        return;
    }

    vpsGateEnsureDirectory($path);
    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($path, $json . PHP_EOL, LOCK_EX) === false) {
        throw new RuntimeException('Nao foi possivel gravar o relatorio operacional: ' . $path);
    }
}

function vpsGateCanWritePrivateReport(array $prechecks): bool
{
    foreach ($prechecks as $check) {
        if (($check['name'] ?? '') === 'report-file') {
            return !empty($check['ok']);
        }
    }

    return false;
}

function vpsGateWriteReportIfPrivate(string $path, array $payload, array $prechecks): void
{
    if (!vpsGateCanWritePrivateReport($prechecks)) {
        return;
    }

    vpsGateWriteReport($path, $payload);
}

function vpsGateScriptPath(string $name): string
{
    return vpsGateNormalizePath(__DIR__ . '/' . $name);
}

function vpsGateValidatePrivateReportPath(string $name, string $path): array
{
    $normalized = vpsGateNormalizePath($path);
    if ($normalized === '') {
        return [
            'ok' => false,
            'name' => $name,
            'message' => $name . ' nao foi informado.',
        ];
    }

    if (preg_match('#/api(/|$)#i', $normalized)) {
        return [
            'ok' => false,
            'name' => $name,
            'message' => $name . ' nao pode ficar dentro da pasta publica api/.',
            'path' => $normalized,
        ];
    }

    return [
        'ok' => true,
        'name' => $name,
        'message' => $name . ' aponta para caminho privado.',
        'path' => $normalized,
    ];
}

function vpsGateRunPhpScript(string $phpBinary, string $scriptPath, array $arguments = []): array
{
    $command = escapeshellarg($phpBinary) . ' ' . escapeshellarg($scriptPath);
    foreach ($arguments as $name => $value) {
        if ($value === null) {
            continue;
        }

        $command .= ' --' . $name . '=' . escapeshellarg((string) $value);
    }

    $output = [];
    $exitCode = 0;
    $startedAt = microtime(true);
    exec($command . ' 2>&1', $output, $exitCode);
    $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
    $body = trim(implode("\n", $output));
    $payload = json_decode($body, true);

    return [
        'ok' => $exitCode === 0 && is_array($payload) && !empty($payload['success']),
        'exit_code' => $exitCode,
        'duration_ms' => $durationMs,
        'json_ok' => is_array($payload),
        'payload' => is_array($payload) ? $payload : null,
        'raw_output' => is_array($payload) ? null : $body,
    ];
}

function vpsGateBuildPlan(array $context): array
{
    $logArguments = [
        'since-minutes' => $context['log_since_minutes'],
        'fail-on' => 'critical',
        'require-files' => 'true',
    ];

    return [
        'production_preflight' => [
            'script' => vpsGateScriptPath('production_preflight.php'),
            'arguments' => [],
        ],
        'operational_log_maintenance' => [
            'script' => vpsGateScriptPath('operational_log_maintenance.php'),
            'arguments' => [
                'dry-run' => $context['dry_run_maintenance'] ? 'true' : 'false',
                'require-files' => 'true',
            ],
        ],
        'production_log_audit' => [
            'script' => vpsGateScriptPath('production_log_audit.php'),
            'arguments' => $logArguments,
        ],
        'operational_log_alerts' => [
            'script' => vpsGateScriptPath('operational_log_alerts.php'),
            'arguments' => [
                'since-minutes' => $context['log_since_minutes'],
                'alert-on' => 'critical',
                'require-files' => 'true',
                'fail-on-alert' => 'true',
                'notify-admins' => $context['notify_admins'] ? 'true' : 'false',
            ],
        ],
        'backup_restore_rehearsal' => [
            'script' => vpsGateScriptPath('backup_restore_rehearsal.php'),
            'arguments' => [
                'target-db' => $context['restore_target_db'],
                'php' => $context['php'],
            ],
        ],
    ];
}

try {
    $profile = strtolower((string) vpsGateCliOption('profile', getEnvString('OPERATIONS_PROFILE', 'production')));
    if (!in_array($profile, ['staging', 'production'], true)) {
        throw new RuntimeException('Perfil invalido para o gate operacional. Use staging ou production.');
    }

    $dryRun = vpsGateBoolOption('dry-run', false);
    $phpBinary = vpsGateNormalizePath(vpsGateCliOption('php', PHP_BINARY));
    if ($phpBinary === '') {
        throw new RuntimeException('PHP binary nao encontrado para o gate operacional.');
    }

    $logSinceMinutes = max(1, min(1440, (int) vpsGateCliOption('log-since-minutes', getEnvString('LOG_AUDIT_SINCE_MINUTES', '60'))));
    $restoreTargetDb = trim((string) vpsGateCliOption('restore-target-db', getEnvString('RESTORE_TARGET_DB', 'concursomestre_restore_test')));
    if ($restoreTargetDb === '') {
        throw new RuntimeException('RESTORE_TARGET_DB nao configurado para o gate operacional.');
    }

    $notifyAdmins = vpsGateBoolOption('notify-admins', filter_var(getEnvString('LOG_ALERT_NOTIFY_ADMINS', 'false'), FILTER_VALIDATE_BOOLEAN));
    $dryRunMaintenance = vpsGateBoolOption('dry-run-maintenance', false);
    $reportFile = vpsGateNormalizePath(vpsGateCliOption(
        'report-file',
        getEnvString('OPERATIONS_GATE_REPORT_FILE', vpsGateStoragePath($profile . '_operations_gate_latest.json'))
    ));

    $context = [
        'profile' => $profile,
        'php' => $phpBinary,
        'log_since_minutes' => $logSinceMinutes,
        'restore_target_db' => $restoreTargetDb,
        'notify_admins' => $notifyAdmins,
        'dry_run_maintenance' => $dryRunMaintenance,
    ];

    $prechecks = [
        vpsGateValidatePrivateReportPath('report-file', $reportFile),
    ];
    $failedPrechecks = array_values(array_filter($prechecks, static fn (array $check): bool => empty($check['ok'])));
    $plan = vpsGateBuildPlan($context);

    if ($failedPrechecks) {
        $payload = [
            'success' => false,
            'status' => 'blocked_precheck',
            'profile' => $profile,
            'dry_run' => $dryRun,
            'prechecks' => $prechecks,
            'planned' => $plan,
            'checked_at' => gmdate(DATE_ATOM),
        ];
        vpsGateWriteReportIfPrivate($reportFile, $payload, $prechecks);
        fwrite(STDERR, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
        exit(2);
    }

    if ($dryRun) {
        $payload = [
            'success' => true,
            'status' => 'planned',
            'profile' => $profile,
            'dry_run' => true,
            'prechecks' => $prechecks,
            'planned' => $plan,
            'checked_at' => gmdate(DATE_ATOM),
        ];
        vpsGateWriteReport($reportFile, $payload);
        echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
        exit(0);
    }

    $steps = [];
    foreach ($plan as $name => $step) {
        $steps[] = [
            'name' => $name,
            'required' => true,
            'result' => vpsGateRunPhpScript($phpBinary, $step['script'], $step['arguments']),
        ];
    }

    $failed = array_values(array_filter($steps, static fn (array $step): bool => empty($step['result']['ok'])));
    $payload = [
        'success' => count($failed) === 0,
        'status' => count($failed) === 0 ? 'operations_ready' : 'blocked',
        'profile' => $profile,
        'dry_run' => false,
        'prechecks' => $prechecks,
        'summary' => [
            'total_steps' => count($steps),
            'failed' => count($failed),
        ],
        'steps' => $steps,
        'checked_at' => gmdate(DATE_ATOM),
    ];

    vpsGateWriteReport($reportFile, $payload);
    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($payload['success']) {
        echo $json . PHP_EOL;
        exit(0);
    }

    fwrite(STDERR, $json . PHP_EOL);
    exit(2);
} catch (Throwable $e) {
    $payload = [
        'success' => false,
        'status' => 'error',
        'message' => $e->getMessage(),
        'checked_at' => gmdate(DATE_ATOM),
    ];

    $reportFile = vpsGateNormalizePath(vpsGateCliOption(
        'report-file',
        getEnvString('OPERATIONS_GATE_REPORT_FILE', vpsGateStoragePath('production_operations_gate_latest.json'))
    ));

    $reportPrechecks = [
        vpsGateValidatePrivateReportPath('report-file', $reportFile),
    ];

    if (vpsGateCanWritePrivateReport($reportPrechecks)) {
        try {
            vpsGateWriteReport($reportFile, $payload);
        } catch (Throwable $reportError) {
            $payload['report_error'] = $reportError->getMessage();
        }
    }

    fwrite(STDERR, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}
