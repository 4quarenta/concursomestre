<?php

declare(strict_types=1);

/**
 * Publishes database backup artifacts only after the complete file and its
 * metadata have been written and verified in the same directory.
 */
final class BackupArtifactPublisher
{
    public const DEFAULT_DIRECTORY_MODE = 0750;
    public const DEFAULT_FILE_MODE = 0600;

    public static function ensurePrivateDirectory(string $directory, int $mode = self::DEFAULT_DIRECTORY_MODE): string
    {
        $directory = rtrim(str_replace('\\', '/', trim($directory)), '/');
        if ($directory === '' || $directory === '/') {
            throw new InvalidArgumentException('Diretorio de backup invalido.');
        }
        if (!is_dir($directory) && !mkdir($directory, $mode, true) && !is_dir($directory)) {
            throw new RuntimeException('Nao foi possivel criar o diretorio de backup.');
        }
        if (!is_writable($directory)) {
            throw new RuntimeException('Diretorio de backup sem permissao de escrita.');
        }
        @chmod($directory, $mode);
        return $directory;
    }

    public static function temporaryPath(string $directory, string $finalName): string
    {
        $name = basename($finalName);
        if ($name === '' || $name !== $finalName || !preg_match('/^[A-Za-z0-9._-]+$/', $name)) {
            throw new InvalidArgumentException('Nome de artefato de backup invalido.');
        }
        return $directory . '/.' . $name . '.' . bin2hex(random_bytes(12)) . '.partial';
    }

    public static function syncFile(string $path): void
    {
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            throw new RuntimeException('Nao foi possivel abrir o artefato para sincronizacao.');
        }
        try {
            if (function_exists('fsync') && !fsync($handle)) {
                throw new RuntimeException('Nao foi possivel sincronizar o artefato.');
            }
        } finally {
            fclose($handle);
        }
    }

    public static function publish(
        string $temporaryPath,
        string $finalPath,
        int $fileMode = self::DEFAULT_FILE_MODE,
        bool $replaceExisting = false
    ): void
    {
        if (!is_file($temporaryPath) || (int) filesize($temporaryPath) <= 0) {
            throw new RuntimeException('Artefato temporario ausente ou vazio.');
        }
        self::syncFile($temporaryPath);
        if ((!$replaceExisting && file_exists($finalPath)) || is_link($finalPath)) {
            throw new RuntimeException('Artefato final ja existe; publicacao recusada.');
        }
        if (!rename($temporaryPath, $finalPath)) {
            throw new RuntimeException('Nao foi possivel publicar o artefato atomically.');
        }
        @chmod($finalPath, $fileMode);
    }

    public static function writeAtomic(string $path, string $contents, int $fileMode = self::DEFAULT_FILE_MODE): void
    {
        $directory = dirname($path);
        self::ensurePrivateDirectory($directory);
        $temporaryPath = self::temporaryPath($directory, basename($path));
        $previousUmask = umask(0077);
        try {
            if (file_put_contents($temporaryPath, $contents, LOCK_EX) === false) {
                throw new RuntimeException('Nao foi possivel escrever artefato temporario.');
            }
            @chmod($temporaryPath, $fileMode);
            self::publish($temporaryPath, $path, $fileMode, true);
        } finally {
            umask($previousUmask);
            if (is_file($temporaryPath)) {
                @unlink($temporaryPath);
            }
        }
    }

    public static function writeChecksum(string $backupPath, string $checksum, int $fileMode = self::DEFAULT_FILE_MODE): string
    {
        if (!preg_match('/^[a-f0-9]{64}$/i', $checksum)) {
            throw new InvalidArgumentException('Checksum invalido.');
        }
        $checksumPath = $backupPath . '.sha256';
        self::writeAtomic($checksumPath, strtolower($checksum) . '  ' . basename($backupPath) . PHP_EOL, $fileMode);
        return $checksumPath;
    }

    public static function writeManifest(string $backupPath, array $manifest, int $fileMode = self::DEFAULT_FILE_MODE): string
    {
        $manifestPath = $backupPath . '.manifest.json';
        $json = json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new RuntimeException('Nao foi possivel serializar manifest do backup.');
        }
        self::writeAtomic($manifestPath, $json . PHP_EOL, $fileMode);
        return $manifestPath;
    }
}
