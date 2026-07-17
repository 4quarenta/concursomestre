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

function assertContainsSubscriptionsPlanSyncDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function assertNotContainsSubscriptionsPlanSyncDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false) {
        throw new RuntimeException('Nao foi possivel ler o arquivo [' . $path . ']');
    }

    if (strpos($content, $needle) !== false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsSubscriptionsPlanSyncDelegate(
    $base . '/api/subscriptions/sync_plans_mp.php',
    'respondRemovedMercadoPagoSubscriptionsRoute',
    'Removed Mercado Pago plan sync endpoint must return 410 without running legacy flow'
);

assertNotContainsSubscriptionsPlanSyncDelegate(
    $base . '/api/subscriptions/sync_plans_mp.php',
    'config/database.php',
    'Removed Mercado Pago plan sync endpoint must not open MySQL'
);

assertContainsSubscriptionsPlanSyncDelegate(
    $base . '/modules/subscriptions/routes.php',
    'function handleSubscriptionsMercadoPagoPlanSyncRoute',
    'Subscriptions routes must expose Mercado Pago plan sync handler'
);

assertContainsSubscriptionsPlanSyncDelegate(
    $base . '/scripts/tasks/sync_mercadopago_preapproval_plans.php',
    'SubscriptionsMercadoPagoPlanSyncService',
    'CLI task must use the official Mercado Pago plan sync service'
);

fwrite(STDOUT, "Subscriptions plan sync wiring assertions passed.\n");
