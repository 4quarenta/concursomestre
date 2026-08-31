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

function assertContainsRouteDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function assertNotContainsRouteDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false) {
        throw new RuntimeException('Nao foi possivel ler o arquivo [' . $path . ']');
    }

    if (strpos($content, $needle) !== false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function extractFunctionBlockForCronWiring(string $path, string $functionName): string
{
    $content = file_get_contents($path);
    if ($content === false) {
        throw new RuntimeException('Nao foi possivel ler o arquivo [' . $path . ']');
    }

    $functionPos = strpos($content, 'function ' . $functionName);
    if ($functionPos === false) {
        throw new RuntimeException('Funcao nao encontrada: ' . $functionName . ' [' . $path . ']');
    }

    $bracePos = strpos($content, '{', $functionPos);
    if ($bracePos === false) {
        throw new RuntimeException('Corpo da funcao nao encontrado: ' . $functionName . ' [' . $path . ']');
    }

    $depth = 0;
    $length = strlen($content);
    for ($index = $bracePos; $index < $length; $index++) {
        $char = $content[$index];
        if ($char === '{') {
            $depth++;
        } elseif ($char === '}') {
            $depth--;
            if ($depth === 0) {
                return substr($content, $functionPos, $index - $functionPos + 1);
            }
        }
    }

    throw new RuntimeException('Corpo da funcao incompleto: ' . $functionName . ' [' . $path . ']');
}

function assertFunctionBlockNotContainsForCronWiring(string $path, string $functionName, string $needle, string $message): void
{
    $block = extractFunctionBlockForCronWiring($path, $functionName);
    if (strpos($block, $needle) !== false) {
        throw new RuntimeException($message . ' [' . $path . '::' . $functionName . ']');
    }
}

$base = dirname(__DIR__);

assertContainsRouteDelegate(
    $base . '/api/subscriptions/cron_scheduled_payments.php',
    'respondRemovedMercadoPagoSubscriptionsRoute',
    'Scheduled payments cron bridge must return the removed Mercado Pago response without opening MySQL'
);

assertContainsRouteDelegate(
    $base . '/api/subscriptions/cron_recurring.php',
    'respondRemovedMercadoPagoSubscriptionsRoute',
    'Recurring subscriptions cron bridge must return the removed Mercado Pago response without opening MySQL'
);

assertContainsRouteDelegate(
    $base . '/api/subscriptions/cron_stripe_reconciliation.php',
    'handleSubscriptionsStripeReconciliationCronRoute',
    'Stripe reconciliation cron must delegate to subscriptions routes'
);

assertContainsRouteDelegate(
    $base . '/scripts/tasks/reconcile_stripe_subscriptions.php',
    "PHP_SAPI !== 'cli'",
    'Stripe reconciliation task must be CLI-only for reliable server-side scheduling'
);

assertContainsRouteDelegate(
    $base . '/scripts/tasks/reconcile_stripe_subscriptions.php',
    "acquireCronLockOrThrow('subscriptions_stripe_reconciliation')",
    'Stripe reconciliation CLI task must reuse the same non-overlapping lock'
);

assertContainsRouteDelegate(
    $base . '/scripts/tasks/reconcile_stripe_subscriptions.php',
    'runStripeReconciliationCron',
    'Stripe reconciliation CLI task must execute the same server-side service'
);

assertNotContainsRouteDelegate(
    $base . '/scripts/tasks/reconcile_stripe_subscriptions.php',
    'AuthMiddleware',
    'Stripe reconciliation CLI task must not depend on a logged-in user session'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/routes.php',
    'function handleSubscriptionsScheduledPaymentsCronRoute',
    'Subscriptions routes must expose scheduled payments cron handler'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/routes.php',
    'function handleSubscriptionsRecurringCronRoute',
    'Subscriptions routes must expose recurring cron handler'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/routes.php',
    'function handleSubscriptionsStripeReconciliationCronRoute',
    'Subscriptions routes must expose Stripe reconciliation cron handler'
);

assertContainsRouteDelegate(
    $base . '/api/subscriptions/cron_stripe_reconciliation.php',
    "acquireCronLockOrRespond('subscriptions_stripe_reconciliation')",
    'Stripe reconciliation cron must acquire a non-overlapping lock before opening MySQL'
);

assertNotContainsRouteDelegate(
    $base . '/api/subscriptions/cron_stripe_reconciliation.php',
    'AuthMiddleware',
    'Stripe reconciliation cron must not depend on a logged-in user session'
);

assertFunctionBlockNotContainsForCronWiring(
    $base . '/modules/subscriptions/routes.php',
    'handleSubscriptionsStripeReconciliationCronRoute',
    'verifyAuthenticatedUserPayload',
    'Stripe reconciliation route must run from CRON_SECRET, not from user auth'
);

assertFunctionBlockNotContainsForCronWiring(
    $base . '/modules/subscriptions/routes.php',
    'handleSubscriptionsStripeReconciliationCronRoute',
    'requireAdminSessionContext',
    'Stripe reconciliation route must not require an admin session'
);

assertFunctionBlockNotContainsForCronWiring(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    'runStripeReconciliationCron',
    'verifyAuthenticatedUserPayload',
    'Stripe renewal reconciliation service must be server-side and user-session independent'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    'reconcileLocalExpiredSubscriptionAccess',
    'Stripe reconciliation cron must expire local subscription access without waiting for user login'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    "['active', 'trialing', 'past_due']",
    'Canceled and expired subscriptions must not receive remote renewal schedule updates'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/repositories/SubscriptionsRepository.php',
    'findSubscriptionsForLocalAccessExpiration',
    'Subscriptions repository must expose expired local access rows to the server-side cron'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/repositories/SubscriptionsRepository.php',
    "status = 'expired'",
    'Expired subscriptions must be persisted as expired instead of remaining active until the next login'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    "/storage/logs/subscriptions",
    'Subscriptions cron logs must be written to private storage/logs'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    "subscription_cron_health.json",
    'Subscriptions cron must persist a private heartbeat for admin observability'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    "cron_health",
    'Automation helper payload must expose the private cron heartbeat to the admin'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    "webhook_health",
    'Automation helper payload must expose the private Stripe webhook heartbeat to the admin'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    "A reconciliacao Stripe nao roda ha mais de 30 minutos.",
    'Cron heartbeat must mark stale reconciliation when the server task stops running'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    "stripe_webhook_health.json",
    'Stripe webhook must persist a private heartbeat for admin observability'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    "Evento Stripe processado pelo dominio de subscriptions.",
    'Stripe webhook heartbeat must record processed domain events'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/repositories/SubscriptionsRepository.php',
    "findProviderWebhookEventStatus",
    'Stripe webhook heartbeat must distinguish closed duplicates from events still processing'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    "Evento Stripe ja esta em processamento",
    'Stripe webhook heartbeat must not mark in-flight duplicate deliveries as healthy'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsAutomationService.php',
    "*/15 * * * *",
    'Stripe reconciliation helper must recommend a 15 minute cadence for production'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsAutomationService.php',
    "scripts/tasks/reconcile_stripe_subscriptions.php",
    'Stripe automation helper must expose the recommended CLI task command'
);

assertContainsRouteDelegate(
    $base . '/modules/subscriptions/routes.php',
    "'issues' => (int) (\$summary['issues'] ?? 0)",
    'Admin run_now audit must log summary issues instead of a non-existent errors counter'
);

assertNotContainsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    "/api/subscriptions/subscription_cron.log",
    'Subscriptions cron logs must not be written under public api/'
);

fwrite(STDOUT, "Subscriptions cron wiring assertions passed.\n");
