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

function homologationCliOption(string $name, ?string $fallback = null): ?string
{
    global $argv;

    foreach ($argv as $argument) {
        if (strpos($argument, '--' . $name . '=') === 0) {
            return substr($argument, strlen($name) + 3);
        }
    }

    return $fallback;
}

function homologationBoolOption(string $name, bool $fallback): bool
{
    $value = homologationCliOption($name);
    if ($value === null) {
        return $fallback;
    }

    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

function homologationNormalizePath(string $path): string
{
    return str_replace('\\', '/', trim($path));
}

function homologationStoragePath(string $relativePath): string
{
    return homologationNormalizePath(dirname(__DIR__, 2) . '/storage/logs/readiness/' . ltrim($relativePath, '/'));
}

function homologationEnsureDirectory(string $path): void
{
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Nao foi possivel criar o diretorio do relatorio: ' . $directory);
    }
}

function homologationWriteReport(string $path, array $payload): void
{
    if ($path === '') {
        return;
    }

    homologationEnsureDirectory($path);
    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($path, $json . PHP_EOL, LOCK_EX) === false) {
        throw new RuntimeException('Nao foi possivel gravar o relatorio de homologacao: ' . $path);
    }
}

function homologationCanWritePrivateReport(array $prechecks, string $precheckName = 'report-file'): bool
{
    foreach ($prechecks as $check) {
        if (($check['name'] ?? '') === $precheckName) {
            return !empty($check['ok']);
        }
    }

    return false;
}

function homologationWriteReportIfPrivate(string $path, array $payload, array $prechecks): void
{
    if (!homologationCanWritePrivateReport($prechecks)) {
        return;
    }

    homologationWriteReport($path, $payload);
}

function homologationScriptPath(string $name): string
{
    return homologationNormalizePath(__DIR__ . '/' . $name);
}

function homologationRunPhpScript(string $phpBinary, string $scriptPath, array $arguments): array
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

function homologationIsLocalHost(string $host): bool
{
    $host = strtolower(trim($host));
    return $host === ''
        || in_array($host, ['localhost', '127.0.0.1', '::1'], true)
        || str_ends_with($host, '.local')
        || str_ends_with($host, '.test');
}

function homologationValidatePublicHttpsUrl(string $name, string $url): array
{
    $url = trim($url);
    if ($url === '') {
        return [
            'ok' => false,
            'name' => $name,
            'message' => $name . ' nao foi informado.',
        ];
    }

    $parts = parse_url($url);
    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $host = strtolower((string) ($parts['host'] ?? ''));

    if ($scheme !== 'https') {
        return [
            'ok' => false,
            'name' => $name,
            'message' => $name . ' deve usar HTTPS publico.',
            'url' => $url,
        ];
    }

    if (homologationIsLocalHost($host)) {
        return [
            'ok' => false,
            'name' => $name,
            'message' => $name . ' nao pode apontar para localhost, loopback ou dominio local em homologacao.',
            'url' => $url,
        ];
    }

    return [
        'ok' => true,
        'name' => $name,
        'message' => $name . ' usa HTTPS publico.',
        'url' => $url,
    ];
}

function homologationValidatePrivateReportPath(string $name, string $path): array
{
    $normalized = homologationNormalizePath($path);
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

function homologationBuildSuiteArguments(array $context): array
{
    return [
        'profile' => $context['profile'],
        'api-base-url' => $context['api_base_url'],
        'web-base-url' => $context['web_base_url'],
        'timeout' => $context['timeout_seconds'],
        'db-connections' => $context['db_connections'],
        'auth-required' => 'true',
        'admin-required' => 'true',
        'with-preflight' => 'true',
        'with-backup-rehearsal' => 'true',
        'log-fail-on' => 'critical',
        'log-since-minutes' => $context['log_since_minutes'],
        'log-require-files' => 'true',
        'restore-target-db' => $context['restore_target_db'],
        'report-file' => $context['suite_report_file'],
    ];
}

function homologationBuildAlertArguments(array $context): array
{
    return [
        'since-minutes' => $context['log_since_minutes'],
        'alert-on' => 'critical',
        'require-files' => 'true',
        'fail-on-alert' => 'true',
        'notify-admins' => $context['notify_admins'] ? 'true' : 'false',
    ];
}

try {
    $profile = strtolower((string) homologationCliOption('profile', getEnvString('HOMOLOGATION_PROFILE', 'staging')));
    if (!in_array($profile, ['staging', 'production'], true)) {
        throw new RuntimeException('Perfil invalido para homologacao. Use staging ou production.');
    }

    $apiBaseUrl = (string) homologationCliOption('api-base-url', getEnvString('SMOKE_API_BASE_URL', ''));
    $webBaseUrl = (string) homologationCliOption('web-base-url', getEnvString('SMOKE_WEB_BASE_URL', getEnvString('APP_URL', '')));
    $phpBinary = homologationNormalizePath((string) homologationCliOption('php', PHP_BINARY));
    $timeoutSeconds = max(5, min(60, (int) homologationCliOption('timeout', getEnvString('SMOKE_TIMEOUT_SECONDS', '12'))));
    $dbConnections = max(1, min(20, (int) homologationCliOption('db-connections', getEnvString('SMOKE_DB_CONNECTIONS', '3'))));
    $logSinceMinutes = max(1, min(1440, (int) homologationCliOption('log-since-minutes', getEnvString('LOG_AUDIT_SINCE_MINUTES', '60'))));
    $restoreTargetDb = (string) homologationCliOption('restore-target-db', getEnvString('RESTORE_TARGET_DB', 'concursomestre_restore_test'));
    $dryRun = homologationBoolOption('dry-run', false);
    $withAlerts = homologationBoolOption('with-alerts', true);
    $notifyAdmins = homologationBoolOption('notify-admins', filter_var(getEnvString('LOG_ALERT_NOTIFY_ADMINS', 'false'), FILTER_VALIDATE_BOOLEAN));
    $reportFile = homologationNormalizePath((string) homologationCliOption('report-file', getEnvString('HOMOLOGATION_REPORT_FILE', homologationStoragePath($profile . '_homologation_latest.json'))));
    $suiteReportFile = homologationNormalizePath((string) homologationCliOption('suite-report-file', getEnvString('READINESS_REPORT_FILE', homologationStoragePath($profile . '_readiness_suite_latest.json'))));

    $context = [
        'profile' => $profile,
        'api_base_url' => $apiBaseUrl,
        'web_base_url' => $webBaseUrl,
        'php' => $phpBinary,
        'timeout_seconds' => $timeoutSeconds,
        'db_connections' => $dbConnections,
        'log_since_minutes' => $logSinceMinutes,
        'restore_target_db' => $restoreTargetDb,
        'notify_admins' => $notifyAdmins,
        'report_file' => $reportFile,
        'suite_report_file' => $suiteReportFile,
    ];

    $prechecks = [
        homologationValidatePublicHttpsUrl('api-base-url', $apiBaseUrl),
        homologationValidatePublicHttpsUrl('web-base-url', $webBaseUrl),
        homologationValidatePrivateReportPath('report-file', $reportFile),
        homologationValidatePrivateReportPath('suite-report-file', $suiteReportFile),
    ];

    $failedPrechecks = array_values(array_filter($prechecks, static fn (array $check): bool => empty($check['ok'])));
    $suiteArguments = homologationBuildSuiteArguments($context);
    $alertArguments = homologationBuildAlertArguments($context);

    if ($failedPrechecks) {
        $payload = [
            'success' => false,
            'status' => 'blocked_precheck',
            'profile' => $profile,
            'dry_run' => $dryRun,
            'prechecks' => $prechecks,
            'planned' => [
                'readiness_suite' => [
                    'script' => homologationScriptPath('production_readiness_suite.php'),
                    'arguments' => $suiteArguments,
                ],
                'operational_alerts' => $withAlerts ? [
                    'script' => homologationScriptPath('operational_log_alerts.php'),
                    'arguments' => $alertArguments,
                ] : null,
            ],
            'checked_at' => gmdate(DATE_ATOM),
        ];
        homologationWriteReportIfPrivate($reportFile, $payload, $prechecks);
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
            'planned' => [
                'readiness_suite' => [
                    'script' => homologationScriptPath('production_readiness_suite.php'),
                    'arguments' => $suiteArguments,
                ],
                'operational_alerts' => $withAlerts ? [
                    'script' => homologationScriptPath('operational_log_alerts.php'),
                    'arguments' => $alertArguments,
                ] : null,
            ],
            'checked_at' => gmdate(DATE_ATOM),
        ];
        homologationWriteReport($reportFile, $payload);
        echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
        exit(0);
    }

    $steps = [];
    $steps[] = [
        'name' => 'production_readiness_suite',
        'required' => true,
        'result' => homologationRunPhpScript($phpBinary, homologationScriptPath('production_readiness_suite.php'), $suiteArguments),
    ];

    if ($withAlerts) {
        $steps[] = [
            'name' => 'operational_log_alerts',
            'required' => true,
            'result' => homologationRunPhpScript($phpBinary, homologationScriptPath('operational_log_alerts.php'), $alertArguments),
        ];
    }

    $failed = array_values(array_filter($steps, static fn (array $step): bool => empty($step['result']['ok'])));
    $payload = [
        'success' => count($failed) === 0,
        'status' => count($failed) === 0 ? 'ready_for_controlled_release' : 'blocked',
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

    homologationWriteReport($reportFile, $payload);
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

    $reportFile = homologationNormalizePath((string) homologationCliOption('report-file', getEnvString('HOMOLOGATION_REPORT_FILE', homologationStoragePath('staging_homologation_latest.json'))));
    $reportPrechecks = [
        homologationValidatePrivateReportPath('report-file', $reportFile),
    ];

    if (homologationCanWritePrivateReport($reportPrechecks)) {
        try {
            homologationWriteReport($reportFile, $payload);
        } catch (Throwable $reportError) {
            $payload['report_error'] = $reportError->getMessage();
        }
    }

    fwrite(STDERR, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}
