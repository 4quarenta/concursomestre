<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

function assertContainsSecurityHeaders(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';
$headers = $base . '/config/security_headers.php';
$cors = $base . '/config/cors.php';

assertContainsSecurityHeaders(
    $headers,
    'X-Content-Type-Options: nosniff',
    'API security headers must prevent MIME sniffing'
);

assertContainsSecurityHeaders(
    $headers,
    'X-Frame-Options: DENY',
    'API security headers must block clickjacking'
);

assertContainsSecurityHeaders(
    $headers,
    "Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'API security headers must apply a restrictive CSP'
);

assertContainsSecurityHeaders(
    $headers,
    'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
    'API security headers must enable HSTS in production'
);

assertContainsSecurityHeaders(
    $cors,
    'applyApiSecurityHeaders();',
    'CORS bootstrap must apply security headers for API endpoints'
);

fwrite(STDOUT, "Security headers wiring assertions passed.\n");
