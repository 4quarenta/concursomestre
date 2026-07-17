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

function assertContainsCronHardening(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function assertNotContainsCronHardening(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content !== false && strpos($content, $needle) !== false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsCronHardening(
    $base . '/modules/users/routes.php',
    "getenv('CRON_SECRET') ?? ''",
    'Users cron secret must fail closed when the environment variable is absent'
);

assertContainsCronHardening(
    $base . '/modules/users/routes.php',
    "throw new RuntimeException('CRON_SECRET nao configurado.');",
    'Users routes must expose a clear cron secret misconfiguration error'
);

assertNotContainsCronHardening(
    $base . '/modules/users/routes.php',
    'SECURE_CRON_KEY_123',
    'Users routes must not ship a hardcoded cron secret fallback'
);

assertContainsCronHardening(
    $base . '/modules/subscriptions/routes.php',
    "getenv('CRON_SECRET') ?? ''",
    'Subscriptions cron secret must fail closed when the environment variable is absent'
);

assertContainsCronHardening(
    $base . '/modules/subscriptions/routes.php',
    "throw new RuntimeException('CRON_SECRET nao configurado.');",
    'Subscriptions routes must expose a clear cron secret misconfiguration error'
);

assertNotContainsCronHardening(
    $base . '/modules/subscriptions/routes.php',
    'SECURE_CRON_KEY_123',
    'Subscriptions routes must not ship a hardcoded cron secret fallback'
);

fwrite(STDOUT, "Cron secret hardening wiring assertions passed.\n");
