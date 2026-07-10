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

function refundImmediateCancellationAssertContains(string $needle, string $path): void
{
    $contents = file_get_contents($path);
    if ($contents === false || strpos($contents, $needle) === false) {
        fwrite(STDERR, "Assertion failed: expected '{$needle}' in {$path}" . PHP_EOL);
        exit(1);
    }
}

$refundSupportPath = __DIR__ . '/../modules/transactions/services/TransactionsRefundSupport.php';
$billingSupportPath = __DIR__ . '/../modules/subscriptions/services/SubscriptionsBillingSupport.php';
$subscriptionsServicePath = __DIR__ . '/../modules/subscriptions/services/SubscriptionsService.php';
$subscriptionsRepositoryPath = __DIR__ . '/../modules/subscriptions/repositories/SubscriptionsRepository.php';
$transactionsRepositoryPath = __DIR__ . '/../modules/transactions/repositories/TransactionsRepository.php';

refundImmediateCancellationAssertContains('cancel_at_period_end = 0', $refundSupportPath);
refundImmediateCancellationAssertContains('next_renewal_date = NULL', $refundSupportPath);
refundImmediateCancellationAssertContains('$stripe->subscriptions->cancel($providerSubscriptionId, [])', $refundSupportPath);

refundImmediateCancellationAssertContains('cancel_at_period_end = 0', $subscriptionsServicePath);
refundImmediateCancellationAssertContains('next_renewal_date = NULL', $subscriptionsServicePath);
refundImmediateCancellationAssertContains('provider_current_period_end = CASE', $subscriptionsServicePath);

refundImmediateCancellationAssertContains('cancel_at_period_end = 0', $billingSupportPath);
refundImmediateCancellationAssertContains('next_renewal_date = NULL', $billingSupportPath);

refundImmediateCancellationAssertContains('cancel_at_period_end = 0', $subscriptionsRepositoryPath);
refundImmediateCancellationAssertContains('next_renewal_date = NULL', $subscriptionsRepositoryPath);

refundImmediateCancellationAssertContains('cancel_at_period_end = 0', $transactionsRepositoryPath);
refundImmediateCancellationAssertContains('next_renewal_date = NULL', $transactionsRepositoryPath);

fwrite(STDOUT, 'Transactions refund immediate cancellation wiring assertions passed.' . PHP_EOL);
