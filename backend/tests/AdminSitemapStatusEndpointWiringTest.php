<?php

declare(strict_types=1);

$base = dirname(__DIR__);
$endpoint = $base . '/api/admin/sitemap-status.php';

if (!is_file($endpoint)) {
    throw new RuntimeException('Admin sitemap status endpoint is missing.');
}

$source = (string) file_get_contents($endpoint);
foreach ([
    "new Database('read')",
    'requirePlatformAdminSessionContext($db)',
    'StaticSitemapDatasetRevision::current($db)',
    'StaticSitemapArtifactState($directory)',
    "'/sitemap-status.json'",
] as $needle) {
    if (!str_contains($source, $needle)) {
        throw new RuntimeException('Admin sitemap status endpoint must use the canonical artifact authority: ' . $needle);
    }
}

echo "ADMIN_SITEMAP_STATUS_ENDPOINT_WIRING=PASS\n";
