<?php

declare(strict_types=1);

require_once __DIR__ . '/StaticSitemapArtifactState.php';

final class StaticSitemapMutationInvalidator
{
    /** @param array<string, scalar|null> $context */
    public static function invalidate(string $reason, array $context = []): void
    {
        $outputDirectory = trim((string) (
            getenv('SITEMAP_OUTPUT_DIR')
            ?: dirname(__DIR__, 3) . '/storage/sitemaps'
        ));
        $state = new StaticSitemapArtifactState($outputDirectory);
        if (($state->read()['state'] ?? null) === 'DIRTY') {
            return;
        }
        $state->invalidate($reason, $context);
    }
}
