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

function assertContainsBridgeText(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function assertNotContainsBridgeText(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content !== false && strpos($content, $needle) !== false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsBridgeText(
    $base . '/api/settings.php',
    "require_once __DIR__ . '/../config/cors.php';",
    'Public settings bridge must keep CORS handling for browser compatibility'
);

assertContainsBridgeText(
    $base . '/api/settings.php',
    "if ((\$_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {",
    'Public settings bridge must keep the OPTIONS fast-path'
);

assertContainsBridgeText(
    $base . '/api/settings.php',
    'handlePublicSettingsRoute($db);',
    'Public settings bridge must delegate to the official public settings handler'
);

assertContainsBridgeText(
    $base . '/api/upload.php',
    "require_once __DIR__ . '/../config/cors.php';",
    'Legacy upload bridge must keep CORS handling for browser upload flows'
);

assertContainsBridgeText(
    $base . '/api/upload.php',
    'handleMaterialsUploadRoute($db);',
    'Legacy upload bridge must delegate to the official materials upload handler'
);

$cronBridges = [
    $base . '/api/subscriptions/cron_stripe_reconciliation.php' => 'handleSubscriptionsStripeReconciliationCronRoute($db);',
    $base . '/api/tasks/ProcessRewards.php' => 'handleUsersProcessReferralRewardsCronRoute($db);',
];

foreach ($cronBridges as $path => $handler) {
    assertContainsBridgeText(
        $path,
        "require_once __DIR__ . '/../../config/database.php';",
        'Cron bridge must bootstrap the official database config'
    );

    assertContainsBridgeText(
        $path,
        $handler,
        'Cron bridge must delegate to the official module cron handler'
    );

    assertNotContainsBridgeText(
        $path,
        'config/cors.php',
        'Cron bridge must not depend on browser CORS bootstrap'
    );
}

foreach ([
    $base . '/api/subscriptions/cron_recurring.php',
    $base . '/api/subscriptions/cron_scheduled_payments.php',
] as $removedCronBridge) {
    assertContainsBridgeText(
        $removedCronBridge,
        'respondRemovedMercadoPagoSubscriptionsRoute();',
        'Cron HTTP legado deve permanecer como tombstone sem executar cobranca.'
    );
    assertNotContainsBridgeText(
        $removedCronBridge,
        'config/database.php',
        'Tombstone de cron legado nao deve abrir conexao de banco.'
    );
}

fwrite(STDOUT, "API exceptional bridges wiring assertions passed.\n");
