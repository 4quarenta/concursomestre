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

require_once 'C:/xampp/htdocs/questao-pro-backend/shared/auth/AuthConfig.php';

function assertSameIp(?string $expected, ?string $actual, string $message): void
{
    if ($expected !== $actual) {
        throw new RuntimeException($message . " Expected [{$expected}] but received [{$actual}].");
    }
}

$originalServer = $_SERVER;

try {
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
} finally {
    $_SERVER = $originalServer;
}

fwrite(STDOUT, "Auth client IP behavior assertions passed.\n");
