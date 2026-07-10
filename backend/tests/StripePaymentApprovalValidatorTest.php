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

require_once __DIR__ . '/../modules/subscriptions/services/StripePaymentApprovalValidator.php';

function stripeApprovalAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function makeStripeApprovalSnapshot(array $overrides = []): array
{
    $base = [
        'payment_intent' => (object) ['id' => 'pi_test', 'status' => 'succeeded', 'next_action' => null, 'review' => null],
        'payment_method' => (object) [],
        'charge' => (object) ['id' => 'ch_test', 'status' => 'succeeded', 'paid' => true],
        'payment_intent_status' => 'succeeded',
        'charge_status' => 'succeeded',
        'charge_paid' => true,
        'checks' => [
            'cvc_check' => 'pass',
            'address_line1_check' => 'pass',
            'address_postal_code_check' => 'pass',
        ],
        'risk' => [
            'risk_level' => 'normal',
            'risk_score' => 5,
            'outcome_type' => 'authorized',
            'outcome_reason' => '',
            'seller_message' => 'Payment complete.',
        ],
        'three_d_secure' => [
            'result' => '',
        ],
        'billing' => [
            'name' => 'Teste',
            'email' => 'teste@teste.com',
            'line1' => 'Rua Teste, 100',
            'postal_code' => '01001000',
        ],
        'review_id' => '',
    ];

    return array_replace_recursive($base, $overrides);
}

try {
    $approved = validateStripePaymentForApproval(makeStripeApprovalSnapshot());
    stripeApprovalAssert($approved['approved'] === true, 'Pagamento valido deve ser aprovado.');

    $cvcFail = validateStripePaymentForApproval(makeStripeApprovalSnapshot([
        'checks' => ['cvc_check' => 'fail'],
    ]));
    stripeApprovalAssert($cvcFail['approved'] === false, 'CVC incorreto deve bloquear aprovação.');
    stripeApprovalAssert(in_array('cvc_check_failed', $cvcFail['reason_codes'], true), 'CVC incorreto deve gerar código de motivo.');

    $zipFail = validateStripePaymentForApproval(makeStripeApprovalSnapshot([
        'checks' => ['address_postal_code_check' => 'fail'],
    ]));
    stripeApprovalAssert($zipFail['approved'] === false, 'CEP incorreto deve bloquear aprovação.');

    $missingBilling = validateStripePaymentForApproval(makeStripeApprovalSnapshot([
        'billing' => ['line1' => '', 'postal_code' => ''],
        'checks' => ['address_line1_check' => 'not_provided', 'address_postal_code_check' => 'not_provided'],
    ]));
    stripeApprovalAssert($missingBilling['approved'] === false, 'Endereco de cobrança ausente deve bloquear aprovação.');

    $requiresAction = validateStripePaymentForApproval(makeStripeApprovalSnapshot([
        'payment_intent' => (object) ['id' => 'pi_test', 'status' => 'requires_action', 'next_action' => (object) ['type' => 'use_stripe_sdk'], 'review' => null],
        'payment_intent_status' => 'requires_action',
    ]));
    stripeApprovalAssert($requiresAction['approved'] === false, 'Pagamento que exige autenticação pendente não deve ser aprovado.');

    $highRisk = validateStripePaymentForApproval(makeStripeApprovalSnapshot([
        'risk' => [
            'risk_level' => 'highest',
            'risk_score' => 88,
            'outcome_type' => 'blocked',
            'outcome_reason' => 'highest_risk_level',
            'seller_message' => 'Blocked as fraudulent.',
        ],
    ]));
    stripeApprovalAssert($highRisk['approved'] === false, 'Risco alto deve bloquear aprovação.');
    stripeApprovalAssert($highRisk['manual_review_required'] === true, 'Risco alto deve sinalizar revisao manual.');

    $processing = validateStripePaymentForApproval(makeStripeApprovalSnapshot([
        'payment_intent_status' => 'processing',
        'payment_intent' => (object) ['id' => 'pi_test', 'status' => 'processing', 'next_action' => null, 'review' => null],
    ]));
    stripeApprovalAssert($processing['approved'] === false, 'Status processing não pode virar pagamento aprovado.');

    $underReview = validateStripePaymentForApproval(makeStripeApprovalSnapshot([
        'review_id' => 'prv_123',
        'payment_intent' => (object) ['id' => 'pi_test', 'status' => 'succeeded', 'next_action' => null, 'review' => 'prv_123'],
    ]));
    stripeApprovalAssert($underReview['approved'] === false, 'Pagamento em review não deve ser aprovado automaticamente.');

    echo "StripePaymentApprovalValidatorTest: PASS\n";
} catch (Throwable $e) {
    fwrite(STDERR, "StripePaymentApprovalValidatorTest: FAIL - {$e->getMessage()}\n");
    exit(1);
}
