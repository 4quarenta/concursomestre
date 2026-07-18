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

function assertSetupContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertSetupContains(
    $base . '/api/setup/status.php',
    'handleSetupStatusRoute();',
    'Setup status endpoint must delegate to setup routes.'
);

assertSetupContains(
    $base . '/api/setup/install.php',
    'handleSetupInstallRoute();',
    'Setup install endpoint must delegate to setup routes.'
);

assertSetupContains(
    $base . '/modules/setup/services/SetupService.php',
    "SETUP_COMPLETED' => 'true'",
    'Setup install must lock itself after completion.'
);

assertSetupContains(
    $base . '/modules/setup/services/SetupService.php',
    'countAdminUsers($pdo) > 0',
    'Setup install must refuse installation when an admin already exists.'
);

assertSetupContains(
    $base . '/modules/setup/services/SetupService.php',
    'assertSetupInstallToken',
    'Setup install must require a server-side installation token.'
);

assertSetupContains(
    $base . '/modules/setup/services/SetupService.php',
    'storage/setup/install.key',
    'Setup install token must live in server storage, not in the public API response.'
);

assertSetupContains(
    $base . '/modules/setup/services/SetupService.php',
    'existingConfigurationLocked',
    'Setup must fail closed when an existing configured .env cannot reach the database.'
);

assertSetupContains(
    $base . '/modules/setup/services/SetupService.php',
    'inspectDatabaseReadiness',
    'Internal setup validation must inspect production database readiness.'
);

assertSetupContains(
    $base . '/modules/setup/services/SetupService.php',
    'public function getPublicStatus(): array',
    'Setup status must use a dedicated minimal public contract.'
);

assertSetupContains(
    $base . '/modules/setup/routes.php',
    'Response::notFound();',
    'Installed setup status must fail closed with 404.'
);

assertSetupContains(
    $base . '/config/cors.php',
    'isSetupCorsBootstrapOrigin',
    'CORS must support same-host bootstrap before .env exists.'
);

assertSetupContains(
    $base . '/router.php',
    "'setup/'",
    'Router legacy fallback must allow setup endpoints.'
);

fwrite(STDOUT, "Setup installer wiring assertions passed.\n");
