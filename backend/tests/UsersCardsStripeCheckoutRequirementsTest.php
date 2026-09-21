<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/users/services/UsersCardsStripeSupport.php';

function stripeRequirementAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$valid = [
    'name' => 'Usuario Sintetico',
    'cpf' => '529.982.247-25',
    'zip_code' => '01001-000',
    'street' => 'Rua Sintetica',
    'number' => '10A',
    'neighborhood' => 'Centro',
    'city' => 'Sao Paulo',
    'state' => 'SP',
    'email_verified' => 1,
];

stripeRequirementAssert(
    getStripeCheckoutRequirementErrors($valid) === [],
    'Dados cadastrais validos nao podem bloquear o checkout Stripe.'
);

$invalidCases = [
    'cpf' => '111.111.111-11',
    'zip_code' => '1234',
    'street' => 'R',
    'number' => '---',
    'neighborhood' => 'A',
    'city' => 'B',
    'state' => 'S',
];

foreach ($invalidCases as $field => $value) {
    $candidate = $valid;
    $candidate[$field] = $value;
    $errors = getStripeCheckoutRequirementErrors($candidate);
    stripeRequirementAssert(
        in_array($field, $errors, true),
        'Checkout Stripe aceitou campo cadastral invalido: ' . $field
    );
}

$missing = $valid;
$missing['cpf'] = '';
stripeRequirementAssert(
    array_count_values(getStripeCheckoutRequirementErrors($missing))['cpf'] === 1,
    'Campo ausente nao pode produzir erro duplicado.'
);

echo "Stripe checkout requirement validation PASS\n";
