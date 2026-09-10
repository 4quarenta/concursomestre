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

require_once __DIR__ . '/../repositories/SubscriptionsRepository.php';
require_once __DIR__ . '/../validators/SubscriptionsValidator.php';
require_once __DIR__ . '/../../../shared/security/Recaptcha.php';
require_once __DIR__ . '/../../../shared/legal/LegalAcceptance.php';
require_once __DIR__ . '/../../transactions/services/TransactionsRefundSupport.php';
require_once __DIR__ . '/../../transactions/services/RefundRetentionExpiryProcessor.php';
require_once __DIR__ . '/../../finance/services/FinancialLedger.php';
require_once __DIR__ . '/../../../shared/utils/Mailer.php';
require_once __DIR__ . '/../../../shared/utils/EmailTemplateResolver.php';
require_once __DIR__ . '/../../../config/stripe.php';
require_once __DIR__ . '/../../../config/payment_provider.php';
require_once __DIR__ . '/../../../config/notification_helper.php';
require_once __DIR__ . '/SubscriptionsBillingSupport.php';
require_once __DIR__ . '/StripePaymentApprovalValidator.php';
require_once __DIR__ . '/SubscriptionsAutomationService.php';
require_once __DIR__ . '/../../users/services/UsersCardsStripeSupport.php';

use Stripe\Webhook;

/**
 * Servico do dominio de assinaturas para fluxos pontuais de gestao.
 *
 * @since 1.0.0
 */
class SubscriptionsService
{
    private PDO $db;
    private SubscriptionsRepository $repository;
    private SubscriptionsValidator $validator;
    private ?string $stripeWebhookIgnoreReason = null;

    /**
     * Inicializa o servico de assinaturas com dependencias principais.
     *
     * @since 1.0.0
     */
    public function __construct(
        PDO $db,
        SubscriptionsRepository $repository,
        SubscriptionsValidator $validator
    ) {
        $this->db = $db;
        $this->repository = $repository;
        $this->validator = $validator;
    }

    /**
     * Monta as instrucoes operacionais do cron legadas consumidas pelo admin.
     *
     * @since 1.0.0
     */
    public function buildAutomationHelperPayload(string $apiBaseUrl, string $cronSecret): array
    {
        $payload = (new SubscriptionsAutomationService())
            ->buildHelperPayload($apiBaseUrl, $cronSecret);

        $payload['cron_health'] = $this->readSubscriptionCronHeartbeat();
        $payload['webhook_health'] = $this->readStripeWebhookHeartbeat();

        return $payload;
    }

    /**
     * Gera o script .bat baixado pelo admin para o agendador do Windows.
     *
     * @since 1.0.0
     */
    public function buildAutomationBatchScript(string $cronUrl): string
    {
        return (new SubscriptionsAutomationService())
            ->buildWindowsBatchScript($cronUrl);
    }

    /**
     * Retorna a matriz oficial de cenarios de teste Stripe para auditoria no admin.
     *
     * @since 1.0.0
     */
    public function buildStripeTestingMatrixPayload(): array
    {
        return (new SubscriptionsAutomationService())
            ->buildStripeTestingMatrixPayload();
    }

    /**
     * Lista o historico de execucoes guiadas da matriz Stripe.
     *
     * @since 1.0.0
     */
    public function listStripeTestingRuns(int $limit = 80): array
    {
        $runs = $this->repository->listStripeTestingRuns($limit);
        return [
            'runs' => $runs,
            'total' => count($runs),
        ];
    }

    /**
     * Registra uma execucao guiada da matriz Stripe feita por admin.
     *
     * @since 1.0.0
     */
    public function createStripeTestingRun(string $adminUserId, array $data): array
    {
        $payload = $this->validator->validateStripeTestingRunPayload($data);
        $matrix = $this->buildStripeTestingMatrixPayload();
        $scenario = null;

        foreach (($matrix['cases'] ?? []) as $case) {
            if ((string) ($case['id'] ?? '') === $payload['scenario_id']) {
                $scenario = $case;
                break;
            }
        }

        if (!$scenario) {
            throw new InvalidArgumentException('Cenario de teste nao encontrado na matriz oficial.');
        }

        if (strtolower((string) ($scenario['platform_status'] ?? '')) !== 'supported') {
            throw new DomainException('Execucao guiada disponivel apenas para cenarios com status supported.');
        }

        $runId = 'strun-' . bin2hex(random_bytes(8));
        $insertPayload = [
            'run_id' => $runId,
            'scenario_id' => (string) $scenario['id'],
            'scenario_label' => (string) ($scenario['scenario'] ?? ''),
            'category_id' => (string) ($scenario['category_id'] ?? ''),
            'stripe_reference' => (string) ($scenario['stripe_reference'] ?? ''),
            'platform_flow' => (string) ($scenario['platform_flow'] ?? ''),
            'platform_status' => (string) ($scenario['platform_status'] ?? ''),
            'execution_result' => (string) $payload['execution_result'],
            'evidence' => $payload['evidence'],
            'notes' => (string) $payload['notes'],
            'executed_by_admin_id' => $adminUserId,
        ];

        $this->repository->insertStripeTestingRun($insertPayload);

        return [
            'run_id' => $runId,
            'scenario_id' => (string) $scenario['id'],
            'scenario_label' => (string) ($scenario['scenario'] ?? ''),
            'execution_result' => (string) $payload['execution_result'],
            'evidence' => $payload['evidence'],
            'notes' => (string) $payload['notes'],
            'created_at' => gmdate('Y-m-d H:i:s'),
        ];
    }

    /**
     * Bloqueia novas cobrancas Stripe por cartao quando o admin desativou o metodo.
     *
     * @since 1.0.0
     */
    private function assertStripeCardPaymentMethodEnabled(): void
    {
        if (!isStripePaymentMethodEnabled($this->db, 'card')) {
            throw new DomainException('Cartao esta desativado no painel administrativo para novas assinaturas.');
        }
    }

    /**
     * Resolve o método de pagamento do checkout hospedado a partir da configuração admin.
     *
     * @since 1.0.0
     */
    private function resolveEnabledStripeCheckoutMethod(string $requestedMethodId = ''): array
    {
        $normalizedMethodId = normalizeStripePaymentMethodId($requestedMethodId !== '' ? $requestedMethodId : 'card'); if ($normalizedMethodId !== 'card') { throw new DomainException('O checkout de assinatura aceita apenas Cartão neste lançamento. PIX permanece desativado até a implementação pós-lançamento.'); }
        $configuredMethods = getConfiguredStripePaymentMethods($this->db)['methods'] ?? [];

        foreach ($configuredMethods as $method) {
            if (!is_array($method)) {
                continue;
            }

            $methodId = normalizeStripePaymentMethodId($method['id'] ?? '');
            if ($methodId !== $normalizedMethodId) {
                continue;
            }

            if (empty($method['enabled']) || empty($method['checkoutSupported'])) {
                throw new DomainException('O método selecionado está desativado para checkout no painel administrativo.');
            }

            return $method;
        }

        throw new DomainException('Método de pagamento não encontrado na configuração do checkout.');
    }

    /**
     * Converte o método configurado no painel para o tipo Stripe aceito pelo Checkout Session.
     *
     * @since 1.0.0
     */
    private function resolveStripeCheckoutMethodTypes(array $method): array
    {
        $methodId = normalizeStripePaymentMethodId($method['id'] ?? '');
        $stripeType = strtolower(trim((string) ($method['stripeType'] ?? '')));

        if ($methodId === 'pix' || $stripeType === 'pix') {
            return ['pix'];
        }

        if ($methodId === 'boleto' || $stripeType === 'boleto') {
            return ['boleto'];
        }

        if (
            $methodId === 'apple_pay'
            || $methodId === 'google_pay'
            || $stripeType === 'card_wallet'
            || $stripeType === 'wallet'
            || $stripeType === 'apple_pay'
            || $stripeType === 'google_pay'
        ) {
            return ['card'];
        }

        return ['card'];
    }

    /**
     * Regras de compatibilidade do método com recorrência automática.
     *
     * @since 1.0.0
     */
    private function assertStripeCheckoutMethodCompatibility(array $method, bool $autoRenew): void
    {
        $methodId = normalizeStripePaymentMethodId($method['id'] ?? '');
        $supportsRecurring = !empty($method['recurringSupported']);

        if ($autoRenew && !$supportsRecurring) {
            throw new DomainException('O método selecionado não suporta renovação automática neste fluxo. Escolha Cartão para recorrência ou desative a renovação automática.');
        }

        if ($methodId === 'pix') {
            $pixCapability = $this->resolveStripePixCapability(false);
            if (empty($pixCapability['available'])) {
                throw new DomainException('PIX ainda não está ativo na conta Stripe para este checkout. Ative a capability PIX no painel financeiro ou use Cartão.');
            }
        }
    }

    /**
     * Cria o checkout de assinatura Stripe para o usuario.
     *
     * @since 1.0.0
     */
    public function createStripeCheckoutSession(string $userId, array $data): array
    {
        $payload = $this->validator->validateStripeCheckoutPayload($data);
        $context = $this->buildStripeCreationContext($userId, $payload);
        LegalAcceptance::recordCheckout($this->db, $userId, (string) $payload['checkout_adhesion_terms_version']);
        if ($context['final_price'] <= 0) {
            return $this->activateLocalCreditStripeSubscription(
                $userId,
                $context['plan'],
                $context['user'],
                $context['coupon_result'],
                (float) $context['credit_amount'],
                (float) $context['discount_amount'],
                (float) $context['final_price']
            );
        }

        $selectedCheckoutMethod = $this->resolveEnabledStripeCheckoutMethod((string) ($payload['payment_method_id'] ?? ''));
        $selectedCheckoutMethodId = normalizeStripePaymentMethodId($selectedCheckoutMethod['id'] ?? '');
        $this->assertStripeCheckoutMethodCompatibility($selectedCheckoutMethod, (bool) $payload['auto_renew']);
        $paymentMethodTypes = $this->resolveStripeCheckoutMethodTypes($selectedCheckoutMethod);

        $billingConfig = getStripeBillingTermConfig(
            $context['plan'],
            $context['final_price'],
            $payload['billing_mode'],
            $payload['installment_count']
        );
        if (in_array('card', $paymentMethodTypes, true) && (int) $billingConfig['term_cycles'] > 1) {
            throw new DomainException(
                'O parcelamento com cartao exige checkout interno para validar se a validade cobre todas as parcelas.'
            );
        }

        $customerData = getStripeCustomerForUser($this->db, $userId);
        $stripe = $customerData['stripe'];
        $stripeCustomerId = $customerData['customer_id'];

        cancelStaleIncompleteStripeSubscriptions($this->db, $userId, $stripeCustomerId, $stripe);
        $initialChargeDescription = buildStripeChargeDescription(
            (string) $context['plan']['name'],
            1,
            (int) $billingConfig['term_cycles'],
            (string) $billingConfig['billing_mode']
        );
        $stripeProductId = getOrCreateStripeProductId($this->db, $context['plan'], $stripe);
        $metadata = $this->buildStripeCheckoutMetadata(
            $userId,
            $context['plan'],
            $context['user'],
            $payload['auto_renew'],
            $context['coupon_result'],
            $context['discount_amount'],
            $context['credit_amount'],
            $context['final_price'],
            $billingConfig,
            $initialChargeDescription,
            [
                'checkout_payment_method_id' => $selectedCheckoutMethodId,
                'checkout_payment_method_types' => implode(',', $paymentMethodTypes),
                'checkout_attempt_id' => (string) ($payload['checkout_attempt_id'] ?? ''),
            ]
        );

        $sessionPayload = [
            'mode' => 'subscription',
            'customer' => $stripeCustomerId,
            'client_reference_id' => $userId,
            'success_url' => getAppBaseUrl() . '/subscription/success?provider=stripe&session_id={CHECKOUT_SESSION_ID}',
            'cancel_url' => getAppBaseUrl() . '/subscription/cancelled?provider=stripe',
            'payment_method_types' => $paymentMethodTypes,
            'billing_address_collection' => 'required',
            'customer_update' => [
                'address' => 'auto',
                'name' => 'auto',
            ],
            'metadata' => $metadata,
            'subscription_data' => [
                'cancel_at_period_end' => resolveStripeCancelAtPeriodEnd(
                    $payload['auto_renew'],
                    (int) $billingConfig['term_cycles'],
                    0
                ),
                'metadata' => $metadata,
            ],
            'line_items' => [[
                'quantity' => 1,
                'price_data' => [
                    'currency' => 'brl',
                    'unit_amount' => $billingConfig['cycle_charge_cents'],
                    'product' => $stripeProductId,
                    'recurring' => [
                        'interval' => $billingConfig['charge_interval'],
                        'interval_count' => $billingConfig['charge_interval_count'],
                    ],
                ],
            ]],
        ];

        $sessionRequestOptions = [];
        if (!empty($payload['checkout_attempt_id'])) {
            $sessionRequestOptions['idempotency_key'] = 'checkout_session_' . $userId . '_' . $payload['checkout_attempt_id'];
        }

        $reservedCouponCode = !empty($context['coupon_result']['valid'])
            ? (string) ($context['coupon_result']['coupon']['code'] ?? '')
            : '';
        $checkoutAttemptId = (string) ($payload['checkout_attempt_id'] ?? '');
        $sessionCreated = false;

        try {
            if ($reservedCouponCode !== '') {
                reserveCouponUsage($this->db, $reservedCouponCode, $userId, $checkoutAttemptId, 'stripe');
            }

            if ($billingConfig['first_invoice_discount_cents'] > 0) {
                $coupon = $this->createFirstInvoiceAdjustmentCoupon(
                    $stripe,
                    $userId,
                    (int) $context['plan']['id'],
                    (int) $billingConfig['first_invoice_discount_cents'],
                    $context['coupon_result'],
                    $context['final_price']
                );

                $sessionPayload['discounts'] = [[
                    'coupon' => $coupon->id,
                ]];
            }

            $session = $stripe->checkout->sessions->create($sessionPayload, $sessionRequestOptions);
            $sessionCreated = true;

            if ($reservedCouponCode !== '') {
                attachCouponReservationProviderReference(
                    $this->db,
                    $reservedCouponCode,
                    $userId,
                    $checkoutAttemptId,
                    (string) $session->id,
                    null,
                    'stripe'
                );
            }
        } catch (Throwable $error) {
            if (!$sessionCreated && $reservedCouponCode !== '') {
                releaseCouponReservation($this->db, $reservedCouponCode, $userId, $checkoutAttemptId, 'stripe');
            }

            throw $error;
        }

        return [
            'url' => $session->url,
            'session_id' => $session->id,
            'provider' => 'stripe',
            'payment_method_id' => $selectedCheckoutMethodId,
            'payment_method_types' => $paymentMethodTypes,
            'amount' => (float) $billingConfig['first_invoice_charge_amount'],
            'term_total_amount' => (float) $billingConfig['term_total_amount'],
            'recurring_cycle_amount' => (float) $billingConfig['cycle_charge_amount'],
            'billing_mode' => (string) $billingConfig['billing_mode'],
            'billing_term_cycles' => (int) $billingConfig['term_cycles'],
            'billing_commitment_cycles' => (int) $billingConfig['commitment_cycles'],
            'billing_selected_installments' => (int) $billingConfig['selected_installment_count'],
            'charge_description' => $initialChargeDescription,
        ];
    }

    /**
     * Cria a assinatura Stripe com pagamento inline.
     *
     * @since 1.0.0
     */
    public function createStripeInlineSubscription(string $userId, array $data): array
    {
        $payload = $this->validator->validateStripeInlineSubscriptionPayload($data);
        $context = $this->buildStripeCreationContext($userId, $payload);
        LegalAcceptance::recordCheckout($this->db, $userId, (string) $payload['checkout_adhesion_terms_version']);
        if ($context['final_price'] <= 0) {
            return $this->activateLocalCreditStripeSubscription(
                $userId,
                $context['plan'],
                $context['user'],
                $context['coupon_result'],
                (float) $context['credit_amount'],
                (float) $context['discount_amount'],
                (float) $context['final_price']
            );
        }

        $this->assertStripeCardPaymentMethodEnabled();

        $billingConfig = getStripeBillingTermConfig(
            $context['plan'],
            $context['final_price'],
            $payload['billing_mode'],
            $payload['installment_count']
        );

        $customerData = getStripeCustomerForUser($this->db, $userId);
        $stripe = $customerData['stripe'];
        $stripeCustomerId = $customerData['customer_id'];

        cancelStaleIncompleteStripeSubscriptions($this->db, $userId, $stripeCustomerId, $stripe);

        $paymentContext = $this->resolveStripeInlinePaymentMethod(
            $stripe,
            $userId,
            $stripeCustomerId,
            $context['user'],
            $payload,
            $billingConfig
        );
        $paymentMethodId = $paymentContext['payment_method_id'];
        $persistCardLocally = $paymentContext['persist_card_locally'];
        $usingSavedCard = $paymentContext['using_saved_card'];

        $initialChargeDescription = buildStripeChargeDescription(
            (string) $context['plan']['name'],
            1,
            (int) $billingConfig['term_cycles'],
            (string) $billingConfig['billing_mode']
        );
        $stripeProductId = getOrCreateStripeProductId($this->db, $context['plan'], $stripe);
        $metadata = $this->buildStripeCheckoutMetadata(
            $userId,
            $context['plan'],
            $context['user'],
            $payload['auto_renew'],
            $context['coupon_result'],
            $context['discount_amount'],
            $context['credit_amount'],
            $context['final_price'],
            $billingConfig,
            $initialChargeDescription,
            [
                'save_card' => $persistCardLocally ? '1' : '0',
                'saved_card_id' => $payload['saved_card_id'],
                'checkout_attempt_id' => (string) ($payload['checkout_attempt_id'] ?? ''),
            ]
        );

        $subscriptionPayload = [
            'customer' => $stripeCustomerId,
            'items' => [[
                'price_data' => [
                    'currency' => 'brl',
                    'unit_amount' => $billingConfig['cycle_charge_cents'],
                    'product' => $stripeProductId,
                    'recurring' => [
                        'interval' => $billingConfig['charge_interval'],
                        'interval_count' => $billingConfig['charge_interval_count'],
                    ],
                ],
            ]],
            'payment_behavior' => 'default_incomplete',
            'default_payment_method' => $paymentMethodId,
            'payment_settings' => [
                'save_default_payment_method' => 'on_subscription',
            ],
            'cancel_at_period_end' => resolveStripeCancelAtPeriodEnd(
                $payload['auto_renew'],
                (int) $billingConfig['term_cycles'],
                0
            ),
            'expand' => ['latest_invoice.confirmation_secret', 'latest_invoice.payment_intent', 'latest_invoice.lines.data', 'pending_setup_intent'],
            'metadata' => $metadata,
        ];

        $subscriptionRequestOptions = [];
        if (!empty($payload['checkout_attempt_id'])) {
            $subscriptionRequestOptions['idempotency_key'] = 'inline_subscription_' . $userId . '_' . $payload['checkout_attempt_id'];
        }

        $reservedCouponCode = !empty($context['coupon_result']['valid'])
            ? (string) ($context['coupon_result']['coupon']['code'] ?? '')
            : '';
        $checkoutAttemptId = (string) ($payload['checkout_attempt_id'] ?? '');
        $subscriptionCreated = false;

        try {
            if ($reservedCouponCode !== '') {
                reserveCouponUsage($this->db, $reservedCouponCode, $userId, $checkoutAttemptId, 'stripe');
            }

            if ($billingConfig['first_invoice_discount_cents'] > 0) {
                $coupon = $this->createFirstInvoiceAdjustmentCoupon(
                    $stripe,
                    $userId,
                    (int) $context['plan']['id'],
                    (int) $billingConfig['first_invoice_discount_cents'],
                    $context['coupon_result'],
                    $context['final_price']
                );

                $subscriptionPayload['discounts'] = [[
                    'coupon' => $coupon->id,
                ]];
            }

            $subscription = $stripe->subscriptions->create($subscriptionPayload, $subscriptionRequestOptions);
            $subscriptionCreated = true;

            if ($reservedCouponCode !== '') {
                attachCouponReservationProviderReference(
                    $this->db,
                    $reservedCouponCode,
                    $userId,
                    $checkoutAttemptId,
                    null,
                    (string) $subscription->id,
                    'stripe'
                );
            }
        } catch (Throwable $error) {
            if (!$subscriptionCreated && $reservedCouponCode !== '') {
                releaseCouponReservation($this->db, $reservedCouponCode, $userId, $checkoutAttemptId, 'stripe');
            }

            throw $error;
        }
        $paymentIntent = $subscription->latest_invoice->payment_intent ?? null;
        $confirmationSecret = $subscription->latest_invoice->confirmation_secret->client_secret ?? null;
        $setupIntent = $subscription->pending_setup_intent ?? null;

        if (!empty($paymentIntent->id)) {
            $paymentIntentUpdatePayload = [
                'description' => $initialChargeDescription,
                'payment_method_options' => [
                    'card' => [
                        'request_three_d_secure' => 'automatic',
                    ],
                ],
            ];

            if ($usingSavedCard) {
                $paymentIntentUpdatePayload['payment_method_options']['card']['require_cvc_recollection'] = true;
            }

            $paymentIntent = $stripe->paymentIntents->update((string) $paymentIntent->id, $paymentIntentUpdatePayload);
        }

        $clientSecret = $usingSavedCard
            ? (($paymentIntent->client_secret ?? null) ?: $confirmationSecret ?: ($setupIntent->client_secret ?? null))
            : ($confirmationSecret ?: ($paymentIntent->client_secret ?? null) ?: ($setupIntent->client_secret ?? null));

        $confirmationType = 'none';
        if (!empty($confirmationSecret) || !empty($paymentIntent?->client_secret)) {
            $confirmationType = 'payment';
        } elseif (!empty($setupIntent?->client_secret)) {
            $confirmationType = 'setup';
        }

        $subscriptionStatus = (string) ($subscription->status ?? '');
        if ($clientSecret === null || $clientSecret === '') {
            if (!in_array($subscriptionStatus, ['active', 'trialing'], true)) {
                throw new RuntimeException('Nao foi possivel iniciar a confirmacao do pagamento Stripe.');
            }
        }

        $subscriptionPeriod = calculateSubscriptionPeriodRange(
            (string) $billingConfig['access_interval_unit'],
            (int) $billingConfig['access_interval_count']
        );
        $providerPeriod = $this->extractStripeSubscriptionProviderPeriod($subscription, $subscription->latest_invoice ?? null);
        $this->upsertPendingStripeSubscriptionRecord(
            $userId,
            (int) $context['plan']['id'],
            (string) $subscription->id,
            $stripeCustomerId,
            mapStripeSubscriptionStatus($subscriptionStatus),
            $subscriptionPeriod['start'],
            $subscriptionPeriod['end'],
            $providerPeriod['start'],
            $providerPeriod['end'],
            $payload['auto_renew'],
            (float) $billingConfig['cycle_charge_amount'],
            (int) $billingConfig['term_cycles']
        );

        return [
            'provider' => 'stripe',
            'checkout_mode' => 'internal',
            'client_secret' => $clientSecret,
            'confirmation_type' => $confirmationType,
            'customer_id' => $stripeCustomerId,
            'subscription_id' => $subscription->id,
            'payment_method_id' => $paymentMethodId,
            'saved_card_id' => $payload['saved_card_id'],
            'save_card' => $persistCardLocally,
            'amount' => (float) $billingConfig['first_invoice_charge_amount'],
            'term_total_amount' => (float) $billingConfig['term_total_amount'],
            'recurring_cycle_amount' => (float) $billingConfig['cycle_charge_amount'],
            'billing_mode' => (string) $billingConfig['billing_mode'],
            'billing_term_cycles' => (int) $billingConfig['term_cycles'],
            'billing_commitment_cycles' => (int) $billingConfig['commitment_cycles'],
            'billing_selected_installments' => (int) $billingConfig['selected_installment_count'],
            'charge_description' => $initialChargeDescription,
            'subscription_status' => $subscriptionStatus,
            'payment_intent_id' => (string) ($paymentIntent->id ?? ''),
            'payment_intent_status' => (string) ($paymentIntent->status ?? ''),
        ];
    }

    /**
     * Finaliza a assinatura Stripe apos o checkout inline.
     *
     * @since 1.0.0
     */
    public function finalizeStripeSubscription(string $userId, array $data): array {
        $payload = $this->validator->validateStripeFinalizePayload($data);

        if (!stripeIsConfigured()) {
            throw new RuntimeException('Stripe nao configurado no backend.');
        }

        $user = $this->repository->findUserById($userId);
        if (!$user) {
            throw new OutOfBoundsException('Usuario nao encontrado.');
        }

        $localSubscription = $this->repository->findStripeSubscriptionForUser($userId, $payload['subscription_id']);
        if (!$localSubscription) {
            if ($payload['plan_id'] <= 0) {
                throw new InvalidArgumentException('Nao foi possivel localizar a assinatura local para finalizar.');
            }

            $plan = $this->repository->findPlanById($payload['plan_id']);
            if (!$plan) {
                throw new OutOfBoundsException('Plano nao encontrado para finalizar a assinatura.');
            }

            $localSubscription = [
                'plan_id' => $payload['plan_id'],
                'plan_name' => $plan['name'],
                'price' => $plan['price'] ?? 0,
                'interval_unit' => $plan['interval_unit'],
                'interval_count' => $plan['interval_count'],
            ];
        }

        $stripe = getStripeClient();
        $subscription = $stripe->subscriptions->retrieve($payload['subscription_id'], [
            'expand' => ['latest_invoice.payment_intent', 'latest_invoice.lines.data', 'default_payment_method', 'items.data.price'],
        ]);

        $stripeCustomerId = getStripeObjectId($subscription->customer ?? null);
        if ($stripeCustomerId === '') {
            throw new RuntimeException('A assinatura Stripe retornou sem customer vinculado.');
        }

        if (!empty($user['stripe_customer_id']) && $user['stripe_customer_id'] !== $stripeCustomerId) {
            throw new DomainException('A assinatura Stripe nao pertence ao usuario autenticado.');
        }

        if (empty($user['stripe_customer_id'])) {
            $this->repository->updateUserStripeCustomerId($userId, $stripeCustomerId);
        }

        $paymentMethodId = (string) $payload['payment_method_id'];
        if ($payload['saved_card_id'] !== '') {
            $savedCard = getLocalStripeCardById($this->db, $userId, $payload['saved_card_id']);
            if (!$savedCard || empty($savedCard['stripe_payment_method_id'])) {
                throw new InvalidArgumentException('O cartao salvo selecionado nao foi encontrado para finalizar a compra.');
            }
            $paymentMethodId = (string) $savedCard['stripe_payment_method_id'];
        }

        if ($paymentMethodId === '') {
            $paymentMethodId = getStripeSubscriptionDefaultPaymentMethodId($subscription);
        }

        $invoice = $subscription->latest_invoice ?? null;
        $invoiceStatus = is_object($invoice) && isset($invoice->status) ? (string) $invoice->status : '';
        $paymentIntentStatus = getStripeInvoicePaymentIntentStatus($invoice);
        $subscriptionStatus = (string) ($subscription->status ?? '');
        $subscriptionMetadata = $this->normalizeStripeMetadata($subscription->metadata ?? []);
        $planContext = [
            'name' => (string) ($localSubscription['plan_name'] ?? ''),
            'price' => (float) ($localSubscription['price'] ?? $localSubscription['recurring_amount'] ?? 0),
            'interval_unit' => (string) ($localSubscription['interval_unit'] ?? 'month'),
            'interval_count' => (int) ($localSubscription['interval_count'] ?? 1),
        ];
        $termCycles = resolveStripeTermCycleCount($localSubscription, $subscriptionMetadata, $planContext);
        $paymentIntentId = $payload['payment_intent_id'] !== ''
            ? $payload['payment_intent_id']
            : getStripeInvoicePaymentIntentId($invoice);

        $approvalSnapshot = getStripePaymentApprovalSnapshot(
            $stripe,
            $paymentIntentId,
            is_object($invoice) ? ($invoice->payment_intent ?? null) : null,
            $subscription,
            $invoice,
            $paymentMethodId
        );

        $resolvedPaymentIntent = $approvalSnapshot['payment_intent'] ?? null;
        $resolvedPaymentIntentCustomerId = getStripeObjectId($resolvedPaymentIntent->customer ?? null);
        if ($resolvedPaymentIntentCustomerId !== '' && $resolvedPaymentIntentCustomerId !== $stripeCustomerId) {
            throw new DomainException('O PaymentIntent Stripe nao pertence ao customer autenticado.');
        }

        $subscriptionInvoiceId = is_object($invoice) ? trim((string) ($invoice->id ?? '')) : trim((string) $invoice);
        $resolvedPaymentIntentInvoiceId = getStripeObjectId($resolvedPaymentIntent->invoice ?? null);
        if (
            $subscriptionInvoiceId !== ''
            && $resolvedPaymentIntentInvoiceId !== ''
            && $resolvedPaymentIntentInvoiceId !== $subscriptionInvoiceId
        ) {
            return [
                'response_type' => 'validation_error',
                'error' => [
                    'message' => 'O PaymentIntent confirmado nao corresponde a fatura atual da assinatura Stripe.',
                    'reason_codes' => ['payment_intent_invoice_mismatch'],
                    'blocking_errors' => ['O PaymentIntent confirmado nao corresponde a fatura atual da assinatura Stripe.'],
                    'risk_summary' => [],
                ],
            ];
        }

        $approvalResult = validateStripePaymentForApproval($approvalSnapshot);
        $approvalResult['payment_intent_id'] = (string) ($approvalSnapshot['payment_intent']->id ?? $paymentIntentId);
        $approvalResult['charge_id'] = (string) ($approvalSnapshot['charge']->id ?? '');
        $approvalResult['subscription_id'] = $payload['subscription_id'];
        $approvalResult['user_id'] = $userId;
        logStripePaymentApprovalAudit('stripe_finalize', $approvalResult);

        if (!$approvalResult['approved']) {
            rejectStripeSubscriptionAfterFailedApproval(
                $this->db,
                $stripe,
                $payload['subscription_id'],
                $userId,
                !empty($localSubscription['id']) ? (int) $localSubscription['id'] : null,
                $approvalResult
            );

            return [
                'response_type' => 'validation_error',
                'error' => [
                    'message' => 'O pagamento Stripe foi bloqueado: ' . ($approvalResult['blocking_errors'][0] ?? 'falha na validacao antifraude.'),
                    'reason_codes' => $approvalResult['reason_codes'],
                    'blocking_errors' => $approvalResult['blocking_errors'],
                    'risk_summary' => $approvalResult['risk_summary'],
                ],
            ];
        }

        $accessGranted = $approvalResult['approved']
            && in_array($subscriptionStatus, ['active', 'trialing'], true)
            && ($invoiceStatus === 'paid' || $paymentIntentStatus === 'succeeded');

        $syncedSubscription = $this->upsertStripeSubscriptionFinalize(
            $userId,
            (int) $localSubscription['plan_id'],
            (string) ($localSubscription['plan_name'] ?? 'Assinatura'),
            $termCycles,
            $planContext,
            $subscription,
            $payload['auto_renew']
        );
        $syncedSubscription = $this->refreshStripeRenewalProjection($syncedSubscription, true);

        $cardSaved = false;
        $cardSaveWarning = null;
        $persistCardLocally = $payload['save_card'] || $payload['auto_renew'] || $payload['saved_card_id'] !== '';

        if ($accessGranted) {
            $shouldCancelAtPeriodEnd = resolveStripeCancelAtPeriodEnd($payload['auto_renew'], $termCycles, 1);
            if ((bool) ($subscription->cancel_at_period_end ?? false) !== $shouldCancelAtPeriodEnd) {
                $stripe->subscriptions->update($payload['subscription_id'], [
                    'cancel_at_period_end' => $shouldCancelAtPeriodEnd,
                ]);
            }

            $this->repository->updateUserPlanAssignment(
                $userId,
                (int) $localSubscription['plan_id'],
                canonicalUserPlanValue((string) $syncedSubscription['plan_name']),
                (string) $syncedSubscription['current_period_end']
            );

            if ($invoice) {
                $invoiceInserted = $this->ensureStripeInvoiceTransaction(
                    $invoice,
                    $userId,
                    (int) $localSubscription['plan_id'],
                    (string) ($localSubscription['plan_name'] ?? 'Assinatura'),
                    $stripeCustomerId,
                    (string) $user['email'],
                    trim((string) ($subscription->metadata->coupon_code ?? '')),
                    (int) ($syncedSubscription['id'] ?? 0)
                );

                if ($invoiceInserted) {
                    $couponCode = trim((string) ($subscription->metadata->coupon_code ?? ''));
                    if ($couponCode !== '') {
                        consumeCouponReservationForStripeInvoice(
                            $this->db,
                            $couponCode,
                            $subscriptionMetadata,
                            (string) ($invoice->id ?? ''),
                            (string) ($subscription->id ?? '')
                        );
                    }

                    $transaction = findStripeTransactionByInvoiceId($this->db, (string) ($invoice->id ?? ''));
                    $paidAmount = round(((float) ($invoice->amount_paid ?? $invoice->amount_due ?? 0)) / 100, 2);
                    $this->notifyFinancialAdminsAboutStripeTransaction(
                        is_array($transaction) ? $transaction : [],
                        $syncedSubscription,
                        (string) ($localSubscription['plan_name'] ?? 'Assinatura'),
                        $paidAmount,
                        (string) ($invoice->id ?? ''),
                        false
                    );

                    try {
                        sendSubscriptionWelcomeEmail($this->db, $user, [
                            'plan_name' => (string) ($localSubscription['plan_name'] ?? 'Assinatura'),
                            'interval_unit' => (string) ($localSubscription['interval_unit'] ?? 'month'),
                            'interval_count' => (int) ($localSubscription['interval_count'] ?? 1),
                            'billing_mode' => (string) ($subscriptionMetadata['billing_mode'] ?? ($termCycles > 1 ? 'term_recurring' : 'single_installment')),
                            'installment_count' => $termCycles,
                            'term_total_amount' => (float) ($subscriptionMetadata['final_amount'] ?? ($transaction['amount'] ?? 0)),
                            'first_charge_amount' => (float) ($transaction['amount'] ?? 0),
                            'cycle_charge_amount' => (float) ($subscriptionMetadata['billing_cycle_amount'] ?? ($transaction['amount'] ?? 0)),
                            'payment_provider' => 'stripe',
                            'current_period_end' => $syncedSubscription['current_period_end'],
                            'transaction_reference' => (string) ($invoice->id ?? ''),
                        ], $transaction);
                    } catch (Throwable $emailError) {
                        error_log('Stripe subscription welcome email error: ' . $emailError->getMessage());
                    }
                }
            }

            if ($paymentMethodId !== '') {
                if ($persistCardLocally) {
                    try {
                        markStripePaymentMethodAsSaved($stripe, $paymentMethodId, true);
                        $paymentMethod = $stripe->paymentMethods->retrieve($paymentMethodId, []);

                        $stripe->customers->update($stripeCustomerId, [
                            'invoice_settings' => [
                                'default_payment_method' => $paymentMethodId,
                            ],
                        ]);

                        upsertLocalStripeCardMirror($this->db, $userId, $stripeCustomerId, $paymentMethod, true, 'checkout_billing_card_sync');
                        setStripeLocalDefaultCard($this->db, $userId, $paymentMethodId);
                        $cardSaved = true;
                    } catch (Throwable $cardSyncError) {
                        $cardSaveWarning = 'O pagamento foi aprovado, mas nao foi possivel sincronizar o cartao salvo agora. Tente novamente em Dados Pessoais.';
                        error_log('Stripe finalize card sync warning: ' . $cardSyncError->getMessage());
                    }
                }

                setStripeRecurringCardLock($this->db, $userId, $payload['auto_renew'] ? $paymentMethodId : null);
            } else {
                setStripeRecurringCardLock($this->db, $userId, null);
            }

            $this->repository->updateUserHasSavedCard(
                $userId,
                $this->repository->countSavedStripeCards($userId) > 0
            );
        }

        return [
            'response_type' => 'success',
            'message' => $accessGranted
                ? 'Assinatura Stripe sincronizada com sucesso.'
                : 'Pagamento confirmado, mas a assinatura ainda aguarda sincronizacao final do Stripe.',
            'data' => [
                'access_granted' => $accessGranted,
                'approved' => $approvalResult['approved'],
                'reason_codes' => $approvalResult['reason_codes'],
                'subscription_status' => $subscriptionStatus,
                'payment_intent_status' => $paymentIntentStatus,
                'current_period_end' => $syncedSubscription['current_period_end'],
                'billing_mode' => (string) ($subscriptionMetadata['billing_mode'] ?? ($termCycles > 1 ? 'term_recurring' : 'single_installment')),
                'billing_term_cycles' => $termCycles,
                'card_saved' => $cardSaved,
                'card_save_warning' => $cardSaveWarning,
            ],
        ];
    }

    /**
     * Consulta ou solicita a capability pix_payments da conta Stripe conectada.
     * A API de capabilities se aplica a contas Connect; sem account id configurado
     * o checkout mantém PIX indisponível para evitar cobrança fora do fluxo oficial.
     *
     * @since 1.0.0
     */
    public function resolveStripePixCapability(bool $requestCapability = false): array
    {
        $stripe = getStripeClient();
        $accountId = trim((string) (
            $_ENV['STRIPE_PIX_ACCOUNT_ID']
            ?? getenv('STRIPE_PIX_ACCOUNT_ID')
            ?: ($_ENV['STRIPE_CONNECTED_ACCOUNT_ID']
                ?? getenv('STRIPE_CONNECTED_ACCOUNT_ID')
                ?: ($_ENV['STRIPE_ACCOUNT_ID'] ?? getenv('STRIPE_ACCOUNT_ID') ?: ''))
        ));

        if ($accountId === '') {
            return [
                'success' => true,
                'available' => false,
                'requested' => false,
                'capability' => 'pix_payments',
                'status' => 'not_configured',
                'account_id' => null,
                'message' => 'Configure STRIPE_PIX_ACCOUNT_ID ou STRIPE_CONNECTED_ACCOUNT_ID para solicitar pix_payments via API de capabilities.',
            ];
        }

        try {
            $capability = $requestCapability
                ? $stripe->accounts->updateCapability($accountId, 'pix_payments', ['requested' => true])
                : $stripe->accounts->retrieveCapability($accountId, 'pix_payments');

            $status = (string) ($capability->status ?? 'unknown');
            $requested = (bool) ($capability->requested ?? false);

            return [
                'success' => true,
                'available' => $status === 'active',
                'requested' => $requested,
                'capability' => 'pix_payments',
                'status' => $status,
                'account_id' => $accountId,
                'message' => $status === 'active'
                    ? 'Capability pix_payments ativa na Stripe.'
                    : 'Capability pix_payments solicitada/consultada, mas ainda não ativa.',
            ];
        } catch (Throwable $e) {
            return [
                'success' => true,
                'available' => false,
                'requested' => $requestCapability,
                'capability' => 'pix_payments',
                'status' => 'unavailable',
                'account_id' => $accountId,
                'message' => 'Não foi possível consultar ou solicitar pix_payments na Stripe: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Processa os webhooks da Stripe.
     *
     * @since 1.0.0
     */
    public function processStripeWebhook(string $payload, string $signature): array
    {
        if (!stripeIsConfigured() || empty(STRIPE_WEBHOOK_SECRET)) {
            throw new RuntimeException('Stripe webhook nao configurado.');
        }

        $event = Webhook::constructEvent($payload, $signature, STRIPE_WEBHOOK_SECRET);
        assertStripeEventMatchesConfiguredMode($event);
        return $this->processStripeWebhookEventObject(
            $event,
            hash('sha256', $payload)
        );
    }

    /**
     * Valida a assinatura Stripe e persiste um job duravel para resposta HTTP rapida.
     */
    public function enqueueStripeWebhook(string $payload, string $signature): array
    {
        if (!stripeIsConfigured() || empty(STRIPE_WEBHOOK_SECRET)) {
            throw new RuntimeException('Stripe webhook nao configurado.');
        }
        if ($payload === '' || strlen($payload) > 1_048_576) {
            throw new InvalidArgumentException('Payload Stripe vazio ou acima de 1 MiB.');
        }

        $event = Webhook::constructEvent($payload, $signature, STRIPE_WEBHOOK_SECRET);
        assertStripeEventMatchesConfiguredMode($event);
        $eventId = trim((string) ($event->id ?? ''));
        $eventType = trim((string) ($event->type ?? ''));
        if ($eventId === '' || $eventType === '') {
            throw new InvalidArgumentException('Evento Stripe sem identidade valida.');
        }
        $eventCreatedAt = (int) ($event->created ?? 0);
        $objectId = $this->extractStripeEventObjectId($event->data->object ?? null);
        $result = $this->repository->enqueueStripeWebhookEvent([
            'event_id' => $eventId,
            'event_type' => $eventType,
            'object_id' => $objectId,
            'payload_hash' => hash('sha256', $payload),
            'payload_json' => $payload,
            'event_created_at' => $this->formatStripeTimestamp($eventCreatedAt),
        ]);

        $this->writeStripeWebhookHeartbeat(
            $eventId,
            $eventType,
            $objectId,
            $eventCreatedAt,
            !empty($result['duplicate']) ? 'duplicate' : 'queued',
            !empty($result['duplicate']),
            !empty($result['duplicate'])
                ? 'Evento Stripe duplicado reconhecido na fila.'
                : 'Evento Stripe autenticado e enfileirado.'
        );

        return [
            'received' => true,
            'queued' => !empty($result['queued']),
            'duplicate' => !empty($result['duplicate']),
            'eventId' => $eventId,
        ];
    }

    /** Processa um evento previamente autenticado e reservado pelo worker. */
    public function processNextQueuedStripeWebhook(): ?array
    {
        $job = $this->repository->claimNextStripeWebhookEvent();
        if ($job === null) {
            return null;
        }

        $eventId = (string) ($job['event_id'] ?? '');
        $claimToken = (string) ($job['claim_token'] ?? '');
        try {
            $event = json_decode((string) ($job['payload_json'] ?? ''), false, 64, JSON_THROW_ON_ERROR);
            if (!is_object($event)) {
                throw new UnexpectedValueException('Payload Stripe enfileirado invalido.');
            }
            $result = $this->processStripeWebhookEventObject(
                $event,
                (string) ($job['payload_hash'] ?? ''),
                null,
                $claimToken
            );
            return ['eventId' => $eventId, 'result' => $result];
        } catch (Throwable $exception) {
            $this->repository->markProviderWebhookEventFailed(
                'stripe',
                $eventId,
                $exception->getMessage(),
                $claimToken,
                'ASYNC_PROCESSING_ERROR'
            );
            throw $exception;
        }
    }

    /**
     * Processa um objeto de evento Stripe ja validado.
     *
     * Essa entrada existe para suites operacionais e simuladores locais que
     * precisam reaproveitar a mesma logica do webhook sem depender da
     * verificacao criptografica do endpoint HTTP.
     *
     * @since 1.0.0
     */
    public function processStripeWebhookEventObject(
        object $event,
        ?string $payloadHash = null,
        $stripeClient = null,
        ?string $preclaimedToken = null
    ): array
    {
        $eventId = trim((string) ($event->id ?? ''));
        $eventType = trim((string) ($event->type ?? ''));
        $eventCreatedAt = (int) ($event->created ?? 0);
        $objectId = $this->extractStripeEventObjectId($event->data->object ?? null);
        $payloadHash = $payloadHash ?: hash('sha256', json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        if ($eventId !== '' && $preclaimedToken === null && !$this->repository->claimProviderWebhookEvent(
            'stripe',
            $eventId,
            $eventType,
            $objectId,
            $payloadHash,
                $this->formatStripeTimestamp($eventCreatedAt)
        )) {
            $existingWebhookStatus = $this->repository->findProviderWebhookEventStatus('stripe', $eventId);
            $existingStatus = strtolower(trim((string) ($existingWebhookStatus['status'] ?? 'processing')));
            $duplicateAlreadyClosed = in_array($existingStatus, ['processed', 'ignored'], true);
            $this->writeStripeWebhookHeartbeat(
                $eventId,
                $eventType,
                $objectId,
                $eventCreatedAt,
                $duplicateAlreadyClosed ? 'duplicate' : 'processing',
                $duplicateAlreadyClosed,
                $duplicateAlreadyClosed
                    ? 'Evento Stripe duplicado ja registrado localmente.'
                    : 'Evento Stripe ja esta em processamento e ainda nao foi concluido.'
            );

            return [
                'received' => true,
                'duplicate' => true,
            ];
        }

        $stripe = $stripeClient ?: getStripeClient();
        $this->stripeWebhookIgnoreReason = null;

        try {
            $handled = $this->dispatchStripeWebhookEvent(
                $stripe,
                $eventType,
                $event->data->object ?? null,
                $eventCreatedAt
            );
        } catch (Throwable $exception) {
            $this->writeStripeWebhookHeartbeat(
                $eventId,
                $eventType,
                $objectId,
                $eventCreatedAt,
                'error',
                false,
                $exception->getMessage()
            );

            if ($eventId !== '') {
                $this->repository->markProviderWebhookEventFailed(
                    'stripe',
                    $eventId,
                    $exception->getMessage(),
                    $preclaimedToken
                );
            }

            throw $exception;
        }

        $ignoredReason = $this->consumeStripeWebhookIgnoreReason();
        if (!$handled) {
            if ($eventId !== '') {
                $this->repository->markProviderWebhookEventIgnored(
                    'stripe',
                    $eventId,
                    'Evento ignorado pelo dominio de subscriptions.',
                    $preclaimedToken
                );
            }

            $this->writeStripeWebhookHeartbeat(
                $eventId,
                $eventType,
                $objectId,
                $eventCreatedAt,
                'ignored',
                true,
                'Evento Stripe recebido e ignorado pelo dominio de subscriptions.'
            );

            return [
                'received' => true,
                'ignored' => true,
            ];
        }

        if ($ignoredReason !== null && $eventId !== '') {
            $this->repository->markProviderWebhookEventIgnored('stripe', $eventId, $ignoredReason, $preclaimedToken);

            $this->writeStripeWebhookHeartbeat(
                $eventId,
                $eventType,
                $objectId,
                $eventCreatedAt,
                'ignored',
                true,
                $ignoredReason
            );

            return [
                'received' => true,
                'ignored' => true,
                'reason' => $ignoredReason,
            ];
        }

        if ($eventId !== '') {
            $this->repository->markProviderWebhookEventProcessed('stripe', $eventId, $preclaimedToken);
        }

        $this->writeStripeWebhookHeartbeat(
            $eventId,
            $eventType,
            $objectId,
            $eventCreatedAt,
            'processed',
            true,
            'Evento Stripe processado pelo dominio de subscriptions.'
        );

        return ['received' => true];
    }

    /**
     * Roteia o evento Stripe para o handler correto.
     *
     * @since 1.0.0
     */
    private function dispatchStripeWebhookEvent($stripe, string $eventType, $eventObject, int $eventCreatedAt): bool
    {
        switch ($eventType) {
            case 'checkout.session.completed':
                $this->handleStripeCheckoutSessionCompleted($stripe, $eventObject, $eventCreatedAt);
                return true;

            case 'checkout.session.expired':
                $this->handleStripeCheckoutSessionExpired($eventObject);
                return true;

            case 'invoice.paid':
            case 'invoice.payment_succeeded':
                $this->handleStripeInvoicePaid($stripe, $eventObject, $eventCreatedAt);
                return true;

            case 'invoice.payment_failed':
                $this->handleStripeInvoicePaymentFailed($stripe, $eventObject, $eventCreatedAt);
                return true;

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                $this->handleStripeSubscriptionUpdated($eventObject, $eventCreatedAt);
                return true;

            case 'customer.subscription.deleted':
                $this->handleStripeSubscriptionDeleted($eventObject, $eventCreatedAt);
                return true;

            case 'charge.refunded':
                $this->handleStripeChargeRefunded($eventObject, $eventCreatedAt);
                return true;

            default:
                return false;
        }
    }

    /**
     * Valida um cupom e calcula o desconto aplicavel.
     *
     * @since 1.0.0
     */
    public function validateCoupon(array $data): ?array
    {
        $payload = $this->validator->validateCouponPayload($data);
        $authenticatedUserId = $payload['authenticated_user_id'];
        $authenticatedUserEmail = $payload['authenticated_user_email'];

        if ($authenticatedUserId !== '') {
            $user = $this->repository->findStripeCheckoutUser($authenticatedUserId);
            if ($user) {
                $authenticatedUserEmail = strtolower(trim((string) ($user['email'] ?? $authenticatedUserEmail)));
            }
        }

        $coupon = validateCouponForAmount(
            $this->db,
            $payload['code'],
            $payload['amount'],
            [
                'plan_id' => $payload['plan_id'],
                'item_id' => $payload['item_id'],
                'target_type' => $payload['target_type'],
                'target_id' => $payload['target_id'],
                'user_id' => $authenticatedUserId,
                'user_email' => $authenticatedUserEmail,
                'checkout_attempt_id' => (string) ($payload['checkout_attempt_id'] ?? ''),
            ]
        );

        if (!$coupon['valid']) {
            if ($payload['code'] === '') {
                return null;
            }

            throw new InvalidArgumentException($coupon['message'] ?: 'Cupom invalido ou expirado.');
        }

        return array_merge($coupon['coupon'], [
            'discount_amount' => $coupon['discount_amount'],
            'final_amount' => $coupon['final_amount'],
            'auto_applied' => !empty($coupon['auto_applied']),
        ]);
    }

    /**
     * Atualiza a configuracao de renovacao automatica da assinatura.
     *
     * @since 1.0.0
     */
    public function updateRenewal(string $userId, array $data): array
    {
        $payload = $this->validator->validateRenewalPayload($data);
        $nextAutoRenew = $payload['auto_renew'];

        $subscription = $this->repository->findLatestManagedSubscription($userId);
        if (!$subscription) {
            throw new OutOfBoundsException('Nenhuma assinatura ativa encontrada.');
        }

        $paymentProvider = normalizePaymentProvider($subscription['payment_provider'] ?? 'stripe');
        $totalInstallments = max(1, (int) ($subscription['total_installments'] ?? 1));
        $paidInstallments = max(0, (int) ($subscription['paid_installments'] ?? 0));
        $hasRemainingCommitment = hasStripeRemainingCommitmentCycles($totalInstallments, $paidInstallments);
        $cancelAtPeriodEnd = resolveStripeCancelAtPeriodEnd($nextAutoRenew, $totalInstallments, $paidInstallments);

        if ($paymentProvider !== 'stripe') {
            throw new InvalidArgumentException('Assinaturas legadas fora da Stripe nao sao mais suportadas.');
        }

        if ($nextAutoRenew && empty($subscription['provider_subscription_id'])) {
            $subscription = $this->restoreStripeBillingForLocalSubscription($subscription);
            $cancelAtPeriodEnd = false;
        } elseif ($nextAutoRenew) {
            $this->assertStripeRenewalPaymentMethodReady($subscription);
        }

        if (!empty($subscription['provider_subscription_id']) && stripeIsConfigured()) {
            $stripeSubscription = getStripeClient()->subscriptions->update((string) $subscription['provider_subscription_id'], [
                'cancel_at_period_end' => $cancelAtPeriodEnd,
                'metadata' => [
                    'auto_renew' => $nextAutoRenew ? '1' : '0',
                    'refund_review_pending' => '0',
                ],
            ]);
            $cancelAtPeriodEnd = !empty($stripeSubscription->cancel_at_period_end);
        } else {
            throw new InvalidArgumentException('Assinatura Stripe sem identificador externo valido.');
        }

        $this->repository->updateAutoRenewState((int) $subscription['id'], $nextAutoRenew, $cancelAtPeriodEnd);
        $subscription['auto_renew'] = $nextAutoRenew ? 1 : 0;
        $subscription['cancel_at_period_end'] = $cancelAtPeriodEnd ? 1 : 0;
        $subscription = $this->refreshStripeRenewalProjection($subscription, true);

        $message = $nextAutoRenew
            ? 'Renovação automática ativada com sucesso.'
            : ($hasRemainingCommitment
                ? 'Renovação automática desativada. A assinatura sera encerrada ao fim do termo contratado.'
                : 'Renovação automática desativada. A assinatura sera encerrada ao fim do periodo atual.');

        return [
            'auto_renew' => $nextAutoRenew,
            'cancel_at_period_end' => $cancelAtPeriodEnd,
            'term_commitment_active' => $hasRemainingCommitment,
            'total_installments' => $totalInstallments,
            'paid_installments' => $paidInstallments,
            'next_renewal_amount' => round((float) ($subscription['next_renewal_amount'] ?? 0), 2),
            'next_renewal_date' => $subscription['next_renewal_date'] ?? null,
            'next_renewal_price_source' => $subscription['next_renewal_price_source'] ?? null,
            'next_renewal_cycle_label' => $subscription['next_renewal_cycle_label'] ?? null,
            'message' => $message,
        ];
    }

    /**
     * Executa a transicao canonica de plano sobre a assinatura Stripe existente.
     * Upgrade e imediato; downgrade e aplicado pela Stripe no fim do periodo
     * atual, que permanece a fonte autoritativa mesmo apos extensoes.
     *
     * @since 1.0.0
     */
    public function changePlan(string $userId, array $data): array
    {
        $payload = $this->validator->validatePlanChangePayload($data);
        if (!stripeIsConfigured()) {
            throw new RuntimeException('Stripe nao configurado no backend.');
        }

        $targetPlan = $this->repository->findPlanById($payload['plan_id']);
        if (!$targetPlan) {
            throw new OutOfBoundsException('Plano de destino nao encontrado.');
        }
        if (!$this->isActivePlanForChange($targetPlan)) {
            throw new DomainException('Este plano nao esta disponivel para mudanca de assinatura.');
        }

        $providerMutationStarted = false;
        $operation = '';
        $subscription = null;
        try {
            $this->db->beginTransaction();
            $subscription = $this->repository->findLatestManagedSubscription($userId, true);
            if (!$subscription || empty($subscription['provider_subscription_id'])) {
                throw new OutOfBoundsException('Nenhuma assinatura Stripe ativa encontrada.');
            }

            $stripe = getStripeClient();
            $targetPriceId = $this->resolveCanonicalPlanPrice($stripe, $targetPlan, $payload['idempotency_key']);

            $currentPlanId = (int) ($subscription['plan_id'] ?? 0);
            if ($currentPlanId === (int) $targetPlan['id']) {
                $this->db->commit();
                return [
                    'operation' => 'NOOP',
                    'status' => 'already_current',
                    'subscription_id' => (int) $subscription['id'],
                    'provider_subscription_id' => (string) $subscription['provider_subscription_id'],
                    'current_plan_id' => $currentPlanId,
                    'target_plan_id' => (int) $targetPlan['id'],
                    'effective_at' => $subscription['current_period_end'] ?? null,
                    'message' => 'A assinatura ja esta no plano solicitado.',
                ];
            }

            $currentTier = (int) ($subscription['tier'] ?? 0);
            $targetTier = (int) ($targetPlan['tier'] ?? 0);
            $operation = $targetTier > $currentTier ? 'UPGRADE' : 'SCHEDULED_DOWNGRADE';
            $providerId = (string) $subscription['provider_subscription_id'];
            $remoteBefore = $stripe->subscriptions->retrieve($providerId, [
                'expand' => ['items.data.price', 'schedule'],
            ]);
            $metadataBefore = $this->normalizeStripeMetadata($remoteBefore->metadata ?? []);
            $sameRequest = (string) ($metadataBefore['plan_change_id'] ?? '') === $payload['idempotency_key'];

            if ($sameRequest) {
                $this->db->commit();
                return $this->buildPlanChangeResult(
                    $operation,
                    'idempotent_replay',
                    $subscription,
                    $targetPlan,
                    $metadataBefore['scheduled_effective_at'] ?? $subscription['current_period_end'] ?? null
                );
            }

            $beforePeriods = getStripeSubscriptionPeriodTimestamps($remoteBefore);
            $beforePeriodStart = formatStripeTimestampToDb((int) ($beforePeriods['start'] ?? 0));
            $beforePeriodEnd = formatStripeTimestampToDb((int) ($beforePeriods['end'] ?? 0));
            $currentItem = $remoteBefore->items->data[0] ?? null;
            $subscriptionItemId = is_object($currentItem) ? trim((string) ($currentItem->id ?? '')) : '';
            if ($subscriptionItemId === '') {
                throw new RuntimeException('A assinatura Stripe nao possui item de preco atual.');
            }

            if ($operation === 'UPGRADE') {
                $existingScheduleId = getStripeObjectId($remoteBefore->schedule ?? null);
                if ($existingScheduleId !== '') {
                    $this->releaseStripeRenewalScheduleIfNeeded($stripe, array_merge($subscription, [
                        'provider_schedule_id' => $existingScheduleId,
                    ]));
                }

                $providerMutationStarted = true;
                $stripe->subscriptionItems->update($subscriptionItemId, [
                    'price' => $targetPriceId,
                    'proration_behavior' => 'none',
                ], [
                    'idempotency_key' => 'plan_change_' . $payload['idempotency_key'],
                ]);
                $remoteAfter = $stripe->subscriptions->update($providerId, [
                    'metadata' => [
                        'user_id' => $userId,
                        'plan_id' => (string) $targetPlan['id'],
                        'plan_name' => (string) $targetPlan['name'],
                        'plan_change_id' => $payload['idempotency_key'],
                        'plan_change_operation' => 'UPGRADE',
                        'reconciliation_state' => 'CONFIRMED',
                    ],
                ], [
                    'idempotency_key' => 'plan_change_metadata_' . $payload['idempotency_key'],
                ]);
                $remoteAfter = $stripe->subscriptions->retrieve($providerId, [
                    'expand' => ['items.data.price', 'schedule'],
                ]);
                $actualPriceId = getStripeObjectId($remoteAfter->items->data[0]->price ?? null);
                if ($actualPriceId !== $targetPriceId) {
                    throw new RuntimeException('Stripe nao confirmou o preco do upgrade.');
                }

                $afterPeriods = getStripeSubscriptionPeriodTimestamps($remoteAfter);
                $afterStart = formatStripeTimestampToDb((int) ($afterPeriods['start'] ?? 0), (int) ($beforePeriods['start'] ?? 0));
                $afterEnd = formatStripeTimestampToDb((int) ($afterPeriods['end'] ?? 0), (int) ($beforePeriods['end'] ?? 0));
                $this->repository->updateSubscriptionPlanState(
                    (int) $subscription['id'],
                    (int) $targetPlan['id'],
                    (float) $targetPlan['price'],
                    $afterStart,
                    $afterEnd,
                    $afterStart,
                    $afterEnd,
                    null,
                    null
                );
                $this->repository->updateUserPlanAssignment(
                    $userId,
                    (int) $targetPlan['id'],
                    canonicalUserPlanValue((string) $targetPlan['name']),
                    $afterEnd
                );
                $effectiveAt = $afterEnd;
            } else {
                $effectiveAt = $beforePeriodEnd;
                if ($effectiveAt === '' || strtotime($effectiveAt) <= time()) {
                    throw new DomainException('A assinatura nao possui periodo futuro para agendar o downgrade.');
                }

                $scheduleId = getStripeObjectId($remoteBefore->schedule ?? null);
                if ($scheduleId === '') {
                    $providerMutationStarted = true;
                    $schedule = $stripe->subscriptionSchedules->create([
                        'from_subscription' => $providerId,
                    ], [
                        'idempotency_key' => 'plan_change_schedule_' . $payload['idempotency_key'],
                    ]);
                    $scheduleId = (string) ($schedule->id ?? '');
                }
                if ($scheduleId === '') {
                    throw new RuntimeException('Stripe nao criou o schedule do downgrade.');
                }

                $currentItemPayload = $this->buildStripeCurrentScheduleItemPayload($remoteBefore);
                $providerMutationStarted = true;
                $stripe->subscriptionSchedules->update($scheduleId, [
                    'end_behavior' => 'release',
                    'phases' => [
                        [
                            'start_date' => (int) ($beforePeriods['start'] ?? 0),
                            'end_date' => (int) ($beforePeriods['end'] ?? 0),
                            'proration_behavior' => 'none',
                            'items' => [$currentItemPayload],
                        ],
                        [
                            'start_date' => (int) ($beforePeriods['end'] ?? 0),
                            'iterations' => 1,
                            'proration_behavior' => 'none',
                            'items' => [[
                                'price' => $targetPriceId,
                                'quantity' => max(1, (int) ($currentItem->quantity ?? 1)),
                            ]],
                            'metadata' => [
                                'user_id' => $userId,
                                'plan_id' => (string) $targetPlan['id'],
                                'plan_name' => (string) $targetPlan['name'],
                                'plan_change_id' => $payload['idempotency_key'],
                                'plan_change_operation' => 'SCHEDULED_DOWNGRADE',
                                'reconciliation_state' => 'SCHEDULED',
                            ],
                        ],
                    ],
                    'metadata' => [
                        'user_id' => $userId,
                        'pending_plan_id' => (string) $targetPlan['id'],
                        'pending_plan_name' => (string) $targetPlan['name'],
                        'plan_change_id' => $payload['idempotency_key'],
                        'plan_change_operation' => 'SCHEDULED_DOWNGRADE',
                        'scheduled_effective_at' => $effectiveAt,
                        'reconciliation_state' => 'SCHEDULED',
                    ],
                ], [
                    'idempotency_key' => 'plan_change_schedule_update_' . $payload['idempotency_key'],
                ]);

                $snapshot = json_encode([
                    'scheduled_plan_change' => [
                        'operation' => 'SCHEDULED_DOWNGRADE',
                        'target_plan_id' => (int) $targetPlan['id'],
                        'target_plan_name' => (string) $targetPlan['name'],
                        'effective_at' => $effectiveAt,
                        'idempotency_key' => $payload['idempotency_key'],
                        'provider_schedule_id' => $scheduleId,
                        'reconciliation_state' => 'SCHEDULED',
                    ],
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $this->repository->updateSubscriptionPlanState(
                    (int) $subscription['id'],
                    $currentPlanId,
                    (float) ($subscription['recurring_amount'] ?? $subscription['price'] ?? 0),
                    $beforePeriodStart,
                    $beforePeriodEnd,
                    $beforePeriodStart,
                    $beforePeriodEnd,
                    $scheduleId,
                    $snapshot !== false ? $snapshot : null
                );
            }

            $this->recordPlanChangeAudit($userId, $subscription, $targetPlan, $operation, [
                'provider_state_before' => [
                    'price_id' => getStripeObjectId($remoteBefore->items->data[0]->price ?? null),
                    'period_start' => $beforePeriodStart,
                    'period_end' => $beforePeriodEnd,
                ],
                'provider_state_after' => [
                    'price_id' => $operation === 'UPGRADE'
                        ? $targetPriceId
                        : getStripeObjectId($remoteBefore->items->data[0]->price ?? null),
                    'period_start' => $operation === 'UPGRADE' ? $afterStart : $beforePeriodStart,
                    'period_end' => $operation === 'UPGRADE' ? $afterEnd : $beforePeriodEnd,
                ],
                'period_before' => $beforePeriodEnd,
                'period_after' => $effectiveAt,
                'scheduled_effective_at' => $operation === 'UPGRADE' ? null : $effectiveAt,
                'result' => 'CONFIRMED',
                'reconciliation_state' => $operation === 'UPGRADE' ? 'CONFIRMED' : 'SCHEDULED',
                'idempotency_key' => $payload['idempotency_key'],
            ]);
            $this->db->commit();

            return $this->buildPlanChangeResult($operation, 'confirmed', $subscription, $targetPlan, $effectiveAt);
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            if ($providerMutationStarted) {
                try {
                    $this->syncCurrentUserStripeState($userId);
                } catch (Throwable $reconciliationError) {
                    error_log('[subscriptions_service] plan change reconciliation failed: ' . $reconciliationError->getMessage());
                }
            }
            throw $error;
        }
    }

    private function isActivePlanForChange(array $plan): bool
    {
        foreach (['active', 'is_active'] as $key) {
            if (array_key_exists($key, $plan)) {
                $value = filter_var($plan[$key], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
                return $value === null ? (int) $plan[$key] > 0 : $value;
            }
        }
        return true;
    }

    private function resolveCanonicalPlanPrice($stripe, array &$plan, string $idempotencyKey): string
    {
        $priceId = trim((string) ($plan['stripe_price_id'] ?? ''));
        if ($priceId !== '') {
            return $priceId;
        }

        $productId = trim((string) ($plan['stripe_product_id'] ?? ''));
        if ($productId === '') {
            $productId = getOrCreateStripeProductId($this->db, $plan, $stripe);
            $plan['stripe_product_id'] = $productId;
        }
        if ($productId === '') {
            throw new DomainException('O plano de destino nao possui produto Stripe configurado.');
        }

        $createdPrice = $stripe->prices->create([
            'product' => $productId,
            'currency' => 'brl',
            'unit_amount' => formatMoneyToCents((float) ($plan['price'] ?? 0)),
            'recurring' => [
                'interval' => (string) ($plan['interval_unit'] ?? 'month'),
                'interval_count' => max(1, (int) ($plan['interval_count'] ?? 1)),
            ],
            'metadata' => [
                'plan_id' => (string) ($plan['id'] ?? ''),
                'source' => 'canonical_plan_change',
            ],
        ], [
            'idempotency_key' => 'plan_catalog_price_' . (int) ($plan['id'] ?? 0),
        ]);
        $priceId = trim((string) ($createdPrice->id ?? ''));
        if ($priceId === '') {
            throw new RuntimeException('Stripe nao retornou o preco canonico do plano.');
        }

        $this->repository->updatePlanStripePriceId((int) $plan['id'], $priceId);
        $plan['stripe_price_id'] = $priceId;
        return $priceId;
    }

    private function buildPlanChangeResult(string $operation, string $status, array $subscription, array $targetPlan, ?string $effectiveAt): array
    {
        return [
            'operation' => $operation,
            'status' => $status,
            'subscription_id' => (int) ($subscription['id'] ?? 0),
            'provider_subscription_id' => (string) ($subscription['provider_subscription_id'] ?? ''),
            'current_plan_id' => (int) ($subscription['plan_id'] ?? 0),
            'target_plan_id' => (int) ($targetPlan['id'] ?? 0),
            'target_plan_name' => (string) ($targetPlan['name'] ?? ''),
            'effective_at' => $effectiveAt,
            'message' => $operation === 'UPGRADE'
                ? 'Upgrade aplicado com sucesso na assinatura atual.'
                : 'Downgrade agendado para o fim do periodo atual.',
        ];
    }

    private function recordPlanChangeAudit(string $userId, array $subscription, array $targetPlan, string $operation, array $details): void
    {
        try {
            $payload = array_merge([
                'actor_source' => 'authenticated_user',
                'user_id' => $userId,
                'subscription_id' => (int) ($subscription['id'] ?? 0),
                'provider_subscription_id' => (string) ($subscription['provider_subscription_id'] ?? ''),
                'previous_plan_id' => (int) ($subscription['plan_id'] ?? 0),
                'target_plan_id' => (int) ($targetPlan['id'] ?? 0),
                'target_plan_name' => (string) ($targetPlan['name'] ?? ''),
                'operation' => $operation,
            ], $details);
            $stmt = $this->db->prepare("\n                INSERT INTO admin_audit_logs (\n                    admin_user_id, action, resource_type, resource_id, details_json,\n                    ip_address, user_agent, created_at\n                ) VALUES (:actor_id, :action, 'subscription', :resource_id, :details, '', '', NOW())\n            ");
            $stmt->execute([
                ':actor_id' => $userId,
                ':action' => 'subscription.plan_change',
                ':resource_id' => (string) ($subscription['id'] ?? ''),
                ':details' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
        } catch (Throwable $error) {
            throw new RuntimeException('Nao foi possivel registrar a auditoria da mudanca de plano.', 0, $error);
        }
    }

    /**
     * Persiste o snapshot local da proxima renovacao da assinatura.
     *
     * @since 1.0.0
     */
    private function persistStripeRenewalForecastSnapshot(array $subscriptionRow, array $forecast, ?string $scheduleId = null): array
    {
        $totalInstallments = max(1, (int) ($subscriptionRow['total_installments'] ?? 1));
        $paidInstallments = max(0, (int) ($subscriptionRow['paid_installments'] ?? 0));
        $status = strtolower(trim((string) ($subscriptionRow['status'] ?? '')));
        $autoRenewEnabled = !empty($subscriptionRow['auto_renew']) && empty($subscriptionRow['cancel_at_period_end']);
        $hasPendingContractInstallment = $totalInstallments > 1 && $paidInstallments < $totalInstallments;
        $minimumRenewalDate = trim((string) (
            $subscriptionRow['current_period_end']
            ?? $subscriptionRow['provider_current_period_end']
            ?? ''
        ));

        if (!$autoRenewEnabled && !$hasPendingContractInstallment) {
            $forecast['amount'] = null;
            $forecast['date'] = null;
            $forecast['price_source'] = null;
            $forecast['cycle_label'] = null;
            $forecast['snapshot'] = [];
        }

        if (
            $autoRenewEnabled
            && in_array($status, ['active', 'trialing', 'past_due'], true)
            && $paidInstallments >= $totalInstallments
            && $minimumRenewalDate !== ''
        ) {
            $minimumRenewalTimestamp = strtotime($minimumRenewalDate);
            $forecastTimestamp = !empty($forecast['date']) ? strtotime((string) $forecast['date']) : false;

            if ($minimumRenewalTimestamp && (!$forecastTimestamp || $forecastTimestamp < $minimumRenewalTimestamp)) {
                $forecast['date'] = date('Y-m-d H:i:s', $minimumRenewalTimestamp);
            }
        }

        $snapshotJson = json_encode($forecast['snapshot'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $providerScheduleId = $scheduleId !== null
            ? ($scheduleId !== '' ? $scheduleId : null)
            : ($subscriptionRow['provider_schedule_id'] ?? null);
        $nextRenewalAmount = $forecast['amount'] !== null && $forecast['amount'] !== ''
            ? round((float) $forecast['amount'], 2)
            : null;

        $this->db->prepare("
            UPDATE user_subscriptions
            SET provider_schedule_id = :provider_schedule_id,
                next_renewal_amount = :next_renewal_amount,
                next_renewal_date = :next_renewal_date,
                next_renewal_price_source = :next_renewal_price_source,
                next_renewal_cycle_label = :next_renewal_cycle_label,
                next_renewal_snapshot_json = :next_renewal_snapshot_json
            WHERE id = :id
        ")->execute([
            ':provider_schedule_id' => $providerScheduleId,
            ':next_renewal_amount' => $nextRenewalAmount,
            ':next_renewal_date' => $forecast['date'] ?? null,
            ':next_renewal_price_source' => $forecast['price_source'] ?? null,
            ':next_renewal_cycle_label' => $forecast['cycle_label'] ?? null,
            ':next_renewal_snapshot_json' => $snapshotJson !== false ? $snapshotJson : null,
            ':id' => (int) $subscriptionRow['id'],
        ]);

        $subscriptionRow['provider_schedule_id'] = $providerScheduleId;
        $subscriptionRow['next_renewal_amount'] = $nextRenewalAmount;
        $subscriptionRow['next_renewal_date'] = $forecast['date'] ?? null;
        $subscriptionRow['next_renewal_price_source'] = $forecast['price_source'] ?? null;
        $subscriptionRow['next_renewal_cycle_label'] = $forecast['cycle_label'] ?? null;
        $subscriptionRow['next_renewal_snapshot_json'] = $snapshotJson !== false ? $snapshotJson : null;

        return $subscriptionRow;
    }

    /**
     * Constrói o item da fase atual do schedule usando o preço remoto vigente.
     *
     * @since 1.0.0
     */
    private function buildStripeCurrentScheduleItemPayload($stripeSubscription): array
    {
        $items = $stripeSubscription->items->data ?? [];
        $firstItem = $items[0] ?? null;
        $price = is_object($firstItem) ? ($firstItem->price ?? null) : null;
        $quantity = max(1, (int) ($firstItem->quantity ?? 1));

        if (is_object($price)) {
            $priceId = trim((string) ($price->id ?? ''));
            if ($priceId !== '') {
                return [
                    'price' => $priceId,
                    'quantity' => $quantity,
                ];
            }

            $currency = strtolower(trim((string) ($price->currency ?? 'brl')));
            $unitAmount = (int) ($price->unit_amount ?? 0);
            $productId = getStripeObjectId($price->product ?? null);
            $interval = (string) ($price->recurring->interval ?? 'month');
            $intervalCount = max(1, (int) ($price->recurring->interval_count ?? 1));

            if ($unitAmount > 0 && $productId !== '') {
                return [
                    'price_data' => [
                        'currency' => $currency,
                        'unit_amount' => $unitAmount,
                        'product' => $productId,
                        'recurring' => [
                            'interval' => $interval,
                            'interval_count' => $intervalCount,
                        ],
                    ],
                    'quantity' => $quantity,
                ];
            }
        }

        throw new RuntimeException('Nao foi possivel montar a fase atual do schedule Stripe.');
    }

    /**
     * Sincroniza o schedule da proxima renovacao da assinatura.
     *
     * @since 1.0.0
     */
    private function syncStripeRenewalSchedule($stripe, array $subscriptionRow, array $forecast): ?string
    {
        $providerSubscriptionId = trim((string) ($subscriptionRow['provider_subscription_id'] ?? ''));
        if ($providerSubscriptionId === '') {
            return null;
        }

        $stripeSubscription = $stripe->subscriptions->retrieve($providerSubscriptionId, [
            'expand' => ['items.data.price', 'schedule'],
        ]);

        $currentItems = $stripeSubscription->items->data ?? [];
        $firstItem = $currentItems[0] ?? null;
        $currentPrice = is_object($firstItem) ? ($firstItem->price ?? null) : null;
        $subscriptionItemId = is_object($firstItem) ? trim((string) ($firstItem->id ?? '')) : '';
        $quantity = max(1, (int) ($firstItem->quantity ?? 1));
        $forecastAmountCents = formatMoneyToCents((float) ($forecast['amount'] ?? 0));
        $forecastInterval = (string) ($forecast['charge_interval'] ?? ($subscriptionRow['interval_unit'] ?? 'month'));
        $forecastIntervalCount = max(1, (int) ($forecast['charge_interval_count'] ?? ($subscriptionRow['interval_count'] ?? 1)));
        $currentInterval = is_object($currentPrice) ? (string) ($currentPrice->recurring->interval ?? '') : '';
        $currentIntervalCount = is_object($currentPrice) ? max(1, (int) ($currentPrice->recurring->interval_count ?? 1)) : 1;

        $periodTimestamps = getStripeSubscriptionPeriodTimestamps($stripeSubscription);
        $currentPeriodStart = (int) ($periodTimestamps['start'] ?? 0);
        $currentPeriodEnd = (int) ($periodTimestamps['end'] ?? 0);
        if ($currentPeriodStart <= 0 || $currentPeriodEnd <= 0 || $currentPeriodEnd <= $currentPeriodStart) {
            return null;
        }

        $planProductId = trim((string) ($subscriptionRow['stripe_product_id'] ?? ''));
        if ($planProductId === '') {
            $currentItems = $stripeSubscription->items->data ?? [];
            $firstItem = $currentItems[0] ?? null;
            if (is_object($firstItem) && is_object($firstItem->price ?? null)) {
                $planProductId = getStripeObjectId($firstItem->price->product ?? null);
            }
        }
        if ($planProductId === '') {
            throw new RuntimeException('Produto Stripe nao encontrado para programar a renovacao futura.');
        }

        $scheduleId = trim((string) ($subscriptionRow['provider_schedule_id'] ?? ''));
        if ($scheduleId === '') {
            $scheduleId = getStripeObjectId($stripeSubscription->schedule ?? null);
        }

        if (
            $subscriptionItemId !== ''
            && $forecastAmountCents > 0
            && $currentInterval === $forecastInterval
            && $currentIntervalCount === $forecastIntervalCount
        ) {
            if ($scheduleId !== '') {
                $this->releaseStripeRenewalScheduleIfNeeded($stripe, array_merge($subscriptionRow, [
                    'provider_schedule_id' => $scheduleId,
                ]));
                $scheduleId = '';
            }

            $currentAmountCents = is_object($currentPrice) ? (int) ($currentPrice->unit_amount ?? 0) : 0;
            if ($currentAmountCents !== $forecastAmountCents) {
                $stripe->subscriptionItems->update($subscriptionItemId, [
                    'price_data' => [
                        'currency' => 'brl',
                        'unit_amount' => $forecastAmountCents,
                        'product' => $planProductId,
                        'recurring' => [
                            'interval' => $forecastInterval,
                            'interval_count' => $forecastIntervalCount,
                        ],
                    ],
                    'quantity' => $quantity,
                    'proration_behavior' => 'none',
                    'metadata' => [
                        'plan_id' => (string) ($subscriptionRow['plan_id'] ?? ''),
                        'next_renewal_price_source' => (string) ($forecast['price_source'] ?? ''),
                    ],
                ]);
            }

            $stripe->subscriptions->update($providerSubscriptionId, [
                'cancel_at_period_end' => false,
                'metadata' => [
                    'user_id' => (string) ($subscriptionRow['user_id'] ?? ''),
                    'plan_id' => (string) ($subscriptionRow['plan_id'] ?? ''),
                    'next_renewal_amount' => number_format((float) ($forecast['amount'] ?? 0), 2, '.', ''),
                    'next_renewal_cycle_label' => (string) ($forecast['cycle_label'] ?? ''),
                    'next_renewal_price_source' => (string) ($forecast['price_source'] ?? ''),
                ],
            ]);

            return null;
        }

        $currentItemPayload = $this->buildStripeCurrentScheduleItemPayload($stripeSubscription);

        if ($scheduleId === '') {
            $schedule = $stripe->subscriptionSchedules->create([
                'from_subscription' => $providerSubscriptionId,
            ]);
            $scheduleId = (string) ($schedule->id ?? '');
        }

        if ($scheduleId === '') {
            return null;
        }

        $futurePhase = [
            'start_date' => $currentPeriodEnd,
            'iterations' => max(1, (int) ($forecast['term_cycles'] ?? 1)),
            'proration_behavior' => 'none',
            'items' => [[
                'price_data' => [
                    'currency' => 'brl',
                    'unit_amount' => $forecastAmountCents,
                    'product' => $planProductId,
                    'recurring' => [
                        'interval' => $forecastInterval,
                        'interval_count' => $forecastIntervalCount,
                    ],
                ],
                'quantity' => 1,
            ]],
        ];

        $stripe->subscriptionSchedules->update($scheduleId, [
            'end_behavior' => 'release',
            'phases' => [
                [
                    'start_date' => $currentPeriodStart,
                    'end_date' => $currentPeriodEnd,
                    'proration_behavior' => 'none',
                    'items' => [$currentItemPayload],
                ],
                $futurePhase,
            ],
            'metadata' => [
                'user_id' => (string) ($subscriptionRow['user_id'] ?? ''),
                'plan_id' => (string) ($subscriptionRow['plan_id'] ?? ''),
                'next_renewal_amount' => number_format((float) ($forecast['amount'] ?? 0), 2, '.', ''),
                'next_renewal_cycle_label' => (string) ($forecast['cycle_label'] ?? ''),
                'next_renewal_price_source' => (string) ($forecast['price_source'] ?? ''),
            ],
        ]);

        return $scheduleId;
    }

    /**
     * Libera o schedule remoto quando a renovacao automatica e desativada.
     *
     * @since 1.0.0
     */
    private function releaseStripeRenewalScheduleIfNeeded($stripe, array $subscriptionRow): void
    {
        $scheduleId = trim((string) ($subscriptionRow['provider_schedule_id'] ?? ''));
        if ($scheduleId === '' && !empty($subscriptionRow['provider_subscription_id'])) {
            try {
                $stripeSubscription = $stripe->subscriptions->retrieve((string) $subscriptionRow['provider_subscription_id'], [
                    'expand' => ['schedule'],
                ]);
                $scheduleId = getStripeObjectId($stripeSubscription->schedule ?? null);
            } catch (Throwable $e) {
                error_log('Stripe renewal schedule lookup warning: ' . $e->getMessage());
            }
        }

        if ($scheduleId === '') {
            return;
        }

        try {
            $stripe->subscriptionSchedules->release($scheduleId, []);
        } catch (Throwable $e) {
            error_log('Stripe renewal schedule release warning: ' . $e->getMessage());
        }

        $this->db->prepare("
            UPDATE user_subscriptions
            SET provider_schedule_id = NULL
            WHERE id = :id
        ")->execute([':id' => (int) $subscriptionRow['id']]);
    }

    /**
     * Recalcula e sincroniza a projeção da próxima renovação.
     *
     * @since 1.0.0
     */
    private function refreshStripeRenewalProjection(array $subscriptionRow, bool $syncRemoteSchedule = true): array
    {
        $forecast = buildStripeRenewalForecast($this->db, $subscriptionRow, [
            'id' => (int) ($subscriptionRow['plan_id'] ?? 0),
            'name' => (string) ($subscriptionRow['plan_name'] ?? 'Assinatura'),
            'price' => (float) ($subscriptionRow['price'] ?? $subscriptionRow['recurring_amount'] ?? 0),
            'interval_unit' => (string) ($subscriptionRow['interval_unit'] ?? 'month'),
            'interval_count' => (int) ($subscriptionRow['interval_count'] ?? 1),
        ]);

        $scheduleId = $subscriptionRow['provider_schedule_id'] ?? null;
        $remoteScheduleEligible = in_array(
            strtolower(trim((string) ($subscriptionRow['status'] ?? ''))),
            ['active', 'trialing', 'past_due'],
            true
        );

        if (
            $syncRemoteSchedule
            && $remoteScheduleEligible
            && stripeIsConfigured()
            && !empty($subscriptionRow['provider_subscription_id'])
        ) {
            try {
                $stripe = getStripeClient();
                $totalInstallments = max(1, (int) ($subscriptionRow['total_installments'] ?? 1));
                $paidInstallments = max(0, (int) ($subscriptionRow['paid_installments'] ?? 0));
                $hasPendingContractInstallments = $totalInstallments > 1 && $paidInstallments < $totalInstallments;

                if (!empty($subscriptionRow['auto_renew']) && !$hasPendingContractInstallments) {
                    $scheduleId = $this->syncStripeRenewalSchedule($stripe, $subscriptionRow, $forecast);
                } else {
                    // Price changes belong to the next contracted term. They
                    // must not rewrite installments that are still being paid.
                    $this->releaseStripeRenewalScheduleIfNeeded($stripe, $subscriptionRow);
                    $scheduleId = null;
                }
            } catch (Throwable $e) {
                error_log('Stripe renewal projection sync warning: ' . $e->getMessage());
            }
        }

        return $this->persistStripeRenewalForecastSnapshot($subscriptionRow, $forecast, $scheduleId);
    }

    /**
     * Dispara o lembrete de renovação quando a próxima cobrança está a 5 dias.
     *
     * @since 1.0.0
     */
    private function maybeSendStripeRenewalReminder(array $subscriptionRow): bool
    {
        if (empty($subscriptionRow['auto_renew']) || !in_array((string) ($subscriptionRow['status'] ?? ''), ['active', 'trialing'], true)) {
            return false;
        }

        $nextRenewalDate = trim((string) ($subscriptionRow['next_renewal_date'] ?? ''));
        if ($nextRenewalDate === '' || !strtotime($nextRenewalDate)) {
            return false;
        }

        $notice = resolveStripeRenewalReminderNotice($subscriptionRow);
        if ($notice === null) {
            return false;
        }

        $snapshot = [];
        if (!empty($subscriptionRow['next_renewal_snapshot_json'])) {
            $snapshot = json_decode((string) $subscriptionRow['next_renewal_snapshot_json'], true) ?: [];
        }

        $reminderKey = sha1(json_encode([
            'notice' => (string) ($notice['type'] ?? 'renewal'),
            'date' => $nextRenewalDate,
            'amount' => round((float) ($subscriptionRow['next_renewal_amount'] ?? 0), 2),
            'cycle_label' => (string) ($subscriptionRow['next_renewal_cycle_label'] ?? ''),
            'price_source' => (string) ($subscriptionRow['next_renewal_price_source'] ?? ''),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        if ((string) ($subscriptionRow['renewal_reminder_sent_for'] ?? '') === $reminderKey) {
            return false;
        }

        $user = $this->repository->findUserById((string) $subscriptionRow['user_id']);
        if (!$user) {
            return false;
        }

        sendStripeRenewalReminderEmail($this->db, $user, [
            'plan_name' => (string) ($subscriptionRow['plan_name'] ?? 'Assinatura'),
            'interval_unit' => (string) ($subscriptionRow['interval_unit'] ?? 'month'),
            'interval_count' => (int) ($subscriptionRow['interval_count'] ?? 1),
        ], [
            'date' => $nextRenewalDate,
            'amount' => round((float) ($subscriptionRow['next_renewal_amount'] ?? 0), 2),
            'cycle_label' => (string) ($subscriptionRow['next_renewal_cycle_label'] ?? ''),
            'price_source' => (string) ($subscriptionRow['next_renewal_price_source'] ?? ''),
            'price_source_label' => (string) ($snapshot['price_source_label'] ?? 'preco atual do plano'),
        ], $notice);

        createNotification(
            $this->db,
            (string) $subscriptionRow['user_id'],
            (string) ($notice['notification_title'] ?? 'Renovação automática'),
            (string) ($notice['notification_message'] ?? 'Sua próxima renovação está prevista em breve. Revise o valor e o cartão salvo.'),
            'info',
            'marketplace',
            '/profile/billing',
            null,
            round((float) ($subscriptionRow['next_renewal_amount'] ?? 0), 2),
            'Valor previsto'
        );

        $this->db->prepare("
            UPDATE user_subscriptions
            SET renewal_reminder_sent_for = :renewal_reminder_sent_for,
                renewal_reminder_sent_at = NOW()
            WHERE id = :id
        ")->execute([
            ':renewal_reminder_sent_for' => $reminderKey,
            ':id' => (int) $subscriptionRow['id'],
        ]);

        return true;
    }

    /**
     * Cria a sessao do portal de cobranca Stripe.
     *
     * @since 1.0.0
     */
    public function createStripePortalSession(string $userId): array
    {
        if (!stripeIsConfigured()) {
            throw new RuntimeException('Stripe nao configurado no backend.');
        }

        $row = $this->repository->findLatestPortalSubscription($userId);
        if (!$row || empty($row['stripe_customer_id'])) {
            throw new InvalidArgumentException('Nenhum cliente Stripe encontrado para esta conta.');
        }

        $session = getStripeClient()->billingPortal->sessions->create([
            'customer' => $row['stripe_customer_id'],
            'return_url' => buildAppHashRoute('/profile', ['tab' => 'billing']),
        ]);

        return [
            'url' => $session->url,
            'provider' => 'stripe',
        ];
    }

    /**
     * Solicita o cancelamento da assinatura do usuario.
     *
     * @since 1.0.0
     */
    public function cancelSubscription(string $userId, array $data): array
    {
        $payload = $this->validator->validateCancelPayload($data);
        ensureRecaptchaPassed($this->db, $payload['captcha_token']);

        $this->db->beginTransaction();

        $subscription = $this->repository->findCancelableSubscriptionForUser($userId, true);
        if (!$subscription) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            return [
                'message' => 'Sua assinatura ja foi cancelada ou esta em processamento.',
                'refund_processed' => false,
            ];
        }

        $isRefundWindowOpen = $this->isWithinFirstSubscriptionRefundWindow($subscription);

        if (!$isRefundWindowOpen) {
            $outstandingDebt = $this->calculateOutstandingTermDebt($subscription);
            if ($outstandingDebt['amount'] > 0 && empty($payload['confirm_debt_charge'])) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }

                throw new InvalidArgumentException(
                    'Confirme a quitacao das parcelas pre-aprovadas pendentes para cancelar a renovacao deste termo.'
                );
            }

            if ($this->db->inTransaction()) {
                $this->db->commit();
            }

            $debtSettlement = null;
            if ($outstandingDebt['amount'] > 0) {
                $debtSettlement = $this->settleOutstandingTermDebt($subscription, $outstandingDebt, $payload);
                $this->repository->settleSubscriptionInstallmentDebt((int) $subscription['id']);
                $subscription['paid_installments'] = (int) ($subscription['total_installments'] ?? 1);
                $subscription['auto_renew'] = 0;
                $subscription['cancel_at_period_end'] = 1;
                $this->cancelSettledStripeSubscriptionWithoutRevokingAccess($subscription);
                $renewalState = [
                    'message' => 'Parcelas pendentes quitadas e renovação automática desativada. Seu acesso segue até o fim do termo contratado.',
                    'auto_renew' => false,
                    'cancel_at_period_end' => true,
                ];
            } else {
                $renewalState = $this->updateRenewal($userId, ['auto_renew' => false]);
            }

            createNotification(
                $this->db,
                $userId,
                'Renovação automática desativada',
                (string) ($renewalState['message'] ?? 'Sua assinatura sera encerrada ao fim do compromisso atual.'),
                'info',
                'marketplace',
                '/profile?tab=billing'
            );

            return [
                'message' => (string) ($renewalState['message'] ?? 'Renovação automática desativada com sucesso.'),
                'refund_processed' => false,
                'scheduled_cancellation' => true,
                'auto_renew' => (bool) ($renewalState['auto_renew'] ?? false),
                'cancel_at_period_end' => (bool) ($renewalState['cancel_at_period_end'] ?? false),
                'debt_settled' => $debtSettlement !== null,
                'debt_settlement_amount' => $debtSettlement['amount'] ?? 0,
                'debt_transaction_id' => $debtSettlement['transaction_id'] ?? null,
            ];
        }

        $paymentProvider = normalizePaymentProvider($subscription['payment_provider'] ?? 'stripe');
        $transaction = getLatestRefundablePlanTransactionForUser($this->db, $userId, $paymentProvider, true, $subscription);
        $refundProcessed = false;
        $refundResult = null;
        $refundReason = $payload['reason'] !== ''
            ? $this->humanizeCancellationReason((string) $payload['reason'])
            : 'Solicitado pelo usuário (dentro dos 7 dias da primeira assinatura)';
        if ($payload['details'] !== '') {
            $refundReason .= ': ' . $payload['details'];
        }

        if ($transaction) {
            $this->repository->markTransactionRefundRequested((int) $transaction['id'], $refundReason);
        }

        $this->db->commit();

        if ($transaction) {
            try {
                $this->suspendStripeSubscriptionForRefundReview($subscription);
            } catch (Throwable $renewalError) {
                $this->repository->restoreRefundRequestedTransaction((int) $transaction['id']);
                error_log('[subscriptions_service] refund review suspension error: ' . $renewalError->getMessage());
                throw new RuntimeException(
                    'Nao foi possivel suspender a proxima cobranca na Stripe. A solicitacao nao foi registrada; tente novamente.',
                    0,
                    $renewalError
                );
            }
            $this->notifyAdminAboutPendingRefundReview(
                (int) $transaction['id'],
                $refundReason,
                round((float) ($transaction['amount'] ?? 0), 2)
            );
        } else {
            $this->syncRemoteCancellation($subscription);
            $this->repository->revokeSubscriptionAccessNow($userId, (int) $subscription['id']);
        }

        if ($refundProcessed) {
            $this->syncRemoteCancellation($subscription);
            $this->repository->revokeSubscriptionAccessNow($userId, (int) $subscription['id']);
        }

        $user = $this->repository->findUserById($userId);
        if ($user) {
            try {
                $this->sendCancellationOutcomeEmail($user, $subscription, $refundProcessed, $transaction, $refundResult);
            } catch (Throwable $emailError) {
                error_log('[subscriptions_service] cancellation email error: ' . $emailError->getMessage());
            }
        }

        if ($refundProcessed) {
            $refundedAmount = round((float) ($transaction['amount'] ?? 0), 2);
            createNotification(
                $this->db,
                $userId,
                'Assinatura cancelada e reembolso processado',
                'Sua assinatura foi cancelada e o reembolso ja foi enviado ao gateway de pagamento.',
                'success',
                'marketplace',
                '/profile?tab=billing',
                null,
                $refundedAmount,
                'Valor reembolsado'
            );

            return [
                'message' => 'Sua assinatura foi cancelada e o reembolso foi processado com sucesso.',
                'refund_processed' => true,
                'refund_id' => $refundResult['provider_refund_id'] ?? null,
            ];
        }

        createNotification(
            $this->db,
            $userId,
            'Solicitacao de cancelamento recebida',
            'Sua solicitacao ficou em analise financeira. O acesso permanece ativo ate a confirmacao final do estorno.',
            'info',
            'marketplace',
            '/profile?tab=billing'
        );

        return [
            'message' => 'Sua solicitacao de cancelamento e reembolso foi registrada. O acesso permanece ativo ate a confirmacao financeira final.',
            'refund_processed' => false,
        ];
    }

    /**
     * Suspende novas cobrancas enquanto o primeiro pagamento esta em analise
     * de reembolso. O acesso atual permanece ate a decisao financeira.
     *
     * @since 1.0.0
     */
    private function suspendStripeSubscriptionForRefundReview(array $subscription): void
    {
        $providerSubscriptionId = trim((string) ($subscription['provider_subscription_id'] ?? ''));
        if ($providerSubscriptionId === '' || !stripeIsConfigured()) {
            throw new RuntimeException('Assinatura Stripe sem identificador externo valido.');
        }

        $remoteSubscription = getStripeClient()->subscriptions->update($providerSubscriptionId, [
            'cancel_at_period_end' => true,
            'metadata' => [
                'auto_renew' => '0',
                'refund_review_pending' => '1',
            ],
        ]);

        if (empty($remoteSubscription->cancel_at_period_end)) {
            throw new RuntimeException('A Stripe nao confirmou a suspensao da proxima cobranca.');
        }

        $this->repository->updateAutoRenewState((int) $subscription['id'], false, true);
    }

    /**
     * Converte codigos internos de cancelamento em texto claro para historico,
     * notificacoes e e-mails.
     *
     * @since 1.0.0
     */
    private function humanizeCancellationReason(string $reason): string
    {
        $normalized = strtolower(trim($reason));
        $normalized = str_replace(['-', ' '], '_', $normalized);

        return match ($normalized) {
            'price', 'valor_da_assinatura' => 'Valor da assinatura',
            'usage', 'nao_estou_usando_o_suficiente' => 'Não estou usando o suficiente',
            'technical', 'problemas_tecnicos' => 'Problemas técnicos',
            'content', 'falta_de_conteudos_especificos' => 'Falta de conteúdos específicos',
            'other', 'outros_motivos' => 'Outros motivos',
            'arrependimento' => 'Arrependimento dentro do prazo de garantia',
            'user_request' => 'Solicitado pelo usuário',
            default => trim($reason) !== '' ? trim($reason) : 'Solicitado pelo usuário',
        };
    }

    /**
     * Calcula o saldo devedor de um termo parcelado ainda nao quitado.
     *
     * Fatura pre-aprovada representa parcela futura do termo ja contratado:
     * ela nao e renovacao, e sim parte do valor total do trimestre/ano que o
     * usuario optou por pagar em parcelas para nao comprometer o limite total.
     *
     * @since 1.0.0
     */
    private function calculateOutstandingTermDebt(array $subscription): array
    {
        $totalInstallments = max(1, (int) ($subscription['total_installments'] ?? 1));
        $paidInstallments = max(0, (int) ($subscription['paid_installments'] ?? 0));
        $remainingInstallments = max(0, $totalInstallments - $paidInstallments);
        $recurringAmount = round((float) ($subscription['recurring_amount'] ?? $subscription['price'] ?? 0), 2);

        if ($totalInstallments <= 1 || $remainingInstallments <= 0 || $recurringAmount <= 0) {
            return [
                'amount' => 0.0,
                'remaining_installments' => 0,
                'total_installments' => $totalInstallments,
                'paid_installments' => $paidInstallments,
                'installment_amount' => $recurringAmount,
            ];
        }

        return [
            'amount' => round($remainingInstallments * $recurringAmount, 2),
            'remaining_installments' => $remainingInstallments,
            'total_installments' => $totalInstallments,
            'paid_installments' => $paidInstallments,
            'installment_amount' => $recurringAmount,
        ];
    }

    /**
     * Quita imediatamente o saldo devedor das parcelas futuras do termo Stripe.
     *
     * @since 1.0.0
     */
    private function settleOutstandingTermDebt(array $subscription, array $debt, array $payload): array
    {
        if (normalizePaymentProvider($subscription['payment_provider'] ?? 'stripe') !== 'stripe') {
            throw new InvalidArgumentException('Quitacao antecipada de termo parcelado exige assinatura Stripe.');
        }

        if (!stripeIsConfigured() || empty($subscription['provider_subscription_id'])) {
            throw new InvalidArgumentException('Assinatura Stripe sem configuracao valida para quitar parcelas pendentes.');
        }

        $amount = round((float) ($debt['amount'] ?? 0), 2);
        if ($amount <= 0) {
            return [
                'amount' => 0.0,
                'transaction_id' => null,
            ];
        }

        $stripe = getStripeClient();
        $stripeSubscription = $stripe->subscriptions->retrieve(
            (string) $subscription['provider_subscription_id'],
            ['expand' => ['default_payment_method', 'customer.invoice_settings.default_payment_method']]
        );

        $customerId = getStripeObjectId($stripeSubscription->customer ?? null)
            ?: trim((string) ($subscription['provider_customer_id'] ?? ''));
        $paymentMethodId = getStripeSubscriptionDefaultPaymentMethodId($stripeSubscription);

        if ($customerId === '' || $paymentMethodId === '') {
            throw new InvalidArgumentException('Nao encontramos um cartao padrao na Stripe para quitar as parcelas pendentes.');
        }

        $planName = trim((string) ($subscription['plan_name'] ?? 'Assinatura'));
        $description = 'Quitacao antecipada das parcelas pendentes - ' . $planName;
        $debtIdempotencyKey = 'subscription_term_debt_'
            . (int) ($subscription['id'] ?? 0)
            . '_' . max(1, (int) ($subscription['renewal_iteration'] ?? 0))
            . '_' . max(1, (int) ($debt['remaining_installments'] ?? 1))
            . '_' . (int) round($amount * 100)
            . '_' . substr(sha1($paymentMethodId), 0, 12);
        $paymentIntent = $stripe->paymentIntents->create([
            'amount' => (int) round($amount * 100),
            'currency' => 'brl',
            'customer' => $customerId,
            'payment_method' => $paymentMethodId,
            'confirm' => true,
            'off_session' => true,
            'description' => $description,
            'metadata' => [
                'type' => 'subscription_term_debt_settlement',
                'user_id' => (string) ($subscription['user_id'] ?? ''),
                'subscription_id' => (string) ($subscription['id'] ?? ''),
                'plan_id' => (string) ($subscription['plan_id'] ?? ''),
                'remaining_installments' => (string) ($debt['remaining_installments'] ?? 0),
                'cancel_reason' => $this->humanizeCancellationReason((string) ($payload['reason'] ?? 'user_request')),
            ],
        ], [
            'idempotency_key' => $debtIdempotencyKey,
        ]);

        $status = strtolower((string) ($paymentIntent->status ?? ''));
        if ($status !== 'succeeded') {
            throw new RuntimeException('A quitacao das parcelas pendentes nao foi aprovada pela Stripe. Atualize o cartao e tente novamente.');
        }

        $paymentIntentId = trim((string) ($paymentIntent->id ?? ''));
        if ($paymentIntentId !== '') {
            $existingTransaction = $this->db->prepare("
                SELECT id
                FROM transactions
                WHERE provider_payment_intent_id = :provider_payment_intent_id
                   OR external_id = :external_id
                LIMIT 1
            ");
            $existingTransaction->execute([
                ':provider_payment_intent_id' => $paymentIntentId !== '' ? $paymentIntentId : null,
                ':external_id' => $paymentIntentId,
            ]);
            $existingTransactionId = $existingTransaction->fetchColumn();
            if ($existingTransactionId) {
                $this->db->prepare("
                    UPDATE transactions
                    SET user_subscription_id = COALESCE(user_subscription_id, :user_subscription_id)
                    WHERE id = :id
                ")->execute([
                    ':user_subscription_id' => (int) ($subscription['id'] ?? 0) ?: null,
                    ':id' => (int) $existingTransactionId,
                ]);

                return [
                    'amount' => $amount,
                    'payment_intent_id' => $paymentIntentId,
                    'transaction_id' => (int) $existingTransactionId,
                ];
            }
        }

        $stmt = $this->db->prepare("
            INSERT INTO transactions (
                external_id, user_id, user_subscription_id, plan_id, plan_name, amount, platform_fee, status, payment_method, payment_provider,
                provider_payment_intent_id, provider_customer_id, installments, payer_email, type
            ) VALUES (
                :external_id, :user_id, :user_subscription_id, :plan_id, :plan_name, :amount, 0, 'approved', 'credit_card', 'stripe',
                :provider_payment_intent_id, :provider_customer_id, :installments, :payer_email, 'plan'
            )
        ");
        try {
            $stmt->execute([
                ':external_id' => $paymentIntentId !== '' ? $paymentIntentId : ('term-debt-' . (int) $subscription['id'] . '-' . time()),
                ':user_id' => (string) $subscription['user_id'],
                ':user_subscription_id' => (int) ($subscription['id'] ?? 0) ?: null,
                ':plan_id' => (int) ($subscription['plan_id'] ?? 0),
                ':plan_name' => $planName,
                ':amount' => $amount,
                ':provider_payment_intent_id' => $paymentIntentId !== '' ? $paymentIntentId : null,
                ':provider_customer_id' => $customerId,
                ':installments' => max(1, (int) ($debt['remaining_installments'] ?? 1)),
                ':payer_email' => '',
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() !== '23000' || $paymentIntentId === '') {
                throw $e;
            }

            $existingTransaction = $this->db->prepare("
                SELECT id
                FROM transactions
                WHERE provider_payment_intent_id = :provider_payment_intent_id
                   OR external_id = :external_id
                LIMIT 1
            ");
            $existingTransaction->execute([
                ':provider_payment_intent_id' => $paymentIntentId !== '' ? $paymentIntentId : null,
                ':external_id' => $paymentIntentId,
            ]);
            $existingTransactionId = (int) $existingTransaction->fetchColumn();
            if ($existingTransactionId > 0) {
                $this->db->prepare("
                    UPDATE transactions
                    SET user_subscription_id = COALESCE(user_subscription_id, :user_subscription_id)
                    WHERE id = :id
                ")->execute([
                    ':user_subscription_id' => (int) ($subscription['id'] ?? 0) ?: null,
                    ':id' => $existingTransactionId,
                ]);
            }
            return [
                'amount' => $amount,
                'payment_intent_id' => $paymentIntentId,
                'transaction_id' => $existingTransactionId,
            ];
        }

        $transactionId = (int) $this->db->lastInsertId();
        $this->notifyFinancialAdminsAboutStripeTransaction(
            ['id' => $transactionId],
            $subscription,
            $planName,
            $amount,
            $paymentIntentId,
            true
        );

        return [
            'amount' => $amount,
            'payment_intent_id' => $paymentIntentId,
            'transaction_id' => $transactionId,
        ];
    }

    /**
     * Agenda o encerramento remoto apos a fatura Stripe atual, sem renovar o termo.
     *
     * @since 1.0.0
     */
    private function cancelSettledStripeSubscriptionWithoutRevokingAccess(array $subscription): void
    {
        if (empty($subscription['provider_subscription_id']) || !stripeIsConfigured()) {
            return;
        }

        try {
            $stripe = getStripeClient();
            $stripe->subscriptions->update((string) $subscription['provider_subscription_id'], [
                'metadata' => [
                    'auto_renew' => '0',
                    'term_debt_settled' => '1',
                ],
            ]);
            $stripe->subscriptions->cancel((string) $subscription['provider_subscription_id'], []);
        } catch (Throwable $e) {
            error_log('[subscriptions_service] Stripe debt settlement cancel sync warning: ' . $e->getMessage());
        }
    }

    /**
     * Determina se a janela legal de reembolso esta aberta para a primeira
     * assinatura paga do usuario (primeiros 7 dias apenas).
     *
     * Renovacoes ou qualquer nova assinatura posterior a primeira compra paga
     * seguem o fluxo normal de cancelamento sem reembolso automatico.
     *
     * @since 1.0.0
     */
    private function isWithinFirstSubscriptionRefundWindow(array $subscription): bool
    {
        $paidInstallments = max(0, (int) ($subscription['paid_installments'] ?? 0));
        if ($paidInstallments > 1) {
            return false;
        }

        $userId = trim((string) ($subscription['user_id'] ?? ''));
        if ($userId === '') {
            return false;
        }

        $stmt = $this->db->prepare("
            SELECT MIN(created_at)
            FROM transactions
            WHERE user_id = :user_id
              AND type = 'plan'
              AND COALESCE(amount, 0) > 0
              AND status IN ('approved', 'completed', 'refund_requested', 'refunded')
        ");
        $stmt->execute([':user_id' => $userId]);

        $firstPaidAt = trim((string) ($stmt->fetchColumn() ?: ''));
        $purchaseTimestamp = $firstPaidAt !== '' ? strtotime($firstPaidAt) : 0;
        if (!$purchaseTimestamp) {
            return false;
        }

        $diffDays = (time() - $purchaseTimestamp) / 86400;
        if ($diffDays > 7) {
            return false;
        }

        return true;
    }

    /**
     * Notifica o primeiro admin quando um cancelamento de assinatura exige
     * mediacao manual de reembolso.
     *
     * @since 1.0.0
     */
    private function notifyAdminAboutPendingRefundReview(int $transactionId, string $reason, float $amount): void
    {
        try {
            createAdminNotification(
                $this->db,
                'Novo reembolso de assinatura pendente',
                'A transação #' . $transactionId . ' aguarda mediação manual na área financeira.',
                'warning',
                'admin',
                '/admin/support/refunds?transactionId=' . rawurlencode((string) $transactionId),
                null,
                $amount,
                'Valor solicitado'
            );

            $stmt = $this->db->query("SELECT id, name, email FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
            $admin = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : null;
            if (!$admin) {
                return;
            }

            $subject = 'Nova solicitação de reembolso de assinatura - #' . $transactionId;
            $content = 'Olá ' . $admin['name'] . ',<br><br>'
                . 'Uma solicitação de cancelamento com reembolso pendente foi registrada no billing.<br><br>'
                . '<b>ID da transação:</b> ' . $transactionId . '<br>'
                . '<b>Valor solicitado:</b> R$ ' . number_format($amount, 2, ',', '.') . '<br>'
                . '<b>Motivo:</b> ' . $reason . '<br><br>'
                . 'Acesse o painel financeiro para aprovar ou rejeitar o estorno.';

            $bodyHtml = Mailer::htmlTemplate(
                'Reembolso pendente',
                $content,
                buildAppHashRoute('/admin', ['tab' => 'support', 'section' => 'refunds']),
                'Abrir reembolsos'
            );

            $adminUrl = buildAppHashRoute('/admin', ['tab' => 'support', 'section' => 'refunds']);
            $template = resolveSystemEmailTemplate(
                'subscription_refund_pending_admin',
                [
                    'subject' => $subject,
                    'htmlBody' => $bodyHtml,
                    'textBody' => "Olá {$admin['name']},\n\nUma solicitação de cancelamento com reembolso pendente foi registrada.\nID da transação: {$transactionId}\nValor solicitado: R$ " . number_format($amount, 2, ',', '.') . "\nMotivo: {$reason}\n\nAbrir financeiro: {$adminUrl}",
                ],
                [
                    'name' => (string) ($admin['name'] ?? ''),
                    'email' => (string) ($admin['email'] ?? ''),
                    'content' => Mailer::htmlToText($content),
                    'admin_url' => $adminUrl,
                    'app_url' => rtrim((string) (getenv('APP_URL') ?: 'http://localhost:3000'), '/'),
                ],
                $this->db
            );

            if ($template['enabled']) {
                Mailer::send((string) $admin['email'], (string) $admin['name'], $template['subject'], $template['htmlBody'], $template['textBody']);
            }
        } catch (Throwable $error) {
            error_log('[subscriptions_service] admin pending refund notification error: ' . $error->getMessage());
        }
    }

    /**
     * Cancela a solicitacao de estorno pendente do usuario.
     *
     * @since 1.0.0
     */
    public function cancelRefundRequest(string $userId): array
    {
        $transaction = $this->repository->findLatestRefundRequestedTransaction($userId);
        if (!$transaction) {
            throw new OutOfBoundsException('Nenhuma solicitacao de reembolso pendente encontrada.');
        }

        $this->repository->restoreRefundRequestedTransaction((int) $transaction['id']);
        $restoredSubscription = $this->resyncLatestStripeSubscriptionForUser($userId);
        $renewalState = $this->updateRenewal($userId, ['auto_renew' => true]);
        $resyncedSubscription = $this->resyncLatestStripeSubscriptionForUser($userId) ?: $restoredSubscription;

        createNotification(
            $this->db,
            $userId,
            'Reembolso cancelado',
            'Voce cancelou sua solicitacao de estorno. Sua assinatura e beneficios foram mantidos.',
            'success',
            'marketplace',
            '/profile?tab=billing'
        );

        return [
            'transaction_id' => (int) $transaction['id'],
            'subscription_status' => (string) ($resyncedSubscription['status'] ?? 'active'),
            'message' => (string) ($renewalState['message'] ?? 'Solicitação de reembolso cancelada. Sua assinatura continua ativa com renovação automática.'),
        ];
    }

    /**
     * Desfaz a solicitacao de cancelamento para manter a assinatura ativa.
     *
     * @since 1.0.0
     */
    public function undoCancellationRequest(string $userId): array
    {
        $transaction = $this->repository->findLatestRefundRequestedTransaction($userId, true);
        if (!$transaction) {
            throw new OutOfBoundsException('Nenhuma solicitacao de cancelamento encontrada.');
        }

        $this->repository->restoreRefundRequestedTransaction((int) $transaction['id']);
        $restoredSubscription = $this->resyncLatestStripeSubscriptionForUser($userId);
        $renewalState = $this->updateRenewal($userId, ['auto_renew' => true]);
        $resyncedSubscription = $this->resyncLatestStripeSubscriptionForUser($userId) ?: $restoredSubscription;

        return [
            'transaction_id' => (int) $transaction['id'],
            'subscription_status' => (string) ($resyncedSubscription['status'] ?? 'active'),
            'message' => (string) ($renewalState['message'] ?? 'Solicitacao de cancelamento removida. Sua assinatura continua ativa.'),
        ];
    }

    /**
     * Reconcilia o estado local das assinaturas Stripe com o estado remoto do
     * provider e registra divergencias operacionais relevantes.
     *
     * @since 1.0.0
     */
    public function runStripeReconciliationCron(): array
    {
        $summary = [
            'checked' => 0,
            'synced_status' => 0,
            'synced_amount' => 0,
            'synced_term_cycles' => 0,
            'synced_periods' => 0,
            'synced_flags' => 0,
            'materialized_invoices' => 0,
            'local_expired' => 0,
            'collection_retries_due' => 0,
            'collection_retries_attempted' => 0,
            'collection_retries_deferred_to_stripe' => 0,
            'collection_retries_succeeded' => 0,
            'collection_retries_exhausted' => 0,
            'issues' => 0,
            'rows' => [],
        ];
        $localExpirationSummary = $this->reconcileLocalExpiredSubscriptionAccess();
        $summary['local_expired'] = (int) ($localExpirationSummary['expired'] ?? 0);
        foreach (($localExpirationSummary['rows'] ?? []) as $localRow) {
            $summary['rows'][] = $localRow;
        }

        if (!stripeIsConfigured()) {
            $this->writeSubscriptionCronHeartbeat($summary, false, 'Stripe nao configurado.');
            throw new RuntimeException('Stripe nao configurado.');
        }
        try {
            $summary['retention'] = RefundRetentionExpiryProcessor::run($this->db, 50);
            $stripe = getStripeClient();
            $collectionRetrySummary = $this->recoverDueStripeInvoicePayments($stripe);
            foreach ($collectionRetrySummary as $key => $value) {
                if ($key === 'rows') {
                    foreach ($value as $retryRow) {
                        $summary['rows'][] = $retryRow;
                    }
                    continue;
                }
                if (array_key_exists($key, $summary)) {
                    $summary[$key] += $value;
                }
            }
            $subscriptions = $this->repository->findStripeSubscriptionsForReconciliation();

            foreach ($subscriptions as $subscriptionRow) {
                $summary['checked']++;
                $rowIssues = [];

                try {
                    $remoteSubscription = $stripe->subscriptions->retrieve(
                        (string) $subscriptionRow['provider_subscription_id'],
                        ['expand' => ['latest_invoice.payment_intent', 'latest_invoice.lines.data', 'items.data.price']]
                    );
                if (
                    !empty($subscriptionRow['superseded_by_subscription_id'])
                    && strtolower(trim((string) ($remoteSubscription->status ?? ''))) !== 'canceled'
                ) {
                    try {
                        $remoteSubscription = $stripe->subscriptions->cancel(
                            (string) $subscriptionRow['provider_subscription_id'],
                            []
                        );
                    } catch (Throwable $supersededCancellationError) {
                        $summary['issues']++;
                        $errorRow = [
                            'subscription_id' => $subscriptionRow['id'],
                            'provider_subscription_id' => $subscriptionRow['provider_subscription_id'],
                            'user_id' => $subscriptionRow['user_id'],
                            'plan_name' => $subscriptionRow['plan_name'],
                            'error' => 'superseded_remote_cancellation_failed: ' . $supersededCancellationError->getMessage(),
                        ];
                        $summary['rows'][] = $errorRow;
                        $this->logSubscriptionCron('stripe_superseded_cancellation_error', $errorRow);
                        continue;
                    }
                }
                $metadata = $this->normalizeStripeMetadata($remoteSubscription->metadata ?? []);
                $previousStatus = (string) ($subscriptionRow['status'] ?? '');
                $previousRecurringAmount = round((float) ($subscriptionRow['recurring_amount'] ?? 0), 2);
                $previousTermCycles = (int) ($subscriptionRow['total_installments'] ?? 1);
                $previousCurrentPeriodStart = (string) ($subscriptionRow['current_period_start'] ?? '');
                $previousCurrentPeriodEnd = (string) ($subscriptionRow['current_period_end'] ?? '');
                $previousProviderPeriodStart = (string) ($subscriptionRow['provider_current_period_start'] ?? '');
                $previousProviderPeriodEnd = (string) ($subscriptionRow['provider_current_period_end'] ?? '');
                $previousAutoRenew = (int) (!empty($subscriptionRow['auto_renew']));
                $previousCancelAtPeriodEnd = (int) (!empty($subscriptionRow['cancel_at_period_end']));
                $previousTransactionsCount = $this->repository->countPlanTransactionsForUser((string) $subscriptionRow['user_id']);
                $this->materializeUnrecordedStripePaidInvoices($stripe, $remoteSubscription);
                $subscriptionRow = $this->repository->findStripeSubscriptionByProviderId((string) $remoteSubscription->id) ?: $subscriptionRow;
                $subscriptionRow = $this->reconcileStripeRemoteSubscriptionState($stripe, $remoteSubscription, $metadata);
                $remoteStatus = mapStripeSubscriptionStatus((string) ($remoteSubscription->status ?? 'incomplete'));
                $remoteRecurringAmount = round(getStripeSubscriptionRecurringAmount($remoteSubscription), 2);
                $resolvedTermCycles = resolveStripeTermCycleCount(
                    $subscriptionRow,
                    $metadata,
                    [
                        'interval_unit' => $subscriptionRow['interval_unit'],
                        'interval_count' => $subscriptionRow['interval_count'],
                        'name' => $subscriptionRow['plan_name'],
                    ]
                );

                if ($previousStatus !== (string) ($subscriptionRow['status'] ?? '')) {
                    $this->repository->updateSubscriptionStatusById((int) $subscriptionRow['id'], $remoteStatus);
                    $subscriptionRow['status'] = $remoteStatus;
                    $summary['synced_status']++;
                }

                if ($remoteRecurringAmount > 0 && abs($remoteRecurringAmount - $previousRecurringAmount) >= 0.01) {
                    $this->repository->updateSubscriptionRecurringAmountById((int) $subscriptionRow['id'], $remoteRecurringAmount);
                    $subscriptionRow['recurring_amount'] = $remoteRecurringAmount;
                    $summary['synced_amount']++;
                }

                if ($resolvedTermCycles !== $previousTermCycles) {
                    $this->repository->updateSubscriptionTotalInstallmentsById((int) $subscriptionRow['id'], $resolvedTermCycles);
                    $subscriptionRow['total_installments'] = $resolvedTermCycles;
                    $summary['synced_term_cycles']++;
                }

                if (
                    $previousCurrentPeriodStart !== (string) ($subscriptionRow['current_period_start'] ?? '')
                    || $previousCurrentPeriodEnd !== (string) ($subscriptionRow['current_period_end'] ?? '')
                    || $previousProviderPeriodStart !== (string) ($subscriptionRow['provider_current_period_start'] ?? '')
                    || $previousProviderPeriodEnd !== (string) ($subscriptionRow['provider_current_period_end'] ?? '')
                ) {
                    $summary['synced_periods']++;
                }

                if (
                    $previousAutoRenew !== (int) (!empty($subscriptionRow['auto_renew']))
                    || $previousCancelAtPeriodEnd !== (int) (!empty($subscriptionRow['cancel_at_period_end']))
                ) {
                    $summary['synced_flags']++;
                }

                $currentTransactionsCount = $this->repository->countPlanTransactionsForUser((string) $subscriptionRow['user_id']);
                if ($currentTransactionsCount > $previousTransactionsCount) {
                    $summary['materialized_invoices'] += ($currentTransactionsCount - $previousTransactionsCount);
                }

                $subscriptionRow = $this->refreshStripeRenewalProjection($subscriptionRow, true);

                if ($remoteStatus === 'canceled') {
                    $preservedSubscription = $this->preservePaidInstallmentAccessAfterRemoteCancellation($subscriptionRow);
                    if ($preservedSubscription !== null) {
                        $subscriptionRow = $preservedSubscription;
                        $remoteStatus = (string) ($subscriptionRow['status'] ?? 'active');
                        $summary['synced_status']++;
                    } else {
                        $this->db->prepare("
                            UPDATE user_subscriptions
                            SET auto_renew = 0,
                                cancel_at_period_end = 0,
                                current_period_end = CASE
                                    WHEN current_period_end IS NULL OR current_period_end > NOW() THEN NOW()
                                    ELSE current_period_end
                                END,
                                provider_current_period_end = CASE
                                    WHEN provider_current_period_end IS NULL OR provider_current_period_end > NOW() THEN NOW()
                                    ELSE provider_current_period_end
                                END,
                                next_renewal_amount = NULL,
                                next_renewal_date = NULL,
                                next_renewal_price_source = NULL,
                                next_renewal_cycle_label = NULL,
                                next_renewal_snapshot_json = NULL
                            WHERE id = :id
                        ")->execute([':id' => (int) $subscriptionRow['id']]);
                        setStripeRecurringCardLock($this->db, (string) $subscriptionRow['user_id'], null);
                        $this->revokeUserAccessFromStripeSubscription($subscriptionRow);
                    }
                } elseif (in_array((string) $subscriptionRow['status'], ['active', 'trialing'], true)) {
                    $this->updateUserAccessFromStripeSubscription(
                        $subscriptionRow,
                        (string) ($metadata['plan_name'] ?? $subscriptionRow['plan_name'] ?? 'Assinatura')
                    );
                } elseif (in_array((string) $subscriptionRow['status'], ['past_due', 'incomplete'], true)) {
                    $this->revokeUserAccessFromStripeSubscription($subscriptionRow);
                }

                $localSubscriptionStatus = strtolower(trim((string) ($subscriptionRow['status'] ?? '')));
                $canReceiveFutureCharges = $remoteStatus !== 'canceled'
                    && in_array($localSubscriptionStatus, ['active', 'trialing', 'past_due', 'incomplete'], true);
                $shouldHaveNextCharge = $canReceiveFutureCharges
                    && (
                        !empty($subscriptionRow['auto_renew'])
                        || (int) ($subscriptionRow['paid_installments'] ?? 0) < max(1, (int) ($subscriptionRow['total_installments'] ?? 1))
                    );

                $upcomingAmount = null;
                $upcomingDate = null;

                if ($shouldHaveNextCharge) {
                    $paidInstallments = (int) ($subscriptionRow['paid_installments'] ?? 0);
                    $totalInstallments = max(1, (int) ($subscriptionRow['total_installments'] ?? 1));
                    $hasRemainingTermInstallments = $paidInstallments < $totalInstallments;
                    $expectedRecurringAmount = $hasRemainingTermInstallments
                        ? round((float) ($subscriptionRow['recurring_amount'] ?? 0), 2)
                        : round((float) ($subscriptionRow['next_renewal_amount'] ?? $subscriptionRow['recurring_amount'] ?? 0), 2);
                    $fallbackBillingDate = $hasRemainingTermInstallments
                        ? (string) ($subscriptionRow['provider_current_period_end'] ?? $subscriptionRow['current_period_end'] ?? '')
                        : (string) ($subscriptionRow['next_renewal_date'] ?? $subscriptionRow['provider_current_period_end'] ?? $subscriptionRow['current_period_end'] ?? '');

                    try {
                        $upcomingInvoice = $stripe->invoices->upcoming([
                            'customer' => getStripeObjectId($remoteSubscription->customer ?? null),
                            'subscription' => (string) $remoteSubscription->id,
                        ]);

                        $upcomingAmount = round(((float) ($upcomingInvoice->amount_due ?? 0)) / 100, 2);
                        $upcomingTimestamp = (int) ($upcomingInvoice->next_payment_attempt ?? 0);
                        if ($upcomingTimestamp <= 0) {
                            $upcomingTimestamp = !empty($subscriptionRow['current_period_end'])
                                ? (int) strtotime((string) $subscriptionRow['current_period_end'])
                                : 0;
                        }
                        $upcomingDate = $upcomingTimestamp > 0 ? date('Y-m-d H:i:s', $upcomingTimestamp) : null;

                        if ($expectedRecurringAmount > 0 && abs($upcomingAmount - $expectedRecurringAmount) >= 0.01) {
                            $rowIssues[] = 'amount_mismatch';
                        }
                    } catch (Throwable $e) {
                        $localForecastAmount = $expectedRecurringAmount;
                        $localForecastTimestamp = $fallbackBillingDate !== ''
                            ? strtotime($fallbackBillingDate)
                            : false;

                        if ($localForecastAmount > 0 && $localForecastTimestamp !== false) {
                            $upcomingAmount = $localForecastAmount;
                            $upcomingDate = date('Y-m-d H:i:s', $localForecastTimestamp);
                        } else {
                            $rowIssues[] = 'missing_upcoming_invoice';
                        }
                    }
                }

                $latestInvoice = $this->resolveLatestPaidStripeInvoice($stripe, $remoteSubscription);
                $latestPaymentIntentStatus = '';
                if (is_object($latestInvoice) && isset($latestInvoice->payment_intent) && is_object($latestInvoice->payment_intent)) {
                    $latestPaymentIntentStatus = (string) ($latestInvoice->payment_intent->status ?? '');
                }

                $latestInvoiceStatus = is_object($latestInvoice) ? (string) ($latestInvoice->status ?? '') : '';
                $latestInvoiceId = is_object($latestInvoice) ? trim((string) ($latestInvoice->id ?? '')) : '';
                $latestInvoiceAmountPaidCents = is_object($latestInvoice)
                    ? max(0, (int) ($latestInvoice->amount_paid ?? 0))
                    : 0;
                $latestInvoiceAlreadyRecorded = $latestInvoiceId !== ''
                    && findStripeTransactionByInvoiceId($this->db, $latestInvoiceId) !== null;
                $latestInvoiceConfirmed = $latestInvoiceAmountPaidCents > 0
                    && (
                        $latestInvoiceStatus === 'paid'
                        || in_array($latestPaymentIntentStatus, ['succeeded', 'processing'], true)
                    );
                $latestInvoicePeriod = is_object($latestInvoice)
                    ? $this->extractStripeInvoiceProviderPeriod($latestInvoice)
                    : ['start' => null, 'end' => null];
                $currentPeriodEndTimestamp = !empty($subscriptionRow['current_period_end'])
                    ? strtotime((string) $subscriptionRow['current_period_end'])
                    : false;
                $latestInvoicePeriodEndTimestamp = !empty($latestInvoicePeriod['end'])
                    ? strtotime((string) $latestInvoicePeriod['end'])
                    : false;
                $latestInvoiceCoversNextPeriod = $latestInvoiceConfirmed
                    && $currentPeriodEndTimestamp !== false
                    && $latestInvoicePeriodEndTimestamp !== false
                    && $latestInvoicePeriodEndTimestamp > $currentPeriodEndTimestamp;

                if (
                    is_object($latestInvoice)
                    && $latestInvoiceConfirmed
                    && !$latestInvoiceAlreadyRecorded
                ) {
                    $this->handleStripeInvoicePaid($stripe, $latestInvoice, 0, $remoteSubscription);
                    $subscriptionRow = $this->repository->findStripeSubscriptionByProviderId((string) $remoteSubscription->id) ?: $subscriptionRow;
                    $summary['materialized_invoices']++;
                }

                if (
                    is_object($latestInvoice)
                    && in_array((string) $subscriptionRow['status'], ['active', 'trialing'], true)
                    && !empty($subscriptionRow['current_period_end'])
                    && strtotime((string) $subscriptionRow['current_period_end']) < time()
                    && $latestInvoiceCoversNextPeriod
                ) {
                    $this->handleStripeInvoicePaid($stripe, $latestInvoice, 0, $remoteSubscription);
                    $subscriptionRow = $this->repository->findStripeSubscriptionByProviderId((string) $remoteSubscription->id) ?: $subscriptionRow;
                }

                if (
                    in_array((string) $subscriptionRow['status'], ['active', 'trialing'], true)
                    && !empty($subscriptionRow['current_period_end'])
                    && strtotime((string) $subscriptionRow['current_period_end']) < time()
                    && !$latestInvoiceCoversNextPeriod
                ) {
                    if (!$shouldHaveNextCharge || !empty($subscriptionRow['cancel_at_period_end'])) {
                        $rowIssues[] = 'ended_without_expected_renewal';

                        $this->expireStripeSubscriptionLocally($subscriptionRow);
                        $subscriptionRow['status'] = 'expired';
                        $summary['local_expired']++;
                    } else {
                        $rowIssues[] = 'overdue_without_confirmed_payment';

                        if ((string) ($subscriptionRow['status'] ?? '') !== 'past_due') {
                            $this->repository->updateSubscriptionStatusById((int) $subscriptionRow['id'], 'past_due');
                            $subscriptionRow['status'] = 'past_due';
                            $this->revokeUserAccessFromStripeSubscription($subscriptionRow);

                            createNotification(
                                $this->db,
                                (string) $subscriptionRow['user_id'],
                                'Renovacao nao confirmada',
                                'A renovação automática venceu, mas não encontramos uma cobrança confirmada na Stripe. Atualize o pagamento para reativar o acesso.',
                                'warning',
                                'marketplace',
                                '/profile/billing'
                            );

                            $this->notifyFinancialAdminsAboutOverdueStripeRenewal($subscriptionRow);
                        }
                    }
                }

                if (!empty($rowIssues)) {
                    $summary['issues'] += count($rowIssues);
                }

                $this->maybeSendStripeRenewalReminder($subscriptionRow);

                $rowSummary = [
                    'subscription_id' => $subscriptionRow['id'],
                    'provider_subscription_id' => $subscriptionRow['provider_subscription_id'],
                    'user_id' => $subscriptionRow['user_id'],
                    'plan_name' => $subscriptionRow['plan_name'],
                    'status' => $subscriptionRow['status'],
                    'paid_installments' => (int) ($subscriptionRow['paid_installments'] ?? 0),
                    'total_installments' => (int) ($subscriptionRow['total_installments'] ?? 1),
                    'recurring_amount' => round((float) ($subscriptionRow['recurring_amount'] ?? 0), 2),
                    'upcoming_amount' => $upcomingAmount,
                    'upcoming_date' => $upcomingDate,
                    'issues' => $rowIssues,
                ];

                $summary['rows'][] = $rowSummary;
                $this->logSubscriptionCron('stripe_reconciliation', $rowSummary);
                } catch (Throwable $e) {
                    $summary['issues']++;
                    $errorRow = [
                        'subscription_id' => $subscriptionRow['id'],
                        'provider_subscription_id' => $subscriptionRow['provider_subscription_id'],
                        'user_id' => $subscriptionRow['user_id'],
                        'plan_name' => $subscriptionRow['plan_name'],
                        'error' => $e->getMessage(),
                    ];
                    $summary['rows'][] = $errorRow;
                    $this->logSubscriptionCron('stripe_reconciliation_error', $errorRow);
                }
            }

            $this->writeSubscriptionCronHeartbeat(
                $summary,
                true,
                (int) ($summary['issues'] ?? 0) > 0
                    ? 'Reconciliacao concluida com alertas.'
                    : 'Reconciliacao concluida sem alertas.'
            );

            return $summary;
        } catch (Throwable $e) {
            $this->writeSubscriptionCronHeartbeat($summary, false, $e->getMessage());
            throw $e;
        }
    }

    /**
     * Encerra assinaturas vencidas que nao dependem de uma acao do usuario logado.
     *
     * @since 1.0.0
     */
    private function reconcileLocalExpiredSubscriptionAccess(): array
    {
        $rows = $this->repository->findSubscriptionsForLocalAccessExpiration();
        $summary = [
            'checked' => count($rows),
            'expired' => 0,
            'rows' => [],
        ];

        foreach ($rows as $subscriptionRow) {
            $status = strtolower(trim((string) ($subscriptionRow['status'] ?? '')));
            if (!in_array($status, ['active', 'trialing'], true)) {
                continue;
            }

            $periodEnd = trim((string) ($subscriptionRow['current_period_end'] ?? ''));
            $periodEndTimestamp = $periodEnd !== '' ? strtotime($periodEnd) : false;
            if ($periodEndTimestamp === false || $periodEndTimestamp >= time()) {
                continue;
            }

            if ($this->shouldWaitForRemoteStripeChargeBeforeLocalExpiration($subscriptionRow)) {
                $rowSummary = [
                    'subscription_id' => (int) ($subscriptionRow['id'] ?? 0),
                    'provider_subscription_id' => (string) ($subscriptionRow['provider_subscription_id'] ?? ''),
                    'user_id' => (string) ($subscriptionRow['user_id'] ?? ''),
                    'plan_name' => (string) ($subscriptionRow['plan_name'] ?? 'Assinatura'),
                    'status' => $status,
                    'reason' => 'waiting_for_stripe_reconciliation',
                    'current_period_end' => $periodEnd,
                ];
                $summary['rows'][] = $rowSummary;
                $this->logSubscriptionCron('local_access_expiration_skipped', $rowSummary);
                continue;
            }

            $this->expireStripeSubscriptionLocally($subscriptionRow);
            $summary['expired']++;

            $rowSummary = [
                'subscription_id' => (int) ($subscriptionRow['id'] ?? 0),
                'provider_subscription_id' => (string) ($subscriptionRow['provider_subscription_id'] ?? ''),
                'user_id' => (string) ($subscriptionRow['user_id'] ?? ''),
                'plan_name' => (string) ($subscriptionRow['plan_name'] ?? 'Assinatura'),
                'status' => 'expired',
                'reason' => 'local_period_ended_without_expected_renewal',
                'current_period_end' => $periodEnd,
            ];
            $summary['rows'][] = $rowSummary;
            $this->logSubscriptionCron('local_access_expiration', $rowSummary);
        }

        return $summary;
    }

    /**
     * Evita encerrar localmente uma assinatura Stripe antes de consultar a Billing API.
     *
     * @since 1.0.0
     */
    private function shouldWaitForRemoteStripeChargeBeforeLocalExpiration(array $subscriptionRow): bool
    {
        if (normalizePaymentProvider($subscriptionRow['payment_provider'] ?? 'stripe') !== 'stripe') {
            return false;
        }

        if (trim((string) ($subscriptionRow['provider_subscription_id'] ?? '')) === '') {
            return false;
        }

        $paidInstallments = (int) ($subscriptionRow['paid_installments'] ?? 0);
        $totalInstallments = max(1, (int) ($subscriptionRow['total_installments'] ?? 1));
        $hasPendingTermCharge = $paidInstallments < $totalInstallments;
        $hasAutoRenewCharge = !empty($subscriptionRow['auto_renew'])
            && empty($subscriptionRow['cancel_at_period_end']);

        return $hasAutoRenewCharge || $hasPendingTermCharge;
    }

    /**
     * Remove acesso premium e limpa projecoes futuras para assinatura encerrada.
     *
     * @since 1.0.0
     */
    private function expireStripeSubscriptionLocally(array $subscriptionRow): void
    {
        $subscriptionId = (int) ($subscriptionRow['id'] ?? 0);
        if ($subscriptionId <= 0) {
            return;
        }

        $userId = trim((string) ($subscriptionRow['user_id'] ?? ''));
        if ($userId === '') {
            return;
        }

        if (
            normalizePaymentProvider($subscriptionRow['payment_provider'] ?? 'stripe') === 'stripe'
            && !empty($subscriptionRow['provider_subscription_id'])
            && stripeIsConfigured()
        ) {
            $this->syncRemoteCancellation($subscriptionRow);
        }

        $this->repository->expireSubscriptionById($subscriptionId);
        setStripeRecurringCardLock($this->db, $userId, null);
        $this->revokeUserAccessFromStripeSubscription($subscriptionRow);

        createNotification(
            $this->db,
            $userId,
            'Assinatura encerrada',
            'Seu periodo de assinatura terminou e o acesso premium foi encerrado. Voce pode reativar o plano quando quiser.',
            'info',
            'marketplace',
            '/plans'
        );
    }

    /**
     * Sincroniza a assinatura Stripe do usuario autenticado e materializa a
     * ultima fatura paga quando o webhook nao chegou a tempo.
     *
     * @since 1.0.0
     */
    public function syncCurrentUserStripeState(string $userId): array
    {
        if (!stripeIsConfigured()) {
            throw new RuntimeException('Stripe nao configurado.');
        }

        $localSubscription = $this->repository->findLatestManagedSubscription($userId);
        if (!$localSubscription) {
            throw new OutOfBoundsException('Nenhuma assinatura gerenciada encontrada para sincronizar.');
        }

        if (normalizePaymentProvider($localSubscription['payment_provider'] ?? 'stripe') !== 'stripe') {
            throw new InvalidArgumentException('A assinatura atual nao utiliza Stripe.');
        }

        $syncedSubscription = $this->resyncLatestStripeSubscriptionForUser($userId) ?: $localSubscription;
        $materializedInvoice = false;
        $materializedInvoicesCount = 0;
        $latestInvoiceId = '';
        $latestInvoiceStatus = '';

        try {
            $stripe = getStripeClient();
            $providerSubscriptionId = trim((string) ($syncedSubscription['provider_subscription_id'] ?? ''));
            if ($providerSubscriptionId !== '') {
                $remoteSubscription = $stripe->subscriptions->retrieve(
                    $providerSubscriptionId,
                    ['expand' => ['latest_invoice.payment_intent', 'latest_invoice.lines.data', 'items.data.price']]
                );

                $materializedInvoices = $this->materializeUnrecordedStripePaidInvoices($stripe, $remoteSubscription);
                $materializedInvoicesCount = (int) ($materializedInvoices['count'] ?? 0);
                $materializedInvoice = $materializedInvoicesCount > 0;
                $latestInvoiceId = (string) ($materializedInvoices['latest_invoice_id'] ?? '');
                $latestInvoiceStatus = (string) ($materializedInvoices['latest_invoice_status'] ?? '');

                $syncedSubscription = $this->repository->findStripeSubscriptionByProviderId($providerSubscriptionId) ?: $syncedSubscription;
                $syncedSubscription = $this->refreshStripeRenewalProjection($syncedSubscription, true);
            }
        } catch (Throwable $syncError) {
            error_log('[subscriptions_service] syncCurrentUserStripeState warning: ' . $syncError->getMessage());
        }

        return [
            'subscription_id' => (int) ($syncedSubscription['id'] ?? 0),
            'provider_subscription_id' => (string) ($syncedSubscription['provider_subscription_id'] ?? ''),
            'status' => (string) ($syncedSubscription['status'] ?? ''),
            'current_period_start' => $syncedSubscription['current_period_start'] ?? null,
            'current_period_end' => $syncedSubscription['current_period_end'] ?? null,
            'next_renewal_date' => $syncedSubscription['next_renewal_date'] ?? null,
            'next_renewal_amount' => round((float) ($syncedSubscription['next_renewal_amount'] ?? 0), 2),
            'materialized_invoice' => $materializedInvoice,
            'materialized_invoices' => $materializedInvoicesCount,
            'latest_invoice_id' => $latestInvoiceId,
            'latest_invoice_status' => $latestInvoiceStatus,
        ];
    }
    public function getCurrentUserBillingSnapshot(string $userId): array { $subscription = $this->repository->findLatestManagedSubscription($userId); return ['subscription' => $subscription ? buildCurrentSubscriptionBillingSnapshot(hydrateCurrentSubscriptionSnapshotFromStripe($subscription)) : null]; }
    /**
     * Recalcula a projeção de renovação de todas as assinaturas Stripe ativas.
     * Usado após alteração administrativa de preços de planos.
     *
     * @since 1.0.0
     */
    public function syncStripeRenewalProjectionsAfterPricingChange(): array
    {
        if (!stripeIsConfigured()) {
            return [
                'configured' => false,
                'checked' => 0,
                'synced' => 0,
                'errors' => 0,
                'rows' => [],
            ];
        }

        $rows = $this->repository->findStripeSubscriptionsForReconciliation();
        $summary = [
            'configured' => true,
            'checked' => 0,
            'synced' => 0,
            'errors' => 0,
            'rows' => [],
        ];

        foreach ($rows as $subscriptionRow) {
            $summary['checked']++;
            try {
                $synced = $this->refreshStripeRenewalProjection($subscriptionRow, true);
                $summary['synced']++;
                $summary['rows'][] = [
                    'subscription_id' => (int) ($synced['id'] ?? 0),
                    'provider_subscription_id' => (string) ($synced['provider_subscription_id'] ?? ''),
                    'plan_id' => (int) ($synced['plan_id'] ?? 0),
                    'next_renewal_amount' => round((float) ($synced['next_renewal_amount'] ?? 0), 2),
                    'next_renewal_date' => (string) ($synced['next_renewal_date'] ?? ''),
                    'price_source' => (string) ($synced['next_renewal_price_source'] ?? ''),
                    'status' => 'synced',
                ];
            } catch (Throwable $syncError) {
                $summary['errors']++;
                $summary['rows'][] = [
                    'subscription_id' => (int) ($subscriptionRow['id'] ?? 0),
                    'provider_subscription_id' => (string) ($subscriptionRow['provider_subscription_id'] ?? ''),
                    'plan_id' => (int) ($subscriptionRow['plan_id'] ?? 0),
                    'status' => 'error',
                    'error' => $syncError->getMessage(),
                ];
                error_log('[subscriptions_service] price sync warning: ' . $syncError->getMessage());
            }
        }

        return $summary;
    }

    /**
     * Consolida a validacao compartilhada entre os dois fluxos de criacao Stripe.
     *
     * @since 1.0.0
     */
    private function buildStripeCreationContext(string $userId, array $payload): array
    {
        if (!stripeIsConfigured()) {
            throw new RuntimeException('Stripe nao configurado no backend.');
        }

        if (getConfiguredPaymentProvider($this->db) !== 'stripe') {
            throw new InvalidArgumentException('O provedor Stripe nao esta ativo no painel administrativo.');
        }

        $plan = $this->repository->findPlanById((int) $payload['plan_id']);
        if (!$plan) {
            throw new OutOfBoundsException('Plano nao encontrado.');
        }

        $catalogActive = true;
        if (array_key_exists('active', $plan)) {
            $catalogActive = filter_var($plan['active'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
            if ($catalogActive === null) {
                $catalogActive = ((int) $plan['active']) > 0;
            }
        } elseif (array_key_exists('is_active', $plan)) {
            $catalogActive = filter_var($plan['is_active'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
            if ($catalogActive === null) {
                $catalogActive = ((int) $plan['is_active']) > 0;
            }
        }

        if (!$catalogActive) {
            throw new DomainException('Este plano esta desativado no catalogo e nao pode ser contratado no momento.');
        }

        if (!isPlanCommerciallyEnabled($this->db, (string) ($plan['name'] ?? ''))) {
            throw new DomainException('Este plano esta desativado no painel administrativo e nao pode ser contratado no momento.');
        }

        $planValidation = validateSubscriptionTargetPlan($this->db, $userId, $plan);
        if (!empty($planValidation['blocked_message'])) {
            throw new DomainException((string) $planValidation['blocked_message']);
        }

        $user = $this->repository->findStripeCheckoutUser($userId);
        if (!$user) {
            throw new OutOfBoundsException('Usuario nao encontrado.');
        }

        $checkoutRequirementErrors = getStripeCheckoutRequirementErrors($user);
        if (!empty($checkoutRequirementErrors)) {
            throw new InvalidArgumentException('Complete seu perfil e confirme o e-mail antes de concluir o pagamento.');
        }

        $basePrice = round((float) $plan['price'], 2);
        $creditAmount = calculateSafeProratedCredit($this->db, $userId);
        $discountBase = max(0, round($basePrice - $creditAmount, 2));
        $couponResult = validateCouponForAmount(
            $this->db,
            $payload['coupon_code'],
            $discountBase,
            [
                'plan_id' => (int) $plan['id'],
                'target_type' => 'plan',
                'target_id' => (string) $plan['id'],
                'user_id' => $userId,
                'user_email' => strtolower(trim((string) ($user['email'] ?? ''))),
                'checkout_attempt_id' => (string) ($payload['checkout_attempt_id'] ?? ''),
            ]
        );
        $discountAmount = $couponResult['valid'] ? (float) $couponResult['discount_amount'] : 0.0;
        $finalPrice = max(0, round($discountBase - $discountAmount, 2));

        return [
            'plan' => $plan,
            'user' => $user,
            'credit_amount' => $creditAmount,
            'discount_amount' => $discountAmount,
            'coupon_result' => $couponResult,
            'final_price' => $finalPrice,
        ];
    }

    /**
     * Ativa uma assinatura imediata quando cupom + credito interno zeram o valor a cobrar.
     *
     * @since 1.0.0
     */
    private function activateLocalCreditStripeSubscription(
        string $userId,
        array $plan,
        array $user,
        array $couponResult,
        float $creditAmount,
        float $discountAmount,
        float $finalPrice
    ): array {
        $periodRange = calculateSubscriptionPeriodRange((string) $plan['interval_unit'], (int) $plan['interval_count']);
        $currentDate = $periodRange['start'];
        $endDate = $periodRange['end'];
        $platformFeePercent = getPlatformFeePercent($this->db);
        $externalSubscriptionId = 'local_credit_' . uniqid('', true);
        $providerCustomerId = trim((string) ($user['stripe_customer_id'] ?? ''));

        $stmtSubscription = $this->db->prepare("
            INSERT INTO user_subscriptions (
                user_id, plan_id, status, payment_provider, current_period_start, current_period_end,
                external_subscription_id, provider_customer_id, provider_current_period_start, provider_current_period_end,
                auto_renew, cancel_at_period_end, is_recurring, recurring_amount,
                total_installments, paid_installments
            ) VALUES (
                :user_id, :plan_id, 'active', 'stripe', :current_start, :current_end,
                :external_subscription_id, :provider_customer_id, :provider_current_period_start, :provider_current_period_end,
                0, 1, 0, 0, 1, 1
            )
            ON DUPLICATE KEY UPDATE
                plan_id = VALUES(plan_id),
                status = 'active',
                payment_provider = 'stripe',
                current_period_start = VALUES(current_period_start),
                current_period_end = VALUES(current_period_end),
                provider_customer_id = VALUES(provider_customer_id),
                provider_current_period_start = VALUES(provider_current_period_start),
                provider_current_period_end = VALUES(provider_current_period_end),
                external_subscription_id = VALUES(external_subscription_id),
                auto_renew = 0,
                cancel_at_period_end = 1,
                is_recurring = 0,
                recurring_amount = 0,
                total_installments = 1,
                paid_installments = 1
        ");
        $stmtSubscription->execute([
            ':user_id' => $userId,
            ':plan_id' => (int) $plan['id'],
            ':current_start' => $currentDate,
            ':current_end' => $endDate,
            ':provider_customer_id' => $providerCustomerId !== '' ? $providerCustomerId : null,
            ':provider_current_period_start' => $currentDate,
            ':provider_current_period_end' => $endDate,
            ':external_subscription_id' => $externalSubscriptionId,
        ]);

        $stmtTransaction = $this->db->prepare("
            INSERT INTO transactions (
                external_id, user_id, plan_id, plan_name, amount, platform_fee, status, payment_method, payment_provider,
                provider_invoice_id, provider_customer_id, installments, payer_email, type
            ) VALUES (
                :external_id, :user_id, :plan_id, :plan_name, 0, :platform_fee, 'approved', 'local_credit', 'stripe',
                :provider_invoice_id, :provider_customer_id, 1, :payer_email, 'plan'
            )
        ");
        $stmtTransaction->execute([
            ':external_id' => $externalSubscriptionId,
            ':user_id' => $userId,
            ':plan_id' => (int) $plan['id'],
            ':plan_name' => (string) $plan['name'],
            ':platform_fee' => round((0 * $platformFeePercent) / 100, 2),
            ':provider_invoice_id' => $externalSubscriptionId,
            ':provider_customer_id' => $providerCustomerId !== '' ? $providerCustomerId : null,
            ':payer_email' => $user['email'],
        ]);
        $transaction = findStripeTransactionByInvoiceId($this->db, $externalSubscriptionId);

        $currentSubscriptionStmt = $this->db->prepare("
            SELECT id
            FROM user_subscriptions
            WHERE user_id = :user_id
              AND external_subscription_id = :external_subscription_id
            ORDER BY id DESC
            LIMIT 1
        ");
        $currentSubscriptionStmt->execute([
            ':user_id' => $userId,
            ':external_subscription_id' => $externalSubscriptionId,
        ]);
        $currentSubscriptionId = $currentSubscriptionStmt->fetchColumn();
        if ($currentSubscriptionId) {
            $this->db->prepare("
                UPDATE transactions
                SET user_subscription_id = :user_subscription_id
                WHERE provider_invoice_id = :provider_invoice_id
                  AND user_id = :user_id
                  AND type = 'plan'
            ")->execute([
                ':user_subscription_id' => (int) $currentSubscriptionId,
                ':provider_invoice_id' => $externalSubscriptionId,
                ':user_id' => $userId,
            ]);

            $this->cancelSupersededStripeSubscriptions([
                'id' => (int) $currentSubscriptionId,
                'user_id' => $userId,
            ]);
            deactivateOtherUserSubscriptions($this->db, $userId, (int) $currentSubscriptionId);
        }

        $this->db->prepare("
            UPDATE users
            SET plan = :plan_name,
                current_plan_id = :plan_id,
                subscription_end = :subscription_end
            WHERE id = :user_id
        ")->execute([
            ':plan_name' => canonicalUserPlanValue((string) $plan['name']),
            ':plan_id' => (int) $plan['id'],
            ':subscription_end' => $endDate,
            ':user_id' => $userId,
        ]);

        if (!empty($couponResult['valid']) && !empty($couponResult['coupon']['code'])) {
            incrementCouponUsage($this->db, (string) $couponResult['coupon']['code']);
        }

        try {
            sendSubscriptionWelcomeEmail($this->db, $user, [
                'plan_name' => (string) $plan['name'],
                'interval_unit' => (string) $plan['interval_unit'],
                'interval_count' => (int) $plan['interval_count'],
                'billing_mode' => 'single_installment',
                'installment_count' => 1,
                'term_total_amount' => 0.0,
                'first_charge_amount' => 0.0,
                'cycle_charge_amount' => 0.0,
                'payment_provider' => 'stripe',
                'current_period_end' => $endDate,
                'transaction_reference' => $externalSubscriptionId,
            ], $transaction ?: [
                'external_id' => $externalSubscriptionId,
                'amount' => 0.0,
                'provider_invoice_id' => $externalSubscriptionId,
            ]);
        } catch (Throwable $emailError) {
            error_log('[subscriptions_service] local credit welcome email error: ' . $emailError->getMessage());
        }

        return [
            'redirect_url' => buildAppHashRoute('/profile', ['tab' => 'billing', 'checkout' => 'success']),
            'mode' => 'local_credit',
            'subscription_status' => 'active',
            'provider' => 'stripe',
            'amount' => 0.0,
            'term_total_amount' => round($finalPrice, 2),
            'recurring_cycle_amount' => 0.0,
            'billing_mode' => 'local_credit',
            'billing_term_cycles' => 1,
            'billing_commitment_cycles' => 1,
            'billing_selected_installments' => 1,
            'credit_amount' => round($creditAmount, 2),
            'discount_amount' => round($discountAmount, 2),
            'transaction_id' => (int) ($transaction['id'] ?? 0),
            'transaction_reference' => $externalSubscriptionId,
        ];
    }

    /**
     * Sincroniza definitivamente a assinatura Stripe apos a confirmacao do pagamento.
     *
     * @since 1.0.0
     */
    private function upsertStripeSubscriptionFinalize(
        string $userId,
        int $planId,
        string $planName,
        int $termCycles,
        array $planContext,
        $stripeSubscription,
        bool $autoRenew
    ): array {
        $status = mapStripeSubscriptionStatus((string) $stripeSubscription->status);
        $providerPeriod = $this->extractStripeSubscriptionProviderPeriod(
            $stripeSubscription,
            $stripeSubscription->latest_invoice ?? null
        );
        $period = $this->resolveStripeAccessPeriod($planContext, $termCycles, $providerPeriod);
        $currentPeriodStart = $period['start'];
        $currentPeriodEnd = $period['end'];
        $recurringAmount = getStripeSubscriptionRecurringAmount($stripeSubscription);

        $stmt = $this->db->prepare("
            INSERT INTO user_subscriptions (
                user_id, plan_id, status, payment_provider, current_period_start, current_period_end,
                external_subscription_id, provider_subscription_id, provider_customer_id,
                provider_current_period_start, provider_current_period_end,
                auto_renew, cancel_at_period_end, is_recurring, recurring_amount, total_installments, paid_installments
            ) VALUES (
                :user_id, :plan_id, :status, 'stripe', :current_period_start, :current_period_end,
                :external_subscription_id, :provider_subscription_id, :provider_customer_id,
                :provider_current_period_start, :provider_current_period_end,
                :auto_renew, :cancel_at_period_end, 1, :recurring_amount, :total_installments, 1
            )
            ON DUPLICATE KEY UPDATE
                plan_id = VALUES(plan_id),
                status = VALUES(status),
                payment_provider = 'stripe',
                current_period_start = VALUES(current_period_start),
                current_period_end = VALUES(current_period_end),
                external_subscription_id = VALUES(external_subscription_id),
                provider_subscription_id = VALUES(provider_subscription_id),
                provider_customer_id = VALUES(provider_customer_id),
                provider_current_period_start = VALUES(provider_current_period_start),
                provider_current_period_end = VALUES(provider_current_period_end),
                auto_renew = VALUES(auto_renew),
                cancel_at_period_end = VALUES(cancel_at_period_end),
                is_recurring = 1,
                recurring_amount = VALUES(recurring_amount),
                total_installments = VALUES(total_installments),
                paid_installments = 1
        ");
        $stmt->execute([
            ':user_id' => $userId,
            ':plan_id' => $planId,
            ':status' => $status,
            ':current_period_start' => $currentPeriodStart,
            ':current_period_end' => $currentPeriodEnd,
            ':external_subscription_id' => (string) $stripeSubscription->id,
            ':provider_subscription_id' => (string) $stripeSubscription->id,
            ':provider_customer_id' => getStripeObjectId($stripeSubscription->customer ?? null),
            ':provider_current_period_start' => $providerPeriod['start'],
            ':provider_current_period_end' => $providerPeriod['end'],
            ':auto_renew' => $autoRenew ? 1 : 0,
            ':cancel_at_period_end' => resolveStripeCancelAtPeriodEnd($autoRenew, $termCycles, 1) ? 1 : 0,
            ':recurring_amount' => $recurringAmount,
            ':total_installments' => max(1, $termCycles),
        ]);

        $currentSubscriptionStmt = $this->db->prepare("
            SELECT id
            FROM user_subscriptions
            WHERE user_id = :user_id
              AND provider_subscription_id = :provider_subscription_id
            ORDER BY id DESC
            LIMIT 1
        ");
        $currentSubscriptionStmt->execute([
            ':user_id' => $userId,
            ':provider_subscription_id' => (string) $stripeSubscription->id,
        ]);
        $currentSubscriptionId = $currentSubscriptionStmt->fetchColumn();
        if ($currentSubscriptionId) {
            $this->cancelSupersededStripeSubscriptions([
                'id' => (int) $currentSubscriptionId,
                'user_id' => $userId,
                'provider_subscription_id' => (string) $stripeSubscription->id,
            ]);
            deactivateOtherUserSubscriptions($this->db, $userId, (int) $currentSubscriptionId);
        }

        return [
            'id' => $currentSubscriptionId ? (int) $currentSubscriptionId : null,
            'user_id' => $userId,
            'plan_id' => $planId,
            'status' => $status,
            'current_period_start' => $currentPeriodStart,
            'current_period_end' => $currentPeriodEnd,
            'plan_name' => $planName,
            'price' => (float) ($planContext['price'] ?? $recurringAmount),
            'stripe_product_id' => $planContext['stripe_product_id'] ?? null,
            'provider_subscription_id' => (string) $stripeSubscription->id,
            'total_installments' => max(1, $termCycles),
            'paid_installments' => 1,
            'interval_unit' => (string) ($planContext['interval_unit'] ?? 'month'),
            'interval_count' => (int) ($planContext['interval_count'] ?? 1),
            'auto_renew' => $autoRenew ? 1 : 0,
            'cancel_at_period_end' => resolveStripeCancelAtPeriodEnd($autoRenew, $termCycles, 1) ? 1 : 0,
            'recurring_amount' => $recurringAmount,
            'provider_schedule_id' => null,
        ];
    }

    /**
     * Garante que a primeira fatura aprovada da Stripe exista no historico local.
     *
     * @since 1.0.0
     */
    private function ensureStripeInvoiceTransaction(
        $invoice,
        string $userId,
        int $planId,
        string $planName,
        string $customerId,
        string $email,
        ?string $couponCode,
        ?int $subscriptionId = null
    ): bool {
        $invoiceId = (string) ($invoice->id ?? '');
        if ($invoiceId === '') {
            return false;
        }

        $check = $this->db->prepare("
            SELECT id
            FROM transactions
            WHERE provider_invoice_id = :provider_invoice_id
               OR external_id = :external_id
            LIMIT 1
        ");
        $check->execute([
            ':provider_invoice_id' => $invoiceId,
            ':external_id' => $invoiceId,
        ]);
        if ($check->fetch(PDO::FETCH_ASSOC)) {
            if ($subscriptionId && $subscriptionId > 0) {
                $this->db->prepare("
                    UPDATE transactions
                    SET user_subscription_id = COALESCE(user_subscription_id, :user_subscription_id)
                    WHERE provider_invoice_id = :provider_invoice_id
                       OR external_id = :external_id
                ")->execute([
                    ':user_subscription_id' => $subscriptionId,
                    ':provider_invoice_id' => $invoiceId,
                    ':external_id' => $invoiceId,
                ]);
            }
            return false;
        }

        $paymentIntentId = getStripeInvoicePaymentIntentId($invoice);
        if ($paymentIntentId === '' && $invoiceId !== '' && stripeIsConfigured()) {
            try {
                $expandedInvoice = getStripeClient()->invoices->retrieve($invoiceId, [
                    'expand' => ['payment_intent', 'payments'],
                ]);
                $paymentIntentId = getStripeInvoicePaymentIntentId($expandedInvoice);
                $invoice = $expandedInvoice;
            } catch (Throwable $e) {
                error_log('Stripe finalize invoice payment_intent sync warning: ' . $e->getMessage());
            }
        }

        $amountPaid = ((float) ($invoice->amount_paid ?? 0)) / 100;
        $platformFee = round(($amountPaid * getPlatformFeePercent($this->db)) / 100, 2);

        try {
            $this->db->prepare("
                INSERT INTO transactions (
                    external_id, user_id, user_subscription_id, plan_id, plan_name, amount, platform_fee, status, payment_method, payment_provider,
                    provider_payment_intent_id, provider_invoice_id, provider_customer_id, installments,
                    payer_email, type
                ) VALUES (
                    :external_id, :user_id, :user_subscription_id, :plan_id, :plan_name, :amount, :platform_fee, 'approved', 'credit_card', 'stripe',
                    :provider_payment_intent_id, :provider_invoice_id, :provider_customer_id, 1,
                    :payer_email, 'plan'
                )
            ")->execute([
                ':external_id' => $invoiceId,
                ':user_id' => $userId,
                ':user_subscription_id' => $subscriptionId && $subscriptionId > 0 ? $subscriptionId : null,
                ':plan_id' => $planId,
                ':plan_name' => $planName,
                ':amount' => $amountPaid,
                ':platform_fee' => $platformFee,
                ':provider_payment_intent_id' => $paymentIntentId !== '' ? $paymentIntentId : null,
                ':provider_invoice_id' => $invoiceId,
                ':provider_customer_id' => $customerId,
                ':payer_email' => $email,
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                return false;
            }
            throw $e;
        }

        if ($couponCode) {
            incrementCouponUsage($this->db, $couponCode);
        }

        return true;
    }

    /**
     * Gera o metadata padronizado reaproveitado entre checkout hospedado e fluxo interno.
     *
     * @since 1.0.0
     */
    private function buildStripeCheckoutMetadata(
        string $userId,
        array $plan,
        array $user,
        bool $autoRenew,
        array $couponResult,
        float $discountAmount,
        float $creditAmount,
        float $finalPrice,
        array $billingConfig,
        string $initialChargeDescription,
        array $extra = []
    ): array {
        $canonicalFinalPrice = (float) ($billingConfig['term_total_amount'] ?? $finalPrice);
        $roundingAdjustmentAmount = max(0, round($finalPrice - $canonicalFinalPrice, 2));
        $canonicalDiscountAmount = max(0, round($discountAmount + $roundingAdjustmentAmount, 2));

        $metadata = array_merge([
            'user_id' => $userId,
            'plan_id' => (string) ($plan['id'] ?? ''),
            'plan_name' => (string) ($plan['name'] ?? ''),
            'auto_renew' => $autoRenew ? '1' : '0',
            'coupon_code' => !empty($couponResult['valid']) ? (string) ($couponResult['coupon']['code'] ?? '') : '',
            'discount_amount' => number_format($canonicalDiscountAmount, 2, '.', ''),
            'credit_amount' => number_format($creditAmount, 2, '.', ''),
            'rounding_adjustment_amount' => number_format($roundingAdjustmentAmount, 2, '.', ''),
            'final_amount' => number_format($canonicalFinalPrice, 2, '.', ''),
            'billing_mode' => (string) $billingConfig['billing_mode'],
            'billing_term_cycles' => (string) $billingConfig['term_cycles'],
            'billing_commitment_cycles' => (string) $billingConfig['commitment_cycles'],
            'billing_selected_installments' => (string) $billingConfig['selected_installment_count'],
            'billing_cycle_amount' => number_format($billingConfig['cycle_charge_amount'], 2, '.', ''),
            'billing_first_charge_amount' => number_format($billingConfig['first_invoice_charge_amount'], 2, '.', ''),
            'billing_initial_charge_description' => $initialChargeDescription,
            'payment_provider' => 'stripe',
        ], $extra);

        $cpf = preg_replace('/\D+/', '', (string) ($user['cpf'] ?? ''));
        if ($cpf !== '') {
            $metadata['payer_cpf'] = $cpf;
        }

        return $metadata;
    }

    /**
     * Cria o cupom tecnico usado apenas para ajustar a primeira cobranca do termo.
     *
     * @since 1.0.0
     */
    private function createFirstInvoiceAdjustmentCoupon(
        $stripe,
        string $userId,
        int $planId,
        int $firstInvoiceDiscountCents,
        array $couponResult,
        float $finalPrice
    ) {
        return $stripe->coupons->create([
            'amount_off' => $firstInvoiceDiscountCents,
            'currency' => 'brl',
            'duration' => 'once',
            'max_redemptions' => 1,
            'name' => buildStripeFirstInvoiceAdjustmentCouponName($userId, $planId),
            'metadata' => [
                'user_id' => $userId,
                'plan_id' => (string) $planId,
                'coupon_code' => !empty($couponResult['valid']) ? (string) ($couponResult['coupon']['code'] ?? '') : '',
                'final_amount' => number_format($finalPrice, 2, '.', ''),
            ],
        ]);
    }

    /**
     * Resolve, anexa e normaliza o metodo de pagamento do fluxo interno Stripe.
     *
     * @since 1.0.0
     */
    private function resolveStripeInlinePaymentMethod(
        $stripe,
        string $userId,
        string $stripeCustomerId,
        array $user,
        array $payload,
        array $billingConfig
    ): array {
        $paymentMethodId = (string) $payload['payment_method_id'];
        $savedCardId = (string) $payload['saved_card_id'];
        $usingSavedCard = false;

        if ($savedCardId !== '') {
            $selectedSavedCard = getLocalStripeCardById($this->db, $userId, $savedCardId);
            if (!$selectedSavedCard || empty($selectedSavedCard['stripe_payment_method_id'])) {
                throw new InvalidArgumentException('O cartao salvo selecionado nao esta disponivel para este usuario.');
            }

            $paymentMethodId = (string) $selectedSavedCard['stripe_payment_method_id'];
            $usingSavedCard = true;
        }

        $paymentMethod = $stripe->paymentMethods->retrieve($paymentMethodId, []);
        assertStripeCardCoversInstallmentTerm($paymentMethod, $billingConfig);

        $paymentMethodCustomerId = (string) ($paymentMethod->customer ?? '');
        if ($paymentMethodCustomerId !== '' && $paymentMethodCustomerId !== $stripeCustomerId) {
            throw new InvalidArgumentException('Este metodo de pagamento pertence a outro cliente Stripe.');
        }

        if ($paymentMethodCustomerId !== $stripeCustomerId) {
            $paymentMethod = $stripe->paymentMethods->attach($paymentMethodId, [
                'customer' => $stripeCustomerId,
            ]);
        }

        $persistCardLocally = !empty($payload['save_card']) || !empty($payload['auto_renew']) || $usingSavedCard;
        if ($persistCardLocally) {
            $stripe->customers->update($stripeCustomerId, [
                'invoice_settings' => [
                    'default_payment_method' => $paymentMethodId,
                ],
            ]);
        }

        syncStripePaymentMethodBillingDetails($stripe, $paymentMethodId, $user);

        return [
            'payment_method' => $paymentMethod,
            'payment_method_id' => $paymentMethodId,
            'using_saved_card' => $usingSavedCard,
            'persist_card_locally' => $persistCardLocally,
        ];
    }

    /**
     * Mantem a assinatura pendente salva localmente ate a confirmacao final do pagamento.
     *
     * @since 1.0.0
     */
    private function upsertPendingStripeSubscriptionRecord(
        string $userId,
        int $planId,
        string $subscriptionId,
        string $customerId,
        string $status,
        string $currentPeriodStart,
        string $currentPeriodEnd,
        ?string $providerCurrentPeriodStart,
        ?string $providerCurrentPeriodEnd,
        bool $autoRenew,
        float $recurringAmount,
        int $totalInstallments
    ): void {
        $stmt = $this->db->prepare("
            INSERT INTO user_subscriptions (
                user_id, plan_id, status, payment_provider, current_period_start, current_period_end,
                external_subscription_id, provider_subscription_id, provider_customer_id,
                provider_current_period_start, provider_current_period_end,
                auto_renew, cancel_at_period_end, is_recurring, recurring_amount, total_installments, paid_installments
            ) VALUES (
                :user_id, :plan_id, :status, 'stripe', :current_period_start, :current_period_end,
                :external_subscription_id, :provider_subscription_id, :provider_customer_id,
                :provider_current_period_start, :provider_current_period_end,
                :auto_renew, :cancel_at_period_end, 1, :recurring_amount, :total_installments, 0
            )
            ON DUPLICATE KEY UPDATE
                plan_id = VALUES(plan_id),
                status = VALUES(status),
                payment_provider = 'stripe',
                current_period_start = VALUES(current_period_start),
                current_period_end = VALUES(current_period_end),
                external_subscription_id = VALUES(external_subscription_id),
                provider_subscription_id = VALUES(provider_subscription_id),
                provider_customer_id = VALUES(provider_customer_id),
                provider_current_period_start = VALUES(provider_current_period_start),
                provider_current_period_end = VALUES(provider_current_period_end),
                auto_renew = VALUES(auto_renew),
                cancel_at_period_end = VALUES(cancel_at_period_end),
                is_recurring = 1,
                recurring_amount = VALUES(recurring_amount),
                total_installments = VALUES(total_installments)
        ");

        $stmt->execute([
            ':user_id' => $userId,
            ':plan_id' => $planId,
            ':status' => $status,
            ':current_period_start' => $currentPeriodStart,
            ':current_period_end' => $currentPeriodEnd,
            ':external_subscription_id' => $subscriptionId,
            ':provider_subscription_id' => $subscriptionId,
            ':provider_customer_id' => $customerId,
            ':provider_current_period_start' => $providerCurrentPeriodStart,
            ':provider_current_period_end' => $providerCurrentPeriodEnd,
            ':auto_renew' => $autoRenew ? 1 : 0,
            ':cancel_at_period_end' => resolveStripeCancelAtPeriodEnd($autoRenew, $totalInstallments, 0) ? 1 : 0,
            ':recurring_amount' => round($recurringAmount, 2),
            ':total_installments' => max(1, $totalInstallments),
        ]);
    }

    /**
     * Processa o checkout hospedado finalizado no Stripe.
     *
     * @since 1.0.0
     */
    private function handleStripeCheckoutSessionCompleted($stripe, $session, int $eventCreatedAt = 0): void
    {
        if (($session->mode ?? null) !== 'subscription' || empty($session->subscription)) {
            return;
        }

        $subscription = $stripe->subscriptions->retrieve((string) $session->subscription, [
            'expand' => ['latest_invoice.payment_intent', 'latest_invoice.lines.data', 'items.data.price'],
        ]);
        $metadata = $this->mergeStripeMetadata($session->metadata ?? [], $subscription->metadata ?? []);
        $localSubscription = $this->upsertStripeSubscriptionFromWebhook($subscription, $metadata, (string) $session->id, $eventCreatedAt);

        if (($metadata['auto_renew'] ?? '1') === '0' && (int) ($localSubscription['total_installments'] ?? 1) <= 1) {
            $stripe->subscriptions->update((string) $subscription->id, [
                'cancel_at_period_end' => true,
            ]);

            $this->db->prepare("UPDATE user_subscriptions SET auto_renew = 0, cancel_at_period_end = 1 WHERE id = :id")
                ->execute([':id' => $localSubscription['id']]);
        }
    }

    /**
     * Libera reservas de cupom quando o checkout hospedado expira sem pagamento.
     *
     * @since 1.0.0
     */
    private function handleStripeCheckoutSessionExpired($session): void
    {
        $metadata = $this->normalizeStripeMetadata($session->metadata ?? []);
        $couponCode = trim((string) ($metadata['coupon_code'] ?? ''));
        $userId = trim((string) ($metadata['user_id'] ?? ''));
        $checkoutAttemptId = trim((string) ($metadata['checkout_attempt_id'] ?? ''));

        if ($couponCode === '' || $userId === '' || $checkoutAttemptId === '') {
            return;
        }

        releaseCouponReservation($this->db, $couponCode, $userId, $checkoutAttemptId, 'stripe');
    }

    /**
     * Normaliza metadata vinda do SDK Stripe.
     *
     * Objetos Stripe nao podem ser convertidos com `(array)`, pois isso expoe
     * campos internos do SDK em vez das chaves comerciais como user_id/plan_id.
     *
     * @since 1.0.0
     */
    private function normalizeStripeMetadata($metadata): array
    {
        if ($metadata === null || $metadata === '') {
            return [];
        }

        if (is_array($metadata)) {
            $normalized = $metadata;
        } elseif (is_object($metadata) && method_exists($metadata, 'toArray')) {
            try {
                $normalized = $metadata->toArray();
            } catch (Throwable $exception) {
                $normalized = [];
            }
        } elseif ($metadata instanceof Traversable) {
            $normalized = iterator_to_array($metadata);
        } elseif (is_object($metadata)) {
            $encoded = json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $decoded = is_string($encoded) ? json_decode($encoded, true) : null;
            $normalized = is_array($decoded) ? $decoded : [];
        } else {
            return [];
        }

        return array_filter(
            $normalized,
            static fn($value, $key): bool => is_string($key) && $key !== '' && strpos($key, "\0") === false,
            ARRAY_FILTER_USE_BOTH
        );
    }

    /**
     * Mescla metadados Stripe preservando apenas chaves publicas.
     *
     * @since 1.0.0
     */
    private function mergeStripeMetadata(...$metadataSources): array
    {
        $merged = [];
        foreach ($metadataSources as $metadataSource) {
            $metadata = $this->normalizeStripeMetadata($metadataSource);
            if (!empty($metadata)) {
                $merged = array_merge($merged, $metadata);
            }
        }

        return $merged;
    }

    /**
     * Consolida metadata disponivel em diferentes formatos de webhook de invoice Stripe.
     *
     * @since 1.0.0
     */
    private function extractStripeInvoiceMetadata($invoice, $subscription = null): array
    {
        return $this->mergeStripeMetadata(
            $invoice->metadata ?? [],
            $invoice->subscription_details->metadata ?? [],
            $invoice->parent->subscription_details->metadata ?? [],
            $subscription->metadata ?? []
        );
    }

    /**
     * Processa o webhook de fatura paga no Stripe.
     *
     * @since 1.0.0
     */
    private function handleStripeInvoicePaid($stripe, $invoice, int $eventCreatedAt = 0, $fallbackSubscription = null): void
    {
        $invoice = $this->expandStripeInvoice($stripe, $invoice) ?: $invoice;
        $subscriptionId = $this->resolveStripeInvoiceSubscriptionId($stripe, $invoice, $fallbackSubscription);
        if ($subscriptionId === '') {
            return;
        }

        $previousLocalSubscription = $this->repository->findStripeSubscriptionByProviderId($subscriptionId);
        $wasPastDue = in_array((string) ($previousLocalSubscription['status'] ?? ''), ['past_due', 'incomplete'], true);

        $subscription = is_object($fallbackSubscription)
            && trim((string) ($fallbackSubscription->id ?? '')) === $subscriptionId
            ? $fallbackSubscription
            : $stripe->subscriptions->retrieve($subscriptionId, [
                'expand' => ['latest_invoice.payment_intent', 'latest_invoice.lines.data', 'items.data.price'],
            ]);
        $metadata = $this->extractStripeInvoiceMetadata($invoice, $subscription);
        try {
            $localSubscription = $this->upsertStripeSubscriptionFromWebhook($subscription, $metadata, null, $eventCreatedAt);
        } catch (Throwable $exception) {
            $this->notifyFinancialAdminsAboutStripeInvoiceSyncFailure($invoice, $subscription, $metadata, $exception);
            if ($this->shouldIgnoreUnresolvableStripeSyncFailure($exception)) {
                $this->flagStripeWebhookIgnored(
                    'Webhook Stripe ignorado para conciliacao manual: ' . $exception->getMessage()
                );
                return;
            }
            throw $exception;
        }

        $invoiceAmountCents = max(
            (int) ($invoice->amount_paid ?? 0),
            (int) ($invoice->amount_due ?? 0),
            (int) ($invoice->total ?? 0)
        );
        if ($invoiceAmountCents <= 0) {
            // Invoices de R$ 0,00 apenas confirmam o agendamento/trial no Stripe.
            // Elas nao representam pagamento e nao podem avancar parcelas ou antifraude.
            return;
        }

        if ($this->isStripeInvoiceAlreadyRecordedAsFinal((string) ($invoice->id ?? ''))) {
            return;
        }

        $approvalSnapshot = getStripePaymentApprovalSnapshot(
            $stripe,
            getStripeInvoicePaymentIntentId($invoice),
            $invoice->payment_intent ?? null,
            $subscription,
            $invoice,
            getStripeSubscriptionDefaultPaymentMethodId($subscription)
        );
        $approvalResult = validateStripePaymentForApproval($approvalSnapshot);
        $approvalResult['payment_intent_id'] = (string) ($approvalSnapshot['payment_intent']->id ?? getStripeInvoicePaymentIntentId($invoice));
        $approvalResult['charge_id'] = (string) ($approvalSnapshot['charge']->id ?? '');
        $approvalResult['subscription_id'] = (string) $subscription->id;
        $approvalResult['user_id'] = (string) $localSubscription['user_id'];
        logStripePaymentApprovalAudit('stripe_webhook_invoice_paid', $approvalResult);

        if (!$approvalResult['approved'] && $this->shouldRejectStripeInvoiceAfterApprovalFailure($invoice, $approvalResult)) {
            $blockedAmount = round(((float) ($invoice->amount_paid ?? $invoice->amount_due ?? 0)) / 100, 2);
            rejectStripeSubscriptionAfterFailedApproval(
                $this->db,
                $stripe,
                (string) $subscription->id,
                (string) $localSubscription['user_id'],
                !empty($localSubscription['id']) ? (int) $localSubscription['id'] : null,
                $approvalResult
            );

            createNotification(
                $this->db,
                (string) $localSubscription['user_id'],
                'Cobranca cancelada por seguranca',
                'A cobranca Stripe foi revertida porque falhou na validacao antifraude antes da aprovacao final.',
                'warning',
                'marketplace',
                '/profile?tab=billing',
                null,
                $blockedAmount,
                'Valor bloqueado'
            );

            return;
        }

        if (!$approvalResult['approved']) {
            $this->notifyFinancialAdminsAboutStripeApprovalReview($invoice, $localSubscription, $approvalResult);
        }

        $this->syncStripeInvoiceChargeDescription($stripe, $invoice, $localSubscription, $metadata);
        $billingReason = (string) ($invoice->billing_reason ?? '');
        $invoiceRecorded = $this->recordStripeInvoiceWebhook($invoice, $localSubscription, $metadata);
        $alreadyHadPaidInstallment = (int) ($localSubscription['paid_installments'] ?? 0) > 0;
        $isInitialSubscriptionInvoice = $billingReason === 'subscription_create' && !$alreadyHadPaidInstallment;

        if ($isInitialSubscriptionInvoice) {
            if ($invoiceRecorded || (int) ($localSubscription['paid_installments'] ?? 0) <= 0) {
                $localSubscription = $this->advanceStripeBillingProgress(
                    $stripe,
                    $localSubscription,
                    (string) $subscription->id,
                    false
                );
            }
        } elseif ($invoiceRecorded) {
            $localSubscription = $this->advanceStripeBillingProgress(
                $stripe,
                $localSubscription,
                (string) $subscription->id,
                true
            );
        }

        $localSubscription = $this->refreshStripeRenewalProjection($localSubscription, true);

        $this->updateUserAccessFromStripeSubscription(
            $localSubscription,
            (string) ($metadata['plan_name'] ?? $localSubscription['plan_name'] ?? 'Assinatura')
        );

        $user = $this->repository->findUserById((string) $localSubscription['user_id']);
        $transaction = findStripeTransactionByInvoiceId($this->db, (string) ($invoice->id ?? ''));
        $paidAmount = round(((float) ($invoice->amount_paid ?? 0)) / 100, 2);
        $planName = (string) ($metadata['plan_name'] ?? $localSubscription['plan_name'] ?? 'Assinatura');
        $paidAtTimestamp = 0;
        if (isset($invoice->status_transitions) && is_object($invoice->status_transitions)) {
            $paidAtTimestamp = (int) ($invoice->status_transitions->paid_at ?? 0);
        }

        if ($invoiceRecorded && $user) {
            try {
                sendStripePaymentReceiptEmail($this->db, $user, [
                    'plan_name' => $planName,
                    'interval_unit' => (string) ($localSubscription['interval_unit'] ?? 'month'),
                    'interval_count' => (int) ($localSubscription['interval_count'] ?? 1),
                    'payment_provider' => 'stripe',
                ], $transaction, [
                    'amount' => $paidAmount,
                    'invoice_id' => (string) ($invoice->id ?? ''),
                    'hosted_invoice_url' => (string) ($invoice->hosted_invoice_url ?? ''),
                    'invoice_pdf' => (string) ($invoice->invoice_pdf ?? ''),
                    'paid_at' => $this->formatStripeTimestamp($paidAtTimestamp),
                ]);
            } catch (Throwable $emailError) {
                error_log('Stripe webhook payment receipt email error: ' . $emailError->getMessage());
            }
        }

        if ($invoiceRecorded && $billingReason === 'subscription_create' && $user) {
            try {
                    sendSubscriptionWelcomeEmail($this->db, $user, [
                        'plan_name' => (string) ($metadata['plan_name'] ?? $localSubscription['plan_name'] ?? 'Assinatura'),
                        'interval_unit' => (string) ($localSubscription['interval_unit'] ?? 'month'),
                        'interval_count' => (int) ($localSubscription['interval_count'] ?? 1),
                        'billing_mode' => (string) ($metadata['billing_mode'] ?? (((int) ($localSubscription['total_installments'] ?? 1)) > 1 ? 'term_recurring' : 'single_installment')),
                        'installment_count' => (int) ($metadata['billing_term_cycles'] ?? $localSubscription['total_installments'] ?? 1),
                        'term_total_amount' => (float) ($metadata['final_amount'] ?? ($transaction['amount'] ?? 0)),
                        'first_charge_amount' => (float) ($transaction['amount'] ?? 0),
                        'cycle_charge_amount' => (float) ($metadata['billing_cycle_amount'] ?? ($transaction['amount'] ?? 0)),
                        'payment_provider' => 'stripe',
                        'current_period_end' => (string) ($localSubscription['current_period_end'] ?? ''),
                        'transaction_reference' => (string) ($invoice->id ?? ''),
                    ], $transaction);
            } catch (Throwable $emailError) {
                error_log('Stripe webhook subscription welcome email error: ' . $emailError->getMessage());
            }
        }

        if ($invoiceRecorded) {
            $isRenewalPayment = $billingReason !== 'subscription_create';
            $periodEnd = trim((string) ($localSubscription['current_period_end'] ?? ''));
            $periodEndLabel = $periodEnd !== '' && strtotime($periodEnd)
                ? date('d/m/Y H:i', strtotime($periodEnd))
                : '';
            $paymentMessage = $isRenewalPayment
                ? 'Sua assinatura ' . $planName . ' foi renovada com sucesso por R$ '
                    . number_format($paidAmount, 2, ',', '.')
                    . ($periodEndLabel !== '' ? '. O novo ciclo fica ativo ate ' . $periodEndLabel . '.' : '.')
                : 'Recebemos com sucesso o pagamento de R$ '
                    . number_format($paidAmount, 2, ',', '.')
                    . ' da sua assinatura ' . $planName . '.';

            $notificationCreated = createNotification(
                $this->db,
                (string) $localSubscription['user_id'],
                $isRenewalPayment ? 'Assinatura renovada' : 'Pagamento aprovado',
                $paymentMessage,
                'success',
                'marketplace',
                '/profile/billing',
                null,
                $paidAmount,
                'Valor recebido'
            );
            if (!$notificationCreated) {
                error_log('Stripe webhook payment notification warning: notification not persisted for invoice ' . (string) ($invoice->id ?? ''));
            }

            $this->notifyFinancialAdminsAboutStripeTransaction(
                is_array($transaction) ? $transaction : [],
                $localSubscription,
                $planName,
                $paidAmount,
                (string) ($invoice->id ?? ''),
                $isRenewalPayment
            );

            if ($wasPastDue) {
                createNotification(
                    $this->db,
                    (string) $localSubscription['user_id'],
                    'Assinatura regularizada',
                    'O pagamento pendente foi compensado e seus recursos premium foram liberados novamente.',
                    'success',
                    'marketplace',
                    '/profile/billing',
                    null,
                    $paidAmount,
                    'Valor compensado'
                );
            }
        }
    }

    /**
     * Processa o webhook de falha no pagamento da fatura Stripe.
     *
     * @since 1.0.0
     */
    private function handleStripeInvoicePaymentFailed($stripe, $invoice, int $eventCreatedAt = 0): void
    {
        $invoice = $this->expandStripeInvoice($stripe, $invoice) ?: $invoice;
        $subscriptionId = $this->resolveStripeInvoiceSubscriptionId($stripe, $invoice);
        $localSubscription = $subscriptionId !== ''
            ? $this->repository->findStripeSubscriptionByProviderId($subscriptionId)
            : null;
        $wasPastDue = in_array((string) ($localSubscription['status'] ?? ''), ['past_due', 'incomplete'], true);

        if ($localSubscription) {
            $metadata = [];
            if (!empty($localSubscription['provider_subscription_id'])) {
                try {
                    $subscription = $stripe->subscriptions->retrieve((string) $localSubscription['provider_subscription_id'], [
                        'expand' => ['latest_invoice.payment_intent', 'latest_invoice.lines.data', 'items.data.price'],
                    ]);
                    $metadata = $this->extractStripeInvoiceMetadata($invoice, $subscription);
                    $localSubscription = $this->upsertStripeSubscriptionFromWebhook($subscription, $metadata, null, $eventCreatedAt);
                } catch (Throwable $e) {
                    error_log('Stripe subscription metadata sync warning: ' . $e->getMessage());
                }
            }

            $this->syncStripeInvoiceChargeDescription($stripe, $invoice, $localSubscription, $metadata);
        }

        $this->markStripeInvoiceFailure($invoice, $localSubscription);

        if ($localSubscription && !empty($localSubscription['superseded_by_subscription_id'])) {
            return;
        }

        if ($localSubscription) {
            $failedAmount = round(((float) ($invoice->amount_due ?? 0)) / 100, 2);
            $this->revokeUserAccessFromStripeSubscription($localSubscription);
            $localSubscription['status'] = 'past_due';
            $localSubscription = $this->refreshStripeRenewalProjection($localSubscription, false);

            if (!$wasPastDue) {
                createNotification(
                    $this->db,
                    (string) $localSubscription['user_id'],
                    'Falha no pagamento da assinatura',
                    'Nao foi possivel concluir a cobranca da sua assinatura. Atualize o cartao para desbloquear novamente o acesso.',
                    'warning',
                    'marketplace',
                    '/profile/billing',
                    null,
                    $failedAmount,
                    'Valor não processado'
                );

                $this->notifyAdminsAboutStripePastDue($invoice, $localSubscription);
            }

            $user = $this->repository->findUserById((string) $localSubscription['user_id']);
            if ($user) {
                try {
                    sendStripePaymentFailureEmail($this->db, $user, [
                        'plan_name' => (string) ($localSubscription['plan_name'] ?? 'Assinatura'),
                        'interval_unit' => (string) ($localSubscription['interval_unit'] ?? 'month'),
                        'interval_count' => (int) ($localSubscription['interval_count'] ?? 1),
                        'current_period_end' => (string) ($localSubscription['current_period_end'] ?? ''),
                    ], [
                        'amount' => round(((float) ($invoice->amount_due ?? 0)) / 100, 2),
                        'due_date' => (string) ($localSubscription['current_period_end'] ?? ''),
                    ]);
                } catch (Throwable $emailError) {
                    error_log('Stripe webhook payment failure email error: ' . $emailError->getMessage());
                }
            }
        }
    }

    /**
     * Processa atualizacoes de assinatura Stripe.
     *
     * @since 1.0.0
     */
    private function handleStripeSubscriptionUpdated($subscription, int $eventCreatedAt = 0): void
    {
        $existing = $this->repository->findStripeSubscriptionByProviderId((string) ($subscription->id ?? ''));
        if ($existing && $this->isOutdatedStripeEvent($existing, $eventCreatedAt)) {
            $this->flagStripeWebhookIgnored('Evento Stripe atualizado fora de ordem foi ignorado.');
            return;
        }

        $metadata = $this->normalizeStripeMetadata($subscription->metadata ?? []);
        try {
            $localSubscription = $this->reconcileStripeRemoteSubscriptionState(getStripeClient(), $subscription, $metadata);
        } catch (Throwable $exception) {
            if ($this->shouldIgnoreUnresolvableStripeSyncFailure($exception)) {
                $this->notifyFinancialAdminsAboutStripeSubscriptionSyncFailure($subscription, $metadata, $exception);
                $this->flagStripeWebhookIgnored(
                    'Webhook Stripe ignorado para conciliacao manual: ' . $exception->getMessage()
                );
                return;
            }
            throw $exception;
        }
        if ($eventCreatedAt > 0 && !empty($localSubscription['id'])) {
            $this->db->prepare("
                UPDATE user_subscriptions
                SET provider_last_webhook_event_at = COALESCE(:provider_last_webhook_event_at, provider_last_webhook_event_at)
                WHERE id = :id
            ")->execute([
                ':provider_last_webhook_event_at' => $this->formatStripeTimestamp($eventCreatedAt),
                ':id' => (int) $localSubscription['id'],
            ]);
            $localSubscription['provider_last_webhook_event_at'] = $this->formatStripeTimestamp($eventCreatedAt);
        }

        if (empty($localSubscription['antifraud_blocked']) && in_array($localSubscription['status'], ['active', 'trialing'], true)) {
            $this->updateUserAccessFromStripeSubscription(
                $localSubscription,
                (string) ($metadata['plan_name'] ?? $localSubscription['plan_name'] ?? 'Assinatura')
            );
        }
    }

    /**
     * Processa cancelamento de assinatura Stripe.
     *
     * @since 1.0.0
     */
    private function handleStripeSubscriptionDeleted($subscription, int $eventCreatedAt = 0): void
    {
        $localSubscription = $this->repository->findStripeSubscriptionByProviderId((string) $subscription->id);
        if (!$localSubscription) {
            return;
        }

        if ($this->isOutdatedStripeEvent($localSubscription, $eventCreatedAt)) {
            $this->flagStripeWebhookIgnored('Evento Stripe de cancelamento fora de ordem foi ignorado.');
            return;
        }

        $paidInstallmentPreservation = $this->buildPaidInstallmentPreservationState($localSubscription);
        if ($paidInstallmentPreservation !== null) {
            $snapshotJson = json_encode($paidInstallmentPreservation['snapshot'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $this->db->prepare("
                UPDATE user_subscriptions
                SET status = 'active',
                    provider_subscription_id = NULL,
                    external_subscription_id = NULL,
                    provider_schedule_id = NULL,
                    superseded_by_subscription_id = NULL,
                    auto_renew = 0,
                    cancel_at_period_end = 1,
                    current_period_start = :current_period_start,
                    current_period_end = :current_period_end,
                    provider_current_period_end = :provider_current_period_end,
                    next_renewal_amount = :next_renewal_amount,
                    next_renewal_date = :next_renewal_date,
                    next_renewal_price_source = :next_renewal_price_source,
                    next_renewal_cycle_label = :next_renewal_cycle_label,
                    next_renewal_snapshot_json = :next_renewal_snapshot_json,
                    provider_last_webhook_event_at = COALESCE(:provider_last_webhook_event_at, provider_last_webhook_event_at)
                WHERE id = :id
            ")->execute([
                ':id' => $localSubscription['id'],
                ':current_period_start' => $paidInstallmentPreservation['current_period_start'],
                ':current_period_end' => $paidInstallmentPreservation['current_period_end'],
                ':provider_current_period_end' => $paidInstallmentPreservation['provider_current_period_end'],
                ':next_renewal_amount' => $paidInstallmentPreservation['next_renewal_amount'],
                ':next_renewal_date' => $paidInstallmentPreservation['next_renewal_date'],
                ':next_renewal_price_source' => $paidInstallmentPreservation['next_renewal_price_source'],
                ':next_renewal_cycle_label' => $paidInstallmentPreservation['next_renewal_cycle_label'],
                ':next_renewal_snapshot_json' => $snapshotJson !== false ? $snapshotJson : null,
                ':provider_last_webhook_event_at' => $this->formatStripeTimestamp($eventCreatedAt),
            ]);

            $localSubscription['status'] = 'active';
            $localSubscription['current_period_start'] = $paidInstallmentPreservation['current_period_start'];
            $localSubscription['current_period_end'] = $paidInstallmentPreservation['current_period_end'];
            $localSubscription['provider_current_period_end'] = $paidInstallmentPreservation['provider_current_period_end'];
            $localSubscription['provider_subscription_id'] = null;
            $localSubscription['external_subscription_id'] = null;
            $localSubscription['provider_schedule_id'] = null;
            $localSubscription['superseded_by_subscription_id'] = null;
            $localSubscription['auto_renew'] = 0;
            $localSubscription['cancel_at_period_end'] = 1;
            $localSubscription['next_renewal_amount'] = $paidInstallmentPreservation['next_renewal_amount'];
            $localSubscription['next_renewal_date'] = $paidInstallmentPreservation['next_renewal_date'];
            $localSubscription['next_renewal_price_source'] = $paidInstallmentPreservation['next_renewal_price_source'];
            $localSubscription['next_renewal_cycle_label'] = $paidInstallmentPreservation['next_renewal_cycle_label'];

            setStripeRecurringCardLock($this->db, (string) $localSubscription['user_id'], null);
            $this->updateUserAccessFromStripeSubscription(
                $localSubscription,
                (string) ($localSubscription['plan_name'] ?? 'Assinatura')
            );
            return;
        }

        if ($this->shouldPreserveSettledTermAccess($localSubscription)) {
            $this->db->prepare("
                UPDATE user_subscriptions
                SET provider_subscription_id = NULL,
                    external_subscription_id = NULL,
                    provider_schedule_id = NULL,
                    auto_renew = 0,
                    cancel_at_period_end = 1,
                    next_renewal_amount = NULL,
                    next_renewal_date = NULL,
                    next_renewal_price_source = NULL,
                    next_renewal_cycle_label = NULL,
                    next_renewal_snapshot_json = NULL,
                    provider_last_webhook_event_at = COALESCE(:provider_last_webhook_event_at, provider_last_webhook_event_at)
                WHERE id = :id
            ")->execute([
                ':id' => $localSubscription['id'],
                ':provider_last_webhook_event_at' => $this->formatStripeTimestamp($eventCreatedAt),
            ]);
            setStripeRecurringCardLock($this->db, (string) $localSubscription['user_id'], null);
            return;
        }

        $this->db->prepare("
            UPDATE user_subscriptions
            SET status = 'canceled',
                auto_renew = 0,
                cancel_at_period_end = 0,
                current_period_end = CASE
                    WHEN current_period_end IS NULL OR current_period_end > NOW() THEN NOW()
                    ELSE current_period_end
                END,
                provider_current_period_end = CASE
                    WHEN provider_current_period_end IS NULL OR provider_current_period_end > NOW() THEN NOW()
                    ELSE provider_current_period_end
                END,
                next_renewal_amount = NULL,
                next_renewal_date = NULL,
                next_renewal_price_source = NULL,
                next_renewal_cycle_label = NULL,
                next_renewal_snapshot_json = NULL,
                provider_last_webhook_event_at = COALESCE(:provider_last_webhook_event_at, provider_last_webhook_event_at)
            WHERE id = :id
        ")->execute([
            ':id' => $localSubscription['id'],
            ':provider_last_webhook_event_at' => $this->formatStripeTimestamp($eventCreatedAt),
        ]);
        setStripeRecurringCardLock($this->db, (string) $localSubscription['user_id'], null);
        $this->revokeUserAccessFromStripeSubscription($localSubscription);
    }

    /**
     * Mantem acesso local quando uma assinatura Stripe foi cancelada depois de
     * uma parcela aprovada, mas ainda ha cobertura paga e parcelas futuras.
     *
     * @since 1.0.0
     */
    private function preservePaidInstallmentAccessAfterRemoteCancellation(array $localSubscription, int $eventCreatedAt = 0): ?array
    {
        $paidInstallmentPreservation = $this->buildPaidInstallmentPreservationState($localSubscription);
        if ($paidInstallmentPreservation === null) {
            return null;
        }

        $snapshotJson = json_encode($paidInstallmentPreservation['snapshot'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $this->db->prepare("
            UPDATE user_subscriptions
            SET status = 'active',
                provider_subscription_id = NULL,
                external_subscription_id = NULL,
                provider_schedule_id = NULL,
                superseded_by_subscription_id = NULL,
                auto_renew = 0,
                cancel_at_period_end = 1,
                current_period_start = :current_period_start,
                current_period_end = :current_period_end,
                provider_current_period_end = :provider_current_period_end,
                next_renewal_amount = :next_renewal_amount,
                next_renewal_date = :next_renewal_date,
                next_renewal_price_source = :next_renewal_price_source,
                next_renewal_cycle_label = :next_renewal_cycle_label,
                next_renewal_snapshot_json = :next_renewal_snapshot_json,
                provider_last_webhook_event_at = COALESCE(:provider_last_webhook_event_at, provider_last_webhook_event_at)
            WHERE id = :id
        ")->execute([
            ':id' => (int) $localSubscription['id'],
            ':current_period_start' => $paidInstallmentPreservation['current_period_start'],
            ':current_period_end' => $paidInstallmentPreservation['current_period_end'],
            ':provider_current_period_end' => $paidInstallmentPreservation['provider_current_period_end'],
            ':next_renewal_amount' => $paidInstallmentPreservation['next_renewal_amount'],
            ':next_renewal_date' => $paidInstallmentPreservation['next_renewal_date'],
            ':next_renewal_price_source' => $paidInstallmentPreservation['next_renewal_price_source'],
            ':next_renewal_cycle_label' => $paidInstallmentPreservation['next_renewal_cycle_label'],
            ':next_renewal_snapshot_json' => $snapshotJson !== false ? $snapshotJson : null,
            ':provider_last_webhook_event_at' => $this->formatStripeTimestamp($eventCreatedAt),
        ]);

        $preservedSubscription = $localSubscription;
        $preservedSubscription['status'] = 'active';
        $preservedSubscription['current_period_start'] = $paidInstallmentPreservation['current_period_start'];
        $preservedSubscription['current_period_end'] = $paidInstallmentPreservation['current_period_end'];
        $preservedSubscription['provider_current_period_end'] = $paidInstallmentPreservation['provider_current_period_end'];
        $preservedSubscription['provider_subscription_id'] = null;
        $preservedSubscription['external_subscription_id'] = null;
        $preservedSubscription['provider_schedule_id'] = null;
        $preservedSubscription['superseded_by_subscription_id'] = null;
        $preservedSubscription['auto_renew'] = 0;
        $preservedSubscription['cancel_at_period_end'] = 1;
        $preservedSubscription['next_renewal_amount'] = $paidInstallmentPreservation['next_renewal_amount'];
        $preservedSubscription['next_renewal_date'] = $paidInstallmentPreservation['next_renewal_date'];
        $preservedSubscription['next_renewal_price_source'] = $paidInstallmentPreservation['next_renewal_price_source'];
        $preservedSubscription['next_renewal_cycle_label'] = $paidInstallmentPreservation['next_renewal_cycle_label'];

        setStripeRecurringCardLock($this->db, (string) $preservedSubscription['user_id'], null);
        $this->updateUserAccessFromStripeSubscription(
            $preservedSubscription,
            (string) ($preservedSubscription['plan_name'] ?? 'Assinatura')
        );

        return $preservedSubscription;
    }

    /**
     * Mantem acesso local quando o termo parcelado ja foi integralmente quitado.
     *
     * @since 1.0.0
     */
    private function shouldPreserveSettledTermAccess(array $subscription): bool
    {
        $totalInstallments = max(1, (int) ($subscription['total_installments'] ?? 1));
        $paidInstallments = max(0, (int) ($subscription['paid_installments'] ?? 0));
        $periodEndTimestamp = !empty($subscription['current_period_end'])
            ? strtotime((string) $subscription['current_period_end'])
            : 0;

        return $totalInstallments > 1
            && $paidInstallments >= $totalInstallments
            && empty($subscription['auto_renew'])
            && !empty($subscription['cancel_at_period_end'])
            && $periodEndTimestamp > time();
    }

    /**
     * Preserva acesso ja pago quando a assinatura remota Stripe foi cancelada
     * antes de liquidar todas as parcelas do termo contratado.
     *
     * @since 1.0.0
     */
    private function buildPaidInstallmentPreservationState(array $subscription): ?array
    {
        $userId = trim((string) ($subscription['user_id'] ?? ''));
        $planId = (int) ($subscription['plan_id'] ?? 0);
        $paidInstallments = max(0, (int) ($subscription['paid_installments'] ?? 0));
        $totalInstallments = max(1, (int) ($subscription['total_installments'] ?? 1));

        if ($userId === '' || $planId <= 0 || $paidInstallments <= 0) {
            return null;
        }

        if (!$this->hasApprovedNonRefundedStripePaymentForSubscription($subscription)) {
            return null;
        }

        $startTimestamp = $this->readSubscriptionStartTimestamp($subscription);
        if ($startTimestamp <= 0) {
            return null;
        }

        $planContext = [
            'name' => (string) ($subscription['plan_name'] ?? 'Assinatura'),
            'interval_unit' => (string) ($subscription['interval_unit'] ?? 'month'),
            'interval_count' => max(1, (int) ($subscription['interval_count'] ?? 1)),
        ];

        $termPeriod = calculateSubscriptionPeriodRange(
            (string) $planContext['interval_unit'],
            (int) $planContext['interval_count'],
            $startTimestamp
        );

        $chargeIntervalDays = max(1, getStripeChargeIntervalDays($planContext, $totalInstallments));
        $coveredUntilTimestamp = strtotime('+' . ($chargeIntervalDays * $paidInstallments) . ' days', $startTimestamp);
        $termEndTimestamp = (int) ($termPeriod['end_timestamp'] ?? 0);
        if (!$coveredUntilTimestamp || $coveredUntilTimestamp <= 0) {
            $coveredUntilTimestamp = $termEndTimestamp;
        }

        if ($termEndTimestamp > 0) {
            $coveredUntilTimestamp = min($coveredUntilTimestamp, $termEndTimestamp);
        }

        if ($coveredUntilTimestamp <= time()) {
            return null;
        }

        $hasOpenInstallments = $paidInstallments < $totalInstallments;
        $nextDueAt = $hasOpenInstallments ? date('Y-m-d H:i:s', $coveredUntilTimestamp) : null;
        $nextAmount = $hasOpenInstallments
            ? max(0.0, round((float) ($subscription['recurring_amount'] ?? 0), 2))
            : null;

        return [
            'current_period_start' => date('Y-m-d H:i:s', $startTimestamp),
            'current_period_end' => date('Y-m-d H:i:s', $coveredUntilTimestamp),
            'provider_current_period_end' => date('Y-m-d H:i:s', $coveredUntilTimestamp),
            'next_renewal_amount' => $nextAmount,
            'next_renewal_date' => $nextDueAt,
            'next_renewal_price_source' => $hasOpenInstallments ? 'local_open_installment_after_stripe_cancelled' : null,
            'next_renewal_cycle_label' => $hasOpenInstallments
                ? buildStripeInstallmentLabel($paidInstallments + 1, $totalInstallments)
                : null,
            'snapshot' => [
                'source' => 'stripe_subscription_deleted_preserved_paid_installment',
                'term_start' => date('Y-m-d H:i:s', $startTimestamp),
                'term_end' => date('Y-m-d H:i:s', $termEndTimestamp ?: $coveredUntilTimestamp),
                'covered_until' => date('Y-m-d H:i:s', $coveredUntilTimestamp),
                'paid_installments' => $paidInstallments,
                'total_installments' => $totalInstallments,
                'remaining_installments' => max(0, $totalInstallments - $paidInstallments),
                'remaining_amount' => $hasOpenInstallments
                    ? round($nextAmount * max(0, $totalInstallments - $paidInstallments), 2)
                    : 0.0,
            ],
        ];
    }

    /**
     * Confirma evidência local de pagamento Stripe aprovado e não estornado.
     *
     * @since 1.0.0
     */
    private function hasApprovedNonRefundedStripePaymentForSubscription(array $subscription): bool
    {
        $userId = trim((string) ($subscription['user_id'] ?? ''));
        $planId = (int) ($subscription['plan_id'] ?? 0);
        if ($userId === '' || $planId <= 0) {
            return false;
        }

        $periodStart = trim((string) ($subscription['current_period_start'] ?? $subscription['provider_current_period_start'] ?? $subscription['created_at'] ?? ''));
        $providerCustomerId = trim((string) ($subscription['provider_customer_id'] ?? ''));

        $stmt = $this->db->prepare("
            SELECT COUNT(*)
            FROM transactions
            WHERE user_id = :user_id
              AND plan_id = :plan_id
              AND payment_provider = 'stripe'
              AND status IN ('approved', 'completed', 'paid', 'succeeded')
              AND refunded_at IS NULL
              AND (:provider_customer_id = '' OR provider_customer_id = :provider_customer_id)
              AND (:period_start = '' OR created_at >= DATE_SUB(:period_start, INTERVAL 2 DAY))
        ");
        $stmt->execute([
            ':user_id' => $userId,
            ':plan_id' => $planId,
            ':provider_customer_id' => $providerCustomerId,
            ':period_start' => $periodStart,
        ]);

        return (int) $stmt->fetchColumn() > 0;
    }

    /**
     * Resolve o início confiável do termo local.
     *
     * @since 1.0.0
     */
    private function readSubscriptionStartTimestamp(array $subscription): int
    {
        foreach (['current_period_start', 'provider_current_period_start', 'created_at'] as $key) {
            $value = trim((string) ($subscription[$key] ?? ''));
            if ($value === '') {
                continue;
            }

            $timestamp = strtotime($value);
            if ($timestamp !== false && $timestamp > 0) {
                return $timestamp;
            }
        }

        return 0;
    }

    /**
     * Processa estorno de cobranca Stripe.
     *
     * @since 1.0.0
     */
    private function handleStripeChargeRefunded($charge, int $eventCreatedAt = 0): void
    {
        if (empty($charge->payment_intent)) {
            return;
        }

        $refund = $charge->refunds->data[0] ?? null;
        if (!$refund && !empty($charge->id) && stripeIsConfigured()) {
            try {
                $refunds = getStripeClient()->refunds->all([
                    'charge' => (string) $charge->id,
                    'limit' => 1,
                ]);
                $refund = $refunds->data[0] ?? null;
            } catch (Throwable $refundLookupError) {
                error_log('Stripe charge.refunded refund lookup warning: ' . $refundLookupError->getMessage());
            }
        }

        $refundId = getStripeObjectId($refund);
        if ($refundId === '') {
            error_log('Stripe charge.refunded ignored without refund id for payment_intent ' . (string) $charge->payment_intent);
            return;
        }

        $refundDetails = $refund ? extractStripeRefundDetails($refund) : [];
        $paymentIntentId = (string) $charge->payment_intent;
        $refundResult = [
            'payment_provider' => 'stripe',
            'provider_refund_id' => $refundId,
            'provider_payment_intent_id' => $paymentIntentId,
            'provider_invoice_id' => '',
            'gateway_status' => (string) ($refund->status ?? ''),
            'provider_refund_details' => $refundDetails,
        ];

        $txStmt = $this->db->prepare("
            SELECT *
            FROM transactions
            WHERE provider_payment_intent_id = :provider_payment_intent_id
            ORDER BY id DESC
            LIMIT 1
        ");
        $txStmt->execute([':provider_payment_intent_id' => $paymentIntentId]);
        $transaction = $txStmt->fetch(PDO::FETCH_ASSOC);
        if ($transaction) {
            $refundResult['provider_invoice_id'] = trim((string) ($transaction['provider_invoice_id'] ?? ''));
        }

        $refundAmount = round(((float) ($refund->amount ?? $charge->amount_refunded ?? 0)) / 100, 2);
        $transactionAmount = round((float) ($transaction['amount'] ?? 0), 2);
        $isPartialRefund = $refundAmount > 0 && $transactionAmount > 0 && $refundAmount < $transactionAmount;

        $this->db->prepare("
            UPDATE transactions
            SET status = :status,
                refunded_at = COALESCE(refunded_at, NOW()),
                refunded_amount = CASE
                    WHEN :refund_amount_for_condition > 0 THEN :refund_amount_for_storage
                    ELSE amount
                END,
                provider_refund_id = :provider_refund_id,
                provider_refund_details_json = :provider_refund_details_json
            WHERE provider_payment_intent_id = :provider_payment_intent_id
        ")->execute([
            ':status' => $isPartialRefund ? 'partially_refunded' : 'refunded',
            ':refund_amount_for_condition' => $refundAmount,
            ':refund_amount_for_storage' => $refundAmount,
            ':provider_refund_id' => $refundId,
            ':provider_refund_details_json' => json_encode($refundDetails, JSON_UNESCAPED_UNICODE),
            ':provider_payment_intent_id' => $paymentIntentId,
        ]);

        if ($transaction) {
            FinancialLedger::syncTransactionById($this->db, (int) $transaction['id'], 'stripe_refund_webhook');
        }

        if ($transaction && trim((string) ($transaction['provider_refund_id'] ?? '')) !== $refundId) {
            $this->sendStripeRefundWebhookEmail($transaction, $refundResult);
        }

        if (
            $transaction
            && (($transaction['type'] ?? '') === 'plan' || empty($transaction['material_id']))
            && !empty($transaction['user_id'])
            && !$isPartialRefund
        ) {
            $cancellationResult = cancelStripeSubscriptionImmediatelyAfterRefund($this->db, $transaction, $refundResult);
            if (!empty($cancellationResult['warning'])) {
                error_log('[subscriptions_service] webhook refund cancellation warning: ' . $cancellationResult['warning']);
            }
        }
    }

    /**
     * Envia email sobre estorno recebido via webhook Stripe.
     *
     * @since 1.0.0
     */
    private function sendStripeRefundWebhookEmail(array $transaction, array $refundResult): void
    {
        $user = $this->repository->findUserById((string) $transaction['user_id']);
        if (!$user || empty($user['email'])) {
            return;
        }

        $description = trim((string) (($transaction['plan_name'] ?? '') ?: 'sua assinatura'));
        $content = "Olá {$user['name']},<br><br>"
            . "O reembolso referente a <b>{$description}</b> foi processado pela Stripe.<br><br>"
            . "O valor será devolvido para o mesmo método de pagamento utilizado na compra.<br><br>";

        $refundDetailsHtml = buildRefundEmailDetailsHtml($transaction, $refundResult);
        if ($refundDetailsHtml !== '') {
            $content .= $refundDetailsHtml;
        }

        $bodyHtml = Mailer::htmlTemplate(
            'Reembolso processado',
            $content,
            buildAppHashRoute('/profile', ['tab' => 'billing']),
            'Ver historico'
        );

        $billingUrl = buildAppHashRoute('/profile', ['tab' => 'billing']);
        $template = resolveSystemEmailTemplate(
            'subscription_refund_processed',
            [
                'subject' => 'Reembolso processado',
                'htmlBody' => $bodyHtml,
                'textBody' => "Olá {$user['name']},\n\nSeu reembolso foi processado.\nHistórico: {$billingUrl}",
            ],
            [
                'name' => (string) ($user['name'] ?? ''),
                'email' => (string) ($user['email'] ?? ''),
                'content' => Mailer::htmlToText($content),
                'billing_url' => $billingUrl,
                'app_url' => rtrim((string) (getenv('APP_URL') ?: 'http://localhost:3000'), '/'),
            ],
            $this->db
        );

        if ($template['enabled']) {
            Mailer::send((string) $user['email'], (string) $user['name'], $template['subject'], $template['htmlBody'], $template['textBody']);
        }
    }

    /**
     * Sincroniza a descricao de cobranca da fatura Stripe.
     *
     * @since 1.0.0
     */
    private function syncStripeInvoiceChargeDescription($stripe, $invoice, array $subscriptionRow, array $metadata): string
    {
        $planName = (string) ($metadata['plan_name'] ?? $subscriptionRow['plan_name'] ?? 'Assinatura');
        $billingMode = (string) ($metadata['billing_mode'] ?? ((int) ($subscriptionRow['total_installments'] ?? 1) > 1 ? 'term_recurring' : 'single_installment'));
        $installmentCount = max(1, (int) ($metadata['billing_term_cycles'] ?? $subscriptionRow['total_installments'] ?? 1));
        $billingReason = (string) ($invoice->billing_reason ?? '');
        $paidInstallments = max(0, (int) ($subscriptionRow['paid_installments'] ?? 0));
        $installmentNumber = $billingReason === 'subscription_create'
            ? 1
            : ($paidInstallments >= $installmentCount
                ? 1
                : min($installmentCount, max(1, $paidInstallments + 1)));

        $description = buildStripeChargeDescription($planName, $installmentNumber, $installmentCount, $billingMode);
        $paymentIntentId = getStripeInvoicePaymentIntentId($invoice);

        if ($paymentIntentId !== '') {
            try {
                $stripe->paymentIntents->update($paymentIntentId, [
                    'description' => $description,
                ]);
            } catch (Throwable $e) {
                error_log('Stripe payment description sync warning: ' . $e->getMessage());
            }
        }

        return $description;
    }

    /**
     * Atualiza o acesso do usuario a partir da assinatura Stripe.
     *
     * @since 1.0.0
     */
    private function updateUserAccessFromStripeSubscription(array $subscriptionRow, string $planName): void
    {
        $this->repository->updateUserPlanAssignment(
            (string) $subscriptionRow['user_id'],
            (int) $subscriptionRow['plan_id'],
            canonicalUserPlanValue($planName),
            (string) $subscriptionRow['current_period_end']
        );
    }

    /**
     * Remove o acesso do usuario ao cancelar a assinatura Stripe.
     *
     * @since 1.0.0
     */
    private function revokeUserAccessFromStripeSubscription(array $subscriptionRow): void
    {
        $replacementSubscription = $this->repository->findOtherActiveSubscriptionForUser(
            (string) $subscriptionRow['user_id'],
            (int) ($subscriptionRow['id'] ?? 0)
        );
        if ($replacementSubscription) {
            $this->updateUserAccessFromStripeSubscription(
                $replacementSubscription,
                (string) ($replacementSubscription['plan_name'] ?? 'Assinatura')
            );
            return;
        }

        $this->db->prepare("
            UPDATE users
            SET plan = 'Gratuito',
                current_plan_id = NULL,
                subscription_end = NULL
            WHERE id = :user_id
        ")->execute([
            ':user_id' => $subscriptionRow['user_id'],
        ]);
    }

    /**
     * Cancela no provider contratos antigos substituidos por um upgrade pago.
     * A marcacao local permite que o cron repita o cancelamento caso a Stripe
     * esteja temporariamente indisponivel.
     *
     * @since 1.0.0
     */
    private function cancelSupersededStripeSubscriptions(array $currentSubscription): void
    {
        $currentId = (int) ($currentSubscription['id'] ?? 0);
        $userId = trim((string) ($currentSubscription['user_id'] ?? ''));
        if ($currentId <= 0 || $userId === '') {
            return;
        }

        $stmt = $this->db->prepare("
            SELECT id, provider_subscription_id, status
            FROM user_subscriptions
            WHERE user_id = :user_id
              AND id <> :current_id
              AND id < :current_id
              AND status IN ('active', 'trialing', 'past_due', 'incomplete')
            ORDER BY id ASC
        ");
        $stmt->execute([
            ':user_id' => $userId,
            ':current_id' => $currentId,
        ]);

        foreach (($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) as $previousSubscription) {
            $previousId = (int) ($previousSubscription['id'] ?? 0);
            if ($previousId <= 0) {
                continue;
            }

            $this->db->prepare("
                UPDATE user_subscriptions
                SET status = 'canceled',
                    auto_renew = 0,
                    cancel_at_period_end = 0,
                    superseded_by_subscription_id = :current_id,
                    next_renewal_amount = NULL,
                    next_renewal_date = NULL,
                    next_renewal_price_source = NULL,
                    next_renewal_cycle_label = NULL,
                    next_renewal_snapshot_json = NULL
                WHERE id = :id
            ")->execute([
                ':current_id' => $currentId,
                ':id' => $previousId,
            ]);

            $providerSubscriptionId = trim((string) ($previousSubscription['provider_subscription_id'] ?? ''));
            if ($providerSubscriptionId === '' || !stripeIsConfigured()) {
                continue;
            }

            try {
                getStripeClient()->subscriptions->cancel($providerSubscriptionId, []);
            } catch (Throwable $error) {
                error_log('[subscriptions_service] superseded Stripe cancellation warning: ' . $error->getMessage());
                createAdminNotification(
                    $this->db,
                    'Upgrade exige conciliacao na Stripe',
                    'A assinatura antiga ' . $providerSubscriptionId . ' nao foi cancelada automaticamente. O cron tentara novamente.',
                    'error',
                    'admin',
                    '/admin?tab=finance&section=billing-health'
                );
            }
        }
    }

    /**
     * Sincroniza a assinatura local a partir do webhook Stripe.
     *
     * @since 1.0.0
     */
    private function upsertStripeSubscriptionFromWebhook(
        $stripeSubscription,
        array $metadata,
        ?string $checkoutSessionId = null,
        int $eventCreatedAt = 0
    ): array
    {
        $existing = $this->repository->findStripeSubscriptionByProviderId((string) $stripeSubscription->id);
        $providerCustomerId = getStripeObjectId($stripeSubscription->customer ?? null);
        if (!$existing) {
            $existing = $this->repository->findLatestStripeSubscriptionByCustomerId($providerCustomerId);
        }

        $userId = trim((string) ($metadata['user_id'] ?? ($existing['user_id'] ?? '')));
        $planId = (int) ($metadata['plan_id'] ?? ($existing['plan_id'] ?? 0));
        $user = $userId !== '' ? $this->repository->findUserById($userId) : null;
        if (!$user && $providerCustomerId !== '') {
            $customerUser = $this->repository->findUserByStripeCustomerId($providerCustomerId);
            if ($customerUser) {
                $user = $customerUser;
                $userId = trim((string) ($customerUser['id'] ?? ''));
            }
        }

        if (!$user) {
            $stripeCustomer = $stripeSubscription->customer ?? null;
            $customerEmail = is_object($stripeCustomer)
                ? trim((string) ($stripeCustomer->email ?? ''))
                : '';
            if ($customerEmail !== '') {
                $emailUser = $this->repository->findUserByEmail($customerEmail);
                if ($emailUser) {
                    $user = $emailUser;
                    $userId = trim((string) ($emailUser['id'] ?? ''));
                }
            }
        }

        $stripePrice = $stripeSubscription->items->data[0]->price ?? null;
        $stripePriceId = getStripeObjectId($stripePrice);
        $stripeProductId = is_object($stripePrice) ? getStripeObjectId($stripePrice->product ?? null) : '';
        $stripeIntervalUnit = is_object($stripePrice) && is_object($stripePrice->recurring ?? null)
            ? strtolower(trim((string) ($stripePrice->recurring->interval ?? '')))
            : '';
        $stripeIntervalCount = is_object($stripePrice) && is_object($stripePrice->recurring ?? null)
            ? max(0, (int) ($stripePrice->recurring->interval_count ?? 0))
            : 0;
        $stripeRecurringAmount = getStripeSubscriptionRecurringAmount($stripeSubscription);

        $planRow = $planId > 0 ? $this->repository->findPlanById($planId) : null;
        if (!$planRow) {
            $planRow = $this->repository->findPlanByStripePriceOrProduct($stripePriceId, $stripeProductId);
        }

        if (!$planRow) {
            $planRow = $this->repository->findPlanByNameAndCycle(
                (string) ($metadata['plan_name'] ?? ''),
                $stripeIntervalUnit,
                $stripeIntervalCount
            );
        }

        if (!$planRow) {
            $planRow = $this->repository->findPlanByRecurringAmountAndCycle(
                $stripeRecurringAmount,
                $stripeIntervalUnit,
                $stripeIntervalCount
            );
        }

        if (!$planRow && $userId !== '') {
            $latestStripeSubscription = $this->repository->findLatestStripeSubscriptionForUser($userId);
            $latestProviderCustomerId = trim((string) ($latestStripeSubscription['provider_customer_id'] ?? ''));
            $canReuseLatestStripePlan = $latestStripeSubscription
                && (int) ($latestStripeSubscription['plan_id'] ?? 0) > 0
                && (
                    $providerCustomerId === ''
                    || $latestProviderCustomerId === ''
                    || $latestProviderCustomerId === $providerCustomerId
                );

            if ($canReuseLatestStripePlan) {
                $planRow = $this->repository->findPlanById((int) $latestStripeSubscription['plan_id']);
                if (!$existing && $planRow) {
                    $existing = $latestStripeSubscription;
                }
            }
        }

        if (!$planRow && $userId !== '') {
            $latestManagedSubscription = $this->repository->findLatestManagedSubscription($userId);
            $managedProviderCustomerId = trim((string) ($latestManagedSubscription['provider_customer_id'] ?? ''));
            $managedPaymentProvider = strtolower(trim((string) ($latestManagedSubscription['payment_provider'] ?? '')));
            $userStripeCustomerId = trim((string) ($user['stripe_customer_id'] ?? ''));
            $canReuseManagedPlan = $latestManagedSubscription
                && (int) ($latestManagedSubscription['plan_id'] ?? 0) > 0
                && $managedPaymentProvider === 'stripe'
                && (
                    $managedProviderCustomerId === $providerCustomerId
                    || ($managedProviderCustomerId === '' && $userStripeCustomerId === $providerCustomerId)
                );

            if ($canReuseManagedPlan) {
                $planRow = $this->repository->findPlanById((int) $latestManagedSubscription['plan_id']);
                if (!$existing && $planRow) {
                    $existing = $latestManagedSubscription;
                }
            }
        }

        if (!$planRow && $userId !== '') {
            $currentPlan = $this->repository->findCurrentPlanForUser($userId);
            if ($currentPlan && (int) ($currentPlan['id'] ?? 0) > 0) {
                $planRow = $currentPlan;
            }
        }

        $planId = (int) ($planRow['id'] ?? $planId);
        if ($userId !== '' && trim((string) ($metadata['user_id'] ?? '')) === '') {
            $metadata['user_id'] = $userId;
        }
        if ($planRow) {
            if (trim((string) ($metadata['plan_id'] ?? '')) === '') {
                $metadata['plan_id'] = (string) $planId;
            }
            $metadata['plan_name'] = trim((string) ($metadata['plan_name'] ?? '')) !== ''
                ? (string) $metadata['plan_name']
                : (string) ($planRow['name'] ?? 'Assinatura');
        }

        if ($userId === '' || !$user) {
            throw new RuntimeException('Usuario local nao encontrado para sincronizar assinatura Stripe.');
        }

        if ($planId <= 0) {
            throw new RuntimeException('Metadata incompleta para sincronizar assinatura Stripe.');
        }

        $localStatus = mapStripeSubscriptionStatus((string) $stripeSubscription->status);
        $providerPeriod = $this->extractStripeSubscriptionProviderPeriod(
            $stripeSubscription,
            $stripeSubscription->latest_invoice ?? null
        );
        $providerLastWebhookEventAt = $this->formatStripeTimestamp($eventCreatedAt);
        $remoteCancelAtPeriodEnd = !empty($stripeSubscription->cancel_at_period_end);
        $autoRenew = array_key_exists('auto_renew', $metadata)
            ? ((string) $metadata['auto_renew'] === '1')
            : ($existing
                ? !empty($existing['auto_renew'])
                : !$remoteCancelAtPeriodEnd);
        $recurringAmount = $stripeRecurringAmount;
        if (!$planRow) {
            throw new RuntimeException('Plano nao encontrado ao sincronizar assinatura Stripe.');
        }

        if ($existing && $this->isOutdatedStripeEvent($existing, $eventCreatedAt)) {
            return $existing;
        }

        $termCycles = resolveStripeTermCycleCount($existing, $metadata, $planRow);
        $existingPaidInstallments = max(0, (int) ($existing['paid_installments'] ?? 0));
        $cancelAtPeriodEnd = $remoteCancelAtPeriodEnd
            ? true
            : resolveStripeCancelAtPeriodEnd($autoRenew, $termCycles, $existingPaidInstallments);
        $period = $this->resolveStripeAccessPeriod($planRow, $termCycles, $providerPeriod, $existing);
        $currentPeriodStart = $period['start'];
        $currentPeriodEnd = $period['end'];

        if ($existing) {
            if (!empty($existing['antifraud_blocked'])) {
                $this->db->prepare("
                UPDATE user_subscriptions
                SET user_id = :user_id,
                    plan_id = :plan_id,
                    external_subscription_id = :external_subscription_id,
                    provider_subscription_id = :provider_subscription_id,
                    provider_customer_id = :provider_customer_id,
                    provider_checkout_session_id = COALESCE(:provider_checkout_session_id, provider_checkout_session_id),
                    current_period_start = COALESCE(:current_period_start, current_period_start),
                    current_period_end = COALESCE(:current_period_end, current_period_end),
                    provider_current_period_start = COALESCE(:provider_current_period_start, provider_current_period_start),
                    provider_current_period_end = COALESCE(:provider_current_period_end, provider_current_period_end),
                    provider_last_webhook_event_at = COALESCE(:provider_last_webhook_event_at, provider_last_webhook_event_at),
                    total_installments = :total_installments,
                    recurring_amount = :recurring_amount
                WHERE id = :id
            ")->execute([
                ':user_id' => $userId,
                ':plan_id' => $planId,
                ':external_subscription_id' => (string) $stripeSubscription->id,
                ':provider_subscription_id' => (string) $stripeSubscription->id,
                ':provider_customer_id' => getStripeObjectId($stripeSubscription->customer ?? null),
                ':provider_checkout_session_id' => $checkoutSessionId,
                ':current_period_start' => $currentPeriodStart,
                ':current_period_end' => $currentPeriodEnd,
                ':provider_current_period_start' => $providerPeriod['start'],
                ':provider_current_period_end' => $providerPeriod['end'],
                ':provider_last_webhook_event_at' => $providerLastWebhookEventAt,
                ':total_installments' => $termCycles,
                ':recurring_amount' => $recurringAmount,
                ':id' => $existing['id'],
            ]);

                $existing['user_id'] = $userId;
                $existing['plan_id'] = $planId;
                $existing['provider_subscription_id'] = (string) $stripeSubscription->id;
                $existing['provider_customer_id'] = getStripeObjectId($stripeSubscription->customer ?? null);
                $existing['provider_checkout_session_id'] = $checkoutSessionId;
                $existing['current_period_start'] = $currentPeriodStart;
                $existing['current_period_end'] = $currentPeriodEnd;
                $existing['provider_current_period_start'] = $providerPeriod['start'];
                $existing['provider_current_period_end'] = $providerPeriod['end'];
                $existing['provider_last_webhook_event_at'] = $providerLastWebhookEventAt;
                $existing['total_installments'] = $termCycles;
                $existing['recurring_amount'] = $recurringAmount;
                $existing['status'] = 'canceled';
                return $existing;
            }

            $this->db->prepare("
                UPDATE user_subscriptions
                SET user_id = :user_id,
                    plan_id = :plan_id,
                    status = :status,
                    payment_provider = 'stripe',
                    external_subscription_id = :external_subscription_id,
                    provider_subscription_id = :provider_subscription_id,
                    provider_customer_id = :provider_customer_id,
                    provider_checkout_session_id = COALESCE(:provider_checkout_session_id, provider_checkout_session_id),
                    current_period_start = COALESCE(:current_period_start, current_period_start),
                    current_period_end = COALESCE(:current_period_end, current_period_end),
                    provider_current_period_start = COALESCE(:provider_current_period_start, provider_current_period_start),
                    provider_current_period_end = COALESCE(:provider_current_period_end, provider_current_period_end),
                    provider_last_webhook_event_at = COALESCE(:provider_last_webhook_event_at, provider_last_webhook_event_at),
                    auto_renew = :auto_renew,
                    cancel_at_period_end = :cancel_at_period_end,
                    is_recurring = 1,
                    recurring_amount = :recurring_amount,
                    total_installments = :total_installments
                WHERE id = :id
            ")->execute([
                ':user_id' => $userId,
                ':plan_id' => $planId,
                ':status' => $localStatus,
                ':external_subscription_id' => (string) $stripeSubscription->id,
                ':provider_subscription_id' => (string) $stripeSubscription->id,
                ':provider_customer_id' => getStripeObjectId($stripeSubscription->customer ?? null),
                ':provider_checkout_session_id' => $checkoutSessionId,
                ':current_period_start' => $currentPeriodStart,
                ':current_period_end' => $currentPeriodEnd,
                ':provider_current_period_start' => $providerPeriod['start'],
                ':provider_current_period_end' => $providerPeriod['end'],
                ':provider_last_webhook_event_at' => $providerLastWebhookEventAt,
                ':auto_renew' => $autoRenew ? 1 : 0,
                ':cancel_at_period_end' => $cancelAtPeriodEnd ? 1 : 0,
                ':recurring_amount' => $recurringAmount,
                ':total_installments' => $termCycles,
                ':id' => $existing['id'],
            ]);

            $existing['user_id'] = $userId;
            $existing['plan_id'] = $planId;
            $existing['status'] = $localStatus;
            $existing['interval_unit'] = $planRow['interval_unit'];
            $existing['interval_count'] = $planRow['interval_count'];
            $existing['current_period_start'] = $currentPeriodStart;
            $existing['current_period_end'] = $currentPeriodEnd;
            $existing['provider_current_period_start'] = $providerPeriod['start'];
            $existing['provider_current_period_end'] = $providerPeriod['end'];
            $existing['provider_last_webhook_event_at'] = $providerLastWebhookEventAt;
            $existing['total_installments'] = $termCycles;
            $existing['recurring_amount'] = $recurringAmount;
            $existing['auto_renew'] = $autoRenew ? 1 : 0;
            $existing['cancel_at_period_end'] = $cancelAtPeriodEnd ? 1 : 0;
            return $existing;
        }

        $this->db->prepare("
            INSERT INTO user_subscriptions (
                user_id, plan_id, status, payment_provider, current_period_start, current_period_end,
                external_subscription_id, provider_subscription_id, provider_customer_id, provider_checkout_session_id,
                provider_current_period_start, provider_current_period_end, provider_last_webhook_event_at,
                auto_renew, cancel_at_period_end, is_recurring, recurring_amount, total_installments, paid_installments
            ) VALUES (
                :user_id, :plan_id, :status, 'stripe', :current_period_start, :current_period_end,
                :external_subscription_id, :provider_subscription_id, :provider_customer_id, :provider_checkout_session_id,
                :provider_current_period_start, :provider_current_period_end, :provider_last_webhook_event_at,
                :auto_renew, :cancel_at_period_end, 1, :recurring_amount, :total_installments, 0
            )
        ")->execute([
            ':user_id' => $userId,
            ':plan_id' => $planId,
            ':status' => $localStatus,
            ':current_period_start' => $currentPeriodStart,
            ':current_period_end' => $currentPeriodEnd,
            ':external_subscription_id' => (string) $stripeSubscription->id,
            ':provider_subscription_id' => (string) $stripeSubscription->id,
            ':provider_customer_id' => getStripeObjectId($stripeSubscription->customer ?? null),
            ':provider_checkout_session_id' => $checkoutSessionId,
            ':provider_current_period_start' => $providerPeriod['start'],
            ':provider_current_period_end' => $providerPeriod['end'],
            ':provider_last_webhook_event_at' => $providerLastWebhookEventAt,
            ':auto_renew' => $autoRenew ? 1 : 0,
            ':cancel_at_period_end' => $cancelAtPeriodEnd ? 1 : 0,
            ':recurring_amount' => $recurringAmount,
            ':total_installments' => $termCycles,
        ]);

        return [
            'id' => (int) $this->db->lastInsertId(),
            'user_id' => $userId,
            'plan_id' => $planId,
            'status' => $localStatus,
            'current_period_start' => $currentPeriodStart,
            'current_period_end' => $currentPeriodEnd,
            'provider_subscription_id' => (string) $stripeSubscription->id,
            'plan_name' => $metadata['plan_name'] ?? $planRow['name'] ?? 'Assinatura',
            'price' => isset($planRow['price']) ? (float) $planRow['price'] : 0.0,
            'interval_unit' => $planRow['interval_unit'],
            'interval_count' => $planRow['interval_count'],
            'stripe_product_id' => $planRow['stripe_product_id'] ?? null,
            'total_installments' => $termCycles,
            'paid_installments' => 0,
            'provider_current_period_start' => $providerPeriod['start'],
            'provider_current_period_end' => $providerPeriod['end'],
            'auto_renew' => $autoRenew ? 1 : 0,
            'cancel_at_period_end' => $cancelAtPeriodEnd ? 1 : 0,
            'recurring_amount' => $recurringAmount,
            'provider_schedule_id' => null,
        ];
    }

    /**
     * Atualiza o periodo de acesso local de uma assinatura Stripe.
     *
     * @since 1.0.0
     */
    private function applyLocalStripeAccessPeriod(array $subscriptionRow, bool $isRenewal = false): array
    {
        $planContext = [
            'name' => (string) ($subscriptionRow['plan_name'] ?? ''),
            'interval_unit' => (string) ($subscriptionRow['interval_unit'] ?? 'month'),
            'interval_count' => (int) ($subscriptionRow['interval_count'] ?? 1),
        ];
        $termCycles = max(1, (int) ($subscriptionRow['total_installments'] ?? 1));
        $providerPeriod = [
            'start' => $subscriptionRow['provider_current_period_start'] ?? null,
            'end' => $subscriptionRow['provider_current_period_end'] ?? null,
        ];
        $period = $this->resolveStripeAccessPeriod($planContext, $termCycles, $providerPeriod, $subscriptionRow, $isRenewal);

        $this->db->prepare("
            UPDATE user_subscriptions
            SET current_period_start = :current_period_start,
                current_period_end = :current_period_end
            WHERE id = :id
        ")->execute([
            ':current_period_start' => $period['start'],
            ':current_period_end' => $period['end'],
            ':id' => $subscriptionRow['id'],
        ]);

        $subscriptionRow['current_period_start'] = $period['start'];
        $subscriptionRow['current_period_end'] = $period['end'];
        $this->cancelSupersededStripeSubscriptions($subscriptionRow);
        deactivateOtherUserSubscriptions($this->db, (string) $subscriptionRow['user_id'], (int) $subscriptionRow['id']);

        return $subscriptionRow;
    }

    /**
     * Aplica o periodo remoto autoritativo da Stripe ao contrato local.
     *
     * @since 1.0.0
     */
    private function applyAuthoritativeStripeProviderPeriod(
        array $subscriptionRow,
        array $providerPeriod,
        ?int $eventCreatedAt = null
    ): array {
        $planContext = [
            'name' => (string) ($subscriptionRow['plan_name'] ?? ''),
            'interval_unit' => (string) ($subscriptionRow['interval_unit'] ?? 'month'),
            'interval_count' => (int) ($subscriptionRow['interval_count'] ?? 1),
        ];
        $termCycles = max(1, (int) ($subscriptionRow['total_installments'] ?? 1));
        $period = $this->resolveStripeAccessPeriod($planContext, $termCycles, $providerPeriod, $subscriptionRow);
        $providerLastWebhookEventAt = $this->formatStripeTimestamp((int) ($eventCreatedAt ?? 0));

        $this->db->prepare("
            UPDATE user_subscriptions
            SET current_period_start = :current_period_start,
                current_period_end = :current_period_end,
                provider_current_period_start = COALESCE(:provider_current_period_start, provider_current_period_start),
                provider_current_period_end = COALESCE(:provider_current_period_end, provider_current_period_end),
                provider_last_webhook_event_at = COALESCE(:provider_last_webhook_event_at, provider_last_webhook_event_at)
            WHERE id = :id
        ")->execute([
            ':current_period_start' => $period['start'],
            ':current_period_end' => $period['end'],
            ':provider_current_period_start' => $providerPeriod['start'] ?? null,
            ':provider_current_period_end' => $providerPeriod['end'] ?? null,
            ':provider_last_webhook_event_at' => $providerLastWebhookEventAt,
            ':id' => $subscriptionRow['id'],
        ]);

        $subscriptionRow['current_period_start'] = $period['start'];
        $subscriptionRow['current_period_end'] = $period['end'];
        $subscriptionRow['provider_current_period_start'] = $providerPeriod['start'] ?? ($subscriptionRow['provider_current_period_start'] ?? null);
        $subscriptionRow['provider_current_period_end'] = $providerPeriod['end'] ?? ($subscriptionRow['provider_current_period_end'] ?? null);
        if ($providerLastWebhookEventAt !== null) {
            $subscriptionRow['provider_last_webhook_event_at'] = $providerLastWebhookEventAt;
        }

        $this->cancelSupersededStripeSubscriptions($subscriptionRow);
        deactivateOtherUserSubscriptions($this->db, (string) $subscriptionRow['user_id'], (int) $subscriptionRow['id']);
        return $subscriptionRow;
    }

    /**
     * Reconcilia a assinatura remota e materializa invoice paga quando necessario.
     *
     * @since 1.0.0
     */
    private function reconcileStripeRemoteSubscriptionState($stripe, $remoteSubscription, array $metadata): array
    {
        $localSubscription = $this->upsertStripeSubscriptionFromWebhook($remoteSubscription, $metadata);
        $recoveredDraftInvoice = $this->recoverDraftAutoRenewStripeInvoiceIfNeeded(
            $stripe,
            $remoteSubscription,
            $localSubscription
        );

        if (is_object($recoveredDraftInvoice) && $this->isStripeInvoicePaid($recoveredDraftInvoice)) {
            $this->handleStripeInvoicePaid($stripe, $recoveredDraftInvoice, 0, $remoteSubscription);
            return $this->repository->findStripeSubscriptionByProviderId((string) $remoteSubscription->id) ?: $localSubscription;
        }

        $latestPaidInvoice = $this->resolveLatestPaidStripeInvoice($stripe, $remoteSubscription);

        if (!is_object($latestPaidInvoice)) {
            return $localSubscription;
        }

        $invoiceId = trim((string) ($latestPaidInvoice->id ?? ''));
        $invoiceRecorded = $invoiceId !== '' && findStripeTransactionByInvoiceId($this->db, $invoiceId) !== null;
        $remoteProviderPeriod = $this->extractStripeSubscriptionProviderPeriod($remoteSubscription, $latestPaidInvoice);
        $remoteProviderPeriodEnd = trim((string) ($remoteProviderPeriod['end'] ?? ''));
        $localProviderPeriodEnd = trim((string) ($localSubscription['provider_current_period_end'] ?? ''));
        $localAccessPeriodEnd = trim((string) ($localSubscription['current_period_end'] ?? ''));
        $shouldRefreshPaidInvoice = !$invoiceRecorded;
        $shouldSyncPeriods = $remoteProviderPeriodEnd !== ''
            && ($remoteProviderPeriodEnd !== $localProviderPeriodEnd || $remoteProviderPeriodEnd !== $localAccessPeriodEnd);

        if ($shouldRefreshPaidInvoice) {
            $this->handleStripeInvoicePaid($stripe, $latestPaidInvoice, 0, $remoteSubscription);
            $refreshedSubscription = $this->repository->findStripeSubscriptionByProviderId((string) $remoteSubscription->id);
            return $refreshedSubscription ?: $localSubscription;
        }

        if ($shouldSyncPeriods) {
            $localSubscription = $this->applyAuthoritativeStripeProviderPeriod($localSubscription, $remoteProviderPeriod);
        }

        $localSubscription = $this->refreshStripeRenewalProjection($localSubscription, true);

        if (in_array((string) ($localSubscription['status'] ?? ''), ['active', 'trialing'], true)) {
            $this->updateUserAccessFromStripeSubscription(
                $localSubscription,
                (string) ($metadata['plan_name'] ?? $localSubscription['plan_name'] ?? 'Assinatura')
            );
        } elseif (in_array((string) ($localSubscription['status'] ?? ''), ['past_due', 'incomplete'], true)) {
            $this->revokeUserAccessFromStripeSubscription($localSubscription);
        }

        return $localSubscription;
    }

    /**
     * Avanca o progresso de cobranca e renovacao local da assinatura Stripe.
     *
     * @since 1.0.0
     */
    private function advanceStripeBillingProgress($stripe, array $subscriptionRow, string $providerSubscriptionId, bool $isRenewal): array
    {
        $totalInstallments = max(1, (int) ($subscriptionRow['total_installments'] ?? 1));
        $currentPaidInstallments = max(0, (int) ($subscriptionRow['paid_installments'] ?? 0));
        $autoRenew = !empty($subscriptionRow['auto_renew']);
        $renewalIteration = max(0, (int) ($subscriptionRow['renewal_iteration'] ?? 0));
        $isNewTermRenewal = $isRenewal && $currentPaidInstallments >= $totalInstallments;
        $nextPaidInstallments = $isRenewal
            ? ($isNewTermRenewal ? 1 : max(1, $currentPaidInstallments + 1))
            : max(1, $currentPaidInstallments ?: 1);
        $nextRenewalIteration = $isNewTermRenewal ? ($renewalIteration + 1) : $renewalIteration;

        if ($isRenewal) {
            $providerPeriod = [
                'start' => $subscriptionRow['provider_current_period_start'] ?? null,
                'end' => $subscriptionRow['provider_current_period_end'] ?? null,
            ];
            $hasProviderPeriod = trim((string) ($providerPeriod['start'] ?? '')) !== ''
                && trim((string) ($providerPeriod['end'] ?? '')) !== '';

            // Parcelas do mesmo termo nao aumentam a vigencia. A primeira
            // cobranca de um novo termo, por outro lado, libera uma nova
            // vigencia completa do plano.
            if ($isNewTermRenewal) {
                $subscriptionRow = $this->applyLocalStripeAccessPeriod($subscriptionRow, true);
            } elseif ($hasProviderPeriod) {
                $subscriptionRow = $this->applyAuthoritativeStripeProviderPeriod($subscriptionRow, $providerPeriod);
            }
        }

        $cancelAtPeriodEnd = resolveStripeCancelAtPeriodEnd($autoRenew, $totalInstallments, $nextPaidInstallments) ? 1 : 0;
        $this->db->prepare("
            UPDATE user_subscriptions
            SET paid_installments = :paid_installments,
                renewal_iteration = :renewal_iteration,
                cancel_at_period_end = :cancel_at_period_end
            WHERE id = :id
        ")->execute([
            ':paid_installments' => $nextPaidInstallments,
            ':renewal_iteration' => $nextRenewalIteration,
            ':cancel_at_period_end' => $cancelAtPeriodEnd,
            ':id' => $subscriptionRow['id'],
        ]);

        $subscriptionRow['paid_installments'] = $nextPaidInstallments;
        $subscriptionRow['renewal_iteration'] = $nextRenewalIteration;
        $subscriptionRow['cancel_at_period_end'] = $cancelAtPeriodEnd;

        $shouldCancelAfterCurrentPeriod = !$autoRenew && (bool) $cancelAtPeriodEnd;
        if ($shouldCancelAfterCurrentPeriod && empty($subscriptionRow['provider_subscription_id'])) {
            $subscriptionRow['provider_subscription_id'] = $providerSubscriptionId;
        }

        if ($shouldCancelAfterCurrentPeriod) {
            try {
                $stripe->subscriptions->update($providerSubscriptionId, [
                    'cancel_at_period_end' => true,
                ]);
            } catch (Throwable $e) {
                error_log('Stripe term cancellation sync warning: ' . $e->getMessage());
            }
        } elseif ($autoRenew && !empty($subscriptionRow['cancel_at_period_end'])) {
            try {
                $stripe->subscriptions->update($providerSubscriptionId, [
                    'cancel_at_period_end' => false,
                ]);
            } catch (Throwable $e) {
                error_log('Stripe term renewal sync warning: ' . $e->getMessage());
            }
        }

        return $subscriptionRow;
    }

    /**
     * Registra o pagamento da fatura no webhook Stripe.
     *
     * @since 1.0.0
     */
    private function recordStripeInvoiceWebhook($invoice, array $subscriptionRow, array $metadata): bool
    {
        $invoiceId = (string) $invoice->id;
        $paymentIntentId = getStripeInvoicePaymentIntentId($invoice);

        if ($paymentIntentId === '' && $invoiceId !== '' && stripeIsConfigured()) {
            try {
                $expandedInvoice = getStripeClient()->invoices->retrieve($invoiceId, [
                    'expand' => [
                        'payment_intent',
                        'payments.data.payment.payment_intent',
                    ],
                ]);
                $paymentIntentId = getStripeInvoicePaymentIntentId($expandedInvoice);
                $invoice = $expandedInvoice;
            } catch (Throwable $e) {
                error_log('Stripe invoice payment_intent sync warning: ' . $e->getMessage());
            }
        }

        $check = $this->db->prepare('
            SELECT id, status
            FROM transactions
            WHERE provider_invoice_id = :provider_invoice_id
               OR external_id = :external_id
            LIMIT 1
        ');
        $check->execute([
            ':provider_invoice_id' => $invoiceId,
            ':external_id' => $invoiceId,
        ]);

        $amount = ((float) $invoice->amount_paid) / 100;
        if ($amount <= 0) {
            return false;
        }

        $platformFee = round(($amount * getPlatformFeePercent($this->db)) / 100, 2);
        $totalInstallments = max(1, (int) ($subscriptionRow['total_installments'] ?? 1));
        $paidInstallments = max(0, (int) ($subscriptionRow['paid_installments'] ?? 0));
        $invoiceInstallmentNumber = min($totalInstallments, $paidInstallments + 1);
        $existing = $check->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            $currentStatus = strtolower(trim((string) ($existing['status'] ?? '')));
            if (in_array($currentStatus, ['approved', 'completed', 'refunded', 'partially_refunded'], true)) {
                return false;
            }

            $this->db->prepare("
                UPDATE transactions
                SET status = 'approved',
                    user_subscription_id = COALESCE(user_subscription_id, :user_subscription_id),
                    amount = :amount,
                    platform_fee = :platform_fee,
                    payment_method = 'credit_card',
                    payment_provider = 'stripe',
                    provider_payment_intent_id = :provider_payment_intent_id,
                    provider_invoice_id = :provider_invoice_id,
                    provider_customer_id = :provider_customer_id,
                    plan_id = :plan_id,
                    plan_name = :plan_name,
                    installments = :installments,
                    payer_email = :payer_email,
                    type = 'plan'
                WHERE id = :id
            ")->execute([
                ':user_subscription_id' => (int) ($subscriptionRow['id'] ?? 0) ?: null,
                ':amount' => $amount,
                ':platform_fee' => $platformFee,
                ':provider_payment_intent_id' => $paymentIntentId !== '' ? $paymentIntentId : null,
                ':provider_invoice_id' => $invoiceId,
                ':provider_customer_id' => getStripeObjectId($invoice->customer ?? null),
                ':plan_id' => (int) ($subscriptionRow['plan_id'] ?? 0),
                ':plan_name' => (string) ($metadata['plan_name'] ?? $subscriptionRow['plan_name'] ?? 'Assinatura'),
                ':installments' => $invoiceInstallmentNumber,
                ':payer_email' => (string) ($invoice->customer_email ?: ''),
                ':id' => (int) $existing['id'],
            ]);

            FinancialLedger::syncTransactionById($this->db, (int) $existing['id'], 'stripe_invoice_webhook');

            return true;
        }

        try {
            $this->db->prepare("
                INSERT INTO transactions (
                    external_id, user_id, user_subscription_id, plan_id, plan_name, amount, platform_fee, status, payment_method, payment_provider,
                    provider_payment_intent_id, provider_invoice_id, provider_customer_id, installments,
                    payer_email, type
                ) VALUES (
                    :external_id, :user_id, :user_subscription_id, :plan_id, :plan_name, :amount, :platform_fee, 'approved', 'credit_card', 'stripe',
                    :provider_payment_intent_id, :provider_invoice_id, :provider_customer_id, :installments,
                    :payer_email, 'plan'
                )
            ")->execute([
                ':external_id' => $invoiceId,
                ':user_id' => $subscriptionRow['user_id'],
                ':user_subscription_id' => (int) ($subscriptionRow['id'] ?? 0) ?: null,
                ':plan_id' => (int) ($subscriptionRow['plan_id'] ?? 0),
                ':plan_name' => (string) ($metadata['plan_name'] ?? $subscriptionRow['plan_name'] ?? 'Assinatura'),
                ':amount' => $amount,
                ':platform_fee' => $platformFee,
                ':provider_payment_intent_id' => $paymentIntentId !== '' ? $paymentIntentId : null,
                ':provider_invoice_id' => $invoiceId,
                ':provider_customer_id' => getStripeObjectId($invoice->customer ?? null),
                ':installments' => $invoiceInstallmentNumber,
                ':payer_email' => (string) ($invoice->customer_email ?: ''),
            ]);
            FinancialLedger::syncTransactionById(
                $this->db,
                (int) $this->db->lastInsertId(),
                'stripe_invoice_webhook'
            );
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                return false;
            }
            throw $e;
        }

        $billingReason = (string) ($invoice->billing_reason ?? '');
        if (!empty($metadata['coupon_code']) && $billingReason === 'subscription_create') {
            consumeCouponReservationForStripeInvoice(
                $this->db,
                (string) $metadata['coupon_code'],
                $metadata,
                $invoiceId,
                (string) ($subscriptionRow['provider_subscription_id'] ?? getStripeObjectId($invoice->subscription ?? null))
            );
            incrementCouponUsage($this->db, (string) $metadata['coupon_code']);
        }

        return true;
    }

    /**
     * Evita reprocessar uma invoice Stripe que ja virou transacao local final.
     *
     * @since 1.0.0
     */
    private function isStripeInvoiceAlreadyRecordedAsFinal(string $invoiceId): bool
    {
        $invoiceId = trim($invoiceId);
        if ($invoiceId === '') {
            return false;
        }

        $stmt = $this->db->prepare("
            SELECT id
            FROM transactions
            WHERE (provider_invoice_id = :provider_invoice_id OR external_id = :external_id)
              AND status IN ('approved', 'completed', 'refunded', 'partially_refunded')
            LIMIT 1
        ");
        $stmt->execute([
            ':provider_invoice_id' => $invoiceId,
            ':external_id' => $invoiceId,
        ]);

        return (bool) $stmt->fetchColumn();
    }

    /** Recupera invoices abertas sem uma proxima tentativa remota. */
    private function recoverDueStripeInvoicePayments($stripe): array
    {
        $policy = getStripeInvoiceCollectionRetryPolicy();
        $rows = $this->repository->findDueStripeInvoiceCollectionRetries($policy['maximum_attempts']);
        $summary = [
            'collection_retries_due' => count($rows),
            'collection_retries_attempted' => 0,
            'collection_retries_deferred_to_stripe' => 0,
            'collection_retries_succeeded' => 0,
            'collection_retries_exhausted' => 0,
            'issues' => 0,
            'rows' => [],
        ];

        foreach ($rows as $row) {
            $invoiceId = trim((string) ($row['provider_invoice_id'] ?? ''));
            if ($invoiceId === '') {
                continue;
            }

            $retryRow = [
                'kind' => 'stripe_collection_retry',
                'invoice_id' => $invoiceId,
                'subscription_id' => (int) ($row['subscription_id'] ?? 0),
                'user_id' => (string) ($row['user_id'] ?? ''),
            ];

            try {
                $invoice = $stripe->invoices->retrieve($invoiceId, [
                    'expand' => ['payment_intent', 'lines.data'],
                ]);
                $invoiceStatus = strtolower(trim((string) ($invoice->status ?? '')));
                $attemptCount = max(
                    1,
                    (int) ($row['collection_retry_count'] ?? 0),
                    (int) ($invoice->attempt_count ?? 0)
                );
                $remoteNextAttempt = (int) ($invoice->next_payment_attempt ?? 0);

                if ($invoiceStatus === 'paid' || (int) ($invoice->amount_remaining ?? 1) === 0) {
                    $this->handleStripeInvoicePaid($stripe, $invoice);
                    $this->repository->clearStripeInvoiceCollectionRetry($invoiceId);
                    $summary['collection_retries_succeeded']++;
                    $retryRow['result'] = 'already_paid';
                } elseif ($remoteNextAttempt > (time() + 60)) {
                    $nextRetryAt = date('Y-m-d H:i:s', $remoteNextAttempt);
                    $this->repository->scheduleStripeInvoiceCollectionRetry(
                        $invoiceId,
                        $attemptCount,
                        $nextRetryAt,
                        'stripe_retry_scheduled'
                    );
                    $summary['collection_retries_deferred_to_stripe']++;
                    $retryRow['result'] = 'deferred_to_stripe';
                    $retryRow['next_retry_at'] = $nextRetryAt;
                } elseif (in_array($invoiceStatus, ['void', 'uncollectible'], true)
                    || $attemptCount >= $policy['maximum_attempts']) {
                    $this->repository->clearStripeInvoiceCollectionRetry($invoiceId, 'collection_retry_exhausted');
                    $summary['collection_retries_exhausted']++;
                    $retryRow['result'] = 'exhausted';
                } elseif ($invoiceStatus !== 'open') {
                    $this->repository->clearStripeInvoiceCollectionRetry(
                        $invoiceId,
                        'invoice_not_collectible:' . $invoiceStatus
                    );
                    $retryRow['result'] = 'invoice_not_collectible';
                    $retryRow['invoice_status'] = $invoiceStatus;
                } else {
                    $nextAttemptCount = $attemptCount + 1;
                    $this->repository->scheduleStripeInvoiceCollectionRetry(
                        $invoiceId,
                        $nextAttemptCount,
                        null,
                        null,
                        true
                    );
                    $summary['collection_retries_attempted']++;

                    try {
                        $paidInvoice = $stripe->invoices->pay(
                            $invoiceId,
                            [],
                            ['idempotency_key' => 'invoice_recovery_' . $invoiceId . '_' . $nextAttemptCount]
                        );
                        $paidStatus = strtolower(trim((string) ($paidInvoice->status ?? '')));
                        if ($paidStatus === 'paid' || (int) ($paidInvoice->amount_remaining ?? 1) === 0) {
                            $this->handleStripeInvoicePaid($stripe, $paidInvoice);
                            $this->repository->clearStripeInvoiceCollectionRetry($invoiceId);
                            $summary['collection_retries_succeeded']++;
                            $retryRow['result'] = 'paid';
                        } else {
                            $resolvedAttemptCount = max($nextAttemptCount, (int) ($paidInvoice->attempt_count ?? 0));
                            $nextRetryAt = resolveStripeInvoiceCollectionRetryNextAt(
                                $resolvedAttemptCount,
                                (int) ($paidInvoice->next_payment_attempt ?? 0)
                            );
                            $this->repository->scheduleStripeInvoiceCollectionRetry(
                                $invoiceId,
                                $resolvedAttemptCount,
                                $nextRetryAt,
                                $nextRetryAt === null ? 'collection_retry_exhausted' : 'payment_still_open'
                            );
                            if ($nextRetryAt === null) {
                                $summary['collection_retries_exhausted']++;
                            }
                            $retryRow['result'] = $nextRetryAt === null ? 'exhausted' : 'rescheduled';
                            $retryRow['next_retry_at'] = $nextRetryAt;
                        }
                    } catch (Throwable $paymentError) {
                        $nextRetryAt = resolveStripeInvoiceCollectionRetryNextAt($nextAttemptCount);
                        $this->repository->scheduleStripeInvoiceCollectionRetry(
                            $invoiceId,
                            $nextAttemptCount,
                            $nextRetryAt,
                            $paymentError->getMessage()
                        );
                        if ($nextRetryAt === null) {
                            $summary['collection_retries_exhausted']++;
                        }
                        $retryRow['result'] = $nextRetryAt === null ? 'exhausted' : 'rescheduled_after_failure';
                        $retryRow['next_retry_at'] = $nextRetryAt;
                        $retryRow['error'] = $paymentError->getMessage();
                    }
                }
            } catch (Throwable $error) {
                $summary['issues']++;
                $retryRow['result'] = 'error';
                $retryRow['error'] = $error->getMessage();
            }

            $summary['rows'][] = $retryRow;
            $this->logSubscriptionCron('stripe_collection_retry', $retryRow);
        }

        return $summary;
    }

    /**
     * Registra a falha de pagamento da fatura Stripe.
     *
     * @since 1.0.0
     */
    private function markStripeInvoiceFailure($invoice, ?array $localSubscription): void
    {
        $invoiceId = (string) $invoice->id;
        $paymentIntentId = getStripeInvoicePaymentIntentId($invoice);
        $amountDue = ((float) $invoice->amount_due) / 100;
        $attemptCount = max(1, (int) ($invoice->attempt_count ?? 1));
        $nextRetryAt = resolveStripeInvoiceCollectionRetryNextAt(
            $attemptCount,
            (int) ($invoice->next_payment_attempt ?? 0)
        );

        if ($localSubscription && empty($localSubscription['superseded_by_subscription_id'])) {
            $this->db->prepare("UPDATE user_subscriptions SET status = 'past_due' WHERE id = :id")
                ->execute([':id' => $localSubscription['id']]);
        }

        $existing = $this->repository->findTransactionByProviderInvoiceId($invoiceId);

        if ($existing) {
            $currentStatus = strtolower(trim((string) ($existing['status'] ?? '')));
            if (in_array($currentStatus, ['approved', 'completed', 'refunded'], true)) {
                return;
            }

            $this->repository->markExistingStripeInvoiceTransactionFailed(
                (int) $existing['id'],
                (int) ($localSubscription['id'] ?? 0) ?: null,
                $paymentIntentId !== '' ? $paymentIntentId : null
            );
            $this->repository->scheduleStripeInvoiceCollectionRetry(
                $invoiceId,
                $attemptCount,
                $nextRetryAt,
                $nextRetryAt === null ? 'collection_retry_exhausted' : 'invoice_payment_failed'
            );
            return;
        }

        if (!$localSubscription) {
            return;
        }

        try {
            $this->repository->createFailedStripeInvoiceTransaction([
                'external_id' => $invoiceId,
                'user_id' => $localSubscription['user_id'],
                'user_subscription_id' => (int) ($localSubscription['id'] ?? 0) ?: null,
                'plan_id' => (int) ($localSubscription['plan_id'] ?? 0),
                'plan_name' => (string) ($localSubscription['plan_name'] ?? 'Assinatura'),
                'amount' => $amountDue,
                'provider_payment_intent_id' => $paymentIntentId !== '' ? $paymentIntentId : null,
                'provider_invoice_id' => $invoiceId,
                'provider_customer_id' => getStripeObjectId($invoice->customer ?? null),
                'payer_email' => (string) ($invoice->customer_email ?: ''),
            ]);
            $this->repository->scheduleStripeInvoiceCollectionRetry(
                $invoiceId,
                $attemptCount,
                $nextRetryAt,
                $nextRetryAt === null ? 'collection_retry_exhausted' : 'invoice_payment_failed'
            );
        } catch (PDOException $e) {
            if ($e->getCode() !== '23000') {
                throw $e;
            }
        }
    }

    /**
     * Notifica o financeiro quando uma fatura Stripe vira transacao real.
     *
     * @since 1.0.0
     */
    private function notifyFinancialAdminsAboutStripeTransaction(
        array $transaction,
        array $subscription,
        string $planName,
        float $amount,
        string $invoiceId,
        bool $isRenewalPayment
    ): void {
        $userId = trim((string) ($subscription['user_id'] ?? ''));
        $buyerName = 'Aluno';

        if ($userId !== '') {
            try {
                $user = $this->repository->findUserById($userId);
                if ($user) {
                    $buyerName = trim((string) ($user['name'] ?? $user['email'] ?? 'Aluno')) ?: 'Aluno';
                }
            } catch (Throwable $error) {
                error_log('[subscriptions_service] financial notification user lookup warning: ' . $error->getMessage());
            }
        }

        $transactionId = trim((string) ($transaction['id'] ?? ''));
        $title = $isRenewalPayment ? 'Renovação Stripe confirmada' : 'Nova assinatura confirmada';
        $message = $buyerName . ' pagou ' . trim($planName ?: 'Assinatura')
            . ' no valor de R$ ' . number_format($amount, 2, ',', '.')
            . ($transactionId !== '' ? ' (transação #' . $transactionId . ')' : '')
            . ($invoiceId !== '' ? '. Invoice: ' . $invoiceId . '.' : '.');

        createFinancialAdminNotification(
            $this->db,
            $title,
            $message,
            'success',
            'finance',
            '/admin/finance/transactions',
            'finance_transaction_created',
            $amount,
            $isRenewalPayment ? 'Valor renovado' : 'Valor recebido'
        );

        $this->sendFinancialAdminStripeTransactionEmail(
            $title,
            $message,
            $buyerName,
            $planName,
            $amount,
            $invoiceId
        );
    }

    /**
     * Envia e-mail aos administradores quando uma assinatura Stripe e confirmada.
     *
     * @since 1.0.0
     */
    private function sendFinancialAdminStripeTransactionEmail(
        string $title,
        string $message,
        string $buyerName,
        string $planName,
        float $amount,
        string $invoiceId
    ): void {
        try {
            $stmt = $this->db->query("
                SELECT id, name, email
                FROM users
                WHERE role = 'admin'
                  AND email IS NOT NULL
                  AND email <> ''
                  AND COALESCE(status, 'active') NOT IN ('deleted', 'pending_deletion', 'banned', 'suspended')
            ");
            $admins = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
            if (!$admins) {
                return;
            }

            $adminUrl = getAppBaseUrl() . '/admin/finance/transactions';
            $amountLabel = 'R$ ' . number_format($amount, 2, ',', '.');
            $content = $message . "\n\n"
                . 'Aluno: ' . $buyerName . "\n"
                . 'Plano: ' . $planName . "\n"
                . 'Valor: ' . $amountLabel . "\n"
                . ($invoiceId !== '' ? 'Invoice: ' . $invoiceId . "\n" : '')
                . 'Abra o financeiro para conferir a transação.';

            foreach ($admins as $admin) {
                try {
                    $template = resolveSystemEmailTemplate(
                        'subscription_new_admin',
                        [
                            'subject' => $title . ' - ConcursoMestre',
                            'htmlBody' => '<p>Olá <strong>{{name}}</strong>,</p><p>{{content}}</p>',
                            'textBody' => "Olá {{name}},\n\n{{content}}\n\nAbrir financeiro: {{admin_url}}",
                            'enabled' => true,
                        ],
                        [
                            'name' => (string) ($admin['name'] ?? 'Admin'),
                            'email' => (string) ($admin['email'] ?? ''),
                            'content' => $content,
                            'buyer_name' => $buyerName,
                            'plan_name' => $planName,
                            'amount_label' => $amountLabel,
                            'invoice_id' => $invoiceId,
                            'admin_url' => $adminUrl,
                            'button_url' => $adminUrl,
                            'button_label' => 'Abrir financeiro',
                        ],
                        $this->db
                    );

                    if (!($template['enabled'] ?? true)) {
                        continue;
                    }

                    Mailer::send(
                        (string) $admin['email'],
                        (string) ($admin['name'] ?? 'Admin'),
                        (string) $template['subject'],
                        (string) $template['htmlBody'],
                        (string) $template['textBody']
                    );
                } catch (Throwable $adminEmailError) {
                    error_log('[subscriptions_service] financial admin subscription email recipient error: ' . $adminEmailError->getMessage());
                }
            }
        } catch (Throwable $error) {
            error_log('[subscriptions_service] financial admin subscription email error: ' . $error->getMessage());
        }
    }

    /**
     * Notifica o financeiro quando uma cobranca esperada venceu sem transacao real.
     *
     * @since 1.0.0
     */
    private function notifyFinancialAdminsAboutOverdueStripeRenewal(array $subscription): void
    {
        $planName = trim((string) ($subscription['plan_name'] ?? 'Assinatura')) ?: 'Assinatura';
        $userId = trim((string) ($subscription['user_id'] ?? ''));
        $periodEnd = trim((string) ($subscription['current_period_end'] ?? ''));
        $amount = round((float) ($subscription['next_renewal_amount'] ?? $subscription['recurring_amount'] ?? 0), 2);
        $buyerName = 'Aluno';

        if ($userId !== '') {
            try {
                $user = $this->repository->findUserById($userId);
                if ($user) {
                    $buyerName = trim((string) ($user['name'] ?? $user['email'] ?? 'Aluno')) ?: 'Aluno';
                }
            } catch (Throwable $error) {
                error_log('[subscriptions_service] overdue financial notification user lookup warning: ' . $error->getMessage());
            }
        }

        $message = 'A cobrança esperada da assinatura ' . $planName
            . ' para ' . $buyerName
            . ($periodEnd !== '' ? ' venceu em ' . $periodEnd : ' venceu')
            . ' sem transação Stripe materializada.'
            . ($amount > 0 ? ' Valor previsto: R$ ' . number_format($amount, 2, ',', '.') . '.' : '')
            . ' Verifique o painel financeiro e a Stripe.';

        createFinancialAdminNotification(
            $this->db,
            'Cobrança Stripe vencida sem pagamento',
            $message,
            'warning',
            'finance',
            '/admin/finance/subscriptions',
            'finance_subscription_overdue',
            $amount,
            'Valor em atraso'
        );
    }

    /**
     * Notifica admins quando uma assinatura entra em pendencia financeira.
     *
     * @since 1.0.0
     */
    private function notifyAdminsAboutStripePastDue($invoice, array $localSubscription): void
    {
        $invoiceId = trim((string) ($invoice->id ?? ''));
        $planName = trim((string) ($localSubscription['plan_name'] ?? 'Assinatura'));
        $userId = trim((string) ($localSubscription['user_id'] ?? ''));
        $amountDue = round(((float) ($invoice->amount_due ?? 0)) / 100, 2);
        $link = '/admin/finance/subscriptions';
        if ($invoiceId !== '') {
            $link .= '?invoice=' . rawurlencode($invoiceId);
        }

        createAdminNotification(
            $this->db,
            'Assinatura com pagamento pendente',
            'A cobrança Stripe da assinatura ' . $planName . ' falhou para o usuário ' . $userId . '. Valor pendente: R$ ' . number_format($amountDue, 2, ',', '.') . '.',
            'warning',
            'admin',
            $link,
            null,
            $amountDue,
            'Valor pendente'
        );
    }

    /**
     * Extrai o identificador principal do objeto recebido no webhook Stripe.
     *
     * @since 1.0.0
     */
    private function extractStripeEventObjectId($object): ?string
    {
        $objectId = trim((string) getStripeObjectId($object));
        return $objectId !== '' ? $objectId : null;
    }

    /**
     * Formata um timestamp unix do Stripe para o banco local.
     *
     * @since 1.0.0
     */
    private function formatStripeTimestamp(?int $timestamp): ?string
    {
        $safeTimestamp = (int) ($timestamp ?? 0);
        return $safeTimestamp > 0 ? date('Y-m-d H:i:s', $safeTimestamp) : null;
    }

    /**
     * Extrai o periodo financeiro remoto da assinatura Stripe.
     *
     * @since 1.0.0
     */
    private function extractStripeInvoiceProviderPeriod($invoice): array
    {
        if (!is_object($invoice)) {
            return [
                'start' => null,
                'end' => null,
            ];
        }

        $periodStart = null;
        $periodEnd = null;

        if (isset($invoice->lines->data) && is_iterable($invoice->lines->data)) {
            foreach ($invoice->lines->data as $lineItem) {
                if ($periodStart === null && isset($lineItem->period->start)) {
                    $periodStart = $this->formatStripeTimestamp((int) $lineItem->period->start);
                }
                if ($periodEnd === null && isset($lineItem->period->end)) {
                    $periodEnd = $this->formatStripeTimestamp((int) $lineItem->period->end);
                }

                if ($periodStart !== null && $periodEnd !== null) {
                    break;
                }
            }
        }

        if ($periodStart === null && isset($invoice->period_start)) {
            $periodStart = $this->formatStripeTimestamp((int) $invoice->period_start);
        }
        if ($periodEnd === null && isset($invoice->period_end)) {
            $periodEnd = $this->formatStripeTimestamp((int) $invoice->period_end);
        }

        return [
            'start' => $periodStart,
            'end' => $periodEnd,
        ];
    }

    /**
     * Extrai o periodo financeiro remoto da assinatura Stripe.
     *
     * @since 1.0.0
     */
    private function extractStripeSubscriptionProviderPeriod($stripeSubscription, $invoice = null): array
    {
        $timestamps = getStripeSubscriptionPeriodTimestamps($stripeSubscription);
        $periodStart = $this->formatStripeTimestamp((int) ($timestamps['start'] ?? 0));
        $periodEnd = $this->formatStripeTimestamp((int) ($timestamps['end'] ?? 0));

        if ($periodStart === null || $periodEnd === null) {
            $invoicePeriod = $this->extractStripeInvoiceProviderPeriod(
                $invoice ?: ($stripeSubscription->latest_invoice ?? null)
            );
            if ($periodStart === null) {
                $periodStart = $invoicePeriod['start'];
            }
            if ($periodEnd === null) {
                $periodEnd = $invoicePeriod['end'];
            }
        }

        return [
            'start' => $periodStart,
            'end' => $periodEnd,
        ];
    }

    /**
     * Garante uma invoice Stripe expandida com pagamentos e linhas.
     *
     * @since 1.0.0
     */
    private function expandStripeInvoice($stripe, $invoice)
    {
        $invoiceId = getStripeObjectId($invoice);
        if ($invoiceId === '') {
            return is_object($invoice) ? $invoice : null;
        }

        try {
            return $stripe->invoices->retrieve($invoiceId, [
                'expand' => [
                    'customer',
                    'payment_intent',
                    'payments',
                    'lines.data',
                    'lines.data.price.product',
                ],
            ]);
        } catch (Throwable $exception) {
            error_log('Stripe invoice expand warning: ' . $exception->getMessage());
            return is_object($invoice) ? $invoice : null;
        }
    }

    /**
     * Indica se a invoice Stripe ja representa uma cobranca aprovada.
     *
     * @since 1.0.0
     */
    private function isStripeInvoicePaid($invoice): bool
    {
        $invoiceStatus = is_object($invoice) ? trim((string) ($invoice->status ?? '')) : '';
        $paymentIntentStatus = getStripeInvoicePaymentIntentStatus($invoice);

        return $invoiceStatus === 'paid'
            || (is_object($invoice) && (float) ($invoice->amount_paid ?? 0) > 0)
            || in_array($paymentIntentStatus, ['succeeded', 'processing'], true);
    }

    /**
     * Recupera a invoice com os campos usados pela conciliacao.
     *
     * @since 1.0.0
     */
    private function retrieveStripeInvoiceForReconciliation($stripe, string $invoiceId)
    {
        $safeInvoiceId = trim($invoiceId);
        if ($safeInvoiceId === '') {
            return null;
        }

        return $stripe->invoices->retrieve($safeInvoiceId, [
                'expand' => [
                    'customer',
                    'payment_intent',
                    'payments',
                    'lines.data',
                    'lines.data.price.product',
            ],
        ]);
    }

    /**
     * Recupera invoices de renovacao que a Stripe deixou em rascunho.
     *
     * Para uma assinatura com renovacao ativa, a invoice de `subscription_cycle`
     * precisa ser finalizada/cobrada pela Billing API mesmo que o usuario nao
     * faca login. A automacao e deliberadamente restrita para nao tocar em
     * invoices manuais, cortesia, cancelamento solicitado ou assinatura sem
     * metodo de cobranca automatica.
     *
     * @since 1.0.0
     */
    private function recoverDraftAutoRenewStripeInvoiceIfNeeded($stripe, $remoteSubscription, array $localSubscription)
    {
        $remoteStatus = strtolower(trim((string) ($remoteSubscription->status ?? '')));
        if (!in_array($remoteStatus, ['active', 'trialing', 'past_due'], true)) {
            return null;
        }

        if (empty($localSubscription['auto_renew']) || !empty($localSubscription['cancel_at_period_end'])) {
            return null;
        }

        $invoiceId = getStripeObjectId($remoteSubscription->latest_invoice ?? null);
        if ($invoiceId === '') {
            return null;
        }

        try {
            $invoice = $this->retrieveStripeInvoiceForReconciliation($stripe, $invoiceId);
        } catch (Throwable $exception) {
            error_log('[subscriptions_service] Stripe draft invoice retrieve warning: ' . $exception->getMessage());
            return null;
        }

        if (!is_object($invoice) || strtolower(trim((string) ($invoice->status ?? ''))) !== 'draft') {
            return $invoice;
        }

        $billingReason = strtolower(trim((string) ($invoice->billing_reason ?? '')));
        $collectionMethod = strtolower(trim((string) ($invoice->collection_method ?? '')));
        $amountDue = (float) ($invoice->amount_due ?? 0);
        $invoiceSubscriptionId = getStripeObjectId($invoice->subscription ?? null);
        $remoteSubscriptionId = getStripeObjectId($remoteSubscription);

        if (
            $billingReason !== 'subscription_cycle'
            || $collectionMethod !== 'charge_automatically'
            || $amountDue <= 0
            || ($invoiceSubscriptionId !== '' && $invoiceSubscriptionId !== $remoteSubscriptionId)
        ) {
            return $invoice;
        }

        try {
            $invoice = $stripe->invoices->finalizeInvoice($invoiceId, [
                'auto_advance' => true,
            ]);

            $statusAfterFinalize = strtolower(trim((string) ($invoice->status ?? '')));
            if ($statusAfterFinalize === 'open') {
                $invoice = $stripe->invoices->pay($invoiceId, []);
            }

            return $this->retrieveStripeInvoiceForReconciliation($stripe, $invoiceId);
        } catch (Throwable $exception) {
            $this->notifyFinancialAdminsAboutDraftStripeInvoiceRecoveryFailure($invoice, $localSubscription, $exception);
            error_log('[subscriptions_service] Stripe draft renewal invoice recovery warning: ' . $exception->getMessage());
            return $invoice;
        }
    }

    /**
     * Notifica o financeiro quando uma invoice de renovacao ficou em rascunho e
     * nao pode ser recuperada automaticamente.
     *
     * @since 1.0.0
     */
    private function notifyFinancialAdminsAboutDraftStripeInvoiceRecoveryFailure($invoice, array $localSubscription, Throwable $exception): void
    {
        $invoiceId = trim((string) ($invoice->id ?? ''));
        $planName = trim((string) ($localSubscription['plan_name'] ?? 'Assinatura')) ?: 'Assinatura';
        $userId = trim((string) ($localSubscription['user_id'] ?? ''));
        $amount = round(((float) ($invoice->amount_due ?? 0)) / 100, 2);

        createFinancialAdminNotification(
            $this->db,
            'Renovacao Stripe exige acao',
            'A invoice de renovacao '
                . ($invoiceId !== '' ? $invoiceId : 'sem identificador')
                . ' ficou em rascunho e nao pode ser cobrada automaticamente. '
                . 'Plano: ' . $planName
                . ($userId !== '' ? '. Usuário: ' . $userId : '')
                . ($amount > 0 ? '. Valor: R$ ' . number_format($amount, 2, ',', '.') : '')
                . '. Motivo: ' . $exception->getMessage(),
            'warning',
            'finance',
            '/admin/finance/transactions',
            'finance_stripe_draft_invoice_recovery_failed',
            $amount,
            'Valor pendente'
        );
    }

    /**
     * Decide se uma falha de validacao em webhook deve causar reversao automatica.
     *
     * Uma invoice recebida por `invoice.payment_succeeded` ja representa dinheiro
     * capturado/confirmado pela Stripe. Nesses casos, ausencia de PaymentIntent
     * expandido, CVC nao retornado ou endereco incompleto devem abrir revisao
     * financeira, nao cancelar/reembolsar a assinatura automaticamente.
     *
     * @since 1.0.0
     */
    private function shouldRejectStripeInvoiceAfterApprovalFailure($invoice, array $approvalResult): bool
    {
        if ($this->isStripeInvoicePaid($invoice)) {
            return false;
        }

        $reasonCodes = array_map('strval', (array) ($approvalResult['reason_codes'] ?? []));
        $hardBlockCodes = [
            'radar_blocked_charge',
            'payment_under_review',
            'risk_level_highest',
            'three_d_secure_not_completed',
        ];

        return count(array_intersect($reasonCodes, $hardBlockCodes)) > 0;
    }

    /**
     * Avisa o financeiro quando a Stripe pagou a invoice, mas a validacao local
     * nao conseguiu montar toda a evidencia antifraude esperada.
     *
     * @since 1.0.0
     */
    private function notifyFinancialAdminsAboutStripeApprovalReview($invoice, array $localSubscription, array $approvalResult): void
    {
        $invoiceId = trim((string) ($invoice->id ?? ''));
        $planName = trim((string) ($localSubscription['plan_name'] ?? 'Assinatura')) ?: 'Assinatura';
        $userId = trim((string) ($localSubscription['user_id'] ?? ''));
        $amount = round(((float) ($invoice->amount_paid ?? $invoice->amount_due ?? 0)) / 100, 2);
        $reasons = array_values(array_unique(array_map('strval', (array) ($approvalResult['reason_codes'] ?? []))));
        $reasonText = !empty($reasons) ? implode(', ', $reasons) : 'validacao_local_incompleta';

        createFinancialAdminNotification(
            $this->db,
            'Pagamento Stripe exige revisão',
            'A invoice ' . ($invoiceId !== '' ? $invoiceId : 'sem identificador')
                . ' foi recebida como paga pela Stripe, mas a validação local encontrou pendências: '
                . $reasonText . '. Assinatura: ' . $planName
                . ($userId !== '' ? '. Usuário: ' . $userId : '')
                . ($amount > 0 ? '. Valor: R$ ' . number_format($amount, 2, ',', '.') : '')
                . '. A cobrança foi mantida para evitar perda de receita; confira no painel financeiro.',
            'warning',
            'finance',
            '/admin/finance/transactions',
            'finance_stripe_payment_review',
            $amount,
            'Valor recebido em revisão'
        );
    }

    private function notifyFinancialAdminsAboutStripeInvoiceSyncFailure($invoice, $subscription, array $metadata, Throwable $exception): void
    {
        $invoiceId = trim((string) ($invoice->id ?? ''));
        $subscriptionId = getStripeObjectId($subscription);
        $customerId = getStripeObjectId($subscription->customer ?? $invoice->customer ?? null);
        $metadataUserId = trim((string) ($metadata['user_id'] ?? ''));
        $metadataPlanId = trim((string) ($metadata['plan_id'] ?? ''));
        $amount = round(((float) ($invoice->amount_paid ?? $invoice->amount_due ?? 0)) / 100, 2);
        $diagnosis = $this->describeStripeSyncFailure($exception);

        createFinancialAdminNotification(
            $this->db,
            'Webhook Stripe exige conciliação',
            'A invoice ' . ($invoiceId !== '' ? $invoiceId : 'sem identificador')
                . ' foi recebida, mas nao foi possivel sincronizar a assinatura local automaticamente.'
                . ($subscriptionId !== '' ? ' Assinatura Stripe: ' . $subscriptionId . '.' : '')
                . ($customerId !== '' ? ' Customer: ' . $customerId . '.' : '')
                . ($metadataUserId !== '' ? ' Usuario metadata: ' . $metadataUserId . '.' : '')
                . ($metadataPlanId !== '' ? ' Plano metadata: ' . $metadataPlanId . '.' : '')
                . ($amount > 0 ? ' Valor: R$ ' . number_format($amount, 2, ',', '.') . '.' : '')
                . ' Motivo técnico: ' . $exception->getMessage() . '.'
                . ' Diagnóstico: ' . $diagnosis . '.'
                . ' Ação automática: o evento foi isolado para conciliação e nenhum vínculo local foi criado.',
            'error',
            'finance',
            '/admin/finance/transactions',
            'finance_stripe_invoice_sync_failed',
            $amount,
            'Valor recebido sem sincronização'
        );
    }

    /**
     * Notifica administradores quando uma assinatura Stripe nao possui vinculo local confiavel.
     *
     * @since 1.0.0
     */
    private function notifyFinancialAdminsAboutStripeSubscriptionSyncFailure($subscription, array $metadata, Throwable $exception): void
    {
        $subscriptionId = getStripeObjectId($subscription);
        $customerId = getStripeObjectId($subscription->customer ?? null);
        $metadataUserId = trim((string) ($metadata['user_id'] ?? ''));
        $metadataPlanId = trim((string) ($metadata['plan_id'] ?? ''));
        $diagnosis = $this->describeStripeSyncFailure($exception);

        createFinancialAdminNotification(
            $this->db,
            'Assinatura Stripe exige conciliação',
            'A assinatura Stripe ' . ($subscriptionId !== '' ? $subscriptionId : 'sem identificador')
                . ' foi recebida, mas não foi possível localizar um vínculo local confiável.'
                . ($customerId !== '' ? ' Customer: ' . $customerId . '.' : '')
                . ($metadataUserId !== '' ? ' Usuário metadata: ' . $metadataUserId . '.' : '')
                . ($metadataPlanId !== '' ? ' Plano metadata: ' . $metadataPlanId . '.' : '')
                . ' Motivo técnico: ' . $exception->getMessage() . '.'
                . ' Diagnóstico: ' . $diagnosis . '.'
                . ' Ação automática: a assinatura remota não alterou plano, acesso ou transações locais.',
            'error',
            'finance',
            '/admin/finance/transactions',
            'finance_stripe_subscription_sync_failed'
        );
    }

    /**
     * Traduz falhas tecnicas de vinculo Stripe em um diagnostico operacional.
     *
     * @since 1.0.0
     */
    private function describeStripeSyncFailure(Throwable $exception): string
    {
        $message = strtolower($exception->getMessage());

        if (
            str_contains($message, 'usuario local nao encontrado')
            || str_contains($message, 'usuário local não encontrado')
        ) {
            return 'assinatura órfã ou de teste; o usuário informado na metadata/customer não existe na plataforma';
        }

        if (str_contains($message, 'metadata incompleta')) {
            return 'a Stripe não enviou identificadores locais válidos de usuário e plano';
        }

        if (
            str_contains($message, 'plano nao encontrado')
            || str_contains($message, 'plano não encontrado')
        ) {
            return 'o plano informado pela Stripe não corresponde a um plano ativo do catálogo local';
        }

        return 'o vínculo remoto não passou nas validações de identidade e integridade da plataforma';
    }

    /**
     * Falhas de identidade local irrecuperavel viram conciliacao manual,
     * nao erro HTTP para a Stripe repetir indefinidamente.
     *
     * @since 1.0.0
     */
    private function shouldIgnoreUnresolvableStripeSyncFailure(Throwable $exception): bool
    {
        $message = strtolower($exception->getMessage());

        return str_contains($message, 'usuario local nao encontrado')
            || str_contains($message, 'usuário local não encontrado')
            || str_contains($message, 'metadata incompleta para sincronizar assinatura stripe')
            || str_contains($message, 'plano nao encontrado ao sincronizar assinatura stripe')
            || str_contains($message, 'plano não encontrado ao sincronizar assinatura stripe');
    }

    /**
     * Resolve a invoice paga mais recente da assinatura de forma segura.
     *
     * @since 1.0.0
     */
    private function resolveLatestPaidStripeInvoice($stripe, $stripeSubscription)
    {
        $expandedLatestInvoice = $this->expandStripeInvoice($stripe, $stripeSubscription->latest_invoice ?? null);
        if ($this->isStripeInvoicePaid($expandedLatestInvoice)) {
            return $expandedLatestInvoice;
        }

        $subscriptionId = trim((string) ($stripeSubscription->id ?? ''));
        if ($subscriptionId === '') {
            return null;
        }

        try {
            $invoiceList = $stripe->invoices->all([
                'subscription' => $subscriptionId,
                'limit' => 5,
                'expand' => ['data.payment_intent', 'data.payments', 'data.lines.data'],
            ]);
        } catch (Throwable $exception) {
            error_log('Stripe invoice list warning: ' . $exception->getMessage());
            return $expandedLatestInvoice;
        }

        foreach (($invoiceList->data ?? []) as $candidateInvoice) {
            if ($this->isStripeInvoicePaid($candidateInvoice)) {
                return $candidateInvoice;
            }
        }

        return $this->isStripeInvoicePaid($expandedLatestInvoice) ? $expandedLatestInvoice : null;
    }

    /**
     * Materializa no banco todas as faturas Stripe pagas que ainda nao viraram
     * transacao local. Isso protege a recorrencia quando o usuario nao acessa a
     * plataforma e o cron/webhook precisa manter a base atualizada sozinho.
     *
     * @since 1.0.0
     */
    private function materializeUnrecordedStripePaidInvoices($stripe, $stripeSubscription, int $limit = 100): array
    {
        $subscriptionId = trim((string) ($stripeSubscription->id ?? ''));
        if ($subscriptionId === '') {
            return [
                'count' => 0,
                'invoice_ids' => [],
                'latest_invoice_id' => '',
                'latest_invoice_status' => '',
            ];
        }

        $candidateInvoices = [];
        $latestInvoice = null;

        try {
            $invoiceList = $stripe->invoices->all([
                'subscription' => $subscriptionId,
                'status' => 'paid',
                'limit' => max(1, min(100, $limit)),
                'expand' => ['data.payment_intent', 'data.payments', 'data.lines.data'],
            ]);

            foreach (($invoiceList->data ?? []) as $invoice) {
                if (!is_object($invoice) || !$this->isStripeInvoicePaid($invoice)) {
                    continue;
                }

                if ($latestInvoice === null) {
                    $latestInvoice = $invoice;
                }

                $invoiceId = trim((string) ($invoice->id ?? ''));
                if ($invoiceId === '' || findStripeTransactionByInvoiceId($this->db, $invoiceId) !== null) {
                    continue;
                }

                $candidateInvoices[] = $invoice;
            }
        } catch (Throwable $exception) {
            error_log('Stripe paid invoice reconciliation warning: ' . $exception->getMessage());
        }

        if ($latestInvoice === null) {
            $latestInvoice = $this->resolveLatestPaidStripeInvoice($stripe, $stripeSubscription);
        }

        if (empty($candidateInvoices) && is_object($latestInvoice) && $this->isStripeInvoicePaid($latestInvoice)) {
            $latestInvoiceId = trim((string) ($latestInvoice->id ?? ''));
            if ($latestInvoiceId !== '' && findStripeTransactionByInvoiceId($this->db, $latestInvoiceId) === null) {
                $candidateInvoices[] = $latestInvoice;
            }
        }

        usort($candidateInvoices, function ($left, $right): int {
            return $this->readStripeInvoiceOrderingTimestamp($left) <=> $this->readStripeInvoiceOrderingTimestamp($right);
        });

        $materializedIds = [];
        foreach ($candidateInvoices as $invoice) {
            $invoiceId = trim((string) ($invoice->id ?? ''));
            if ($invoiceId === '') {
                continue;
            }

            $this->handleStripeInvoicePaid($stripe, $invoice, 0, $stripeSubscription);

            if (findStripeTransactionByInvoiceId($this->db, $invoiceId) !== null) {
                $materializedIds[] = $invoiceId;
            }
        }

        return [
            'count' => count($materializedIds),
            'invoice_ids' => $materializedIds,
            'latest_invoice_id' => is_object($latestInvoice) ? trim((string) ($latestInvoice->id ?? '')) : '',
            'latest_invoice_status' => is_object($latestInvoice) ? trim((string) ($latestInvoice->status ?? '')) : '',
        ];
    }

    /**
     * Ordena faturas pagas da Stripe da mais antiga para a mais nova.
     *
     * @since 1.0.0
     */
    private function readStripeInvoiceOrderingTimestamp($invoice): int
    {
        if (is_object($invoice) && isset($invoice->status_transitions) && is_object($invoice->status_transitions)) {
            $paidAt = (int) ($invoice->status_transitions->paid_at ?? 0);
            if ($paidAt > 0) {
                return $paidAt;
            }
        }

        return (int) ($invoice->created ?? 0);
    }

    /**
     * Resolve a assinatura Stripe associada a uma invoice, mesmo em payload parcial.
     *
     * @since 1.0.0
     */
    private function resolveStripeInvoiceSubscriptionId($stripe, $invoice, $fallbackSubscription = null): string
    {
        $subscriptionId = getStripeObjectId($invoice->subscription ?? null);
        if ($subscriptionId !== '') {
            return $subscriptionId;
        }

        $subscriptionId = getStripeObjectId($invoice->parent->subscription_details->subscription ?? null);
        if ($subscriptionId !== '') {
            return $subscriptionId;
        }

        if (is_object($invoice) && isset($invoice->lines->data) && is_iterable($invoice->lines->data)) {
            foreach ($invoice->lines->data as $lineItem) {
                $subscriptionId = getStripeObjectId($lineItem->subscription ?? null);
                if ($subscriptionId !== '') {
                    return $subscriptionId;
                }

                $subscriptionId = getStripeObjectId($lineItem->parent->subscription_item_details->subscription ?? null);
                if ($subscriptionId !== '') {
                    return $subscriptionId;
                }
            }
        }

        $subscriptionId = getStripeObjectId($fallbackSubscription);
        if ($subscriptionId !== '') {
            return $subscriptionId;
        }

        $customerId = getStripeObjectId($invoice->customer ?? null);
        $invoiceId = getStripeObjectId($invoice);
        if ($customerId === '' || $invoiceId === '') {
            return '';
        }

        try {
            $subscriptions = $stripe->subscriptions->all([
                'customer' => $customerId,
                'status' => 'all',
                'limit' => 10,
                'expand' => ['data.latest_invoice'],
            ]);
        } catch (Throwable $exception) {
            error_log('Stripe invoice subscription resolve warning: ' . $exception->getMessage());
            return '';
        }

        foreach (($subscriptions->data ?? []) as $candidateSubscription) {
            $candidateInvoiceId = getStripeObjectId($candidateSubscription->latest_invoice ?? null);
            if ($candidateInvoiceId === $invoiceId) {
                return trim((string) ($candidateSubscription->id ?? ''));
            }
        }

        return '';
    }

    /**
     * Resolve o periodo local priorizando os timestamps remotos da Stripe.
     *
     * @since 1.0.0
     */
    private function resolveStripeAccessPeriod(
        array $planContext,
        int $termCycles,
        array $providerPeriod,
        ?array $existingRow = null,
        bool $isRenewalFallback = false
    ): array {
        $providerStart = trim((string) ($providerPeriod['start'] ?? ''));
        $providerEnd = trim((string) ($providerPeriod['end'] ?? ''));
        $accessInterval = getStripeAccessIntervalConfig($planContext, $termCycles);
        $existingStart = trim((string) ($existingRow['current_period_start'] ?? ''));
        $existingEnd = trim((string) ($existingRow['current_period_end'] ?? ''));

        if ($termCycles > 1) {
            if ($isRenewalFallback) {
                return calculateSubscriptionRenewalPeriodRange(
                    (string) $accessInterval['access_interval_unit'],
                    (int) $accessInterval['access_interval_count'],
                    $existingEnd !== '' ? $existingEnd : null
                );
            }

            if ($existingStart !== '' && $existingEnd !== '') {
                return [
                    'start' => $existingStart,
                    'end' => $existingEnd,
                ];
            }

            $startTimestamp = $providerStart !== '' ? strtotime($providerStart) : time();
            return calculateSubscriptionPeriodRange(
                (string) $accessInterval['access_interval_unit'],
                (int) $accessInterval['access_interval_count'],
                $startTimestamp ?: null
            );
        }

        if ($providerStart !== '' && $providerEnd !== '') {
            return [
                'start' => $providerStart,
                'end' => $providerEnd,
            ];
        }

        if (!$isRenewalFallback && $existingStart !== '' && $existingEnd !== '') {
            return [
                'start' => $existingStart,
                'end' => $existingEnd,
            ];
        }

        if ($isRenewalFallback) {
            return calculateSubscriptionRenewalPeriodRange(
                (string) $accessInterval['access_interval_unit'],
                (int) $accessInterval['access_interval_count'],
                $existingRow['current_period_end'] ?? null
            );
        }

        return calculateSubscriptionPeriodRange(
            (string) $accessInterval['access_interval_unit'],
            (int) $accessInterval['access_interval_count']
        );
    }

    /**
     * Ignora webhooks Stripe fora de ordem quando ja existe evento mais novo salvo.
     *
     * @since 1.0.0
     */
    private function isOutdatedStripeEvent(array $subscriptionRow, int $eventCreatedAt): bool
    {
        if ($eventCreatedAt <= 0) {
            return false;
        }

        $lastWebhookEventAt = trim((string) ($subscriptionRow['provider_last_webhook_event_at'] ?? ''));
        if ($lastWebhookEventAt === '') {
            return false;
        }

        $lastWebhookTimestamp = strtotime($lastWebhookEventAt);
        return $lastWebhookTimestamp !== false && $lastWebhookTimestamp > $eventCreatedAt;
    }

    /**
     * Marca internamente que o evento Stripe atual deve ser tratado como ignorado.
     *
     * @since 1.0.0
     */
    private function flagStripeWebhookIgnored(string $reason): void
    {
        $this->stripeWebhookIgnoreReason = $reason;
    }

    /**
     * Consome a marcacao interna de evento ignorado antes de finalizar o webhook.
     *
     * @since 1.0.0
     */
    private function consumeStripeWebhookIgnoreReason(): ?string
    {
        $reason = $this->stripeWebhookIgnoreReason;
        $this->stripeWebhookIgnoreReason = null;
        return $reason;
    }

    /**
     * Exige um metodo de pagamento real antes de religar a renovacao Stripe.
     *
     * @since 1.0.0
     */
    private function assertStripeRenewalPaymentMethodReady(array $subscription): string
    {
        if (!stripeIsConfigured()) {
            throw new InvalidArgumentException('Stripe nao configurado para religar a renovacao.');
        }

        $stripe = getStripeClient();
        $providerSubscriptionId = trim((string) ($subscription['provider_subscription_id'] ?? ''));
        if ($providerSubscriptionId !== '') {
            $stripeSubscription = $stripe->subscriptions->retrieve(
                $providerSubscriptionId,
                ['expand' => ['default_payment_method', 'customer.invoice_settings.default_payment_method']]
            );

            $defaultPaymentMethodId = getStripeSubscriptionDefaultPaymentMethodId($stripeSubscription);
            if ($defaultPaymentMethodId !== '') {
                return $defaultPaymentMethodId;
            }
        }

        $customerObject = isset($stripeSubscription) ? ($stripeSubscription->customer ?? null) : null;
        $customerDefaultPaymentMethodId = '';
        if (is_object($customerObject)) {
            $customerDefaultPaymentMethodId = getStripeObjectId($customerObject->invoice_settings->default_payment_method ?? null);
        } elseif (!empty($subscription['provider_customer_id'])) {
            $customer = $stripe->customers->retrieve((string) $subscription['provider_customer_id'], []);
            $customerDefaultPaymentMethodId = getStripeObjectId($customer->invoice_settings->default_payment_method ?? null);
        }

        if (trim($customerDefaultPaymentMethodId) === '') {
            throw new InvalidArgumentException('Nenhum cartão padrão foi encontrado no Stripe para religar a renovação automática.');
        }

        return $customerDefaultPaymentMethodId;
    }

    /**
     * Recria, sem cobranca imediata, o vinculo Billing de uma assinatura local
     * preservada depois que o contrato remoto foi encerrado indevidamente.
     *
     * @since 1.0.0
     */
    private function restoreStripeBillingForLocalSubscription(array $subscription): array
    {
        $localSubscriptionId = (int) ($subscription['id'] ?? 0);
        $userId = trim((string) ($subscription['user_id'] ?? ''));
        $planId = (int) ($subscription['plan_id'] ?? 0);
        $customerId = trim((string) ($subscription['provider_customer_id'] ?? ''));
        $productId = trim((string) ($subscription['stripe_product_id'] ?? ''));
        $nextRenewalDate = trim((string) ($subscription['next_renewal_date'] ?? ''));
        $nextRenewalTimestamp = $nextRenewalDate !== '' ? strtotime($nextRenewalDate) : false;
        $nextRenewalAmount = round((float) ($subscription['next_renewal_amount'] ?? $subscription['recurring_amount'] ?? 0), 2);

        if ($localSubscriptionId <= 0 || $userId === '' || $planId <= 0 || $customerId === '' || $productId === '') {
            throw new InvalidArgumentException('A assinatura local nao possui dados suficientes para restaurar a renovacao Stripe.');
        }

        if ($nextRenewalTimestamp === false || $nextRenewalTimestamp <= (time() + 300)) {
            throw new InvalidArgumentException('A proxima cobranca ja venceu ou nao possui data valida. Atualize o pagamento pelo checkout.');
        }

        $amountCents = formatMoneyToCents($nextRenewalAmount);
        if ($amountCents <= 0) {
            throw new InvalidArgumentException('O valor da proxima renovacao nao e valido.');
        }

        $paymentMethodId = $this->assertStripeRenewalPaymentMethodReady($subscription);
        $stripe = getStripeClient();
        $totalInstallments = max(1, (int) ($subscription['total_installments'] ?? 1));
        $paidInstallments = max(0, (int) ($subscription['paid_installments'] ?? 0));
        $chargeInterval = getStripeChargeIntervalConfig([
            'name' => (string) ($subscription['plan_name'] ?? 'Assinatura'),
            'interval_unit' => (string) ($subscription['interval_unit'] ?? 'month'),
            'interval_count' => (int) ($subscription['interval_count'] ?? 1),
        ], $totalInstallments);
        $metadata = [
            'user_id' => $userId,
            'plan_id' => (string) $planId,
            'plan_name' => (string) ($subscription['plan_name'] ?? 'Assinatura'),
            'auto_renew' => '1',
            'billing_mode' => $totalInstallments > 1 ? 'term_recurring' : 'single_installment',
            'billing_term_cycles' => (string) $totalInstallments,
            'billing_commitment_cycles' => (string) getPlanCommitmentCycleCount(
                (string) ($subscription['interval_unit'] ?? 'month'),
                (int) ($subscription['interval_count'] ?? 1),
                (string) ($subscription['plan_name'] ?? '')
            ),
            'billing_selected_installments' => (string) $totalInstallments,
            'billing_cycle_amount' => number_format($nextRenewalAmount, 2, '.', ''),
            'billing_first_charge_amount' => number_format($nextRenewalAmount, 2, '.', ''),
            'final_amount' => number_format($nextRenewalAmount * $totalInstallments, 2, '.', ''),
            'payment_provider' => 'stripe',
            'restored_local_subscription_id' => (string) $localSubscriptionId,
            'restored_paid_installments' => (string) $paidInstallments,
        ];

        $remoteSubscription = null;
        $customerSubscriptions = $stripe->subscriptions->all([
            'customer' => $customerId,
            'status' => 'all',
            'limit' => 20,
        ]);
        foreach (($customerSubscriptions->data ?? []) as $candidate) {
            $candidateMetadata = $this->normalizeStripeMetadata($candidate->metadata ?? []);
            if (
                (string) ($candidateMetadata['restored_local_subscription_id'] ?? '') === (string) $localSubscriptionId
                && in_array(strtolower((string) ($candidate->status ?? '')), ['active', 'trialing', 'past_due'], true)
            ) {
                $remoteSubscription = $candidate;
                break;
            }
        }

        if (!$remoteSubscription) {
            $remoteSubscription = $stripe->subscriptions->create([
                'customer' => $customerId,
                'items' => [[
                    'price_data' => [
                        'currency' => 'brl',
                        'unit_amount' => $amountCents,
                        'product' => $productId,
                        'recurring' => [
                            'interval' => (string) $chargeInterval['charge_interval_unit'],
                            'interval_count' => (int) $chargeInterval['charge_interval_count'],
                        ],
                    ],
                ]],
                'default_payment_method' => $paymentMethodId,
                'payment_settings' => [
                    'save_default_payment_method' => 'on_subscription',
                ],
                'trial_end' => $nextRenewalTimestamp,
                'trial_settings' => [
                    'end_behavior' => [
                        'missing_payment_method' => 'cancel',
                    ],
                ],
                'cancel_at_period_end' => false,
                'metadata' => $metadata,
            ], [
                'idempotency_key' => 'restore_subscription_renewal_' . $localSubscriptionId . '_' . $nextRenewalTimestamp,
            ]);
        }

        $providerSubscriptionId = trim((string) ($remoteSubscription->id ?? ''));
        if ($providerSubscriptionId === '') {
            throw new RuntimeException('A Stripe nao retornou o identificador da assinatura restaurada.');
        }

        $remoteStatus = mapStripeSubscriptionStatus((string) ($remoteSubscription->status ?? 'trialing'));
        $this->db->prepare("
            UPDATE user_subscriptions
            SET status = :status,
                external_subscription_id = :provider_subscription_id,
                provider_subscription_id = :provider_subscription_id,
                provider_customer_id = :provider_customer_id,
                auto_renew = 1,
                cancel_at_period_end = 0,
                is_recurring = 1,
                provider_last_webhook_event_at = NULL
            WHERE id = :id
        ")->execute([
            ':status' => $remoteStatus,
            ':provider_subscription_id' => $providerSubscriptionId,
            ':provider_customer_id' => $customerId,
            ':id' => $localSubscriptionId,
        ]);

        setStripeRecurringCardLock($this->db, $userId, $paymentMethodId);

        return $this->repository->findStripeSubscriptionByProviderId($providerSubscriptionId)
            ?: array_merge($subscription, [
                'status' => $remoteStatus,
                'external_subscription_id' => $providerSubscriptionId,
                'provider_subscription_id' => $providerSubscriptionId,
                'auto_renew' => 1,
                'cancel_at_period_end' => 0,
            ]);
    }

    /**
     * Registra log de execucoes de cron de assinaturas.
     *
     * @since 1.0.0
     */
    private function logSubscriptionCron(string $event, array $payload): void
    {
        @file_put_contents(
            $this->getSubscriptionCronLogPath(),
            date('[Y-m-d H:i:s] ') . $event . ': ' . json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL,
            FILE_APPEND
        );
    }

    /**
     * Persiste o ultimo estado consolidado da reconciliacao Stripe para o admin.
     *
     * @since 1.0.0
     */
    private function writeSubscriptionCronHeartbeat(array $summary, bool $success, string $message): void
    {
        $status = $success
            ? (((int) ($summary['issues'] ?? 0) > 0) ? 'warning' : 'ok')
            : 'error';

        $payload = [
            'last_run_at' => gmdate(DATE_ATOM),
            'status' => $status,
            'success' => $success,
            'message' => $message,
            'checked' => (int) ($summary['checked'] ?? 0),
            'issues' => (int) ($summary['issues'] ?? 0),
            'synced_status' => (int) ($summary['synced_status'] ?? 0),
            'synced_amount' => (int) ($summary['synced_amount'] ?? 0),
            'synced_periods' => (int) ($summary['synced_periods'] ?? 0),
            'materialized_invoices' => (int) ($summary['materialized_invoices'] ?? 0),
            'rows_preview' => array_slice((array) ($summary['rows'] ?? []), 0, 10),
        ];

        @file_put_contents(
            $this->getSubscriptionCronHeartbeatPath(),
            json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );
    }

    /**
     * Le o heartbeat privado do cron e classifica execucoes antigas como stale.
     *
     * @since 1.0.0
     */
    private function readSubscriptionCronHeartbeat(): array
    {
        $path = $this->getSubscriptionCronHeartbeatPath();
        if (!is_file($path)) {
            return [
                'last_run_at' => null,
                'status' => 'unknown',
                'success' => false,
                'message' => 'Nenhuma execucao de reconciliacao Stripe registrada ainda.',
                'checked' => 0,
                'issues' => 0,
            ];
        }

        $raw = @file_get_contents($path);
        $payload = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($payload)) {
            return [
                'last_run_at' => null,
                'status' => 'error',
                'success' => false,
                'message' => 'Heartbeat do cron Stripe invalido.',
                'checked' => 0,
                'issues' => 0,
            ];
        }

        $lastRunTimestamp = !empty($payload['last_run_at'])
            ? strtotime((string) $payload['last_run_at'])
            : false;
        if ($lastRunTimestamp !== false && (time() - $lastRunTimestamp) > 30 * 60) {
            $payload['status'] = 'stale';
            $payload['success'] = false;
            $payload['message'] = 'A reconciliacao Stripe nao roda ha mais de 30 minutos.';
        }

        return $payload;
    }

    /**
     * Persiste o ultimo webhook Stripe valido recebido pelo endpoint oficial.
     *
     * @since 1.0.0
     */
    private function writeStripeWebhookHeartbeat(
        string $eventId,
        string $eventType,
        ?string $objectId,
        int $eventCreatedAt,
        string $status,
        bool $success,
        string $message
    ): void {
        $payload = [
            'last_event_at' => gmdate(DATE_ATOM),
            'status' => $status,
            'success' => $success,
            'message' => $message,
            'event_id' => $eventId,
            'event_type' => $eventType,
            'object_id' => $objectId,
            'event_created_at' => $eventCreatedAt > 0 ? gmdate(DATE_ATOM, $eventCreatedAt) : null,
        ];

        @file_put_contents(
            $this->getStripeWebhookHeartbeatPath(),
            json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );
    }

    /**
     * Le o heartbeat privado do webhook Stripe para o painel admin.
     *
     * @since 1.0.0
     */
    private function readStripeWebhookHeartbeat(): array
    {
        $path = $this->getStripeWebhookHeartbeatPath();
        if (!is_file($path)) {
            return [
                'last_event_at' => null,
                'status' => 'unknown',
                'success' => false,
                'message' => 'Nenhum webhook Stripe registrado ainda.',
            ];
        }

        $raw = @file_get_contents($path);
        $payload = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($payload)) {
            return [
                'last_event_at' => null,
                'status' => 'error',
                'success' => false,
                'message' => 'Heartbeat do webhook Stripe invalido.',
            ];
        }

        return $payload;
    }

    /**
     * Retorna o caminho privado do log de cron de assinaturas.
     *
     * @since 1.0.0
     */
    private function getSubscriptionCronLogPath(): string
    {
        $logDirectory = dirname(__DIR__, 3) . '/storage/logs/subscriptions';
        if (!is_dir($logDirectory)) {
            @mkdir($logDirectory, 0775, true);
        }

        return $logDirectory . '/subscription_cron.log';
    }

    /**
     * Retorna o arquivo privado com o ultimo status consolidado do cron.
     *
     * @since 1.0.0
     */
    private function getSubscriptionCronHeartbeatPath(): string
    {
        $logDirectory = dirname(__DIR__, 3) . '/storage/logs/subscriptions';
        if (!is_dir($logDirectory)) {
            @mkdir($logDirectory, 0775, true);
        }

        return $logDirectory . '/subscription_cron_health.json';
    }

    /**
     * Retorna o arquivo privado com o ultimo status consolidado do webhook Stripe.
     *
     * @since 1.0.0
     */
    private function getStripeWebhookHeartbeatPath(): string
    {
        $logDirectory = dirname(__DIR__, 3) . '/storage/logs/subscriptions';
        if (!is_dir($logDirectory)) {
            @mkdir($logDirectory, 0775, true);
        }

        return $logDirectory . '/stripe_webhook_health.json';
    }

    /**
     * Sincroniza o cancelamento remoto com o provider ativo.
     *
     * @since 1.0.0
     */
    private function syncRemoteCancellation(array $subscription): void
    {
        $paymentProvider = normalizePaymentProvider($subscription['payment_provider'] ?? 'stripe');

        if ($paymentProvider === 'stripe' && !empty($subscription['provider_subscription_id']) && stripeIsConfigured()) {
            try {
                getStripeClient()->subscriptions->cancel((string) $subscription['provider_subscription_id'], []);
            } catch (Throwable $e) {
                error_log('[subscriptions_service] Stripe Cancel Sync Error: ' . $e->getMessage());
            }
        }
    }

    /**
     * Restaura a assinatura local a partir do estado remoto antes de religar a renovacao.
     *
     * @since 1.0.0
     */
    private function resyncLatestStripeSubscriptionForUser(string $userId): ?array
    {
        if (!stripeIsConfigured()) {
            return null;
        }

        $localSubscription = $this->repository->findLatestManagedSubscription($userId);
        if (!$localSubscription) {
            $localSubscription = $this->repository->findLatestStripeSubscriptionForUser($userId);
        }

        if (!$localSubscription || empty($localSubscription['provider_subscription_id'])) {
            return null;
        }

        $stripeSubscription = getStripeClient()->subscriptions->retrieve(
            (string) $localSubscription['provider_subscription_id'],
            ['expand' => ['latest_invoice.payment_intent', 'latest_invoice.lines.data', 'items.data.price']]
        );
        $metadata = $this->normalizeStripeMetadata($stripeSubscription->metadata ?? []);
        $syncedSubscription = $this->reconcileStripeRemoteSubscriptionState(getStripeClient(), $stripeSubscription, $metadata);

        if (in_array((string) ($syncedSubscription['status'] ?? ''), ['active', 'trialing', 'past_due'], true)) {
            $this->updateUserAccessFromStripeSubscription(
                $syncedSubscription,
                (string) ($metadata['plan_name'] ?? $syncedSubscription['plan_name'] ?? 'Assinatura')
            );
        } elseif ((string) ($syncedSubscription['status'] ?? '') === 'canceled') {
            $this->revokeUserAccessFromStripeSubscription($syncedSubscription);
        }

        return $syncedSubscription;
    }

    /**
     * Envia email informando o resultado do cancelamento.
     *
     * @since 1.0.0
     */
    private function sendCancellationOutcomeEmail(
        array $user,
        array $subscription,
        bool $refundProcessed,
        ?array $transaction = null,
        ?array $refundResult = null
    ): void {
        if (empty($user['email'])) {
            return;
        }

        $planName = trim((string) ($subscription['plan_name'] ?? 'sua assinatura'));
        $billingLink = buildAppHashRoute('/profile', ['tab' => 'billing']);

        if ($refundProcessed) {
            $content = 'Ola ' . $user['name'] . ',<br><br>'
                . 'Sua assinatura <b>' . $planName . '</b> foi cancelada com sucesso e o reembolso ja foi solicitado ao gateway de pagamento.<br><br>'
                . 'O estorno sera devolvido para o mesmo metodo utilizado na compra. O prazo final depende da operadora/cartao e pode levar alguns dias uteis.<br><br>';

            $refundDetailsHtml = buildRefundEmailDetailsHtml($transaction, $refundResult);
            if ($refundDetailsHtml !== '') {
                $content .= $refundDetailsHtml . '<br><br>';
            }

            $bodyHtml = Mailer::htmlTemplate(
                'Assinatura cancelada e reembolso processado',
                $content,
                $billingLink,
                'Ver historico'
            );

            $template = resolveSystemEmailTemplate(
                'subscription_cancellation_outcome',
                [
                    'subject' => 'Assinatura cancelada e reembolso processado',
                    'htmlBody' => $bodyHtml,
                    'textBody' => "Olá {$user['name']},\n\nSua assinatura {$planName} foi cancelada com reembolso processado.\nHistórico: {$billingLink}",
                ],
                [
                    'name' => (string) ($user['name'] ?? ''),
                    'email' => (string) ($user['email'] ?? ''),
                    'content' => Mailer::htmlToText($content),
                    'billing_url' => $billingLink,
                    'app_url' => rtrim((string) (getenv('APP_URL') ?: 'http://localhost:3000'), '/'),
                ],
                $this->db
            );

            if ($template['enabled']) {
                Mailer::send(
                    (string) $user['email'],
                    (string) $user['name'],
                    $template['subject'],
                    $template['htmlBody'],
                    $template['textBody']
                );
            }
            return;
        }

        if ($transaction) {
            $content = 'Olá ' . $user['name'] . ',<br><br>'
                . 'Recebemos sua solicitação de cancelamento e reembolso da assinatura <b>' . $planName . '</b>.<br><br>'
                . 'Enquanto o gateway confirma o estorno, o acesso permanece ativo para evitar perda indevida de benefícios.<br><br>'
                . 'Assim que houver confirmação financeira, o histórico será atualizado automaticamente.';

            $bodyHtml = Mailer::htmlTemplate(
                'Solicitação de cancelamento recebida',
                $content,
                $billingLink,
                'Acompanhar historico'
            );

            $template = resolveSystemEmailTemplate(
                'subscription_cancellation_outcome',
                [
                    'subject' => 'Solicitação de cancelamento recebida',
                    'htmlBody' => $bodyHtml,
                    'textBody' => "Olá {$user['name']},\n\nRecebemos sua solicitação de cancelamento da assinatura {$planName}.\nAcompanhe em: {$billingLink}",
                ],
                [
                    'name' => (string) ($user['name'] ?? ''),
                    'email' => (string) ($user['email'] ?? ''),
                    'content' => Mailer::htmlToText($content),
                    'billing_url' => $billingLink,
                    'app_url' => rtrim((string) (getenv('APP_URL') ?: 'http://localhost:3000'), '/'),
                ],
                $this->db
            );

            if ($template['enabled']) {
                Mailer::send(
                    (string) $user['email'],
                    (string) $user['name'],
                    $template['subject'],
                    $template['htmlBody'],
                    $template['textBody']
                );
            }
            return;
        }

        $content = 'Olá ' . $user['name'] . ',<br><br>'
            . 'Sua assinatura <b>' . $planName . '</b> foi cancelada com sucesso.<br><br>'
            . 'Como não havia cobrança financeira vinculada, o acesso foi encerrado imediatamente.';

        $bodyHtml = Mailer::htmlTemplate(
            'Assinatura cancelada',
            $content,
            $billingLink,
            'Acompanhar historico'
        );

        $template = resolveSystemEmailTemplate(
            'subscription_cancellation_outcome',
            [
                'subject' => 'Assinatura cancelada',
                'htmlBody' => $bodyHtml,
                'textBody' => "Olá {$user['name']},\n\nSua assinatura {$planName} foi cancelada.\nAcompanhe em: {$billingLink}",
            ],
            [
                'name' => (string) ($user['name'] ?? ''),
                'email' => (string) ($user['email'] ?? ''),
                'content' => Mailer::htmlToText($content),
                'billing_url' => $billingLink,
                'app_url' => rtrim((string) (getenv('APP_URL') ?: 'http://localhost:3000'), '/'),
            ],
            $this->db
        );

        if ($template['enabled']) {
            Mailer::send(
                (string) $user['email'],
                (string) $user['name'],
                $template['subject'],
                $template['htmlBody'],
                $template['textBody']
            );
        }
    }
}
