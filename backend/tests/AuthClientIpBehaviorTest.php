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

require_once __DIR__ . '/../shared/auth/AuthConfig.php';

function assertSameIp(?string $expected, ?string $actual, string $message): void
{
    if ($expected !== $actual) {
        throw new RuntimeException($message . " Expected [{$expected}] but received [{$actual}].");
    }
}

$originalServer = $_SERVER;
$originalTrustProxyHeaders = getenv('AUTH_TRUST_PROXY_HEADERS');
$originalTrustedProxyCidrs = getenv('AUTH_TRUSTED_PROXY_CIDRS');

try {
    putenv('AUTH_TRUST_PROXY_HEADERS=true');
    putenv('AUTH_TRUSTED_PROXY_CIDRS=127.0.0.1/32,::1/128,10.0.0.0/8');
    $_SERVER = [];
    $_SERVER['REMOTE_ADDR'] = '::1';
    $_SERVER['HTTP_CF_CONNECTING_IP'] = '203.0.113.10';
    assertSameIp('203.0.113.10', getAuthClientIp(), 'CF header must take priority over loopback remote address.');

    $_SERVER = [];
    $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
    $_SERVER['HTTP_FORWARDED'] = 'for=198.51.100.25;proto=https;host=app.concursomestre.com, for=10.0.0.2';
    assertSameIp('198.51.100.25', getAuthClientIp(), 'Forwarded header must expose the first public client IP.');

    $_SERVER = [];
    $_SERVER['REMOTE_ADDR'] = '10.0.0.5';
    $_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.77, 10.0.0.5';
    assertSameIp('198.51.100.77', getAuthClientIp(), 'X-Forwarded-For must expose the first public client IP.');

    $_SERVER = [];
    $_SERVER['REMOTE_ADDR'] = '::ffff:127.0.0.1';
    assertSameIp('127.0.0.1', getAuthClientIp(), 'IPv6-mapped IPv4 loopback must be normalized.');

    $_SERVER = [];
    $_SERVER['REMOTE_ADDR'] = '198.51.100.2';
    $_SERVER['HTTP_X_FORWARDED_FOR'] = '203.0.113.8';
    assertSameIp('198.51.100.2', getAuthClientIp(), 'Unlisted proxy must not influence the client IP.');
} finally {
    $_SERVER = $originalServer;
    if ($originalTrustProxyHeaders === false) {
        putenv('AUTH_TRUST_PROXY_HEADERS');
    } else {
        putenv('AUTH_TRUST_PROXY_HEADERS=' . $originalTrustProxyHeaders);
    }
    if ($originalTrustedProxyCidrs === false) {
        putenv('AUTH_TRUSTED_PROXY_CIDRS');
    } else {
        putenv('AUTH_TRUSTED_PROXY_CIDRS=' . $originalTrustedProxyCidrs);
    }
}

fwrite(STDOUT, "Auth client IP behavior assertions passed.\n");
