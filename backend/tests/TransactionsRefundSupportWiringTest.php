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

function assertContains(string $needle, string $path): void
{
    $contents = file_get_contents($path);
    if ($contents === false || strpos($contents, $needle) === false) {
        fwrite(STDERR, "Assertion failed: expected '{$needle}' in {$path}" . PHP_EOL);
        exit(1);
    }
}

assertContains('/modules/transactions/services/TransactionsRefundSupport.php', __DIR__ . '/../api/utils/payment_refund_helper.php');
assertContains("require_once __DIR__ . '/TransactionsRefundSupport.php';", __DIR__ . '/../modules/transactions/services/TransactionsService.php');
assertContains('/../../transactions/services/TransactionsRefundSupport.php', __DIR__ . '/../modules/subscriptions/services/SubscriptionsService.php');
assertContains('/../../transactions/services/TransactionsRefundSupport.php', __DIR__ . '/../modules/admin/services/AdminUserActionsService.php');
assertContains('function processGatewayRefundForTransaction', __DIR__ . '/../modules/transactions/services/TransactionsRefundSupport.php');
assertContains('function buildRefundEmailDetailsHtml', __DIR__ . '/../modules/transactions/services/TransactionsRefundSupport.php');
assertContains('function getLatestRefundablePlanTransactionForUser', __DIR__ . '/../modules/transactions/services/TransactionsRefundSupport.php');

fwrite(STDOUT, 'Transactions refund support wiring assertions passed.' . PHP_EOL);
