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

function mercadoPagoRemovalAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$backendRoot = dirname(__DIR__);

foreach ([
    '/api/payments/create-preference.php',
    '/api/payments/webhook.php',
    '/api/subscriptions/create.php',
    '/api/subscriptions/cron_recurring.php',
    '/api/subscriptions/cron_scheduled_payments.php',
    '/api/subscriptions/process_payment.php',
    '/api/subscriptions/sync_plans_mp.php',
    '/api/subscriptions/webhook.php',
    '/api/subscriptions/webhook_mp.php',
    '/scripts/tasks/sync_mercadopago_preapproval_plans.php',
] as $removedPath) {
    mercadoPagoRemovalAssert(
        !is_file($backendRoot . $removedPath),
        'Mercado Pago legado nao pode permanecer exposto: ' . $removedPath
    );
}

foreach ([
    '/modules/payments/routes.php',
    '/modules/subscriptions/routes.php',
    '/modules/users/repositories/UsersRepository.php',
    '/modules/users/services/UsersCardsStripeSupport.php',
    '/modules/subscriptions/services/SubscriptionsBillingSupport.php',
    '/modules/transactions/repositories/TransactionsRepository.php',
] as $sourcePath) {
    $content = file_get_contents($backendRoot . $sourcePath);
    mercadoPagoRemovalAssert($content !== false, 'Falha ao ler fonte ativa: ' . $sourcePath);
    mercadoPagoRemovalAssert(
        !preg_match('/MercadoPago|mercadopago|mercado_pago|mp_(?:card|customer|preapproval)/i', $content),
        'Referencia Mercado Pago ativa encontrada: ' . $sourcePath
    );
}

fwrite(STDOUT, "MercadoPagoRemovalWiringTest: PASS\n");
