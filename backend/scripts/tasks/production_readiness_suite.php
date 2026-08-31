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

function readinessCliOption(string $name, ?string $fallback = null): ?string
{
    global $argv;

    foreach ($argv as $argument) {
        if (strpos($argument, '--' . $name . '=') === 0) {
            return substr($argument, strlen($name) + 3);
        }
    }

    return $fallback;
}

function readinessBoolOption(string $name, bool $fallback): bool
{
    $value = readinessCliOption($name);
    if ($value === null) {
        return $fallback;
    }

    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

function readinessNormalizePath(?string $path): string
{
    return rtrim(str_replace('\\', '/', trim((string) $path)), '/');
}

function readinessScriptPath(string $name): string
{
    return __DIR__ . '/' . $name;
}

function readinessRunPhpScript(string $phpBinary, string $scriptPath, array $arguments = []): array
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
    $json = json_decode($body, true);

    return [
        'ok' => $exitCode === 0 && is_array($json) && !empty($json['success']),
        'exit_code' => $exitCode,
        'duration_ms' => $durationMs,
        'json_ok' => is_array($json),
        'payload' => is_array($json) ? $json : null,
        'raw_output' => is_array($json) ? null : $body,
    ];
}

function readinessWriteReportFile(string $reportFile, array $payload): void
{
    $reportFile = readinessNormalizePath($reportFile);
    if ($reportFile === '') {
        return;
    }

    $directory = dirname($reportFile);
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Nao foi possivel criar o diretorio do relatorio: ' . $directory);
    }

    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($reportFile, $json . PHP_EOL, LOCK_EX) === false) {
        throw new RuntimeException('Nao foi possivel gravar o relatorio da suite: ' . $reportFile);
    }
}

function readinessStep(string $name, bool $required, callable $runner): array
{
    try {
        $result = $runner();
        $ok = !empty($result['ok']);

        return [
            'name' => $name,
            'required' => $required,
            'skipped' => false,
            'ok' => $ok,
            'result' => $result,
        ];
    } catch (Throwable $e) {
        return [
            'name' => $name,
            'required' => $required,
            'skipped' => false,
            'ok' => false,
            'result' => [
                'ok' => false,
                'message' => $e->getMessage(),
            ],
        ];
    }
}

function readinessSkippedStep(string $name, string $reason): array
{
    return [
        'name' => $name,
        'required' => false,
        'skipped' => true,
        'ok' => true,
        'reason' => $reason,
    ];
}

try {
    $profile = strtolower((string) readinessCliOption('profile', getEnvString('READINESS_PROFILE', 'local')));
    if (!in_array($profile, ['local', 'staging', 'production'], true)) {
        throw new RuntimeException('Perfil invalido. Use local, staging ou production.');
    }

    $strictProfile = $profile !== 'local';
    $phpBinary = readinessNormalizePath(readinessCliOption('php', PHP_BINARY));
    if ($phpBinary === '') {
        throw new RuntimeException('PHP binary nao encontrado.');
    }

    $apiBaseUrl = readinessCliOption(
        'api-base-url',
        getEnvString('SMOKE_API_BASE_URL', 'http://localhost/questao-pro-backend/api')
    );
    $webBaseUrl = readinessCliOption(
        'web-base-url',
        getEnvString('SMOKE_WEB_BASE_URL', $strictProfile ? getEnvString('APP_URL', '') : '')
    );
    $timeoutSeconds = readinessCliOption('timeout', getEnvString('SMOKE_TIMEOUT_SECONDS', $strictProfile ? '12' : '8'));
    $dbConnections = readinessCliOption('db-connections', getEnvString('SMOKE_DB_CONNECTIONS', '3'));
    $authRequired = readinessBoolOption('auth-required', $strictProfile);
    $adminRequired = readinessBoolOption('admin-required', $strictProfile);
    $withPreflight = readinessBoolOption('with-preflight', $strictProfile);
    $withBackupRehearsal = readinessBoolOption('with-backup-rehearsal', $strictProfile);
    $logFailOn = readinessCliOption('log-fail-on', getEnvString('LOG_AUDIT_FAIL_ON', $strictProfile ? 'critical' : 'none'));
    $logSinceMinutes = readinessCliOption('log-since-minutes', getEnvString('LOG_AUDIT_SINCE_MINUTES', $strictProfile ? '60' : '0'));
    $logRequireFiles = readinessBoolOption(
        'log-require-files',
        filter_var(getEnvString('LOG_AUDIT_REQUIRE_FILES', $strictProfile ? 'true' : 'false'), FILTER_VALIDATE_BOOLEAN)
    );
    $restoreTargetDb = readinessCliOption('restore-target-db', getEnvString('RESTORE_TARGET_DB', 'concursomestre_restore_test'));
    $reportFile = readinessCliOption('report-file', getEnvString('READINESS_REPORT_FILE', ''));

    $steps = [];
    if ($withPreflight) {
        $steps[] = readinessStep(
            'production_preflight',
            $strictProfile,
            static fn (): array => readinessRunPhpScript($phpBinary, readinessScriptPath('production_preflight.php'))
        );
    } else {
        $steps[] = readinessSkippedStep('production_preflight', 'Preflight de producao ignorado no perfil local.');
    }

    $steps[] = readinessStep(
        'production_smoke',
        true,
        static fn (): array => readinessRunPhpScript($phpBinary, readinessScriptPath('production_smoke.php'), [
            'api-base-url' => $apiBaseUrl,
            'web-base-url' => $webBaseUrl,
            'timeout' => $timeoutSeconds,
            'db-connections' => $dbConnections,
            'auth-required' => $authRequired ? 'true' : 'false',
            'admin-required' => $adminRequired ? 'true' : 'false',
        ])
    );

    $steps[] = readinessStep(
        'production_log_audit',
        true,
        static fn (): array => readinessRunPhpScript($phpBinary, readinessScriptPath('production_log_audit.php'), [
            'fail-on' => $logFailOn,
            'since-minutes' => $logSinceMinutes,
            'require-files' => $logRequireFiles ? 'true' : 'false',
        ])
    );

    if ($withBackupRehearsal) {
        $steps[] = readinessStep(
            'backup_restore_rehearsal',
            $strictProfile,
            static fn (): array => readinessRunPhpScript($phpBinary, readinessScriptPath('backup_restore_rehearsal.php'), [
                'target-db' => $restoreTargetDb,
                'php' => $phpBinary,
            ])
        );
    } else {
        $steps[] = readinessSkippedStep(
            'backup_restore_rehearsal',
            'Ensaio de restore ignorado. Use --with-backup-rehearsal=true apos gerar um backup.'
        );
    }

    $failedRequired = array_values(array_filter(
        $steps,
        static fn (array $step): bool => !empty($step['required']) && empty($step['ok'])
    ));
    $failedOptional = array_values(array_filter(
        $steps,
        static fn (array $step): bool => empty($step['required']) && empty($step['skipped']) && empty($step['ok'])
    ));

    $payload = [
        'success' => count($failedRequired) === 0,
        'profile' => $profile,
        'strict_profile' => $strictProfile,
        'summary' => [
            'total_steps' => count($steps),
            'failed_required' => count($failedRequired),
            'failed_optional' => count($failedOptional),
            'skipped' => count(array_filter($steps, static fn (array $step): bool => !empty($step['skipped']))),
        ],
        'steps' => $steps,
        'checked_at' => gmdate(DATE_ATOM),
    ];

    readinessWriteReportFile((string) $reportFile, $payload);

    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($payload['success']) {
        echo $json . PHP_EOL;
        exit(0);
    }

    fwrite(STDERR, $json . PHP_EOL);
    exit(2);
} catch (Throwable $e) {
    fwrite(STDERR, json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}
