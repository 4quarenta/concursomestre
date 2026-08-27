<?php

declare(strict_types=1);

$path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';
if (str_contains($path, '/redirect')) {
    header('Location: /canonical-target', true, 308);
    exit;
}
if (str_contains($path, '/missing')) {
    http_response_code(404);
    exit('missing');
}
if (str_contains($path, '/gone')) {
    http_response_code(410);
    exit('gone');
}

$canonical = 'https://concursomestre.com' . $path;
header('Content-Type: text/html; charset=utf-8');
echo '<!doctype html><html><head><link rel="canonical" href="'
    . htmlspecialchars($canonical, ENT_QUOTES, 'UTF-8')
    . '"><meta name="robots" content="index,follow"></head><body><main>fixture</main></body></html>';
