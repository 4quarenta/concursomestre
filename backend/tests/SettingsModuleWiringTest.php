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

function assertContainsSettingsDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function assertNotContainsSettingsDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) !== false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsSettingsDelegate(
    $base . '/api/settings.php',
    'handlePublicSettingsRoute',
    'Public settings endpoint must delegate to settings module routes'
);

assertContainsSettingsDelegate(
    $base . '/modules/settings/routes.php',
    'function handlePublicSettingsRoute',
    'Settings routes must expose the public settings handler'
);

assertContainsSettingsDelegate(
    $base . '/modules/settings/routes.php',
    '$payload = $controller->show(null);',
    'Public settings route must always request the sanitized public projection'
);

assertNotContainsSettingsDelegate(
    $base . '/modules/settings/routes.php',
    'AuthMiddleware::optionalAuth()',
    'Public settings route must not vary its response by bearer token'
);

assertContainsSettingsDelegate(
    $base . '/modules/admin/services/AdminSettingsService.php',
    "'stripeKey',",
    'Public settings sanitizer must hide legacy Stripe key storage and expose only stripePublishableKey'
);

fwrite(STDOUT, "Settings module wiring assertions passed.\n");
