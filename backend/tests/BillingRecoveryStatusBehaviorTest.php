<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/subscriptions/services/SubscriptionsBillingSupport.php';

function assertBillingRecovery(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$openInvoice = (object) [
    'status' => 'open',
    'currency' => 'brl',
    'amount_due' => 5400,
    'amount_remaining' => 5400,
    'hosted_invoice_url' => 'https://invoice.stripe.com/i/test',
    'next_payment_attempt' => 1784500000,
    'due_date' => null,
    'payment_intent' => (object) ['status' => 'requires_action'],
];

$snapshot = buildStripeOpenInvoiceRecoverySnapshot($openInvoice);
assertBillingRecovery(is_array($snapshot), 'Invoice aberta deve gerar contrato de recuperacao.');
assertBillingRecovery($snapshot['amountRemaining'] === 54.0, 'Valor restante deve ser convertido de centavos.');
assertBillingRecovery($snapshot['hostedInvoiceUrl'] === 'https://invoice.stripe.com/i/test', 'URL hospedada HTTPS deve ser preservada.');
assertBillingRecovery($snapshot['requiresAuthentication'] === true, 'PaymentIntent requires_action deve orientar autenticacao.');

$paidInvoice = clone $openInvoice;
$paidInvoice->status = 'paid';
$paidInvoice->amount_remaining = 0;
assertBillingRecovery(buildStripeOpenInvoiceRecoverySnapshot($paidInvoice) === null, 'Invoice paga nao pode manter CTA de recuperacao.');

$unsafeInvoice = clone $openInvoice;
$unsafeInvoice->hosted_invoice_url = 'http://example.test/invoice';
$unsafeSnapshot = buildStripeOpenInvoiceRecoverySnapshot($unsafeInvoice);
assertBillingRecovery($unsafeSnapshot['hostedInvoiceUrl'] === null, 'CTA financeiro deve aceitar somente URL HTTPS valida.');

$cardsService = (string) file_get_contents(__DIR__ . '/../modules/users/services/UsersCardsService.php');
assertBillingRecovery(
    !str_contains($cardsService, '!$hadSavedCardsBeforeSync && $this->hasActiveStripeSubscription'),
    'Cartao readicionado nao pode depender da ausencia de cartoes anteriores.'
);
assertBillingRecovery(
    substr_count($cardsService, 'assignPaymentMethodToActiveStripeSubscriptions(') >= 3,
    'Novo default deve abastecer customer e assinatura Stripe.'
);

fwrite(STDOUT, "Billing recovery status behavior assertions passed.\n");
