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

function assertContainsStripeConfiguration(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';
$config = $base . '/config/stripe.php';

assertContainsStripeConfiguration(
    $config,
    'function isValidStripeSecretKey',
    'Stripe config must expose secret key format validation'
);

assertContainsStripeConfiguration(
    $config,
    '/^sk_(test|live)_[A-Za-z0-9_]+$/',
    'Stripe secret key validation must require sk_test or sk_live keys'
);

assertContainsStripeConfiguration(
    $config,
    'function isValidStripePublishableKey',
    'Stripe config must expose publishable key format validation'
);

assertContainsStripeConfiguration(
    $config,
    '/^pk_(test|live)_[A-Za-z0-9_]+$/',
    'Stripe publishable key validation must require pk_test or pk_live keys'
);

assertContainsStripeConfiguration(
    $config,
    'function isValidStripeWebhookSecret',
    'Stripe config must expose webhook secret format validation'
);

assertContainsStripeConfiguration(
    $config,
    '/^whsec_[A-Za-z0-9_]+$/',
    'Stripe webhook secret validation must require whsec keys'
);

assertContainsStripeConfiguration(
    $config,
    'return isValidStripeSecretKey(STRIPE_SECRET_KEY);',
    'Stripe runtime must not consider malformed non-empty secret keys configured'
);

fwrite(STDOUT, "Stripe configuration wiring assertions passed.\n");
