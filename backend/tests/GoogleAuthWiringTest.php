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

function assertContainsGoogleAuth(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';
$service = $base . '/modules/auth/services/AuthService.php';

assertContainsGoogleAuth(
    $service,
    'Credencial do Google emitida para outro aplicativo.',
    'Google login must validate the token audience against the configured Client ID'
);

assertContainsGoogleAuth(
    $service,
    'isValidGoogleClientId',
    'Google login must validate Client ID format before accepting OAuth tokens'
);

assertContainsGoogleAuth(
    $service,
    '/^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i',
    'Google Client ID validation must require the official web client ID format'
);

assertContainsGoogleAuth(
    $service,
    'Login com Google nao configurado corretamente.',
    'Google login must fail clearly when the backend Client ID is a placeholder or malformed'
);

fwrite(STDOUT, "Google auth wiring assertions passed.\n");
