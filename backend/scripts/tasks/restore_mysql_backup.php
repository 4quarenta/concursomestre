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

function restoreCliOption(string $name, ?string $fallback = null): ?string
{
    global $argv;

    foreach ($argv as $argument) {
        if (strpos($argument, '--' . $name . '=') === 0) {
            return substr($argument, strlen($name) + 3);
        }
    }

    return $fallback;
}

function restoreRequireValue(string $key): string
{
    $value = getEnvString($key);
    if ($value === '') {
        throw new RuntimeException($key . ' nao configurado.');
    }

    return $value;
}

function restoreEscapeOptionValue(string $value): string
{
    return str_replace(["\\", "\"", "\r", "\n"], ["\\\\", "\\\"", '', ''], $value);
}

function restoreCreateDefaultsFile(string $user, string $password, string $host, string $port): string
{
    $path = tempnam(sys_get_temp_dir(), 'cm-db-restore-');
    if ($path === false) {
        throw new RuntimeException('Nao foi possivel criar arquivo temporario de credenciais.');
    }

    $content = "[client]\n"
        . 'user="' . restoreEscapeOptionValue($user) . '"' . "\n"
        . 'password="' . restoreEscapeOptionValue($password) . '"' . "\n"
        . 'host="' . restoreEscapeOptionValue($host) . '"' . "\n"
        . "default-character-set=utf8mb4\n";

    if ($port !== '') {
        $content .= 'port="' . restoreEscapeOptionValue($port) . '"' . "\n";
    }

    if (file_put_contents($path, $content) === false) {
        @unlink($path);
        throw new RuntimeException('Nao foi possivel escrever arquivo temporario de credenciais.');
    }

    @chmod($path, 0600);

    return $path;
}

function restoreRunCommand(string $command): array
{
    $output = [];
    $exitCode = 0;
    exec($command . ' 2>&1', $output, $exitCode);

    return [
        'exit_code' => $exitCode,
        'output' => implode("\n", $output),
    ];
}

function restoreReadChecksum(string $path): string
{
    $checksumPath = $path . '.sha256';
    if (!is_file($checksumPath)) {
        throw new RuntimeException('Checksum obrigatorio ausente.');
    }

    $content = trim((string) file_get_contents($checksumPath));
    if (!preg_match('/^[a-f0-9]{64}\b/i', $content, $matches)) {
        throw new RuntimeException('Arquivo de checksum invalido.');
    }

    return strtolower($matches[0]);
}

/** @return array<string, mixed> */
function restoreReadManifest(string $path, bool $allowLegacy): array
{
    $manifestPath = $path . '.manifest.json';
    if (!is_file($manifestPath) || !is_readable($manifestPath)) {
        if ($allowLegacy) {
            return ['legacy' => true];
        }
        throw new RuntimeException('Manifest final obrigatorio ausente.');
    }
    $manifest = json_decode((string) file_get_contents($manifestPath), true);
    if (!is_array($manifest) || (int) ($manifest['format_version'] ?? 0) < 1) {
        throw new RuntimeException('Manifest final invalido.');
    }
    $checksum = restoreReadChecksum($path);
    if (($manifest['dump_sha256'] ?? '') === '' || !hash_equals((string) $manifest['dump_sha256'], $checksum)) {
        throw new RuntimeException('Manifest nao corresponde ao checksum do backup.');
    }
    if (isset($manifest['dump_size']) && (int) $manifest['dump_size'] !== (int) filesize($path)) {
        throw new RuntimeException('Manifest nao corresponde ao tamanho do backup.');
    }
    return $manifest;
}

function restoreAssertBackupFileIsValid(string $path): array
{
    $path = str_replace('\\', '/', $path);
    if (!is_file($path) || !is_readable($path)) {
        throw new RuntimeException('Arquivo de backup nao encontrado ou sem permissao de leitura.');
    }

    $size = filesize($path);
    if ($size === false || $size <= 0) {
        throw new RuntimeException('Arquivo de backup vazio.');
    }

    $expectedChecksum = restoreReadChecksum($path);
    $actualChecksum = hash_file('sha256', $path);
    if ($actualChecksum === false) {
        throw new RuntimeException('Nao foi possivel calcular checksum.');
    }

    if (strtolower($actualChecksum) !== $expectedChecksum) {
        throw new RuntimeException('Checksum do backup nao confere.');
    }

    $sample = (string) file_get_contents($path, false, null, 0, 1048576);
    $hasDumpMarker = stripos($sample, 'CREATE TABLE') !== false
        || stripos($sample, 'INSERT INTO') !== false
        || stripos($sample, 'Table structure for table') !== false
        || stripos($sample, 'MariaDB dump') !== false
        || stripos($sample, 'MySQL dump') !== false;

    if (!$hasDumpMarker) {
        throw new RuntimeException('Arquivo nao parece ser um dump SQL MySQL/MariaDB.');
    }

    restoreAssertSqlSafety($path);

    return [
        'backup_file' => $path,
        'size_bytes' => $size,
        'sha256' => $actualChecksum,
        'checksum_file_found' => true,
    ];
}

function restoreAssertSqlSafety(string $path): void
{
    $handle = fopen($path, 'rb');
    if (!$handle) {
        throw new RuntimeException('Nao foi possivel abrir o backup para validacao de seguranca.');
    }

    try {
        while (($line = fgets($handle)) !== false) {
            $normalized = preg_replace('/\s+/', ' ', trim($line));
            if (!is_string($normalized) || $normalized === '') {
                continue;
            }

            if (preg_match('/\bDROP\s+DATABASE\b/i', $normalized) === 1) {
                throw new RuntimeException('Backup contem DROP DATABASE; restore automatico bloqueado.');
            }

            if (preg_match('/\bCREATE\s+DATABASE\b/i', $normalized) === 1) {
                throw new RuntimeException('Backup contem CREATE DATABASE; gere dump de um unico banco sem --databases.');
            }

            if (preg_match('/^\s*USE\s+`?(mysql|information_schema|performance_schema|sys)`?\s*;/i', $normalized) === 1) {
                throw new RuntimeException('Backup tenta alternar para schema de sistema; restore bloqueado.');
            }
        }
    } finally {
        fclose($handle);
    }
}

function restoreNormalizeDatabaseName(string $database): string
{
    $database = trim($database);
    if ($database === '' || preg_match('/^[A-Za-z0-9_]+$/', $database) !== 1) {
        throw new RuntimeException('Nome do banco de destino invalido. Use apenas letras, numeros e underscore.');
    }

    return $database;
}

try {
    $backupPath = restoreCliOption('file');
    if ($backupPath === null || trim($backupPath) === '') {
        throw new RuntimeException('Informe --file=/caminho/backup.sql.');
    }

    $targetDb = restoreNormalizeDatabaseName((string) restoreCliOption('target-db', getEnvString('RESTORE_TARGET_DB')));
    $currentDb = restoreNormalizeDatabaseName(restoreRequireValue('DB_NAME'));
    $allowCurrentDb = restoreCliOption('allow-current-db') === 'RESTORE_CURRENT_DATABASE';
    if (strcasecmp($targetDb, $currentDb) === 0 && !$allowCurrentDb) {
        throw new RuntimeException('Restore no banco atual bloqueado. Use banco temporario ou --allow-current-db=RESTORE_CURRENT_DATABASE.');
    }

    $allowLegacyManifest = restoreCliOption('allow-legacy-manifest') === 'REVIEWED_LEGACY_BACKUP';
    $validation = restoreAssertBackupFileIsValid($backupPath);
    $validation['manifest'] = restoreReadManifest($backupPath, $allowLegacyManifest);
    $executeToken = (string) restoreCliOption('execute', '');
    $shouldExecute = $executeToken === 'RESTORE_BACKUP';
    $createDb = restoreCliOption('create-db', '1') !== '0';
    $dropExistingTarget = restoreCliOption('drop-target-db') === 'DROP_TARGET_DATABASE';

    if (!$shouldExecute) {
        echo json_encode([
            'success' => true,
            'dry_run' => true,
            'message' => 'Backup validado. Para restaurar, rode novamente com --execute=RESTORE_BACKUP.',
            'target_db' => $targetDb,
            'create_db' => $createDb,
            'drop_target_db' => $dropExistingTarget,
            'legacy_manifest_allowed' => $allowLegacyManifest,
            'validation' => $validation,
            'checked_at' => gmdate(DATE_ATOM),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
        exit(0);
    }

    $dbUser = restoreRequireValue('DB_USER');
    $dbPassword = getEnvString('DB_PASSWORD', getEnvString('DB_PASS'));
    $dbHost = getEnvString('DB_HOST', 'localhost');
    $dbPort = getEnvString('DB_PORT', '3306');
    $mysqlPath = restoreCliOption('mysql', getEnvString('MYSQL_PATH', 'mysql'));
    $defaultsFile = restoreCreateDefaultsFile($dbUser, $dbPassword, $dbHost, $dbPort);

    try {
        if ($dropExistingTarget) {
            $dropCommand = escapeshellarg((string) $mysqlPath)
                . ' --defaults-extra-file=' . escapeshellarg($defaultsFile)
                . ' --execute=' . escapeshellarg('DROP DATABASE IF EXISTS `' . str_replace('`', '``', $targetDb) . '`');
            $dropResult = restoreRunCommand($dropCommand);
            if (($dropResult['exit_code'] ?? 1) !== 0) {
                throw new RuntimeException('Falha ao remover banco de destino: ' . (string) ($dropResult['output'] ?? 'sem saida'));
            }
        }

        if ($createDb) {
            $createCommand = escapeshellarg((string) $mysqlPath)
                . ' --defaults-extra-file=' . escapeshellarg($defaultsFile)
                . ' --execute=' . escapeshellarg('CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '``', $targetDb) . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
            $createResult = restoreRunCommand($createCommand);
            if (($createResult['exit_code'] ?? 1) !== 0) {
                throw new RuntimeException('Falha ao criar banco de destino: ' . (string) ($createResult['output'] ?? 'sem saida'));
            }
        }

        $restoreCommand = escapeshellarg((string) $mysqlPath)
            . ' --defaults-extra-file=' . escapeshellarg($defaultsFile)
            . ' --default-character-set=utf8mb4 '
            . escapeshellarg($targetDb)
            . ' < ' . escapeshellarg((string) $validation['backup_file']);
        $restoreResult = restoreRunCommand($restoreCommand);
    } finally {
        @unlink($defaultsFile);
    }

    if (($restoreResult['exit_code'] ?? 1) !== 0) {
        throw new RuntimeException('Restore falhou: ' . (string) ($restoreResult['output'] ?? 'sem saida'));
    }

    echo json_encode([
        'success' => true,
        'dry_run' => false,
        'target_db' => $targetDb,
        'created_db_if_needed' => $createDb,
        'dropped_target_db' => $dropExistingTarget,
        'validation' => $validation,
        'restored_at' => gmdate(DATE_ATOM),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}
