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

function logAlertsCliOption(string $name, ?string $fallback = null): ?string
{
    global $argv;

    foreach ($argv as $argument) {
        if (strpos($argument, '--' . $name . '=') === 0) {
            return substr($argument, strlen($name) + 3);
        }
    }

    return $fallback;
}

function logAlertsBoolOption(string $name, bool $fallback): bool
{
    $value = logAlertsCliOption($name);
    if ($value === null) {
        return $fallback;
    }

    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

function logAlertsCoverageNoop(): bool
{
    return logAlertsBoolOption('coverage-noop', false);
}

function logAlertsNormalizePath(string $path): string
{
    return str_replace('\\', '/', $path);
}

function logAlertsStoragePath(string $relativePath): string
{
    return logAlertsNormalizePath(dirname(__DIR__, 2) . '/storage/logs/operations/' . ltrim($relativePath, '/'));
}

function logAlertsEnsureDirectory(string $path): void
{
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Nao foi possivel criar o diretorio: ' . $directory);
    }
}

function logAlertsRunAudit(array $options): array
{
    $script = logAlertsNormalizePath(__DIR__ . '/production_log_audit.php');
    $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($script);

    $arguments = [
        'fail-on' => 'none',
        'since-minutes' => $options['since_minutes'],
        'repeat-threshold' => $options['repeat_threshold'],
        'require-files' => $options['require_files'] ? 'true' : 'false',
    ];

    if ($options['files'] !== '') {
        $arguments['files'] = $options['files'];
    }

    if ($options['tail_lines'] > 0) {
        $arguments['tail'] = (string) $options['tail_lines'];
    }

    foreach ($arguments as $name => $value) {
        $command .= ' --' . $name . '=' . escapeshellarg((string) $value);
    }

    $output = [];
    $exitCode = 0;
    exec($command . ' 2>&1', $output, $exitCode);
    $rawOutput = trim(implode("\n", $output));
    $payload = json_decode($rawOutput, true);

    if (!is_array($payload)) {
        throw new RuntimeException('Auditoria de logs nao retornou JSON valido. Saida: ' . substr($rawOutput, 0, 500));
    }

    $payload['_audit_exit_code'] = $exitCode;
    return $payload;
}

function logAlertsNormalizeLine(string $line): string
{
    $normalized = preg_replace('/^\[[^\]]+\]\s*/', '', $line) ?? $line;
    $normalized = preg_replace('/"time"\s*:\s*"[^"]+"/', '"time":"<time>"', $normalized) ?? $normalized;
    $normalized = preg_replace('/"server_time_unix"\s*:\s*\d+/', '"server_time_unix":0', $normalized) ?? $normalized;
    $normalized = preg_replace('/\bpid\s+\d+:\s*tid\s+\d+\b/i', 'pid <pid>:tid <tid>', $normalized) ?? $normalized;
    $normalized = preg_replace('/\[pid\s+\d+:tid\s+\d+\]/i', '[pid <pid>:tid <tid>]', $normalized) ?? $normalized;
    $normalized = preg_replace('/\[client\s+[^\]]+\]/i', '[client <client>]', $normalized) ?? $normalized;
    $normalized = preg_replace('/\s+/', ' ', $normalized) ?? $normalized;

    return trim($normalized);
}

function logAlertsBuildFingerprint(string $severity, string $path, string $line): string
{
    return sha1($severity . '|' . logAlertsNormalizePath($path) . '|' . logAlertsNormalizeLine($line));
}

function logAlertsSeverityAllowed(string $severity, string $alertOn): bool
{
    if ($alertOn === 'warning') {
        return in_array($severity, ['critical', 'error', 'warning'], true);
    }

    if ($alertOn === 'error') {
        return in_array($severity, ['critical', 'error'], true);
    }

    return $severity === 'critical';
}

function logAlertsCollectAlerts(array $auditPayload, string $alertOn, int $maxAlerts): array
{
    $alerts = [];

    foreach (($auditPayload['files'] ?? []) as $fileResult) {
        if (!is_array($fileResult)) {
            continue;
        }

        $path = (string) ($fileResult['path'] ?? '');
        $analysis = is_array($fileResult['analysis'] ?? null) ? $fileResult['analysis'] : [];
        $samples = is_array($analysis['samples'] ?? null) ? $analysis['samples'] : [];

        foreach (['critical', 'error', 'warning'] as $severity) {
            if (!logAlertsSeverityAllowed($severity, $alertOn)) {
                continue;
            }

            foreach (($samples[$severity] ?? []) as $line) {
                $line = trim((string) $line);
                if ($line === '') {
                    continue;
                }

                $alerts[] = [
                    'fingerprint' => logAlertsBuildFingerprint($severity, $path, $line),
                    'severity' => $severity,
                    'path' => $path,
                    'line' => $line,
                    'normalized_line' => logAlertsNormalizeLine($line),
                ];

                if (count($alerts) >= $maxAlerts) {
                    return $alerts;
                }
            }
        }
    }

    if (!empty($auditPayload['missing_files']) && $auditPayload['success'] === false) {
        $line = 'Arquivos de log obrigatorios ausentes: ' . implode(', ', array_map('strval', $auditPayload['missing_files']));
        $alerts[] = [
            'fingerprint' => logAlertsBuildFingerprint('critical', 'production_log_audit', $line),
            'severity' => 'critical',
            'path' => 'production_log_audit',
            'line' => $line,
            'normalized_line' => $line,
        ];
    }

    return array_slice($alerts, 0, $maxAlerts);
}

function logAlertsReadLedger(string $path): array
{
    if (!is_file($path)) {
        return [];
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return [];
    }

    $events = [];
    foreach ($lines as $line) {
        $event = json_decode($line, true);
        if (is_array($event) && isset($event['fingerprint'])) {
            $events[] = $event;
        }
    }

    return $events;
}

function logAlertsRecentFingerprints(array $events, int $dedupeSeconds): array
{
    $cutoff = time() - $dedupeSeconds;
    $fingerprints = [];

    foreach ($events as $event) {
        $createdAt = strtotime((string) ($event['created_at'] ?? ''));
        if ($createdAt !== false && $createdAt >= $cutoff) {
            $fingerprints[(string) $event['fingerprint']] = true;
        }
    }

    return $fingerprints;
}

function logAlertsAppendLedger(string $path, array $alerts): void
{
    if (!$alerts) {
        return;
    }

    logAlertsEnsureDirectory($path);
    $handle = fopen($path, 'ab');
    if (!$handle) {
        throw new RuntimeException('Nao foi possivel abrir o ledger de alertas: ' . $path);
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('Nao foi possivel bloquear o ledger de alertas.');
        }

        foreach ($alerts as $alert) {
            $event = $alert;
            $event['created_at'] = gmdate(DATE_ATOM);
            fwrite($handle, json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
        }

        fflush($handle);
        flock($handle, LOCK_UN);
    } finally {
        fclose($handle);
    }
}

function logAlertsWriteHealth(string $path, array $payload): void
{
    logAlertsEnsureDirectory($path);
    file_put_contents(
        $path,
        json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL,
        LOCK_EX
    );
}

function logAlertsNotifyAdmins(array $alerts, string $link): array
{
    if (!$alerts) {
        return ['attempted' => false, 'created' => 0, 'error' => null];
    }

    try {
        require_once __DIR__ . '/../../config/database.php';
        require_once __DIR__ . '/../../config/notification_helper.php';

        $database = new Database();
        $db = $database->getConnection();
        $first = $alerts[0];
        $count = count($alerts);
        $title = $count === 1
            ? 'Alerta operacional nos logs'
            : 'Alertas operacionais nos logs';
        $message = $count . ' alerta(s) novo(s) em logs recentes. Principal: [' . strtoupper((string) $first['severity']) . '] ' . substr((string) $first['normalized_line'], 0, 220);
        $created = createAdminNotification($db, $title, $message, 'error', 'system', $link);

        return ['attempted' => true, 'created' => $created, 'error' => null];
    } catch (Throwable $e) {
        error_log('[operational_log_alerts] Falha ao notificar administradores: ' . $e->getMessage());
        return ['attempted' => true, 'created' => 0, 'error' => $e->getMessage()];
    }
}

try {
    $sinceMinutes = max(1, min(10080, (int) logAlertsCliOption('since-minutes', getEnvString('LOG_ALERT_SINCE_MINUTES', getEnvString('LOG_AUDIT_SINCE_MINUTES', '60')))));
    $repeatThreshold = max(2, min(100, (int) logAlertsCliOption('repeat-threshold', getEnvString('LOG_AUDIT_REPEAT_THRESHOLD', '5'))));
    $tailLines = max(0, min(50000, (int) logAlertsCliOption('tail', getEnvString('LOG_AUDIT_TAIL_LINES', '5000'))));
    $dedupeMinutes = max(1, min(10080, (int) logAlertsCliOption('dedupe-minutes', getEnvString('LOG_ALERT_DEDUPE_MINUTES', '360'))));
    $maxAlerts = max(1, min(100, (int) logAlertsCliOption('max-alerts', getEnvString('LOG_ALERT_MAX_PER_RUN', '20'))));
    $alertOn = strtolower((string) logAlertsCliOption('alert-on', getEnvString('LOG_ALERT_ON', 'critical')));
    if (!in_array($alertOn, ['critical', 'error', 'warning'], true)) {
        $alertOn = 'critical';
    }

    $files = logAlertsCliOption('files', getEnvString('LOG_AUDIT_FILES', ''));
    $requireFiles = logAlertsBoolOption('require-files', filter_var(getEnvString('LOG_AUDIT_REQUIRE_FILES', 'false'), FILTER_VALIDATE_BOOLEAN));
    $notifyAdmins = logAlertsBoolOption('notify-admins', filter_var(getEnvString('LOG_ALERT_NOTIFY_ADMINS', 'false'), FILTER_VALIDATE_BOOLEAN));
    $failOnAlert = logAlertsBoolOption('fail-on-alert', filter_var(getEnvString('LOG_ALERT_FAIL_ON_ALERT', 'false'), FILTER_VALIDATE_BOOLEAN));
    $link = (string) logAlertsCliOption('link', getEnvString('LOG_ALERT_ADMIN_LINK', '/admin?tab=settings&section=logs'));
    $healthPath = logAlertsNormalizePath((string) logAlertsCliOption('health-path', getEnvString('LOG_ALERT_HEALTH_PATH', logAlertsStoragePath('log_alert_health.json'))));
    $ledgerPath = logAlertsNormalizePath((string) logAlertsCliOption('ledger-path', getEnvString('LOG_ALERT_LEDGER_PATH', logAlertsStoragePath('log_alerts.ndjson'))));

    $auditPayload = logAlertsRunAudit([
        'files' => (string) $files,
        'since_minutes' => $sinceMinutes,
        'repeat_threshold' => $repeatThreshold,
        'tail_lines' => $tailLines,
        'require_files' => $requireFiles,
    ]);

    if (logAlertsCoverageNoop()) {
        echo json_encode([
            'success' => true,
            'task' => 'operational_log_alerts',
            'status' => 'coverage-noop',
            'audit_checked_at' => $auditPayload['checked_at'] ?? null,
            'checked_at' => gmdate(DATE_ATOM),
            'alerts_seen' => count(logAlertsCollectAlerts($auditPayload, $alertOn, $maxAlerts)),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
        exit(0);
    }

    $alerts = logAlertsCollectAlerts($auditPayload, $alertOn, $maxAlerts);
    $ledgerEvents = logAlertsReadLedger($ledgerPath);
    $recentFingerprints = logAlertsRecentFingerprints($ledgerEvents, $dedupeMinutes * 60);
    $newAlerts = array_values(array_filter(
        $alerts,
        static fn (array $alert): bool => !isset($recentFingerprints[(string) $alert['fingerprint']])
    ));

    logAlertsAppendLedger($ledgerPath, $newAlerts);
    $notification = $notifyAdmins ? logAlertsNotifyAdmins($newAlerts, $link) : [
        'attempted' => false,
        'created' => 0,
        'error' => null,
    ];

    $status = $alerts ? 'alert' : 'ok';
    $payload = [
        'success' => !$failOnAlert || !$alerts,
        'task' => 'operational_log_alerts',
        'status' => $status,
        'alert_on' => $alertOn,
        'since_minutes' => $sinceMinutes,
        'dedupe_minutes' => $dedupeMinutes,
        'alert_count' => count($alerts),
        'new_alert_count' => count($newAlerts),
        'notification' => $notification,
        'alerts' => $alerts,
        'new_alerts' => $newAlerts,
        'audit_checked_at' => $auditPayload['checked_at'] ?? null,
        'checked_at' => gmdate(DATE_ATOM),
    ];

    logAlertsWriteHealth($healthPath, $payload);

    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!$payload['success']) {
        fwrite(STDERR, $json . PHP_EOL);
        exit(2);
    }

    echo $json . PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    $healthPath = logAlertsNormalizePath((string) logAlertsCliOption('health-path', getEnvString('LOG_ALERT_HEALTH_PATH', logAlertsStoragePath('log_alert_health.json'))));
    $payload = [
        'success' => false,
        'task' => 'operational_log_alerts',
        'status' => 'error',
        'message' => $e->getMessage(),
        'checked_at' => gmdate(DATE_ATOM),
    ];

    try {
        logAlertsWriteHealth($healthPath, $payload);
    } catch (Throwable $healthError) {
        $payload['health_error'] = $healthError->getMessage();
    }

    fwrite(STDERR, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}
