<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Sitemap invalidation is CLI-only.\n");
}

require_once __DIR__ . '/../../modules/seo/sitemaps/StaticSitemapArtifactState.php';
require_once __DIR__ . '/../../modules/seo/sitemaps/StaticSitemapPublisher.php';

$reason = 'CONTENT_ELIGIBILITY_CHANGED';
$withdraw = false;
foreach (array_slice($argv, 1) as $argument) {
    if ($argument === '--withdraw') {
        $withdraw = true;
        continue;
    }
    if (str_starts_with($argument, '--reason=')) {
        $reason = trim(substr($argument, strlen('--reason=')));
        continue;
    }
    throw new InvalidArgumentException('Unknown sitemap invalidation option.');
}

$outputDirectory = trim((string) (getenv('SITEMAP_OUTPUT_DIR') ?: dirname(__DIR__, 2) . '/storage/sitemaps'));
$state = new StaticSitemapArtifactState($outputDirectory);
$publisher = new StaticSitemapPublisher($outputDirectory);
$state->invalidate($reason);
$withdrawn = $withdraw ? $publisher->withdraw() : false;

fwrite(STDOUT, json_encode([
    'status' => 'invalidated',
    'reason' => strtoupper($reason),
    'publicationState' => 'DIRTY',
    'artifactWithdrawn' => $withdrawn,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL);
