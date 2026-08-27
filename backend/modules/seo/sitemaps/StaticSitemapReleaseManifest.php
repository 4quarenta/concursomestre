<?php

declare(strict_types=1);

final class StaticSitemapReleaseManifest
{
    public const VERSION = 'sitemap-release-manifest.v1';
    public const FILENAME = 'sitemap-release-manifest.json';

    /** @return array<string,mixed> */
    public static function create(string $directory, string $logicalFingerprint): array
    {
        self::assertSha256($logicalFingerprint, 'Fingerprint logico invalido para o manifest.');

        $files = [];
        foreach (glob(rtrim($directory, '/\\') . DIRECTORY_SEPARATOR . '*.xml') ?: [] as $path) {
            if (!is_file($path)) continue;
            $hash = hash_file('sha256', $path);
            $size = filesize($path);
            if (!is_string($hash) || $size === false) {
                throw new RuntimeException('Nao foi possivel inspecionar ' . basename($path) . '.');
            }
            $files[] = ['name' => basename($path), 'sha256' => $hash, 'size' => $size];
        }
        usort($files, static fn (array $a, array $b): int => strcmp((string) $a['name'], (string) $b['name']));
        if ($files === [] || !in_array('sitemap.xml', array_column($files, 'name'), true)) {
            throw new RuntimeException('Release de sitemap sem indice canonico.');
        }

        $references = self::indexReferences($directory . DIRECTORY_SEPARATOR . 'sitemap.xml');
        $expectedReferences = array_values(array_map(
            static fn (array $file): string => (string) $file['name'],
            array_filter($files, static fn (array $file): bool => ($file['name'] ?? null) !== 'sitemap.xml')
        ));
        sort($expectedReferences, SORT_STRING);
        if ($references !== $expectedReferences) {
            throw new RuntimeException('Indice e conjunto fisico do sitemap divergem.');
        }

        $physicalFingerprint = self::physicalFingerprint($files);
        $releaseId = hash('sha256', implode("\0", [self::VERSION, $logicalFingerprint, $physicalFingerprint]));
        return [
            'version' => self::VERSION,
            'artifactStateVersion' => StaticSitemapArtifactState::VERSION,
            'releaseId' => $releaseId,
            'logicalDatasetFingerprint' => $logicalFingerprint,
            'physicalSetFingerprint' => $physicalFingerprint,
            'files' => $files,
            'indexReferences' => $references,
        ];
    }

    /** @param array<string,mixed> $manifest */
    public static function write(string $directory, array $manifest): string
    {
        $json = json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
        $path = rtrim($directory, '/\\') . DIRECTORY_SEPARATOR . self::FILENAME;
        if (file_put_contents($path, $json, LOCK_EX) === false) {
            throw new RuntimeException('Nao foi possivel gravar o manifest do sitemap.');
        }
        return hash('sha256', $json);
    }

    /** @param list<array{name:string,sha256:string,size:int}> $files */
    public static function physicalFingerprint(array $files): string
    {
        usort($files, static fn (array $a, array $b): int => strcmp((string) $a['name'], (string) $b['name']));
        return hash('sha256', json_encode($files, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    }

    /** @return list<string> */
    private static function indexReferences(string $indexPath): array
    {
        $xml = (string) file_get_contents($indexPath);
        preg_match_all('~<loc>https://concursomestre\.com/sitemaps/([^<]+)</loc>~', $xml, $matches);
        $references = array_values(array_unique(array_map('basename', $matches[1] ?? [])));
        sort($references, SORT_STRING);
        return $references;
    }

    private static function assertSha256(string $value, string $message): void
    {
        if (preg_match('/^[a-f0-9]{64}$/', $value) !== 1) {
            throw new InvalidArgumentException($message);
        }
    }

    private function __construct()
    {
    }
}
