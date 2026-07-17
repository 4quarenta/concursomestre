<?php

declare(strict_types=1);

/** Metadados da release carregados do manifesto produzido no empacotamento. */
final class ReleaseMetadata
{
    private static ?array $cached = null;

    public static function read(): array
    {
        if (self::$cached !== null) {
            return self::$cached;
        }

        $manifestPath = dirname(__DIR__, 3) . '/release-manifest.json';
        $manifest = [];
        $manifestValid = false;
        if (is_file($manifestPath) && is_readable($manifestPath)) {
            try {
                $decoded = json_decode((string) file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
                if (is_array($decoded)) {
                    $manifest = $decoded;
                    $manifestValid = ($manifest['product'] ?? null) === 'ConcursoMestre'
                        && is_string($manifest['version'] ?? null)
                        && trim((string) ($manifest['version'] ?? '')) !== ''
                        && is_string($manifest['commit'] ?? null)
                        && trim((string) ($manifest['commit'] ?? '')) !== '';
                }
            } catch (Throwable) {
                $manifest = [];
            }
        }

        return self::$cached = [
            'version' => (string) ($manifest['version'] ?? getenv('APP_VERSION') ?: '1.0.0'),
            'commit' => (string) ($manifest['commit'] ?? getenv('APP_RELEASE_COMMIT') ?: 'unknown'),
            'builtAt' => $manifest['generatedAt'] ?? null,
            'manifestValid' => $manifestValid,
        ];
    }
}
