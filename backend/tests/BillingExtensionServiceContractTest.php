<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$adapter = (string) file_get_contents($root . '/modules/billing/services/StripeBillingProviderAdapter.php');
$extension = (string) file_get_contents($root . '/modules/billing/services/BillingExtensionService.php');
$benefits = (string) file_get_contents($root . '/modules/benefits/services/BenefitService.php');

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$assert(str_contains($adapter, "'trial_end' => \$newPeriodEnd"), 'Stripe extensions must use the supported trial_end mechanism.');
$assert(str_contains($adapter, "'trialing']") && str_contains($adapter, 'trialEnd > time()'), 'Sequential extensions must use the provider-confirmed future trial boundary.');
$assert(str_contains($adapter, "'proration_behavior' => 'none'"), 'Stripe extensions must not prorate already-paid time.');
$assert(str_contains($adapter, "'idempotency_key' => 'benefit_extension_'"), 'Stripe extensions must be idempotent.');
$assert(!str_contains($adapter, 'billing_cycle_anchor'), 'The adapter must not attempt an unsupported arbitrary billing anchor.');
$assert(str_contains($adapter, "'livemode' => !empty(\$updated->livemode)"), 'Provider extensions must expose the provider mode for configured-mode validation.');
$assert(str_contains($extension, "'RECONCILIATION_REQUIRED'"), 'Provider uncertainty must have an explicit recovery state.');
$assert(str_contains($extension, 'resolveStripeKeyMode(STRIPE_SECRET_KEY)'), 'Provider extensions must validate the response against the configured Stripe mode.');
$assert(str_contains($extension, 'inspectExistingSubscription'), 'Provider ambiguity must have a read-only reconciliation path.');
$assert(str_contains($benefits, "status IN ('PENDING_PROVIDER', 'APPLYING', 'RECONCILIATION_REQUIRED')"), 'Provider confirmation must converge from recoverable states.');
$assert(str_contains($benefits, 'grantSupportCompensation'), 'Support compensation must enter through BenefitService.');

fwrite(STDOUT, "Billing extension contract assertions passed.\n");
