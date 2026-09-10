<?php

require_once __DIR__ . '/../../../shared/legal/LegalAcceptance.php';

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
 * Validador dos fluxos pontuais do dominio de assinaturas.
 */
class SubscriptionsValidator
{
    /**
     * Valida o payload do checkout Stripe.
     *
     * @since 1.0.0
     */
    public function validateStripeCheckoutPayload(array $data): array
    {
        $planId = (int) ($data['plan_id'] ?? 0);
        if ($planId <= 0) {
            throw new InvalidArgumentException('Plano invalido.');
        }

        $couponCode = strtoupper(trim((string) ($data['coupon_code'] ?? '')));
        if ($couponCode !== '' && !preg_match('/^[A-Z0-9_-]{2,40}$/', $couponCode)) {
            throw new InvalidArgumentException('Codigo de cupom invalido.');
        }

        $checkoutAttemptId = trim((string) ($data['checkout_attempt_id'] ?? ''));
        if ($checkoutAttemptId !== '' && !preg_match('/^[A-Za-z0-9_-]{8,80}$/', $checkoutAttemptId)) {
            throw new InvalidArgumentException('Identificador da tentativa de checkout invalido.');
        }

        $checkoutAdhesionTermsVersion = LegalAcceptance::assertAccepted(
            $data,
            'checkout_adhesion_terms_accepted',
            'checkout_adhesion_terms_version',
            'checkout_adhesion_terms'
        );

        return [
            'plan_id' => $planId,
            'auto_renew' => !array_key_exists('auto_renew', $data) || (bool) $data['auto_renew'],
            'coupon_code' => $couponCode,
            'payment_method_id' => trim((string) ($data['payment_method_id'] ?? '')),
            'billing_mode' => isset($data['billing_mode']) ? (string) $data['billing_mode'] : null,
            'installment_count' => max(1, (int) ($data['installment_count'] ?? 1)),
            'checkout_attempt_id' => $checkoutAttemptId,
            'checkout_adhesion_terms_accepted' => true,
            'checkout_adhesion_terms_version' => $checkoutAdhesionTermsVersion,
        ];
    }

    /**
     * Valida o payload do checkout inline Stripe.
     *
     * @since 1.0.0
     */
    public function validateStripeInlineSubscriptionPayload(array $data): array
    {
        $payload = $this->validateStripeCheckoutPayload($data);
        $paymentMethodId = trim((string) ($data['payment_method_id'] ?? ''));
        $savedCardId = trim((string) ($data['saved_card_id'] ?? ''));

        if ($paymentMethodId === '' && $savedCardId === '') {
            throw new InvalidArgumentException('Metodo de pagamento Stripe nao informado.');
        }

        return array_merge($payload, [
            'payment_method_id' => $paymentMethodId,
            'saved_card_id' => $savedCardId,
            'save_card' => !empty($data['save_card']),
        ]);
    }

    /**
     * Valida o payload de finalizacao do checkout Stripe.
     *
     * @since 1.0.0
     */
    public function validateStripeFinalizePayload(array $data): array
    {
        $subscriptionId = trim((string) ($data['subscription_id'] ?? ''));
        if ($subscriptionId === '') {
            throw new InvalidArgumentException('Assinatura Stripe nao informada.');
        }

        return [
            'subscription_id' => $subscriptionId,
            'plan_id' => isset($data['plan_id']) ? (int) $data['plan_id'] : 0,
            'auto_renew' => !array_key_exists('auto_renew', $data) || (bool) $data['auto_renew'],
            'payment_method_id' => trim((string) ($data['payment_method_id'] ?? '')),
            'payment_intent_id' => trim((string) ($data['payment_intent_id'] ?? '')),
            'saved_card_id' => trim((string) ($data['saved_card_id'] ?? '')),
            'save_card' => !empty($data['save_card']),
        ];
    }

    /**
     * Valida o payload de cupom promocional.
     *
     * @since 1.0.0
     */
    public function validateCouponPayload(array $data): array
    {
        $code = strtoupper(trim((string) ($data['code'] ?? '')));
        $planId = isset($data['plan_id']) ? (int) $data['plan_id'] : 0;
        $itemId = trim((string) ($data['item_id'] ?? ''));
        $amount = isset($data['amount']) ? (float) $data['amount'] : 0.0;

        if ($code === '' && $planId <= 0 && $itemId === '') {
            throw new InvalidArgumentException('Codigo do cupom ou alvo de validacao e obrigatorio.');
        }

        if ($code !== '' && !preg_match('/^[A-Z0-9_-]{2,40}$/', $code)) {
            throw new InvalidArgumentException('Codigo de cupom invalido.');
        }

        if ($amount < 0) {
            throw new InvalidArgumentException('Valor de validacao do cupom invalido.');
        }

        return [
            'code' => $code,
            'amount' => $amount,
            'plan_id' => $planId,
            'item_id' => $itemId,
            'target_type' => trim((string) ($data['target_type'] ?? '')),
            'target_id' => trim((string) ($data['target_id'] ?? '')),
            'authenticated_user_id' => trim((string) ($data['authenticated_user_id'] ?? '')),
            'authenticated_user_email' => strtolower(trim((string) ($data['authenticated_user_email'] ?? ''))),
        ];
    }

    /**
     * Valida o payload de renovacao automatica.
     *
     * @since 1.0.0
     */
    public function validateRenewalPayload(array $data): array
    {
        if (!array_key_exists('auto_renew', $data)) {
            throw new InvalidArgumentException('Estado de renovacao automatica obrigatorio.');
        }

        return [
            'auto_renew' => (bool) $data['auto_renew'],
        ];
    }

    /**
     * Valida uma transicao de plano sem aceitar valores monetarios do cliente.
     *
     * @since 1.0.0
     */
    public function validatePlanChangePayload(array $data): array
    {
        $planId = (int) ($data['plan_id'] ?? 0);
        if ($planId <= 0) {
            throw new InvalidArgumentException('Plano de destino invalido.');
        }

        $idempotencyKey = trim((string) ($data['idempotency_key'] ?? ''));
        if ($idempotencyKey !== '' && !preg_match('/^[A-Za-z0-9_-]{8,120}$/', $idempotencyKey)) {
            throw new InvalidArgumentException('Identificador da transicao invalido.');
        }

        return [
            'plan_id' => $planId,
            'idempotency_key' => $idempotencyKey !== ''
                ? $idempotencyKey
                : 'plan_change_' . bin2hex(random_bytes(12)),
        ];
    }

    /**
     * Valida o payload de cancelamento de assinatura.
     *
     * @since 1.0.0
     */
    public function validateCancelPayload(array $data): array
    {
        return [
            'reason' => trim((string) ($data['reason'] ?? '')),
            'details' => trim((string) ($data['details'] ?? '')),
            'captcha_token' => isset($data['captchaToken']) ? (string) $data['captchaToken'] : null,
            'confirm_debt_charge' => !empty($data['confirmDebtCharge']),
        ];
    }

    /**
     * Valida o payload de execucao guiada da matriz Stripe no admin.
     *
     * @since 1.0.0
     */
    public function validateStripeTestingRunPayload(array $data): array
    {
        $scenarioId = trim((string) ($data['scenario_id'] ?? ''));
        if ($scenarioId === '') {
            throw new InvalidArgumentException('Cenario de teste obrigatorio.');
        }

        $executionResult = strtolower(trim((string) ($data['execution_result'] ?? '')));
        if (!in_array($executionResult, ['passed', 'failed', 'blocked'], true)) {
            throw new InvalidArgumentException('Resultado da execucao invalido.');
        }

        $evidence = [
            'payment_intent_id' => trim((string) ($data['payment_intent_id'] ?? '')),
            'subscription_id' => trim((string) ($data['subscription_id'] ?? '')),
            'transaction_id' => trim((string) ($data['transaction_id'] ?? '')),
            'evidence_url' => trim((string) ($data['evidence_url'] ?? '')),
            'gateway_message' => trim((string) ($data['gateway_message'] ?? '')),
        ];

        $notes = trim((string) ($data['notes'] ?? ''));
        $hasEvidence = $notes !== '';
        foreach ($evidence as $value) {
            if ($value !== '') {
                $hasEvidence = true;
                break;
            }
        }

        if (!$hasEvidence) {
            throw new InvalidArgumentException('Informe pelo menos uma evidencia da execucao.');
        }

        return [
            'scenario_id' => $scenarioId,
            'execution_result' => $executionResult,
            'notes' => $notes,
            'evidence' => $evidence,
        ];
    }
}
