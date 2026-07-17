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

function assertContainsSubscriptionNotification(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$servicePath = dirname(__DIR__) . '/modules/subscriptions/services/SubscriptionsService.php';

assertContainsSubscriptionNotification(
    $servicePath,
    'notifyAdminsAboutStripePastDue',
    'Stripe past_due flow must notify admins when a subscription payment fails'
);

assertContainsSubscriptionNotification(
    $servicePath,
    'Assinatura com pagamento pendente',
    'Stripe past_due admin notification must have a clear title'
);

assertContainsSubscriptionNotification(
    $servicePath,
    '/admin/finance/subscriptions',
    'Stripe past_due admin notification must link to finance subscriptions'
);

assertContainsSubscriptionNotification(
    $servicePath,
    'createAdminNotification(',
    'Subscription service must use admin-wide notifications where required'
);

assertContainsSubscriptionNotification(
    $servicePath,
    'Novo reembolso de assinatura pendente',
    'Pending refund review must notify all active admins in-app'
);

assertContainsSubscriptionNotification(
    $servicePath,
    '/admin/support/refunds?transactionId=',
    'Pending refund admin notification must link directly to the refund context'
);

fwrite(STDOUT, "Subscriptions notification wiring assertions passed.\n");
