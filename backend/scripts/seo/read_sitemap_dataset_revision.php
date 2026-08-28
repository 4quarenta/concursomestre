<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este leitor so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/seo/sitemaps/StaticSitemapDatasetRevision.php';

$authority = StaticSitemapDatasetRevision::current((new Database('read'))->getConnection());
fwrite(STDOUT, json_encode([
    'status' => 'revision',
    'version' => StaticSitemapDatasetRevision::VERSION,
    'revision' => $authority['revision'],
    'token' => $authority['token'],
], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL);
