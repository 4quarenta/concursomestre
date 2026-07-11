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

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/env.php';

use Stripe\StripeClient;

define('STRIPE_SECRET_KEY', $_ENV['STRIPE_SECRET_KEY'] ?? getenv('STRIPE_SECRET_KEY') ?? '');
define('STRIPE_PUBLISHABLE_KEY', $_ENV['STRIPE_PUBLISHABLE_KEY'] ?? getenv('STRIPE_PUBLISHABLE_KEY') ?? '');
define('STRIPE_WEBHOOK_SECRET', $_ENV['STRIPE_WEBHOOK_SECRET'] ?? getenv('STRIPE_WEBHOOK_SECRET') ?? '');

function isValidStripeSecretKey(?string $key): bool
{
    return preg_match('/^sk_(test|live)_[A-Za-z0-9_]+$/', trim((string) $key)) === 1;
}

function isValidStripePublishableKey(?string $key): bool
{
    return preg_match('/^pk_(test|live)_[A-Za-z0-9_]+$/', trim((string) $key)) === 1;
}

function isValidStripeWebhookSecret(?string $secret): bool
{
    return preg_match('/^whsec_[A-Za-z0-9_]+$/', trim((string) $secret)) === 1;
}

function resolveStripeKeyMode(?string $key): string
{
    if (preg_match('/^[ps]k_(test|live)_/i', trim((string) $key), $matches) === 1) {
        return strtolower((string) $matches[1]);
    }

    return '';
}

/**
 * Rejects a signed event from the opposite Stripe environment. Signature
 * verification proves origin, but a test event must never mutate live data.
 */
function assertStripeEventMatchesConfiguredMode(object $event): void
{
    $expectedMode = resolveStripeKeyMode(STRIPE_SECRET_KEY);
    if ($expectedMode === '' || !property_exists($event, 'livemode')) {
        return;
    }

    $eventMode = !empty($event->livemode) ? 'live' : 'test';
    if ($eventMode !== $expectedMode) {
        throw new InvalidArgumentException('Evento Stripe recebido em ambiente incompatível.');
    }
}

function stripeIsConfigured(): bool
{
    return isValidStripeSecretKey(STRIPE_SECRET_KEY);
}

function getStripeClient(): StripeClient
{
    static $client = null;

    if ($client instanceof StripeClient) {
        return $client;
    }

    if (!stripeIsConfigured()) {
        throw new RuntimeException('Stripe nao configurado. Defina STRIPE_SECRET_KEY real no backend.');
    }

    $client = new StripeClient(STRIPE_SECRET_KEY);

    return $client;
}
