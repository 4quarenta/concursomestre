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

function rehearsalCliOption(string $name, ?string $fallback = null): ?string
{
    global $argv;

    foreach ($argv as $argument) {
        if (strpos($argument, '--' . $name . '=') === 0) {
            return substr($argument, strlen($name) + 3);
        }
    }

    return $fallback;
}

function rehearsalNormalizePath(?string $path): string
{
    return rtrim(str_replace('\\', '/', trim((string) $path)), '/');
}

function rehearsalDefaultBackupDirectory(): string
{
    return rehearsalNormalizePath(getEnvString('BACKUP_DIR', dirname(__DIR__, 2) . '/storage/backups'));
}

function rehearsalDefaultHealthPath(): string
{
    return rehearsalNormalizePath(
        getEnvString('MYSQL_BACKUP_HEALTH_PATH', dirname(__DIR__, 2) . '/storage/logs/backups/mysql_backup_health.json')
    );
}

function rehearsalResolveBackupFromHealth(string $healthPath): ?string
{
    if ($healthPath === '' || !is_file($healthPath) || !is_readable($healthPath)) {
        return null;
    }

    $payload = json_decode((string) file_get_contents($healthPath), true);
    if (!is_array($payload) || empty($payload['success'])) {
        return null;
    }

    $backupFile = rehearsalNormalizePath($payload['backup_file'] ?? null);
    return $backupFile !== '' ? $backupFile : null;
}

function rehearsalResolveLatestBackupFromDirectory(string $directory): ?string
{
    if ($directory === '' || !is_dir($directory)) {
        return null;
    }

    $files = glob($directory . '/concursomestre-*.sql') ?: [];
    $files = array_values(array_filter($files, static fn (string $file): bool => is_file($file) && is_readable($file)));
    usort($files, static fn (string $a, string $b): int => (filemtime($b) ?: 0) <=> (filemtime($a) ?: 0));

    return $files[0] ?? null;
}

function rehearsalResolveBackupFile(string $healthPath, string $backupDirectory): string
{
    $explicitFile = rehearsalNormalizePath(rehearsalCliOption('file'));
    if ($explicitFile !== '') {
        return $explicitFile;
    }

    $fromHealth = rehearsalResolveBackupFromHealth($healthPath);
    if ($fromHealth !== null && $fromHealth !== '') {
        return $fromHealth;
    }

    $fromDirectory = rehearsalResolveLatestBackupFromDirectory($backupDirectory);
    if ($fromDirectory !== null && $fromDirectory !== '') {
        return rehearsalNormalizePath($fromDirectory);
    }

    throw new RuntimeException('Nenhum backup encontrado. Informe --file=... ou execute backup_mysql.php antes do ensaio.');
}

function rehearsalRunPhpScript(string $phpBinary, string $scriptPath, array $arguments): array
{
    $command = escapeshellarg($phpBinary) . ' ' . escapeshellarg($scriptPath);
    foreach ($arguments as $name => $value) {
        $command .= ' --' . $name . '=' . escapeshellarg((string) $value);
    }

    $output = [];
    $exitCode = 0;
    exec($command . ' 2>&1', $output, $exitCode);
    $body = trim(implode("\n", $output));
    $json = json_decode($body, true);

    return [
        'ok' => $exitCode === 0 && is_array($json) && !empty($json['success']),
        'exit_code' => $exitCode,
        'json_ok' => is_array($json),
        'payload' => is_array($json) ? $json : null,
        'raw_output' => is_array($json) ? null : $body,
    ];
}

try {
    $phpBinary = rehearsalNormalizePath(rehearsalCliOption('php', PHP_BINARY));
    if ($phpBinary === '') {
        throw new RuntimeException('PHP binary nao encontrado para executar o ensaio.');
    }

    $healthPath = rehearsalNormalizePath(rehearsalCliOption('health-path', rehearsalDefaultHealthPath()));
    $backupDirectory = rehearsalNormalizePath(rehearsalCliOption('dir', rehearsalDefaultBackupDirectory()));
    $backupFile = rehearsalResolveBackupFile($healthPath, $backupDirectory);
    $targetDb = trim((string) rehearsalCliOption('target-db', getEnvString('RESTORE_TARGET_DB', 'concursomestre_restore_test')));
    if ($targetDb === '') {
        throw new RuntimeException('RESTORE_TARGET_DB nao configurado para o ensaio.');
    }

    $verify = rehearsalRunPhpScript($phpBinary, __DIR__ . '/verify_mysql_backup.php', [
        'file' => $backupFile,
    ]);
    if (!$verify['ok']) {
        throw new RuntimeException('Verificacao do backup falhou no ensaio.');
    }

    $restoreDryRun = rehearsalRunPhpScript($phpBinary, __DIR__ . '/restore_mysql_backup.php', [
        'file' => $backupFile,
        'target-db' => $targetDb,
    ]);
    if (!$restoreDryRun['ok']) {
        throw new RuntimeException('Dry-run do restore falhou no ensaio.');
    }

    echo json_encode([
        'success' => true,
        'backup_file' => $backupFile,
        'health_path' => $healthPath,
        'target_db' => $targetDb,
        'verify' => $verify,
        'restore_dry_run' => $restoreDryRun,
        'checked_at' => gmdate(DATE_ATOM),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}
