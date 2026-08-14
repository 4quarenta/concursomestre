<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este validador so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../modules/seo/sitemaps/StaticSitemapValidator.php';

$options = getopt('', ['directory:', 'origin::', 'base-url::']);
$directory = trim((string) ($options['directory'] ?? getenv('SITEMAP_OUTPUT_DIR') ?: dirname(__DIR__, 2) . '/storage/sitemaps'));
$baseUrl = trim((string) ($options['base-url'] ?? getenv('CANONICAL_BASE_URL') ?: 'https://concursomestre.com'));
$origin = isset($options['origin']) ? trim((string) $options['origin']) : null;

$validator = new StaticSitemapValidator($baseUrl);
$report = $validator->validateDirectory($directory, $origin !== '' ? $origin : null);
fwrite(STDOUT, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
exit(($report['valid'] ?? false) === true ? 0 : 1);
