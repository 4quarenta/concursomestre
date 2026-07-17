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

function assertContainsStripeReconciliationWiring(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        fwrite(STDERR, $message . ' [' . $path . ']' . PHP_EOL);
        exit(1);
    }
}

function assertOrderStripeReconciliationWiring(string $path, string $firstNeedle, string $secondNeedle, string $message): void
{
    $content = file_get_contents($path);
    $firstPosition = is_string($content) ? strpos($content, $firstNeedle) : false;
    $secondPosition = is_string($content) ? strpos($content, $secondNeedle) : false;

    if ($firstPosition === false || $secondPosition === false || $firstPosition >= $secondPosition) {
        fwrite(STDERR, $message . ' [' . $path . ']' . PHP_EOL);
        exit(1);
    }
}

$base = dirname(__DIR__);
$servicePath = $base . '/modules/subscriptions/services/SubscriptionsService.php';
$repositoryPath = $base . '/modules/subscriptions/repositories/SubscriptionsRepository.php';
$invoiceIdentityMigrationPath = $base . '/database/migrations/20260716_010000_transactions_provider_identity_unique.php';

assertContainsStripeReconciliationWiring(
    $servicePath,
    "case 'invoice.payment_succeeded':",
    'Stripe webhook must process invoice.payment_succeeded without waiting for user login'
);

assertContainsStripeReconciliationWiring(
    $servicePath,
    'private function materializeUnrecordedStripePaidInvoices',
    'Stripe reconciliation must expose a dedicated materializer for paid invoices'
);

assertContainsStripeReconciliationWiring(
    $servicePath,
    "'status' => 'paid'",
    'Stripe invoice reconciliation must list only paid invoices from Billing'
);

assertContainsStripeReconciliationWiring(
    $servicePath,
    'findStripeTransactionByInvoiceId($this->db, $invoiceId) !== null',
    'Stripe invoice reconciliation must remain idempotent by invoice id'
);

assertContainsStripeReconciliationWiring(
    $repositoryPath,
    'findPlanByRecurringAmountAndCycle',
    'Stripe webhook reconciliation must resolve local plans by recurring amount and cycle when metadata is missing'
);

assertContainsStripeReconciliationWiring(
    $servicePath,
    'findPlanByRecurringAmountAndCycle(',
    'Stripe webhook reconciliation must call the recurring amount/cycle fallback before failing with incomplete metadata'
);

assertContainsStripeReconciliationWiring(
    $servicePath,
    'findLatestStripeSubscriptionForUser($userId)',
    'Stripe webhook reconciliation must reuse the latest local Stripe subscription for metadata-less renewal events'
);

assertContainsStripeReconciliationWiring(
    $servicePath,
    'readStripeInvoiceOrderingTimestamp',
    'Stripe invoice reconciliation must process accumulated invoices in chronological order'
);

assertContainsStripeReconciliationWiring(
    $servicePath,
    "'materialized_invoices' => \$materializedInvoicesCount",
    'Manual sync response must expose how many invoices were materialized'
);

assertOrderStripeReconciliationWiring(
    $servicePath,
    '$this->materializeUnrecordedStripePaidInvoices($stripe, $remoteSubscription);',
    '$subscriptionRow = $this->reconcileStripeRemoteSubscriptionState($stripe, $remoteSubscription, $metadata);',
    'Stripe cron must materialize paid invoices before reconciling final local state'
);

assertContainsStripeReconciliationWiring(
    $servicePath,
    "if (in_array(\$currentStatus, ['approved', 'completed', 'refunded'], true))",
    'A late payment_failed event must not downgrade an approved Stripe transaction'
);

assertContainsStripeReconciliationWiring(
    $servicePath,
    "SET status = 'approved',",
    'A paid Stripe invoice must recover a previously rejected local transaction'
);

assertContainsStripeReconciliationWiring(
    $servicePath,
    "superseded_by_subscription_id",
    'Stripe reconciliation must protect subscriptions superseded by a paid upgrade'
);

assertContainsStripeReconciliationWiring(
    $servicePath,
    'cancelSupersededStripeSubscriptions',
    'Paid upgrades must cancel superseded Stripe subscriptions remotely'
);

assertContainsStripeReconciliationWiring(
    $invoiceIdentityMigrationPath,
    "uniq_transactions_provider_invoice",
    'A migration deve garantir uma unica transacao local por invoice Stripe'
);

assertContainsStripeReconciliationWiring(
    $invoiceIdentityMigrationPath,
    "uniq_transactions_provider_payment_intent",
    'A migration deve garantir uma unica transacao local por PaymentIntent Stripe'
);

fwrite(STDOUT, "Subscriptions Stripe reconciliation wiring assertions passed.\n");
