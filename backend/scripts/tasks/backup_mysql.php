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
require_once __DIR__ . '/../../shared/database/BackupArtifactPublisher.php';
require_once __DIR__ . '/../../shared/database/BackupDatabaseConfig.php';
require_once __DIR__ . '/../../shared/database/BackupManifestInventory.php';
require_once __DIR__ . '/../../shared/database/BackupManifestContract.php';
require_once __DIR__ . '/../../shared/database/BackupPitrAnchor.php';
require_once __DIR__ . '/../../shared/health/ReleaseMetadata.php';

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

function backupConfiguredMode(string $key, int $fallback): int
{
    $raw = getEnvString($key);
    if ($raw === '') {
        return $fallback;
    }
    if (preg_match('/^0?[0-7]{3,4}$/', $raw) !== 1) {
        throw new RuntimeException($key . ' invalido; use modo octal, por exemplo 0750.');
    }
    $mode = octdec(ltrim($raw, '0'));
    if ($mode < 0600 || $mode > 0777) {
        throw new RuntimeException($key . ' fora do intervalo permitido.');
    }
    return $mode;
}

function backupResolveDirectory(): string
{
    $directory = backupCliOption('dir', getEnvString('BACKUP_DIR', dirname(__DIR__, 2) . '/storage/backups'));
    $directory = rtrim(str_replace('\\', '/', (string) $directory), '/');

    if ($directory === '') {
        throw new RuntimeException('Diretorio de backup invalido.');
    }

    return BackupArtifactPublisher::ensurePrivateDirectory(
        $directory,
        backupConfiguredMode('BACKUP_DIRECTORY_MODE', 0750)
    );
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
            if (is_file($file . '.manifest.json')) {
                @unlink($file . '.manifest.json');
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

    foreach (glob($directory . '/concursomestre-*.sql.manifest.json') ?: [] as $file) {
        $backupFile = substr($file, 0, -strlen('.manifest.json'));
        if (is_file($file) && !is_file($backupFile) && filemtime($file) !== false && filemtime($file) < $cutoff) {
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

function backupToolVersion(string $toolPath): string
{
    $result = backupRunCommand(escapeshellarg($toolPath) . ' --version');
    $version = trim($result['output']);
    if ($result['exit_code'] !== 0 || $version === '') {
        throw new RuntimeException('Versao da ferramenta de backup indisponivel.');
    }
    return $version;
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

    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json !== false) {
        BackupArtifactPublisher::writeAtomic($path, $json . PHP_EOL, backupConfiguredMode('BACKUP_FILE_MODE', 0600));
    }
}

try {
    $databaseConfig = BackupDatabaseConfig::fromEnvironment();
    $dbName = $databaseConfig['name'];
    $dbUser = $databaseConfig['user'];
    $dbPassword = $databaseConfig['password'];
    $dbHost = $databaseConfig['host'];
    $dbPort = $databaseConfig['port'];
    $mysqldumpPath = backupCliOption('mysqldump', getEnvString('MYSQLDUMP_PATH', 'mysqldump'));
    $retentionDays = max(0, (int) backupCliOption('retention-days', getEnvString('BACKUP_RETENTION_DAYS', '14')));
    $backupFileMode = backupConfiguredMode('BACKUP_FILE_MODE', 0600);
    $directory = backupResolveDirectory();
    $timestamp = date('Ymd-His') . '-' . bin2hex(random_bytes(4));
    $startedAtUtc = gmdate(DATE_ATOM);
    $backupToolVersion = backupToolVersion((string) $mysqldumpPath);
    $backupPath = $directory . '/concursomestre-' . $timestamp . '.sql';
    $temporaryPath = BackupArtifactPublisher::temporaryPath($directory, basename($backupPath));
    $defaultsFile = backupCreateDefaultsFile($dbUser, $dbPassword, $dbHost, $dbPort);
    $previousUmask = umask(0077);

    try {
        $command = escapeshellarg((string) $mysqldumpPath)
            . ' --defaults-extra-file=' . escapeshellarg($defaultsFile)
            . ' --single-transaction --quick --routines --triggers --events --source-data=2 --set-gtid-purged=COMMENTED --no-tablespaces --default-character-set=utf8mb4 '
            . escapeshellarg($dbName)
            . ' --result-file=' . escapeshellarg($temporaryPath);

        $result = backupRunCommand($command);
    } finally {
        @unlink($defaultsFile);
    }

    if (($result['exit_code'] ?? 1) !== 0 || !is_file($temporaryPath) || filesize($temporaryPath) === 0) {
        @unlink($temporaryPath);
        umask($previousUmask);
        throw new RuntimeException('mysqldump falhou: ' . (string) ($result['output'] ?? 'sem saida'));
    }

    $sample = (string) file_get_contents($temporaryPath, false, null, 0, 1048576);
    $hasDumpMarker = stripos($sample, 'CREATE TABLE') !== false
        || stripos($sample, 'INSERT INTO') !== false
        || stripos($sample, 'Table structure for table') !== false
        || stripos($sample, 'MariaDB dump') !== false
        || stripos($sample, 'MySQL dump') !== false;
    if (!$hasDumpMarker) {
        @unlink($temporaryPath);
        umask($previousUmask);
        throw new RuntimeException('Arquivo gerado nao parece ser um dump SQL MySQL/MariaDB.');
    }

    $checksum = hash_file('sha256', $temporaryPath);
    if ($checksum === false) {
        @unlink($temporaryPath);
        umask($previousUmask);
        throw new RuntimeException('Nao foi possivel gerar checksum do backup.');
    }

    $pitrAnchor = BackupPitrAnchor::fromDump($temporaryPath);

    try {
        BackupArtifactPublisher::publish($temporaryPath, $backupPath, $backupFileMode);
        $checksumPath = BackupArtifactPublisher::writeChecksum($backupPath, $checksum, $backupFileMode);
        $pdo = new PDO(
            'mysql:host=' . $dbHost . ';port=' . $dbPort . ';dbname=' . $dbName . ';charset=utf8mb4',
            $dbUser,
            $dbPassword,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
        $release = ReleaseMetadata::read();
        $applicationSha = getEnvString('BACKUP_APPLICATION_SHA', (string) ($release['commit'] ?? ''));
        $inventory = BackupManifestInventory::collect(
            $pdo,
            $dbName,
            dirname(__DIR__, 2) . '/database/migrations',
            $applicationSha,
            $pitrAnchor
        );
        $manifest = [
            'format_version' => BackupManifestContract::FORMAT_VERSION,
            'backup_id' => $timestamp,
            'started_at_utc' => $startedAtUtc,
            'completed_at_utc' => gmdate(DATE_ATOM),
            'database_engine' => $inventory['db_engine'],
            'database_version' => $inventory['db_version'],
            'backup_tool' => 'mysqldump',
            'backup_tool_version' => $backupToolVersion,
            'filename' => basename($backupPath),
            'file_size' => (int) filesize($backupPath),
            'sha256' => $checksum,
            'result' => 'success',
            'created_at' => gmdate(DATE_ATOM),
            ...$inventory,
            'dump_size' => filesize($backupPath),
            'dump_sha256' => $checksum,
        ];
        BackupManifestContract::assertValid($manifest);
        $manifestPath = BackupArtifactPublisher::writeManifest($backupPath, $manifest, $backupFileMode);
    } catch (Throwable $exception) {
        @unlink($temporaryPath);
        @unlink($backupPath);
        @unlink($backupPath . '.sha256');
        @unlink($backupPath . '.manifest.json');
        umask($previousUmask);
        throw $exception;
    }
    umask($previousUmask);

    $removed = backupRemoveOldFiles($directory, $retentionDays);

    $payload = [
        'success' => true,
        'status' => 'ok',
        'backup_file' => $backupPath,
        'checksum_file' => $checksumPath,
        'manifest_file' => $manifestPath,
        'sha256' => $checksum,
        'size_bytes' => filesize($backupPath),
        'retention_days' => $retentionDays,
        'removed_old_files' => $removed,
        'credential_source' => $databaseConfig['source'],
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
