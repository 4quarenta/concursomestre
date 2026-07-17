<?php

declare(strict_types=1);

putenv('APP_ENV=test');
putenv('ENV_LOADER_SILENT=1');

require_once __DIR__ . '/../modules/subscriptions/services/StripePaymentApprovalValidator.php';

function assertStripeBasilInvoicePayment(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$paymentIntent = (object) [
    'id' => 'pi_basil_test',
    'status' => 'succeeded',
];
$invoice = (object) [
    'id' => 'in_basil_test',
    'payments' => (object) [
        'data' => [
            (object) [
                'status' => 'paid',
                'payment' => (object) [
                    'type' => 'payment_intent',
                    'payment_intent' => $paymentIntent,
                ],
            ],
        ],
    ],
];

assertStripeBasilInvoicePayment(
    getStripeInvoicePaymentIntentId($invoice) === 'pi_basil_test',
    'Basil InvoicePayment deve expor o id do PaymentIntent canonico.'
);
assertStripeBasilInvoicePayment(
    getStripeInvoicePaymentIntentStatus($invoice) === 'succeeded',
    'Basil InvoicePayment expandido deve expor o status do PaymentIntent.'
);

$invoiceWithStringReference = (object) [
    'payments' => (object) [
        'data' => [
            (object) [
                'payment' => (object) [
                    'type' => 'payment_intent',
                    'payment_intent' => 'pi_basil_reference',
                ],
            ],
        ],
    ],
];
assertStripeBasilInvoicePayment(
    getStripeInvoicePaymentIntentId($invoiceWithStringReference) === 'pi_basil_reference',
    'Basil InvoicePayment nao expandido deve preservar a referencia do PaymentIntent.'
);

$capturedParams = null;
$stripe = (object) [
    'invoices' => new class($invoice, $capturedParams) {
        private object $invoice;
        private mixed $capturedParams;

        public function __construct(object $invoice, mixed &$capturedParams)
        {
            $this->invoice = $invoice;
            $this->capturedParams = &$capturedParams;
        }

        public function retrieve(string $invoiceId, array $params): object
        {
            $this->capturedParams = $params;
            return $this->invoice;
        }
    },
];

$retrieved = retrieveExpandedStripeInvoice($stripe, 'in_basil_test');
assertStripeBasilInvoicePayment($retrieved === $invoice, 'A invoice recuperada deve ser retornada sem mutacao.');
assertStripeBasilInvoicePayment(
    in_array('payments', $capturedParams['expand'] ?? [], true),
    'A recuperacao deve expandir invoice.payments na API Basil.'
);

fwrite(STDOUT, "Stripe Basil invoice payment support assertions passed.\n");
