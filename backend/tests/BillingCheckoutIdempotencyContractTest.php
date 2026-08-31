<?php

require_once __DIR__ . '/../modules/subscriptions/validators/SubscriptionsValidator.php';

$validator = new SubscriptionsValidator();

$valid = $validator->validateStripeCheckoutPayload([
    'plan_id' => 3,
    'checkout_attempt_id' => 'attempt_12345678',
]);

if ($valid['checkout_attempt_id'] !== 'attempt_12345678') {
    fwrite(STDERR, "BillingCheckoutIdempotencyContractTest: valid attempt id was not preserved.\n");
    exit(1);
}

foreach ([[], ['checkout_attempt_id' => 'short'], ['checkout_attempt_id' => str_repeat('x', 81)]] as $payload) {
    try {
        $validator->validateStripeCheckoutPayload(array_merge(['plan_id' => 3], $payload));
        fwrite(STDERR, "BillingCheckoutIdempotencyContractTest: invalid attempt id was accepted.\n");
        exit(1);
    } catch (InvalidArgumentException) {
        // Expected contract rejection.
    }
}

fwrite(STDOUT, "BillingCheckoutIdempotencyContractTest: PASS\n");
