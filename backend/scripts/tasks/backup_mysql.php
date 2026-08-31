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

function backupCliOption(string $name, ?string $fallback = null): ?string
{
    global $argv;

    foreach ($argv as $argument) {
        if (strpos($argument, '--' . $name . '=') === 0) {
            return substr($argument, strlen($name) + 3);
        }
    }

    return $fallback;
}

function backupRequireValue(string $key): string
{
    $value = getEnvString($key);
    if ($value === '') {
        throw new RuntimeException($key . ' nao configurado.');
    }

    return $value;
}

function backupEscapeOptionValue(string $value): string
{
    return str_replace(["\\", "\"", "\r", "\n"], ["\\\\", "\\\"", '', ''], $value);
}

function backupResolveDirectory(): string
{
    $directory = backupCliOption('dir', getEnvString('BACKUP_DIR', dirname(__DIR__, 2) . '/storage/backups'));
    $directory = rtrim(str_replace('\\', '/', (string) $directory), '/');

    if ($directory === '') {
        throw new RuntimeException('Diretorio de backup invalido.');
    }

    if (!is_dir($directory) && !mkdir($directory, 0770, true)) {
        throw new RuntimeException('Nao foi possivel criar o diretorio de backup.');
    }

    if (!is_writable($directory)) {
        throw new RuntimeException('Diretorio de backup sem permissao de escrita.');
    }

    return $directory;
}

function backupCreateDefaultsFile(string $user, string $password, string $host, string $port): string
{
    $path = tempnam(sys_get_temp_dir(), 'cm-db-');
    if ($path === false) {
        throw new RuntimeException('Nao foi possivel criar arquivo temporario de credenciais.');
    }

    $content = "[client]\n"
        . 'user="' . backupEscapeOptionValue($user) . '"' . "\n"
        . 'password="' . backupEscapeOptionValue($password) . '"' . "\n"
        . 'host="' . backupEscapeOptionValue($host) . '"' . "\n"
        . "default-character-set=utf8mb4\n";

    if ($port !== '') {
        $content .= 'port="' . backupEscapeOptionValue($port) . '"' . "\n";
    }

    if (file_put_contents($path, $content) === false) {
        @unlink($path);
        throw new RuntimeException('Nao foi possivel escrever arquivo temporario de credenciais.');
    }

    @chmod($path, 0600);

    return $path;
}

function backupRemoveOldFiles(string $directory, int $retentionDays): int
{
    if ($retentionDays <= 0) {
        return 0;
    }

    $removed = 0;
    $cutoff = time() - ($retentionDays * 86400);
    foreach (glob($directory . '/concursomestre-*.sql') ?: [] as $file) {
        if (is_file($file) && filemtime($file) !== false && filemtime($file) < $cutoff) {
            @unlink($file);
            if (is_file($file . '.sha256')) {
                @unlink($file . '.sha256');
                $removed++;
            }
            $removed++;
        }
    }

    foreach (glob($directory . '/concursomestre-*.sql.sha256') ?: [] as $file) {
        if (is_file($file) && !is_file(substr($file, 0, -7)) && filemtime($file) !== false && filemtime($file) < $cutoff) {
            @unlink($file);
            $removed++;
        }
    }

    return $removed;
}

function backupRunCommand(string $command): array
{
    $output = [];
    $exitCode = 0;
    exec($command . ' 2>&1', $output, $exitCode);

    return [
        'exit_code' => $exitCode,
        'output' => implode("\n", $output),
    ];
}

function backupResolveHealthPath(): string
{
    return backupCliOption(
        'health-path',
        getEnvString('MYSQL_BACKUP_HEALTH_PATH', dirname(__DIR__, 2) . '/storage/logs/backups/mysql_backup_health.json')
    ) ?? '';
}

function backupWriteHealth(array $payload): void
{
    $path = trim(str_replace('\\', '/', backupResolveHealthPath()));
    if ($path === '') {
        return;
    }

    $directory = dirname($path);
    if (!is_dir($directory)) {
        @mkdir($directory, 0770, true);
    }

    $payload['last_run_at'] = $payload['last_run_at'] ?? gmdate(DATE_ATOM);
    $payload['task'] = 'backup_mysql';

    @file_put_contents(
        $path,
        json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL,
        LOCK_EX
    );
}

try {
    $dbName = backupRequireValue('DB_NAME');
    $dbUser = backupRequireValue('DB_USER');
    $dbPassword = getEnvString('DB_PASSWORD', getEnvString('DB_PASS'));
    $dbHost = getEnvString('DB_HOST', 'localhost');
    $dbPort = getEnvString('DB_PORT', '3306');
    $mysqldumpPath = backupCliOption('mysqldump', getEnvString('MYSQLDUMP_PATH', 'mysqldump'));
    $retentionDays = max(0, (int) backupCliOption('retention-days', getEnvString('BACKUP_RETENTION_DAYS', '14')));
    $directory = backupResolveDirectory();
    $timestamp = date('Ymd-His');
    $backupPath = $directory . '/concursomestre-' . $timestamp . '.sql';
    $defaultsFile = backupCreateDefaultsFile($dbUser, $dbPassword, $dbHost, $dbPort);

    try {
        $command = escapeshellarg((string) $mysqldumpPath)
            . ' --defaults-extra-file=' . escapeshellarg($defaultsFile)
            . ' --single-transaction --quick --routines --triggers --events --default-character-set=utf8mb4 '
            . escapeshellarg($dbName)
            . ' --result-file=' . escapeshellarg($backupPath);

        $result = backupRunCommand($command);
    } finally {
        @unlink($defaultsFile);
    }

    if (($result['exit_code'] ?? 1) !== 0 || !is_file($backupPath) || filesize($backupPath) === 0) {
        @unlink($backupPath);
        throw new RuntimeException('mysqldump falhou: ' . (string) ($result['output'] ?? 'sem saida'));
    }

    $checksum = hash_file('sha256', $backupPath);
    if ($checksum === false) {
        @unlink($backupPath);
        throw new RuntimeException('Nao foi possivel gerar checksum do backup.');
    }

    $checksumPath = $backupPath . '.sha256';
    if (file_put_contents($checksumPath, $checksum . '  ' . basename($backupPath) . PHP_EOL) === false) {
        @unlink($backupPath);
        throw new RuntimeException('Nao foi possivel escrever checksum do backup.');
    }

    $removed = backupRemoveOldFiles($directory, $retentionDays);

    $payload = [
        'success' => true,
        'status' => 'ok',
        'backup_file' => $backupPath,
        'checksum_file' => $checksumPath,
        'sha256' => $checksum,
        'size_bytes' => filesize($backupPath),
        'retention_days' => $retentionDays,
        'removed_old_files' => $removed,
        'created_at' => gmdate(DATE_ATOM),
    ];
    backupWriteHealth($payload);

    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    backupWriteHealth([
        'success' => false,
        'status' => 'error',
        'message' => $e->getMessage(),
    ]);

    fwrite(STDERR, json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}
