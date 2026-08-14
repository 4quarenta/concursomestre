<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este gerador so pode ser executado via CLI.\n");
}

// Compatibility wrapper: production has one operational sitemap authority.
require __DIR__ . '/generate_static_sitemaps.php';
