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

function assertContainsPaymentsDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function assertNotContainsPaymentsDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false) {
        throw new RuntimeException('Nao foi possivel ler o arquivo [' . $path . ']');
    }

    if (strpos($content, $needle) !== false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsPaymentsDelegate(
    $base . '/api/payments/get-installments.php',
    'handlePaymentsInstallmentsRoute',
    'Payments installments endpoint must delegate to payments module routes'
);

assertContainsPaymentsDelegate(
    $base . '/api/payments/process-payment.php',
    'handlePaymentsProcessMaterialRoute',
    'Payments process-payment endpoint must delegate to payments module routes'
);

assertContainsPaymentsDelegate(
    $base . '/api/payments/config.php',
    'handlePaymentsClientConfigRoute',
    'Payments config endpoint must delegate to payments module routes'
);

assertContainsPaymentsDelegate(
    $base . '/api/payments/create-connect-account.php',
    'handlePaymentsCreateConnectAccountRoute',
    'Payments create-connect-account endpoint must delegate to payments module routes'
);

assertContainsPaymentsDelegate(
    $base . '/api/payments/verify-payment.php',
    'handlePaymentsVerifyStripePaymentRoute',
    'Payments verify-payment endpoint must delegate to payments module routes'
);

assertContainsPaymentsDelegate(
    $base . '/modules/payments/routes.php',
    'function handlePaymentsInstallmentsRoute',
    'Payments routes must expose the installments handler'
);

assertContainsPaymentsDelegate(
    $base . '/modules/payments/routes.php',
    'function handlePaymentsProcessMaterialRoute',
    'Payments routes must expose the process material handler'
);

assertContainsPaymentsDelegate(
    $base . '/modules/payments/routes.php',
    'function handlePaymentsClientConfigRoute',
    'Payments routes must expose the public config handler'
);

assertContainsPaymentsDelegate(
    $base . '/modules/payments/services/PaymentsService.php',
    'isValidStripePublishableKey(STRIPE_PUBLISHABLE_KEY)',
    'Public payments config must expose only a valid Stripe publishable key'
);

assertContainsPaymentsDelegate(
    $base . '/modules/payments/services/PaymentsService.php',
    "\$publishableKey !== '' && stripeIsConfigured()",
    'Public payments config must require both publishable and secret Stripe keys before marking Stripe as configured'
);

assertContainsPaymentsDelegate(
    $base . '/modules/payments/routes.php',
    'function handlePaymentsCreateConnectAccountRoute',
    'Payments routes must expose the create connect account handler'
);

assertContainsPaymentsDelegate(
    $base . '/modules/payments/routes.php',
    'function handlePaymentsVerifyStripePaymentRoute',
    'Payments routes must expose the verify Stripe payment handler'
);

assertContainsPaymentsDelegate(
    $base . '/modules/payments/routes.php',
    '$authenticatedUserId = requirePaymentsAuthenticatedUserId();',
    'Payments verify-payment route must require an authenticated user'
);

assertContainsPaymentsDelegate(
    $base . '/modules/payments/routes.php',
    'verifyStripePayment($_GET, $authenticatedUserId)',
    'Payments verify-payment route must pass the authenticated user to the service'
);

assertContainsPaymentsDelegate(
    $base . '/modules/payments/services/PaymentsService.php',
    'hash_equals($authenticatedUserId, $userId)',
    'Payments verify-payment service must ensure the PaymentIntent belongs to the authenticated user'
);

assertContainsPaymentsDelegate(
    $base . '/modules/payments/validators/PaymentsValidator.php',
    'isAllowedPlatformReturnUrl',
    'Stripe Connect return URLs must be restricted to platform origins'
);

fwrite(STDOUT, "Payments module wiring assertions passed.\n");
