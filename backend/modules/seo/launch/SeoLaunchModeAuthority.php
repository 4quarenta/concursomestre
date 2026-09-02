<?php

declare(strict_types=1);

require_once __DIR__ . '/SeoLaunchMode.php';

/**
 * Single runtime authority for launch mode. The file is shared by PHP and
 * Next at runtime, while environment remains an isolated-test fallback.
 */
final class SeoLaunchModeAuthority
{
    public static function path(): string
    {
        $configured = trim((string) (getenv('SEO_LAUNCH_MODE_FILE') ?: ''));
        return $configured !== ''
            ? $configured
            : dirname(__DIR__, 4) . '/storage/runtime/seo-launch-mode.json';
    }

    public static function read(): string
    {
        $path = self::path();
        if (is_file($path) && is_readable($path)) {
            $payload = json_decode((string) file_get_contents($path), true);
            if (is_array($payload) && isset($payload['mode'])) {
                return SeoLaunchMode::normalize($payload['mode']);
            }
        }

        return SeoLaunchMode::normalize(getenv('SEO_LAUNCH_MODE') ?: null);
    }

    public static function write(string $mode, string $adminUserId, string $correlationId): array
    {
        $normalized = SeoLaunchMode::normalize($mode);
        $path = self::path();
        $directory = dirname($path);
        if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
            throw new RuntimeException('Diretorio de launch mode indisponivel.');
        }
        if (!is_writable($directory)) {
            throw new RuntimeException('Diretorio de launch mode sem permissao de escrita.');
        }

        $previous = self::read();
        $payload = [
            'mode' => $normalized,
            'updated_at' => gmdate(DATE_ATOM),
            'updated_by' => $adminUserId,
            'correlation_id' => $correlationId,
        ];
        $temporary = $path . '.' . bin2hex(random_bytes(8)) . '.tmp';
        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
        $previousUmask = umask(0077);
        try {
            if (file_put_contents($temporary, $json, LOCK_EX) === false || !rename($temporary, $path)) {
                throw new RuntimeException('Nao foi possivel publicar launch mode atomically.');
            }
            @chmod($path, 0660);
        } finally {
            umask($previousUmask);
            if (is_file($temporary)) {
                @unlink($temporary);
            }
        }

        return ['previousMode' => $previous, 'mode' => $normalized, 'path' => $path];
    }

    private function __construct()
    {
    }
}
