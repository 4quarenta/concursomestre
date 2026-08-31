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

function assertContainsTextForAdminActions(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function assertNotContainsTextForAdminActions(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content !== false && strpos($content, $needle) !== false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';

assertContainsTextForAdminActions($base . '/shared/middleware/AuthMiddleware.php', "['admin', 'staff']", 'Auth middleware must allow admin and staff roles in the admin panel');
assertContainsTextForAdminActions($base . '/modules/admin/validators/AdminUserActionsValidator.php', "'staff'", 'Admin user validator must allow the staff role');
assertNotContainsTextForAdminActions($base . '/modules/admin/validators/AdminUserActionsValidator.php', "'tester'", 'Legacy tester role must not stay in the active admin validator');
assertNotContainsTextForAdminActions($base . '/modules/admin/validators/AdminUserActionsValidator.php', "'issue_invoice'", 'Invoice stub must not remain available in the active admin action list');
assertContainsTextForAdminActions($base . '/modules/admin/services/AdminUserDetailsService.php', "'available_plans'", 'Admin user details must expose the manual plan selector dataset');
assertContainsTextForAdminActions($base . '/config/payment_provider.php', "'manual_admin'", 'Manual admin grants must be a first-class non-billing payment provider');
assertContainsTextForAdminActions($base . '/config/payment_provider.php', 'isChargeablePaymentProvider', 'Billing code must centralize chargeable provider detection');
assertContainsTextForAdminActions($base . '/config/payment_provider.php', 'paymentProviderSupportsRemoteCancellation', 'Manual grants must know which providers need remote cancellation');
assertContainsTextForAdminActions($base . '/modules/admin/services/AdminUserActionsService.php', 'cancelRemoteSubscriptionBeforeManualGrant', 'Manual admin upgrades must cancel remote Stripe subscriptions before granting free access');
assertContainsTextForAdminActions($base . '/modules/admin/services/AdminUserActionsService.php', 'is_free_admin_grant', 'Manual admin upgrades must be audited as free grants');
assertContainsTextForAdminActions($base . '/modules/admin/services/AdminUserActionsService.php', "return '+' . \$intervalCount . ' day';", 'Manual admin grants must preserve day-based test plan durations');
assertContainsTextForAdminActions($base . '/modules/admin/services/AdminUserActionsService.php', 'extendSubscriptionAsManualGrant', 'Manual day additions must be converted to a non-billing admin grant');
assertContainsTextForAdminActions($base . '/modules/admin/repositories/AdminUserActionsRepository.php', "'manual_admin'", 'Manual admin subscriptions must not use a billable provider');
assertContainsTextForAdminActions($base . '/modules/admin/repositories/AdminUserActionsRepository.php', 'provider_subscription_id = NULL', 'Manual admin grants must clear remote Stripe subscription ids locally');
assertContainsTextForAdminActions($base . '/modules/admin/repositories/AdminUserActionsRepository.php', 'next_renewal_amount = NULL', 'Manual admin grants must clear future renewal projections');
assertContainsTextForAdminActions($base . '/modules/admin/repositories/AdminUserActionsRepository.php', 'auto_renew,', 'Manual admin subscriptions must explicitly set renewal fields');
assertContainsTextForAdminActions($base . '/modules/admin/repositories/AdminUserActionsRepository.php', 'cancel_at_period_end', 'Manual admin subscriptions must expire instead of renewing');

fwrite(STDOUT, "Admin user actions wiring assertions passed.\n");
