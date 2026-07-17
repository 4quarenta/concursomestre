<?php

declare(strict_types=1);

function assertPaymentRecoveryWiring(string $source, string $needle, string $message): void
{
    if (!str_contains($source, $needle)) {
        throw new RuntimeException($message);
    }
}

$base = dirname(__DIR__);
$usersService = (string) file_get_contents($base . '/modules/users/services/UsersCardsService.php');
$usersRepository = (string) file_get_contents($base . '/modules/users/repositories/UsersRepository.php');
$subscriptionsRepository = (string) file_get_contents($base . '/modules/subscriptions/repositories/SubscriptionsRepository.php');
$subscriptionsService = (string) file_get_contents($base . '/modules/subscriptions/services/SubscriptionsService.php');
$billingSupport = (string) file_get_contents($base . '/modules/subscriptions/services/SubscriptionsBillingSupport.php');
$migration = (string) file_get_contents($base . '/database/migrations/20260717_020000_stripe_recovery_queue.php');

foreach (['findCardProtectedStripeSubscription', 'Nenhum dado local foi removido', 'Remocao cancelada.'] as $needle) {
    assertPaymentRecoveryWiring($usersService . $usersRepository, $needle, 'Protecao de detach ausente: ' . $needle);
}
assertPaymentRecoveryWiring($usersRepository, 'COALESCE(paid_installments, 0) < GREATEST', 'Parcelas futuras devem proteger o cartao.');
foreach (['findDueStripeInvoiceCollectionRetries', 'scheduleStripeInvoiceCollectionRetry'] as $needle) {
    assertPaymentRecoveryWiring($subscriptionsRepository, $needle, 'Repositorio de recuperacao incompleto: ' . $needle);
}
foreach (['next_payment_attempt', "'idempotency_key' => 'invoice_recovery_'", 'handleStripeInvoicePaid'] as $needle) {
    assertPaymentRecoveryWiring($subscriptionsService, $needle, 'Reconciliacao Stripe incompleta: ' . $needle);
}
assertPaymentRecoveryWiring($billingSupport, 'STRIPE_PAYMENT_RETRY_DELAYS_SECONDS', 'Backoff configuravel ausente.');
assertPaymentRecoveryWiring($migration, 'idx_transactions_collection_retry', 'Indice da fila de cobranca ausente.');

echo "Payment recovery hardening wiring assertions passed.\n";
