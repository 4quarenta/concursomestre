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

require_once 'C:/xampp/htdocs/questao-pro-backend/modules/admin/validators/AdminSettingsValidator.php';

function assertAdminSettingsValidatorStripe(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assertAdminSettingsValidatorRejects(callable $callback, string $expectedMessage): void
{
    try {
        $callback();
    } catch (InvalidArgumentException $e) {
        assertAdminSettingsValidatorStripe(
            str_contains($e->getMessage(), $expectedMessage),
            'Mensagem de erro inesperada: ' . $e->getMessage()
        );
        return;
    }

    throw new RuntimeException('Payload invalido deveria ter sido rejeitado.');
}

$validator = new AdminSettingsValidator();

$valid = $validator->validateUpdatePayload([
    'stripePublishableKey' => 'pk_test_123abcDEF_456',
    'stripeSecretKey' => 'sk_test_123abcDEF_456',
    'stripeWebhookSecret' => 'whsec_123abcDEF_456',
]);

assertAdminSettingsValidatorStripe(
    ($valid['stripePublishableKey'] ?? '') === 'pk_test_123abcDEF_456',
    'Publishable key valida deveria ser preservada.'
);

assertAdminSettingsValidatorRejects(
    fn() => $validator->validateUpdatePayload(['stripePublishableKey' => 'pk_fake']),
    'Stripe publishable key invalida'
);

assertAdminSettingsValidatorRejects(
    fn() => $validator->validateUpdatePayload(['stripeSecretKey' => 'secret-here']),
    'Stripe secret key invalida'
);

assertAdminSettingsValidatorRejects(
    fn() => $validator->validateUpdatePayload(['stripeWebhookSecret' => 'webhook-secret']),
    'Stripe webhook secret invalido'
);

assertAdminSettingsValidatorRejects(
    fn() => $validator->validateUpdatePayload([
        'stripePublishableKey' => 'pk_test_123abcDEF_456',
        'stripeSecretKey' => 'sk_live_123abcDEF_456',
    ]),
    'Chaves Stripe devem usar o mesmo modo'
);

fwrite(STDOUT, "Admin settings Stripe validator assertions passed.\n");
