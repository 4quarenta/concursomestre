<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/database/BackupArtifactPublisher.php';

/**
 * Creates private, content-addressed local asset archives for DR rehearsal.
 * Off-host replication is deliberately outside this class and must be wired
 * to an approved provider before production rollout.
 */
final class AssetBackupManager
{
    public function __construct(private readonly int $directoryMode = 0750, private readonly int $fileMode = 0600)
    {
    }

    /** @return array<string, mixed> */
    public function createArchive(string $sourceDirectory, string $destinationDirectory, string $artifactId): array
    {
        $sourceDirectory = rtrim(str_replace('\\', '/', $sourceDirectory), '/');
        if ($sourceDirectory === '' || !is_dir($sourceDirectory)) {
            throw new RuntimeException('Diretorio de assets ausente.');
        }
        $destinationDirectory = BackupArtifactPublisher::ensurePrivateDirectory($destinationDirectory, $this->directoryMode);
        $safeId = $this->normalizeArtifactId($artifactId);
        $archivePath = $destinationDirectory . '/assets-' . $safeId . '.tar';
        $temporaryPath = BackupArtifactPublisher::temporaryPath($destinationDirectory, basename($archivePath));
        $fileCount = 0;
        $totalBytes = 0;

        try {
            $archive = new PharData($temporaryPath);
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($sourceDirectory, FilesystemIterator::SKIP_DOTS)
            );
            foreach ($iterator as $fileInfo) {
                if (!$fileInfo instanceof SplFileInfo || !$fileInfo->isFile() || $fileInfo->isLink()) {
                    continue;
                }
                $absolute = str_replace('\\', '/', $fileInfo->getPathname());
                $relative = ltrim(substr($absolute, strlen($sourceDirectory)), '/');
                $this->assertSafeRelativePath($relative);
                $archive->addFile($absolute, $relative);
                $fileCount++;
                $totalBytes += max(0, (int) $fileInfo->getSize());
            }
            unset($archive);
            $checksum = hash_file('sha256', $temporaryPath);
            if (!is_string($checksum)) {
                throw new RuntimeException('Nao foi possivel calcular checksum dos assets.');
            }
            BackupArtifactPublisher::publish($temporaryPath, $archivePath, $this->fileMode);
            $manifest = [
                'format_version' => 1,
                'created_at' => gmdate(DATE_ATOM),
                'source_classification' => 'LOCAL_ASSET_SNAPSHOT',
                'file_count' => $fileCount,
                'total_bytes' => $totalBytes,
                'archive_size' => filesize($archivePath),
                'archive_sha256' => $checksum,
            ];
            BackupArtifactPublisher::writeAtomic(
                $archivePath . '.manifest.json',
                (string) json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL,
                $this->fileMode
            );
            return [...$manifest, 'archive_path' => $archivePath, 'manifest_path' => $archivePath . '.manifest.json'];
        } finally {
            if (is_file($temporaryPath)) {
                @unlink($temporaryPath);
            }
        }
    }

    /** @return array{file_count:int, total_bytes:int, archive_sha256:string} */
    public function restoreArchive(string $archivePath, string $targetDirectory): array
    {
        $archivePath = str_replace('\\', '/', $archivePath);
        if (!is_file($archivePath) || !is_readable($archivePath)) {
            throw new RuntimeException('Arquivo de assets ausente.');
        }
        $manifestPath = $archivePath . '.manifest.json';
        if (!is_file($manifestPath)) {
            throw new RuntimeException('Manifest de assets ausente.');
        }
        $manifest = json_decode((string) file_get_contents($manifestPath), true);
        $checksum = hash_file('sha256', $archivePath);
        if (!is_array($manifest) || !is_string($checksum) || !hash_equals((string) ($manifest['archive_sha256'] ?? ''), $checksum)) {
            throw new RuntimeException('Checksum de assets divergente.');
        }
        $archive = new PharData($archivePath);
        foreach (new RecursiveIteratorIterator($archive) as $entry) {
            $entryPath = str_replace('\\', '/', (string) $entry->getPathName());
            $archivePrefix = 'phar://' . rtrim(str_replace('\\', '/', $archivePath), '/') . '/';
            if (!str_starts_with($entryPath, $archivePrefix)) {
                throw new RuntimeException('Entrada de asset fora do arquivo.');
            }
            $this->assertSafeRelativePath(substr($entryPath, strlen($archivePrefix)));
        }
        $targetDirectory = BackupArtifactPublisher::ensurePrivateDirectory($targetDirectory, $this->directoryMode);
        $archive->extractTo($targetDirectory, null, true);
        return [
            'file_count' => (int) ($manifest['file_count'] ?? 0),
            'total_bytes' => (int) ($manifest['total_bytes'] ?? 0),
            'archive_sha256' => $checksum,
        ];
    }

    private function normalizeArtifactId(string $artifactId): string
    {
        $artifactId = trim($artifactId);
        if ($artifactId === '' || preg_match('/^[A-Za-z0-9._-]+$/', $artifactId) !== 1) {
            throw new InvalidArgumentException('Identificador de asset invalido.');
        }
        return $artifactId;
    }

    private function assertSafeRelativePath(string $path): void
    {
        if ($path === '' || str_starts_with($path, '/') || str_contains($path, '\\') || str_contains($path, '..')) {
            throw new RuntimeException('Caminho de asset inseguro.');
        }
    }
}
