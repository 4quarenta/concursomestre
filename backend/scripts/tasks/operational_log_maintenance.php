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

function logMaintenanceCliOption(string $name, ?string $fallback = null): ?string
{
    global $argv;

    foreach ($argv as $argument) {
        if (strpos($argument, '--' . $name . '=') === 0) {
            return substr($argument, strlen($name) + 3);
        }
    }

    return $fallback;
}

function logMaintenanceBoolOption(string $name, bool $fallback): bool
{
    $value = logMaintenanceCliOption($name);
    if ($value === null) {
        return $fallback;
    }

    return filter_var($value, FILTER_VALIDATE_BOOLEAN);
}

function logMaintenanceNormalizePath(string $path): string
{
    return rtrim(str_replace('\\', '/', trim($path)), '/');
}

function logMaintenanceBackendRoot(): string
{
    return logMaintenanceNormalizePath(dirname(__DIR__, 2));
}

function logMaintenanceStorageLogRoot(): string
{
    return logMaintenanceNormalizePath(logMaintenanceBackendRoot() . '/storage/logs');
}

function logMaintenancePathInside(string $path, string $directory): bool
{
    $path = logMaintenanceNormalizePath($path);
    $directory = logMaintenanceNormalizePath($directory);

    $pathLower = strtolower($path);
    $directoryLower = strtolower($directory);

    return $pathLower === $directoryLower || str_starts_with($pathLower, $directoryLower . '/');
}

function logMaintenanceEnsureDirectory(string $directory): void
{
    if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
        throw new RuntimeException('Nao foi possivel criar o diretorio: ' . $directory);
    }

    if (!is_writable($directory)) {
        throw new RuntimeException('Diretorio sem permissao de escrita: ' . $directory);
    }
}

/**
 * @return string[]
 */
function logMaintenanceDefaultFiles(): array
{
    $root = logMaintenanceStorageLogRoot();
    if (!is_dir($root)) {
        return [];
    }

    $files = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iterator as $fileInfo) {
        if (!$fileInfo instanceof SplFileInfo || !$fileInfo->isFile()) {
            continue;
        }

        $path = logMaintenanceNormalizePath($fileInfo->getPathname());
        if (strtolower($fileInfo->getExtension()) !== 'log') {
            continue;
        }

        if (logMaintenancePathInside($path, $root . '/archive')) {
            continue;
        }

        $files[] = $path;
    }

    sort($files);

    return $files;
}

/**
 * @return string[]
 */
function logMaintenanceResolveFiles(): array
{
    $raw = trim((string) logMaintenanceCliOption('files', getEnvString('LOG_MAINTENANCE_FILES', '')));
    if ($raw === '') {
        return logMaintenanceDefaultFiles();
    }

    $files = [];
    foreach (array_map('trim', explode(',', $raw)) as $item) {
        if ($item === '') {
            continue;
        }

        $matches = glob(str_replace('\\', '/', $item));
        if (is_array($matches) && $matches !== []) {
            foreach ($matches as $match) {
                if (is_file($match)) {
                    $files[] = logMaintenanceNormalizePath($match);
                }
            }
            continue;
        }

        $files[] = logMaintenanceNormalizePath($item);
    }

    $files = array_values(array_unique($files));
    sort($files);

    return $files;
}

function logMaintenanceAssertSafeFile(string $path): void
{
    $backendRoot = logMaintenanceBackendRoot();
    $apiRoot = $backendRoot . '/api';

    if (logMaintenancePathInside($path, $apiRoot)) {
        throw new RuntimeException('Logs dentro de api/ nao podem ser mantidos por este script: ' . $path);
    }

    if (strtolower(pathinfo($path, PATHINFO_EXTENSION)) !== 'log') {
        throw new RuntimeException('Somente arquivos .log podem ser rotacionados: ' . $path);
    }
}

function logMaintenanceArchivePath(string $source, string $archiveDirectory, string $timestamp): string
{
    $storageRoot = logMaintenanceStorageLogRoot();
    $relative = logMaintenancePathInside($source, $storageRoot)
        ? substr(logMaintenanceNormalizePath($source), strlen($storageRoot) + 1)
        : basename($source);
    $safeName = preg_replace('/[^a-z0-9._-]+/i', '__', $relative) ?: basename($source);

    $archivePath = $archiveDirectory . '/' . $safeName . '.' . $timestamp . '.rotated.log';
    if (!is_file($archivePath)) {
        return $archivePath;
    }

    return $archiveDirectory . '/' . $safeName . '.' . $timestamp . '.' . bin2hex(random_bytes(3)) . '.rotated.log';
}

/**
 * @return array{rotated: bool, archive_file: ?string, reason: string}
 */
function logMaintenanceRotateFile(string $path, string $archiveDirectory, int $maxBytes, string $timestamp, bool $dryRun): array
{
    if (!is_file($path)) {
        return ['rotated' => false, 'archive_file' => null, 'reason' => 'missing'];
    }

    if (!is_readable($path) || !is_writable($path)) {
        return ['rotated' => false, 'archive_file' => null, 'reason' => 'not_readable_or_writable'];
    }

    $size = filesize($path);
    if ($size === false || $size < $maxBytes) {
        return ['rotated' => false, 'archive_file' => null, 'reason' => 'below_threshold'];
    }

    $archivePath = logMaintenanceArchivePath($path, $archiveDirectory, $timestamp);
    if ($dryRun) {
        return ['rotated' => true, 'archive_file' => $archivePath, 'reason' => 'dry_run'];
    }

    if (!copy($path, $archivePath)) {
        throw new RuntimeException('Nao foi possivel copiar log para arquivo rotacionado: ' . $path);
    }

    if (file_put_contents($path, '', LOCK_EX) === false) {
        @unlink($archivePath);
        throw new RuntimeException('Nao foi possivel truncar log apos rotacao: ' . $path);
    }

    @chmod($archivePath, 0640);

    return ['rotated' => true, 'archive_file' => $archivePath, 'reason' => 'rotated'];
}

function logMaintenanceCleanupArchives(string $archiveDirectory, int $retentionDays, bool $dryRun): int
{
    if ($retentionDays <= 0 || !is_dir($archiveDirectory)) {
        return 0;
    }

    $removed = 0;
    $cutoff = time() - ($retentionDays * 86400);
    foreach (glob($archiveDirectory . '/*.rotated.log') ?: [] as $file) {
        if (!is_file($file)) {
            continue;
        }

        $mtime = filemtime($file);
        if ($mtime === false || $mtime >= $cutoff) {
            continue;
        }

        if (!$dryRun) {
            @unlink($file);
        }
        $removed++;
    }

    return $removed;
}

function logMaintenanceHealthPath(): string
{
    return logMaintenanceNormalizePath((string) logMaintenanceCliOption(
        'health-path',
        getEnvString('LOG_MAINTENANCE_HEALTH_PATH', logMaintenanceStorageLogRoot() . '/operations/log_maintenance_health.json')
    ));
}

function logMaintenanceWriteHealth(array $payload): void
{
    $path = logMaintenanceHealthPath();
    if ($path === '') {
        return;
    }

    $directory = dirname($path);
    if (!is_dir($directory)) {
        @mkdir($directory, 0770, true);
    }

    $payload['task'] = 'operational_log_maintenance';
    $payload['last_run_at'] = $payload['last_run_at'] ?? gmdate(DATE_ATOM);

    @file_put_contents(
        $path,
        json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL,
        LOCK_EX
    );
}

try {
    $files = logMaintenanceResolveFiles();
    $maxBytes = max(1024, (int) logMaintenanceCliOption('rotate-max-bytes', getEnvString('LOG_ROTATE_MAX_BYTES', '10485760')));
    $retentionDays = max(0, (int) logMaintenanceCliOption('retention-days', getEnvString('LOG_RETENTION_DAYS', '30')));
    $dryRun = logMaintenanceBoolOption('dry-run', false);
    $requireFiles = logMaintenanceBoolOption('require-files', filter_var(getEnvString('LOG_MAINTENANCE_REQUIRE_FILES', 'false'), FILTER_VALIDATE_BOOLEAN));
    $archiveDirectory = logMaintenanceNormalizePath((string) logMaintenanceCliOption(
        'archive-dir',
        getEnvString('LOG_ROTATE_ARCHIVE_DIR', logMaintenanceStorageLogRoot() . '/archive')
    ));

    logMaintenanceEnsureDirectory($archiveDirectory);

    if ($files === [] && $requireFiles) {
        throw new RuntimeException('Nenhum arquivo de log encontrado para manutencao.');
    }

    $timestamp = gmdate('Ymd-His');
    $checked = [];
    $rotated = [];
    $skipped = [];

    foreach ($files as $path) {
        logMaintenanceAssertSafeFile($path);
        $result = logMaintenanceRotateFile($path, $archiveDirectory, $maxBytes, $timestamp, $dryRun);
        $checked[] = [
            'path' => $path,
            'size_bytes' => is_file($path) ? (filesize($path) ?: 0) : 0,
            'rotated' => $result['rotated'],
            'archive_file' => $result['archive_file'],
            'reason' => $result['reason'],
        ];

        if ($result['rotated']) {
            $rotated[] = $checked[count($checked) - 1];
        } else {
            $skipped[] = $checked[count($checked) - 1];
        }
    }

    $removedOldArchives = logMaintenanceCleanupArchives($archiveDirectory, $retentionDays, $dryRun);

    $payload = [
        'success' => true,
        'status' => 'ok',
        'dry_run' => $dryRun,
        'rotate_max_bytes' => $maxBytes,
        'retention_days' => $retentionDays,
        'archive_dir' => $archiveDirectory,
        'files_checked' => count($checked),
        'rotated_count' => count($rotated),
        'removed_old_archives' => $removedOldArchives,
        'checked' => $checked,
        'created_at' => gmdate(DATE_ATOM),
    ];

    logMaintenanceWriteHealth($payload);
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    $payload = [
        'success' => false,
        'status' => 'error',
        'message' => $e->getMessage(),
        'created_at' => gmdate(DATE_ATOM),
    ];
    logMaintenanceWriteHealth($payload);

    fwrite(STDERR, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}
