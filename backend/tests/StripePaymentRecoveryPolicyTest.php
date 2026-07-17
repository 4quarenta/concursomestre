<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/subscriptions/services/SubscriptionsBillingSupport.php';

function assertStripeRecovery(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$originalDelays = $_ENV['STRIPE_PAYMENT_RETRY_DELAYS_SECONDS'] ?? null;
$originalMaximum = $_ENV['STRIPE_PAYMENT_RETRY_MAX_ATTEMPTS'] ?? null;

try {
    $_ENV['STRIPE_PAYMENT_RETRY_DELAYS_SECONDS'] = '3600,86400,259200';
    $_ENV['STRIPE_PAYMENT_RETRY_MAX_ATTEMPTS'] = '4';
    $policy = getStripeInvoiceCollectionRetryPolicy();
    assertStripeRecovery($policy['delays'] === [3600, 86400, 259200], 'Backoff local deve ser 1h/24h/72h.');
    assertStripeRecovery($policy['maximum_attempts'] === 4, 'Politica deve encerrar apos quatro tentativas totais.');

    $remoteTimestamp = time() + 7200;
    $remoteNext = resolveStripeInvoiceCollectionRetryNextAt(1, $remoteTimestamp);
    assertStripeRecovery(abs(strtotime((string) $remoteNext) - $remoteTimestamp) <= 1, 'Agenda Stripe deve prevalecer.');

    $localNext = resolveStripeInvoiceCollectionRetryNextAt(1, 0);
    assertStripeRecovery(abs(strtotime((string) $localNext) - (time() + 3600)) <= 2, 'Primeiro fallback deve usar uma hora.');
    assertStripeRecovery(resolveStripeInvoiceCollectionRetryNextAt(4, 0) === null, 'Tentativas esgotadas nao podem ser reagendadas.');
} finally {
    if ($originalDelays === null) {
        unset($_ENV['STRIPE_PAYMENT_RETRY_DELAYS_SECONDS']);
    } else {
        $_ENV['STRIPE_PAYMENT_RETRY_DELAYS_SECONDS'] = $originalDelays;
    }
    if ($originalMaximum === null) {
        unset($_ENV['STRIPE_PAYMENT_RETRY_MAX_ATTEMPTS']);
    } else {
        $_ENV['STRIPE_PAYMENT_RETRY_MAX_ATTEMPTS'] = $originalMaximum;
    }
}

echo "Stripe payment recovery policy assertions passed.\n";
