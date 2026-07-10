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

require_once __DIR__ . '/../modules/payments/validators/PaymentsValidator.php';

function setPaymentsValidatorEnv(array $values): void
{
    foreach ($values as $key => $value) {
        $_ENV[$key] = (string) $value;
        $_SERVER[$key] = (string) $value;
        putenv($key . '=' . $value);
    }
}

function assertPaymentReturnUrlRejected(PaymentsValidator $validator, array $payload, string $message): void
{
    try {
        $validator->validateCreateConnectAccountPayload($payload, 'u-1');
    } catch (InvalidArgumentException $exception) {
        return;
    }

    throw new RuntimeException($message);
}

setPaymentsValidatorEnv([
    'APP_ENV' => 'production',
    'APP_URL' => 'https://app.concursomestre.com',
    'CORS_ALLOWED_ORIGINS' => 'https://app.concursomestre.com,https://www.concursomestre.com',
]);

$validator = new PaymentsValidator();
$allowed = $validator->validateCreateConnectAccountPayload([
    'returnUrl' => 'https://app.concursomestre.com/marketplace?onboarding=success',
    'refreshUrl' => 'https://www.concursomestre.com/marketplace?onboarding=refresh',
], 'u-1');

if ($allowed['return_url'] === '' || $allowed['refresh_url'] === '') {
    throw new RuntimeException('URLs autorizadas da plataforma deveriam ser aceitas.');
}

assertPaymentReturnUrlRejected($validator, [
    'returnUrl' => 'https://evil.example/steal',
], 'URL externa deveria ser rejeitada.');

assertPaymentReturnUrlRejected($validator, [
    'returnUrl' => 'http://app.concursomestre.com/marketplace',
], 'HTTP deveria ser rejeitado em producao.');

fwrite(STDOUT, "Payments return URL validator assertions passed.\n");
