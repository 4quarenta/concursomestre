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

function assertMarketplaceNotificationContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';
$transactionsService = $base . '/modules/transactions/services/TransactionsService.php';
$transactionsRepository = $base . '/modules/transactions/repositories/TransactionsRepository.php';
$transactionsValidator = $base . '/modules/transactions/validators/TransactionsValidator.php';
$paymentsService = $base . '/modules/payments/services/PaymentsService.php';

assertMarketplaceNotificationContains(
    $transactionsValidator,
    "\$materialId = trim((string) (\$data['material_id'] ?? \$data['materialId'] ?? ''));",
    'Transactions validator must preserve textual material IDs'
);

assertMarketplaceNotificationContains(
    $transactionsRepository,
    'public function findMaterialById(string $materialId): ?array',
    'Transactions repository must query materials with string IDs'
);

assertMarketplaceNotificationContains(
    $transactionsRepository,
    'string $materialId,',
    'Transactions repository must persist string material IDs in purchases'
);

assertMarketplaceNotificationContains(
    $transactionsService,
    'notifyMaterialPurchaseCompleted',
    'Direct material purchases must notify buyer, seller and admin'
);

assertMarketplaceNotificationContains(
    $transactionsService,
    'notifySellerAboutRefundRequest',
    'Refund requests for marketplace sales must notify the seller'
);

assertMarketplaceNotificationContains(
    $transactionsService,
    'resolveRefundRequestAmount',
    'Refund notifications must calculate the full amount across upgrade chains'
);

assertMarketplaceNotificationContains(
    $transactionsService,
    "'Valor reembolsado'",
    'Refund notifications must always expose the refunded amount'
);

assertMarketplaceNotificationContains(
    $transactionsService,
    'createFinancialAdminNotification(',
    'Refund and purchase flows must create persistent financial admin notifications with amounts'
);

assertMarketplaceNotificationContains(
    $transactionsService,
    "'/admin/finance/refunds'",
    'Refund requests must link admins to the refunds area'
);

assertMarketplaceNotificationContains(
    $paymentsService,
    "/../../../config/notification_helper.php",
    'Stripe material payment verification must load notification helper'
);

assertMarketplaceNotificationContains(
    $paymentsService,
    'notifyMaterialPaymentApproved($transactionPayload)',
    'Stripe material payment approval must notify after first successful approval'
);

assertMarketplaceNotificationContains(
    $paymentsService,
    "'Material liberado'",
    'Buyer must be notified when a material is released'
);

assertMarketplaceNotificationContains(
    $paymentsService,
    "'Valor pago'",
    'Buyer material notifications must expose the paid amount'
);

assertMarketplaceNotificationContains(
    $paymentsService,
    "'Nova venda no marketplace'",
    'Seller must be notified when a marketplace material is sold'
);

fwrite(STDOUT, "Marketplace notifications wiring assertions passed.\n");
