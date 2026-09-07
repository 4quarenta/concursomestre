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

$base = dirname(__DIR__) . '';

assertContainsTextForAdminActions($base . '/shared/middleware/AuthMiddleware.php', "['admin', 'staff']", 'Auth middleware must allow admin and staff roles in the admin panel');
assertContainsTextForAdminActions($base . '/modules/admin/validators/AdminUserActionsValidator.php', "'staff'", 'Admin user validator must allow the staff role');
assertNotContainsTextForAdminActions($base . '/modules/admin/validators/AdminUserActionsValidator.php', "'tester'", 'Legacy tester role must not stay in the active admin validator');
assertNotContainsTextForAdminActions($base . '/modules/admin/validators/AdminUserActionsValidator.php', "'issue_invoice'", 'Invoice stub must not remain available in the active admin action list');
assertContainsTextForAdminActions($base . '/modules/admin/services/AdminUserDetailsService.php', "'available_plans'", 'Admin user details must expose the manual plan selector dataset');
assertContainsTextForAdminActions($base . '/config/payment_provider.php', "'manual_admin'", 'Manual admin grants must be a first-class non-billing payment provider');
assertContainsTextForAdminActions($base . '/config/payment_provider.php', 'isChargeablePaymentProvider', 'Billing code must centralize chargeable provider detection');
assertContainsTextForAdminActions($base . '/config/payment_provider.php', 'paymentProviderSupportsRemoteCancellation', 'Manual grants must know which providers need remote cancellation');
assertContainsTextForAdminActions($base . '/modules/admin/services/AdminUserActionsService.php', 'grantSupportCompensation', 'Manual benefits must use the central BenefitService contract');
assertContainsTextForAdminActions($base . '/modules/admin/services/AdminUserActionsService.php', "'apply_provider' => true", 'Paid subscription extensions must wait for provider confirmation through the central service');
assertNotContainsTextForAdminActions($base . '/modules/admin/services/AdminUserActionsService.php', 'cancelRemoteSubscriptionBeforeManualGrant', 'Legacy manual compensation must not cancel a paid subscription as a side effect');
assertNotContainsTextForAdminActions($base . '/modules/admin/repositories/AdminUserActionsRepository.php', 'extendSubscriptionAsManualGrant', 'Legacy direct subscription benefit mutation must be removed');
assertNotContainsTextForAdminActions($base . '/modules/admin/repositories/AdminUserActionsRepository.php', 'createManualSubscription', 'Legacy manual subscription creation must be removed from benefit compensation');
assertNotContainsTextForAdminActions($base . '/modules/admin/repositories/AdminUserActionsRepository.php', 'updateUserPlanSnapshot', 'Legacy direct users.plan benefit mutation must be removed');
assertContainsTextForAdminActions($base . '/modules/benefits/services/BenefitService.php', 'SUPPORT_COMPENSATION', 'Support compensation must be represented by the central Benefit authority');
assertContainsTextForAdminActions($base . '/modules/billing/services/StripeBillingProviderAdapter.php', "'trial_end' => \$newPeriodEnd", 'Billing extensions must use the audited Stripe trial_end mechanism');

fwrite(STDOUT, "Admin user actions wiring assertions passed.\n");
