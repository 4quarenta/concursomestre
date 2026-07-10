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

function assertFinanceWiringContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        fwrite(STDERR, $message . ' [' . $path . ']' . PHP_EOL);
        exit(1);
    }
}

function assertFinanceWiringNotContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content !== false && strpos($content, $needle) !== false) {
        fwrite(STDERR, $message . ' [' . $path . ']' . PHP_EOL);
        exit(1);
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';
$analyticsPath = $base . '/modules/admin/services/AdminAnalyticsService.php';
$notificationHelperPath = $base . '/config/notification_helper.php';
$subscriptionsPath = $base . '/modules/subscriptions/services/SubscriptionsService.php';
$paymentsPath = $base . '/modules/payments/services/PaymentsService.php';
$transactionsPath = $base . '/modules/transactions/services/TransactionsService.php';

assertFinanceWiringContains(
    $analyticsPath,
    "require_once __DIR__ . '/../../subscriptions/services/SubscriptionsBillingSupport.php';",
    'Admin finance projection must reuse Stripe billing interval helpers'
);

assertFinanceWiringContains(
    $analyticsPath,
    'resolveProjectionChargeIntervalDays',
    'Admin finance projection must resolve the real Stripe charge interval'
);

assertFinanceWiringContains(
    $analyticsPath,
    '$dueDate < $now',
    'Admin finance projection must not count overdue installments as future revenue'
);

assertFinanceWiringContains(
    $analyticsPath,
    "'overduePayments' => array_values(\$overduePayments)",
    'Past due projection dates must be exposed as missed payments for investigation'
);

assertFinanceWiringContains(
    $analyticsPath,
    'Parcela prevista venceu sem transacao local correspondente',
    'Missed projected payments must explain that the real transaction was not materialized'
);

assertFinanceWiringContains(
    $analyticsPath,
    "'intervalUnit' => 'day'",
    'Projected installments must be exposed with charge interval days, not plan access interval'
);

assertFinanceWiringContains(
    $analyticsPath,
    "'chargeIntervalCount' => \$chargeIntervalDays",
    'Projected items must expose chargeIntervalCount for the frontend composition'
);

assertFinanceWiringContains(
    $analyticsPath,
    'shouldSkipRevenueProjectionForSubscription',
    'Admin finance projection must skip plans that are not real pre-approved future charges'
);

assertFinanceWiringContains(
    $analyticsPath,
    "'is_test_plan'",
    'Admin finance projection must skip explicit short test plans'
);

assertFinanceWiringContains(
    $analyticsPath,
    "\$intervalUnit === 'day' && \$intervalCount <= 7",
    'Short day-based test subscriptions must not appear as pre-approved projection items'
);

assertFinanceWiringNotContains(
    $analyticsPath,
    "\$intervalUnit === 'day' && \$intervalCount <= 7 && \$totalInstallments > 1",
    'Short day-based projection skip must also apply to one-charge recurring test plans'
);

assertFinanceWiringContains(
    $base . '/modules/admin/repositories/AdminAnalyticsRepository.php',
    'AS is_test_plan',
    'Admin finance repository must expose plan test flag to projection logic'
);

assertFinanceWiringContains(
    $base . '/modules/admin/repositories/AdminAnalyticsRepository.php',
    'card_exp_month',
    'Admin finance repository must expose preferred card expiry metadata for billing risk'
);

assertFinanceWiringContains(
    $base . '/modules/admin/repositories/AdminAnalyticsRepository.php',
    'has_payment_card',
    'Admin finance repository must expose whether a subscriber has a payment card'
);

assertFinanceWiringContains(
    $analyticsPath,
    'buildBillingRiskRows',
    'Admin finance analytics must build actionable billing risk rows'
);

assertFinanceWiringContains(
    $analyticsPath,
    "'riskRows' => \$riskRows",
    'Billing health must expose the risk rows to the admin panel'
);

assertFinanceWiringContains(
    $analyticsPath,
    "'expired_card'",
    'Billing risk rows must include expired card detection'
);

assertFinanceWiringContains(
    $analyticsPath,
    'sendStripePaymentFailureEmail',
    'Manual billing risk recovery must reuse the existing Stripe recovery email'
);

assertFinanceWiringContains(
    $base . '/modules/admin/routes.php',
    'send_billing_risk_email',
    'Admin finance route must expose an action to send billing risk emails'
);

assertFinanceWiringContains(
    $notificationHelperPath,
    'function createFinancialAdminNotification',
    'Financial admin notification helper must exist'
);

assertFinanceWiringContains(
    $notificationHelperPath,
    '?float $financialAmount = null',
    'Financial notifications must receive the authoritative monetary amount explicitly'
);

assertFinanceWiringContains(
    $notificationHelperPath,
    'function preserveFinancialNotificationMessage',
    'Financial notification formatting must preserve the real summary and amount'
);

assertFinanceWiringContains(
    $notificationHelperPath,
    'Regras administrativas podem personalizar o texto',
    'Admin notification templates must not erase the real financial summary or amount'
);

assertFinanceWiringContains(
    $notificationHelperPath,
    "'Valor recebido'",
    'Financial admin notifications must identify received amounts clearly'
);

assertFinanceWiringContains(
    $notificationHelperPath,
    'function resolveNotificationDeliveryRule',
    'Notification helper must resolve configurable notification rule content'
);

assertFinanceWiringContains(
    $notificationHelperPath,
    "\$delivery['title'] = \$rule['title'];",
    'Notification helper must apply custom notification titles from admin settings'
);

assertFinanceWiringContains(
    $notificationHelperPath,
    "\$delivery['message'] = \$rule['message'];",
    'Notification helper must apply custom notification messages from admin settings'
);

assertFinanceWiringContains(
    $notificationHelperPath,
    "\$delivery['link'] = is_string(\$rule['link'])",
    'Notification helper must apply custom notification links from admin settings'
);

assertFinanceWiringContains(
    $notificationHelperPath,
    "WHERE role = 'admin'",
    'Financial notifications must remain restricted to active admins'
);

assertFinanceWiringContains(
    $subscriptionsPath,
    'notifyFinancialAdminsAboutStripeTransaction',
    'Stripe subscription transactions must notify the finance admin audience'
);

assertFinanceWiringContains(
    $subscriptionsPath,
    'finance_transaction_created',
    'Stripe financial transaction notifications must use the configurable rule key'
);

assertFinanceWiringContains(
    $subscriptionsPath,
    "'Valor renovado' : 'Valor recebido'",
    'Stripe subscription notifications must label initial and renewal amounts'
);

assertFinanceWiringContains(
    $subscriptionsPath,
    'shouldWaitForRemoteStripeChargeBeforeLocalExpiration',
    'Local expiration must wait for Stripe reconciliation when a remote charge is still expected'
);

assertFinanceWiringContains(
    $subscriptionsPath,
    'waiting_for_stripe_reconciliation',
    'Skipped local expiration must be visible in the cron audit rows'
);

assertFinanceWiringContains(
    $subscriptionsPath,
    'notifyFinancialAdminsAboutOverdueStripeRenewal',
    'Overdue expected Stripe charges must notify the finance admin audience'
);

assertFinanceWiringContains(
    $subscriptionsPath,
    'finance_subscription_overdue',
    'Overdue Stripe renewal notifications must use a configurable notification rule key'
);

assertFinanceWiringContains(
    $paymentsPath,
    'createFinancialAdminNotification',
    'Material payment transactions must notify the finance admin audience'
);

assertFinanceWiringContains(
    $transactionsPath,
    'createFinancialAdminNotification',
    'Manual/free material transactions must notify the finance admin audience'
);

fwrite(STDOUT, "Admin finance projection and notification wiring assertions passed.\n");
