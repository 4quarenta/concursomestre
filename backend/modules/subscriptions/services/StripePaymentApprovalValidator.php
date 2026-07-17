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

/**
 * Validador de aprovacao Stripe do dominio de assinaturas.
 *
 * Mantem a verificacao antifraude e evidencias do pagamento
 * dentro do modulo, evitando regra de dominio em `api/subscriptions`.
 */
require_once __DIR__ . '/../../../config/stripe.php';
require_once __DIR__ . '/SubscriptionsBillingSupport.php';

/**
 * Define a politica de aprovacao para pagamentos Stripe.
 *
 * @since 1.0.0
 */
function getStripeApprovalPolicy(): array
{
    return [
        'require_final_payment_intent_status' => 'succeeded',
        'require_charge_paid' => true,
        'require_cvc_check' => true,
        'require_address_line1_check' => false,
        'require_address_postal_code_check' => false,
        'block_on_unavailable_card_checks' => true,
        'block_on_unchecked_card_checks' => true,
        'block_on_not_provided_card_checks' => true,
        'block_on_address_unavailable_checks' => false,
        'block_on_address_unchecked_checks' => false,
        'block_on_address_not_provided_checks' => false,
        'block_on_review' => true,
        'block_on_elevated_risk' => true,
        'block_on_highest_risk' => true,
        'allowed_three_d_secure_results' => [
            'authenticated',
            'attempt_acknowledged',
            'not_supported',
            '',
        ],
    ];
}

/**
 * Normaliza o resultado de checks de cartao.
 *
 * @since 1.0.0
 */
function normalizeStripeCardCheckResult(?string $value): string
{
    return strtolower(trim((string) $value));
}

/**
 * Normaliza o nivel de risco retornado pelo Stripe Radar.
 *
 * @since 1.0.0
 */
function normalizeStripeRiskLevel(?string $value): string
{
    return strtolower(trim((string) $value));
}

/**
 * Extrai checks do metodo de pagamento Stripe.
 *
 * @since 1.0.0
 */
function extractStripeCardChecksFromPaymentMethod($paymentMethod): array
{
    return [
        'cvc_check' => normalizeStripeCardCheckResult($paymentMethod->card->checks->cvc_check ?? ''),
        'address_line1_check' => normalizeStripeCardCheckResult($paymentMethod->card->checks->address_line1_check ?? ''),
        'address_postal_code_check' => normalizeStripeCardCheckResult($paymentMethod->card->checks->address_postal_code_check ?? $paymentMethod->card->checks->address_zip_check ?? ''),
    ];
}

/**
 * Extrai checks do charge Stripe.
 *
 * @since 1.0.0
 */
function extractStripeCardChecksFromCharge($charge): array
{
    return [
        'cvc_check' => normalizeStripeCardCheckResult($charge->payment_method_details->card->checks->cvc_check ?? ''),
        'address_line1_check' => normalizeStripeCardCheckResult($charge->payment_method_details->card->checks->address_line1_check ?? ''),
        'address_postal_code_check' => normalizeStripeCardCheckResult($charge->payment_method_details->card->checks->address_postal_code_check ?? $charge->payment_method_details->card->checks->address_zip_check ?? ''),
    ];
}

/**
 * Resolve o valor final de check entre charge e payment method.
 *
 * @since 1.0.0
 */
function resolveStripeCardCheckValue(string $chargeValue, string $paymentMethodValue): string
{
    return $chargeValue !== '' ? $chargeValue : $paymentMethodValue;
}

/**
 * Monta um snapshot vazio de aprovacao Stripe.
 *
 * @since 1.0.0
 */
function buildBlankStripePaymentApprovalSnapshot(): array
{
    return [
        'payment_intent' => null,
        'payment_method' => null,
        'charge' => null,
        'payment_intent_status' => '',
        'charge_status' => '',
        'charge_paid' => false,
        'checks' => [
            'cvc_check' => '',
            'address_line1_check' => '',
            'address_postal_code_check' => '',
        ],
        'risk' => [
            'risk_level' => '',
            'risk_score' => null,
            'outcome_type' => '',
            'outcome_reason' => '',
            'seller_message' => '',
        ],
        'three_d_secure' => [
            'result' => '',
        ],
        'billing' => [
            'name' => '',
            'email' => '',
            'line1' => '',
            'postal_code' => '',
        ],
        'review_id' => '',
    ];
}

/**
 * Resolve o id do invoice Stripe em formatos mistos.
 *
 * @since 1.0.0
 */
function getStripeInvoiceReferenceId($invoice): string
{
    if (is_string($invoice)) {
        return trim($invoice);
    }

    if (is_object($invoice) && !empty($invoice->id)) {
        return trim((string) $invoice->id);
    }

    return '';
}

/**
 * Recupera o invoice Stripe expandido com payment intent.
 *
 * @since 1.0.0
 */
function retrieveExpandedStripeInvoice($stripe, $invoice)
{
    $invoiceId = getStripeInvoiceReferenceId($invoice);
    if ($invoiceId === '') {
        return $invoice;
    }

    return $stripe->invoices->retrieve($invoiceId, [
        // Basil removed invoice.payment_intent. Expanding payments keeps the
        // InvoicePayment reference available without exceeding Stripe's depth
        // limit; the PaymentIntent itself is retrieved explicitly below.
        'expand' => ['payment_intent', 'payments'],
    ]);
}

/**
 * Monta um snapshot completo com dados de aprovacao Stripe.
 *
 * @since 1.0.0
 */
function getStripePaymentApprovalSnapshot(
    $stripe,
    ?string $paymentIntentId = null,
    $paymentIntent = null,
    $subscription = null,
    $invoice = null,
    ?string $paymentMethodId = null
): array {
    $resolvedPaymentIntent = $paymentIntent;
    $resolvedPaymentIntentId = trim((string) ($paymentIntentId ?: ''));
    $resolvedInvoice = $invoice;
    $resolvedInvoiceId = getStripeInvoiceReferenceId($resolvedInvoice);

    if (!$resolvedPaymentIntent) {
        if ($resolvedPaymentIntentId === '' && is_object($resolvedInvoice)) {
            $resolvedPaymentIntentId = getStripeInvoicePaymentIntentId($resolvedInvoice);
        }

        if ($resolvedPaymentIntentId === '' && $resolvedInvoiceId !== '') {
            $resolvedInvoice = retrieveExpandedStripeInvoice($stripe, $resolvedInvoice);
            $resolvedInvoiceId = getStripeInvoiceReferenceId($resolvedInvoice);
            $resolvedPaymentIntentId = getStripeInvoicePaymentIntentId($resolvedInvoice);
        }

        if ($resolvedPaymentIntentId === '' && $subscription && isset($subscription->latest_invoice)) {
            $subscriptionInvoice = $subscription->latest_invoice;
            $subscriptionInvoiceId = getStripeInvoiceReferenceId($subscriptionInvoice);

            if ($resolvedInvoiceId === '' && $subscriptionInvoiceId !== '') {
                $resolvedInvoiceId = $subscriptionInvoiceId;
                $resolvedInvoice = $subscriptionInvoice;
            }

            if (is_object($subscriptionInvoice)) {
                $resolvedPaymentIntentId = getStripeInvoicePaymentIntentId($subscriptionInvoice);
            }

            if ($resolvedPaymentIntentId === '' && $subscriptionInvoiceId !== '') {
                $resolvedInvoice = retrieveExpandedStripeInvoice($stripe, $subscriptionInvoice);
                $resolvedInvoiceId = getStripeInvoiceReferenceId($resolvedInvoice);
                $resolvedPaymentIntentId = getStripeInvoicePaymentIntentId($resolvedInvoice);
            }
        }

        if ($resolvedPaymentIntentId !== '') {
            $resolvedPaymentIntent = $stripe->paymentIntents->retrieve($resolvedPaymentIntentId, [
                'expand' => ['latest_charge', 'payment_method', 'review'],
            ]);
        }
    }

    if (!$resolvedPaymentIntent && $resolvedInvoiceId !== '') {
        $resolvedInvoice = retrieveExpandedStripeInvoice($stripe, $resolvedInvoice);
        $resolvedInvoiceId = getStripeInvoiceReferenceId($resolvedInvoice);
        $resolvedPaymentIntentId = getStripeInvoicePaymentIntentId($resolvedInvoice);

        if ($resolvedPaymentIntentId !== '') {
            $resolvedPaymentIntent = $stripe->paymentIntents->retrieve($resolvedPaymentIntentId, [
                'expand' => ['latest_charge', 'payment_method', 'review'],
            ]);
        }
    }

    if (!$resolvedPaymentIntent) {
        return buildBlankStripePaymentApprovalSnapshot();
    }

    if ($resolvedInvoiceId === '') {
        $resolvedInvoiceId = getStripeObjectId($resolvedPaymentIntent->invoice ?? null);
        if ($resolvedInvoiceId !== '') {
            $resolvedInvoice = retrieveExpandedStripeInvoice($stripe, $resolvedInvoiceId);
            $resolvedInvoiceId = getStripeInvoiceReferenceId($resolvedInvoice);
        }
    }

    $charge = $resolvedPaymentIntent->latest_charge ?? null;
    if (is_string($charge) && $charge !== '') {
        $charge = $stripe->charges->retrieve($charge, []);
    }
    if (!$charge && is_object($resolvedInvoice) && !empty($resolvedInvoice->charge)) {
        $invoiceChargeId = getStripeObjectId($resolvedInvoice->charge);
        if ($invoiceChargeId !== '') {
            $charge = $stripe->charges->retrieve($invoiceChargeId, []);
        }
    }

    $resolvedPaymentMethod = $resolvedPaymentIntent->payment_method ?? null;
    if (!$resolvedPaymentMethod && $paymentMethodId) {
        $resolvedPaymentMethod = $stripe->paymentMethods->retrieve($paymentMethodId, []);
    } elseif (is_string($resolvedPaymentMethod) && $resolvedPaymentMethod !== '') {
        $resolvedPaymentMethod = $stripe->paymentMethods->retrieve($resolvedPaymentMethod, []);
    }

    if (!$resolvedPaymentMethod && $subscription) {
        $defaultPaymentMethodId = getStripeSubscriptionDefaultPaymentMethodId($subscription);
        if ($defaultPaymentMethodId !== '') {
            $resolvedPaymentMethod = $stripe->paymentMethods->retrieve($defaultPaymentMethodId, []);
        }
    }

    $chargeChecks = $charge ? extractStripeCardChecksFromCharge($charge) : [
        'cvc_check' => '',
        'address_line1_check' => '',
        'address_postal_code_check' => '',
    ];
    $paymentMethodChecks = $resolvedPaymentMethod ? extractStripeCardChecksFromPaymentMethod($resolvedPaymentMethod) : [
        'cvc_check' => '',
        'address_line1_check' => '',
        'address_postal_code_check' => '',
    ];

    $billingName = trim((string) (
        $resolvedPaymentMethod->billing_details->name
        ?? $charge->billing_details->name
        ?? $resolvedPaymentIntent->shipping->name
        ?? ''
    ));
    $billingEmail = trim((string) (
        $resolvedPaymentMethod->billing_details->email
        ?? $charge->billing_details->email
        ?? $resolvedInvoice->customer_email
        ?? ''
    ));
    $billingLine1 = trim((string) (
        $resolvedPaymentMethod->billing_details->address->line1
        ?? $charge->billing_details->address->line1
        ?? $resolvedPaymentIntent->shipping->address->line1
        ?? $resolvedInvoice->customer_address->line1
        ?? ''
    ));
    $billingPostalCode = trim((string) (
        $resolvedPaymentMethod->billing_details->address->postal_code
        ?? $charge->billing_details->address->postal_code
        ?? $resolvedPaymentIntent->shipping->address->postal_code
        ?? $resolvedInvoice->customer_address->postal_code
        ?? ''
    ));

    return [
        'payment_intent' => $resolvedPaymentIntent,
        'payment_method' => $resolvedPaymentMethod,
        'charge' => $charge,
        'payment_intent_status' => strtolower(trim((string) ($resolvedPaymentIntent->status ?? ''))),
        'charge_status' => strtolower(trim((string) ($charge->status ?? ''))),
        'charge_paid' => (bool) ($charge->paid ?? false),
        'checks' => [
            'cvc_check' => resolveStripeCardCheckValue($chargeChecks['cvc_check'], $paymentMethodChecks['cvc_check']),
            'address_line1_check' => resolveStripeCardCheckValue($chargeChecks['address_line1_check'], $paymentMethodChecks['address_line1_check']),
            'address_postal_code_check' => resolveStripeCardCheckValue($chargeChecks['address_postal_code_check'], $paymentMethodChecks['address_postal_code_check']),
        ],
        'risk' => [
            'risk_level' => normalizeStripeRiskLevel($charge->outcome->risk_level ?? ''),
            'risk_score' => isset($charge->outcome->risk_score) ? (int) $charge->outcome->risk_score : null,
            'outcome_type' => strtolower(trim((string) ($charge->outcome->type ?? ''))),
            'outcome_reason' => strtolower(trim((string) ($charge->outcome->reason ?? ''))),
            'seller_message' => trim((string) ($charge->outcome->seller_message ?? '')),
        ],
        'three_d_secure' => [
            'result' => strtolower(trim((string) ($charge->payment_method_details->card->three_d_secure->result ?? ''))),
        ],
        'billing' => [
            'name' => $billingName,
            'email' => $billingEmail,
            'line1' => $billingLine1,
            'postal_code' => $billingPostalCode,
        ],
        'review_id' => trim((string) ($resolvedPaymentIntent->review ?? '')),
    ];
}

/**
 * Registra um motivo de bloqueio no resultado de validacao.
 *
 * @since 1.0.0
 */
function appendStripeValidationIssue(array &$reasonCodes, array &$blockingErrors, string $code, string $message): void
{
    if (!in_array($code, $reasonCodes, true)) {
        $reasonCodes[] = $code;
    }

    if (!in_array($message, $blockingErrors, true)) {
        $blockingErrors[] = $message;
    }
}

/**
 * Decide se deve bloquear baseado no check de cartao.
 *
 * @since 1.0.0
 */
function shouldBlockStripeCardCheck(string $value, bool $requirePass, array $policy): bool
{
    if (!$requirePass) {
        return false;
    }

    if ($value === 'pass') {
        return false;
    }

    if ($value === 'fail') {
        return true;
    }

    if ($value === 'unavailable') {
        return !empty($policy['block_on_unavailable_card_checks']);
    }

    if ($value === 'unchecked') {
        return !empty($policy['block_on_unchecked_card_checks']);
    }

    if ($value === 'not_provided' || $value === '') {
        return !empty($policy['block_on_not_provided_card_checks']);
    }

    return true;
}

/**
 * Decide se deve bloquear baseado no check de endereco.
 *
 * @since 1.0.0
 */
function shouldBlockStripeAddressCheck(string $value, array $policy): bool
{
    if ($value === '' || $value === 'pass') {
        return false;
    }

    if ($value === 'fail') {
        return true;
    }

    if ($value === 'unavailable') {
        return !empty($policy['block_on_address_unavailable_checks']);
    }

    if ($value === 'unchecked') {
        return !empty($policy['block_on_address_unchecked_checks']);
    }

    if ($value === 'not_provided') {
        return !empty($policy['block_on_address_not_provided_checks']);
    }

    return false;
}

/**
 * Valida o snapshot Stripe contra a politica de aprovacao.
 *
 * @since 1.0.0
 */
function validateStripePaymentForApproval(array $snapshot, ?array $policy = null): array
{
    $policy = array_merge(getStripeApprovalPolicy(), $policy ?? []);
    $reasonCodes = [];
    $blockingErrors = [];
    $manualReviewRequired = false;

    $paymentIntentStatus = strtolower(trim((string) ($snapshot['payment_intent_status'] ?? '')));
    $chargeStatus = strtolower(trim((string) ($snapshot['charge_status'] ?? '')));
    $chargePaid = (bool) ($snapshot['charge_paid'] ?? false);
    $checks = (array) ($snapshot['checks'] ?? []);
    $risk = (array) ($snapshot['risk'] ?? []);
    $threeDSecure = (array) ($snapshot['three_d_secure'] ?? []);
    $billing = (array) ($snapshot['billing'] ?? []);
    $reviewId = trim((string) ($snapshot['review_id'] ?? ''));

    if ($paymentIntentStatus !== strtolower((string) $policy['require_final_payment_intent_status'])) {
        appendStripeValidationIssue(
            $reasonCodes,
            $blockingErrors,
            'payment_intent_not_succeeded',
            'O PaymentIntent Stripe ainda nao esta em estado final aprovado.'
        );
    }

    if (($snapshot['payment_intent']->next_action ?? null) !== null) {
        appendStripeValidationIssue(
            $reasonCodes,
            $blockingErrors,
            'payment_intent_requires_action',
            'O pagamento ainda exige autenticacao adicional ou outra acao do titular.'
        );
    }

    if ($chargeStatus !== 'succeeded') {
        appendStripeValidationIssue(
            $reasonCodes,
            $blockingErrors,
            'charge_not_succeeded',
            'A cobranca Stripe nao esta em estado final de sucesso.'
        );
    }

    if (!empty($policy['require_charge_paid']) && !$chargePaid) {
        appendStripeValidationIssue(
            $reasonCodes,
            $blockingErrors,
            'charge_not_paid',
            'A cobranca Stripe nao foi marcada como paga.'
        );
    }

    if ($reviewId !== '' && !empty($policy['block_on_review'])) {
        $manualReviewRequired = true;
        appendStripeValidationIssue(
            $reasonCodes,
            $blockingErrors,
            'payment_under_review',
            'O pagamento foi direcionado para revisao pela Stripe.'
        );
    }

    $outcomeType = strtolower(trim((string) ($risk['outcome_type'] ?? '')));
    if ($outcomeType === 'blocked') {
        $manualReviewRequired = true;
        appendStripeValidationIssue(
            $reasonCodes,
            $blockingErrors,
            'radar_blocked_charge',
            'A Stripe bloqueou a cobranca por regra antifraude.'
        );
    }

    $riskLevel = normalizeStripeRiskLevel($risk['risk_level'] ?? '');
    if ($riskLevel === 'highest' && !empty($policy['block_on_highest_risk'])) {
        $manualReviewRequired = true;
        appendStripeValidationIssue(
            $reasonCodes,
            $blockingErrors,
            'risk_level_highest',
            'A Stripe classificou esta cobranca com risco maximo.'
        );
    } elseif ($riskLevel === 'elevated' && !empty($policy['block_on_elevated_risk'])) {
        $manualReviewRequired = true;
        appendStripeValidationIssue(
            $reasonCodes,
            $blockingErrors,
            'risk_level_elevated',
            'A Stripe classificou esta cobranca com risco elevado.'
        );
    }

    if (!empty($policy['require_cvc_check']) && shouldBlockStripeCardCheck((string) ($checks['cvc_check'] ?? ''), true, $policy)) {
        appendStripeValidationIssue(
            $reasonCodes,
            $blockingErrors,
            'cvc_check_failed',
            'A verificacao do codigo de seguranca do cartao nao foi aprovada.'
        );
    }

    if (shouldBlockStripeAddressCheck((string) ($checks['address_line1_check'] ?? ''), $policy)) {
        appendStripeValidationIssue(
            $reasonCodes,
            $blockingErrors,
            'address_line1_check_failed',
            'A verificacao do endereco de cobranca nao foi aprovada.'
        );
    }

    if (shouldBlockStripeAddressCheck((string) ($checks['address_postal_code_check'] ?? ''), $policy)) {
        appendStripeValidationIssue(
            $reasonCodes,
            $blockingErrors,
            'postal_code_check_failed',
            'A verificacao do CEP de cobranca nao foi aprovada.'
        );
    }

    if (trim((string) ($billing['line1'] ?? '')) === '') {
        appendStripeValidationIssue(
            $reasonCodes,
            $blockingErrors,
            'billing_address_missing',
            'O endereco de cobranca nao foi informado corretamente.'
        );
    }

    if (trim((string) ($billing['postal_code'] ?? '')) === '') {
        appendStripeValidationIssue(
            $reasonCodes,
            $blockingErrors,
            'billing_postal_code_missing',
            'O CEP de cobranca nao foi informado corretamente.'
        );
    }

    $threeDSecureResult = strtolower(trim((string) ($threeDSecure['result'] ?? '')));
    if ($threeDSecureResult !== '' && !in_array($threeDSecureResult, $policy['allowed_three_d_secure_results'], true)) {
        $manualReviewRequired = true;
        appendStripeValidationIssue(
            $reasonCodes,
            $blockingErrors,
            'three_d_secure_not_completed',
            'A autenticacao adicional do cartao nao foi concluida com sucesso.'
        );
    }

    return [
        'approved' => empty($blockingErrors),
        'reason_codes' => array_values($reasonCodes),
        'manual_review_required' => $manualReviewRequired,
        'blocking_errors' => array_values($blockingErrors),
        'risk_summary' => [
            'risk_level' => $riskLevel,
            'risk_score' => $risk['risk_score'] ?? null,
            'outcome_type' => $outcomeType,
            'outcome_reason' => strtolower(trim((string) ($risk['outcome_reason'] ?? ''))),
            'seller_message' => trim((string) ($risk['seller_message'] ?? '')),
            'card_checks' => [
                'cvc_check' => (string) ($checks['cvc_check'] ?? ''),
                'address_line1_check' => (string) ($checks['address_line1_check'] ?? ''),
                'address_postal_code_check' => (string) ($checks['address_postal_code_check'] ?? ''),
            ],
            'three_d_secure_result' => $threeDSecureResult,
            'review_id' => $reviewId,
        ],
    ];
}

/**
 * Registra auditoria da validacao de aprovacao Stripe.
 *
 * @since 1.0.0
 */
function logStripePaymentApprovalAudit(string $context, array $payload): void
{
    $logPayload = [
        'context' => $context,
        'payment_intent_id' => trim((string) ($payload['payment_intent_id'] ?? '')),
        'charge_id' => trim((string) ($payload['charge_id'] ?? '')),
        'subscription_id' => trim((string) ($payload['subscription_id'] ?? '')),
        'user_id' => trim((string) ($payload['user_id'] ?? '')),
        'reason_codes' => $payload['reason_codes'] ?? [],
        'approved' => (bool) ($payload['approved'] ?? false),
        'manual_review_required' => (bool) ($payload['manual_review_required'] ?? false),
        'risk_summary' => $payload['risk_summary'] ?? [],
    ];

    error_log('Stripe approval audit: ' . json_encode($logPayload, JSON_UNESCAPED_UNICODE));
}
