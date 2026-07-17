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

function assertContainsSubscriptionsRouteDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function assertNotContainsSubscriptionsRouteDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false) {
        throw new RuntimeException('Nao foi possivel ler o arquivo [' . $path . ']');
    }

    if (strpos($content, $needle) !== false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function extractFunctionBlockForSubscriptionsCheckout(string $path, string $functionName): string
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

function assertFunctionBlockNotContainsForSubscriptionsCheckout(string $path, string $functionName, string $needle, string $message): void
{
    $block = extractFunctionBlockForSubscriptionsCheckout($path, $functionName);
    if (strpos($block, $needle) !== false) {
        throw new RuntimeException($message . ' [' . $path . '::' . $functionName . ']');
    }
}

$base = dirname(__DIR__);

assertContainsSubscriptionsRouteDelegate(
    $base . '/api/subscriptions/process_payment.php',
    'respondRemovedMercadoPagoSubscriptionsRoute',
    'Removed Mercado Pago process payment endpoint must return 410 without running legacy flow'
);

foreach ([
    '/api/subscriptions/create.php',
    '/api/subscriptions/webhook.php',
    '/api/subscriptions/webhook_mp.php',
    '/api/subscriptions/process_payment.php',
] as $removedMercadoPagoEndpoint) {
    assertContainsSubscriptionsRouteDelegate(
        $base . $removedMercadoPagoEndpoint,
        'respondRemovedMercadoPagoSubscriptionsRoute',
        'Removed Mercado Pago subscription endpoint must return 410 directly'
    );

    assertNotContainsSubscriptionsRouteDelegate(
        $base . $removedMercadoPagoEndpoint,
        'config/database.php',
        'Removed Mercado Pago subscription endpoint must not open MySQL'
    );
}

assertNotContainsSubscriptionsRouteDelegate(
    $base . '/api/subscriptions/process_payment.php',
    'config/database.php',
    'Removed Mercado Pago process payment endpoint must not open MySQL'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/api/subscriptions/automation_helper.php',
    'handleSubscriptionsAutomationHelperRoute',
    'Subscriptions automation helper endpoint must delegate to subscriptions routes'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/api/subscriptions/automation_helper.php',
    "require_once __DIR__ . '/../../config/cron_lock.php';",
    'Subscriptions automation helper must load the cron lock helper for admin run_now'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/api/subscriptions/stripe_webhook.php',
    'handleSubscriptionsStripeWebhookRoute',
    'Canonical Stripe webhook endpoint must delegate to subscriptions routes'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/api/subscriptions/webhook_stripe.php',
    "require_once __DIR__ . '/stripe_webhook.php';",
    'Documented Stripe webhook alias must delegate to the canonical endpoint'
);

assertFunctionBlockNotContainsForSubscriptionsCheckout(
    $base . '/modules/subscriptions/routes.php',
    'handleSubscriptionsStripeWebhookRoute',
    'verifyAuthenticatedUserPayload',
    'Stripe webhook route must not depend on a logged-in user session'
);

assertFunctionBlockNotContainsForSubscriptionsCheckout(
    $base . '/modules/subscriptions/routes.php',
    'handleSubscriptionsStripeWebhookRoute',
    'requireAdminSessionContext',
    'Stripe webhook route must not require an admin session'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/modules/subscriptions/routes.php',
    'function handleSubscriptionsMercadoPagoProcessPaymentRoute',
    'Subscriptions routes must expose Mercado Pago process payment handler'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/modules/subscriptions/routes.php',
    'function handleSubscriptionsAutomationHelperRoute',
    'Subscriptions routes must expose automation helper handler'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/modules/subscriptions/routes.php',
    "acquireCronLockOrRespond('subscriptions_stripe_reconciliation')",
    'Subscriptions automation run_now must reuse the Stripe reconciliation lock'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/database/migrations/20260711_000200_runtime_schema_foundation.php',
    'CREATE TABLE IF NOT EXISTS provider_webhook_events',
    'A migration deve provisionar a tabela de idempotencia dos webhooks fora do request'
);

assertNotContainsSubscriptionsRouteDelegate(
    $base . '/modules/subscriptions/repositories/SubscriptionsRepository.php',
    'ensureProviderWebhookEventsSchema',
    'O repository de assinaturas nao deve inspecionar ou alterar schema em runtime'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/modules/subscriptions/repositories/SubscriptionsRepository.php',
    "in_array(\$status, ['processed', 'ignored'], true)",
    'Processed and ignored webhook events must be terminal for idempotency'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/modules/subscriptions/validators/SubscriptionsValidator.php',
    "'confirm_debt_charge' => !empty(\$data['confirmDebtCharge'])",
    'Cancellation validator must accept explicit debt settlement confirmation'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    'calculateOutstandingTermDebt($subscription)',
    'Cancellation outside refund window must calculate outstanding term debt'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    'empty($payload[\'confirm_debt_charge\'])',
    'Cancellation must block outstanding debt settlement without explicit confirmation'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    'settleOutstandingTermDebt($subscription, $outstandingDebt, $payload)',
    'Cancellation must charge outstanding installment debt before settling the term'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    'cancelSettledStripeSubscriptionWithoutRevokingAccess($subscription)',
    'Cancellation after term debt settlement must stop Stripe recurrence without revoking local access'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    'shouldPreserveSettledTermAccess',
    'Stripe deleted webhook must preserve local access for a settled parcelled term'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/modules/subscriptions/repositories/SubscriptionsRepository.php',
    'function settleSubscriptionInstallmentDebt',
    'Repository must expose a method to mark parcelled term debt as settled'
);

assertContainsSubscriptionsRouteDelegate(
    $base . '/modules/subscriptions/repositories/SubscriptionsRepository.php',
    'paid_installments = COALESCE(total_installments, paid_installments)',
    'Settled parcelled term must mark all installments as paid locally'
);

fwrite(STDOUT, "Subscriptions checkout wiring assertions passed.\n");
