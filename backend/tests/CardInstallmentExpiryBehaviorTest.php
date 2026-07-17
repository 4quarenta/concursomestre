<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/subscriptions/services/SubscriptionsBillingSupport.php';

function assertCardInstallmentExpiry(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$firstChargeAt = new DateTimeImmutable('2026-07-16 12:00:00', new DateTimeZone('UTC'));
$monthlyFourInstallments = [
    'term_cycles' => 4,
    'charge_interval' => 'month',
    'charge_interval_count' => 1,
];
$monthlyFiveInstallments = [
    'term_cycles' => 5,
    'charge_interval' => 'month',
    'charge_interval_count' => 1,
];

$covered = getStripeCardInstallmentExpiryEligibility(10, 2026, $monthlyFourInstallments, $firstChargeAt);
assertCardInstallmentExpiry($covered['eligible'] === true, 'Cartao 10/26 deve cobrir quatro parcelas mensais iniciadas em julho.');
assertCardInstallmentExpiry($covered['last_charge_at']->format('Y-m-d') === '2026-10-16', 'A quarta parcela deve ocorrer no mes de validade.');

$notCovered = getStripeCardInstallmentExpiryEligibility(10, 2026, $monthlyFiveInstallments, $firstChargeAt);
assertCardInstallmentExpiry($notCovered['eligible'] === false, 'Cartao 10/26 nao deve cobrir parcela agendada para novembro.');

$paymentMethod = (object) ['card' => (object) ['exp_month' => 10, 'exp_year' => 2026]];
assertStripeCardCoversInstallmentTerm($paymentMethod, $monthlyFourInstallments, $firstChargeAt);

$blocked = false;
try {
    assertStripeCardCoversInstallmentTerm($paymentMethod, $monthlyFiveInstallments, $firstChargeAt);
} catch (DomainException $error) {
    $blocked = str_contains($error->getMessage(), 'antes da ultima parcela');
}

assertCardInstallmentExpiry($blocked, 'Backend deve bloquear validade anterior a ultima parcela.');
fwrite(STDOUT, "Card installment expiry behavior assertions passed.\n");
