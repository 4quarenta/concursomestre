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

require_once __DIR__ . '/../repositories/PaymentsRepository.php';
require_once __DIR__ . '/../validators/PaymentsValidator.php';
require_once __DIR__ . '/../../../config/payment_provider.php';
require_once __DIR__ . '/../../../config/stripe.php';
require_once __DIR__ . '/../../../config/notification_helper.php';
require_once __DIR__ . '/../../../config/gamification_helper.php';

/**
 * Service do dominio de pagamentos.
 * Centraliza checkout, webhooks e verificacoes de cobrana avulsa.
 *
 * @since 1.0.0
 */
class PaymentsService
{
    private ?PDO $db;
    private ?PaymentsRepository $repository;
    private PaymentsValidator $validator;

    /**
     * Monta a orquestracao principal do dominio usada por checkout, webhook e conciliacao.
     *
     * @since 1.0.0
     */
    public function __construct(?PDO $db, ?PaymentsRepository $repository, PaymentsValidator $validator)
    {
        $this->db = $db;
        $this->repository = $repository;
        $this->validator = $validator;
    }

    /**
     * Expõe o parcelamento local padrao para o checkout Stripe-only.
     *
     * @since 1.0.0
     */
    public function getInstallments(array $query): array
    {
        $filters = $this->validator->validateInstallmentsQuery($query);
        if ($filters['amount'] <= 0) {
            return [];
        }

        return [[
            'payment_method_id' => 'card',
            'payer_costs' => [[
                'installments' => 1,
                'installment_rate' => 0,
                'installment_amount' => $filters['amount'],
                'total_amount' => $filters['amount'],
                'recommended_message' => '1x de R$ ' . number_format($filters['amount'], 2, ',', '.') . ' sem juros',
            ]],
        ]];
    }

    /**
     * Exponibiliza a configurao pblica minima usada pelo checkout.
     *
     * @since 1.0.0
     */
    public function getClientConfig(): array
    {
        $repository = $this->requireRepository();
        $publishableKey = isValidStripePublishableKey(STRIPE_PUBLISHABLE_KEY)
            ? (string) STRIPE_PUBLISHABLE_KEY
            : '';

        return [
            'publishableKey' => $publishableKey,
            'platformFeePercent' => $repository->getPlatformFeePercent(),
            'stripeConfigured' => $publishableKey !== '' && stripeIsConfigured(),
        ];
    }

    /**
     * Processa a compra avulsa do material usando a sesso como fonte de verdade.
     *
     * @since 1.0.0
     */
    public function processMaterialPayment(string $authenticatedUserId, array $payload): array
    {
        throw new RuntimeException('O checkout de materiais permanece pausado ate a entrada do fluxo Stripe oficial.');
    }

    /**
     * Cria ou reaproveita a conta conectada Stripe do vendedor logado.
     * Mantemos o fluxo legado de onboarding Express para preservar compatibilidade atual.
     *
     * @since 1.0.0
     */
    public function createStripeConnectAccount(string $authenticatedUserId, array $payload): array
    {
        $repository = $this->requireRepository();
        $data = $this->validator->validateCreateConnectAccountPayload($payload, $authenticatedUserId);

        if (!stripeIsConfigured()) {
            throw new RuntimeException('Stripe no configurado neste ambiente.');
        }

        $user = $repository->findUserById($data['user_id']);
        if (!$user) {
            throw new OutOfBoundsException('Usurio no encontrado.');
        }

        $email = trim((string) ($user['email'] ?? ''));
        if ($email === '') {
            throw new RuntimeException('O usurio precisa ter email para iniciar o onboarding Stripe.');
        }

        $stripe = getStripeClient();
        $accountId = trim((string) ($user['stripe_account_id'] ?? ''));

        if ($accountId === '') {
            $account = $stripe->accounts->create([
                'type' => 'express',
                'country' => 'BR',
                'email' => $email,
                'metadata' => [
                    'user_id' => (string) $user['id'],
                ],
                'capabilities' => [
                    'card_payments' => ['requested' => true],
                    'transfers' => ['requested' => true],
                ],
            ]);

            $accountId = trim((string) ($account->id ?? ''));
            if ($accountId === '') {
                throw new RuntimeException('O Stripe no retornou uma conta conectada valida.');
            }

            $repository->updateUserStripeAccountId((string) $user['id'], $accountId);
        }

        $refreshUrl = $data['refresh_url'] !== ''
            ? $data['refresh_url']
            : buildAppHashRoute('/marketplace', ['onboarding' => 'refresh']);
        $returnUrl = $data['return_url'] !== ''
            ? $data['return_url']
            : buildAppHashRoute('/marketplace', ['onboarding' => 'success']);

        $accountLink = $stripe->accountLinks->create([
            'account' => $accountId,
            'refresh_url' => $refreshUrl,
            'return_url' => $returnUrl,
            'type' => 'account_onboarding',
        ]);

        return [
            'accountId' => $accountId,
            'onboardingUrl' => (string) ($accountLink->url ?? ''),
        ];
    }

    /**
     * Faz a verificacao tardia de um PaymentIntent do Stripe para liberar o material.
     *
     * @since 1.0.0
     */
    public function verifyStripePayment(array $query, string $authenticatedUserId): array
    {
        $repository = $this->requireRepository();
        $filters = $this->validator->validateVerifyPaymentQuery($query);
        $authenticatedUserId = trim($authenticatedUserId);
        if ($authenticatedUserId === '') {
            throw new InvalidArgumentException('Sessao invalida para verificar pagamento.');
        }

        $stripe = getStripeClient();
        $paymentIntent = $stripe->paymentIntents->retrieve($filters['payment_intent'], []);

        if (($paymentIntent->status ?? '') !== 'succeeded') {
            return [
                'approved' => false,
                'status' => (string) ($paymentIntent->status ?? 'unknown'),
                'message' => 'Payment not succeeded yet',
            ];
        }

        $existingTransaction = $repository->findTransactionByProviderPaymentIntentId($filters['payment_intent']);
        $materialId = trim((string) ($paymentIntent->metadata->material_id ?? ($existingTransaction['material_id'] ?? '')));
        $userId = trim((string) ($paymentIntent->metadata->user_id ?? ($existingTransaction['user_id'] ?? '')));

        if ($materialId === '' || $userId === '') {
            throw new OutOfBoundsException('Transaction metadata not found');
        }

        if (!hash_equals($authenticatedUserId, $userId)) {
            throw new InvalidArgumentException('Pagamento nao pertence ao usuario autenticado.');
        }

        $material = $repository->findMaterialById($materialId);
        if (!$material) {
            throw new OutOfBoundsException('Material no encontrado para o pagamento verificado.');
        }

        $user = $repository->findUserById($userId);
        if (!$user) {
            throw new OutOfBoundsException('Usurio no encontrado para o pagamento verificado.');
        }

        $paymentMethod = 'unknown';
        if (!empty($paymentIntent->payment_method_types) && is_array($paymentIntent->payment_method_types)) {
            $paymentMethod = (string) ($paymentIntent->payment_method_types[0] ?? 'unknown');
        }

        $chargesCollection = $paymentIntent->charges->data ?? [];
        $firstCharge = (is_array($chargesCollection) && !empty($chargesCollection)) ? $chargesCollection[0] : null;
        $amount = round(((float) ($paymentIntent->amount_received ?? $paymentIntent->amount ?? 0)) / 100, 2);
        if ($amount <= 0) {
            $amount = round((float) ($material['price'] ?? 0), 2);
        }

        $transactionPayload = $this->buildMaterialTransactionPayload($material, $user, [
            'external_id' => trim((string) ($firstCharge->id ?? $paymentIntent->id ?? $filters['payment_intent'])),
            'status' => 'approved',
            'payment_method' => $paymentMethod,
            'payment_provider' => 'stripe',
            'provider_payment_intent_id' => $filters['payment_intent'],
            'provider_customer_id' => (string) ($paymentIntent->customer ?? ''),
            'installments' => 1,
            'amount' => $amount,
            'payer_email' => (string) ($paymentIntent->receipt_email ?? ($user['email'] ?? '')),
        ]);

        $this->persistTransactionByProviderPaymentIntentId($filters['payment_intent'], $transactionPayload);

        return [
            'approved' => true,
            'status' => 'approved',
            'message' => 'Payment verified and access granted',
            'materialId' => $materialId,
        ];
    }

    /**
     * Garante que operaes com banco so rodem quando o modulo foi montado com repositorio.
     *
     * @since 1.0.0
     */
    private function requireRepository(): PaymentsRepository
    {
        if (!$this->repository) {
            throw new RuntimeException('Repositorio de pagamentos indisponivel para esta operao.');
        }

        return $this->repository;
    }

    /**
     * Normaliza aliases de bandeira usados pelo frontend ou pela API do MP.
     *
     * @since 1.0.0
     */
    private function normalizePaymentMethodId(string $paymentMethodId): string
    {
        if ($paymentMethodId === '') {
            return '';
        }

        $normalized = strtolower(trim($paymentMethodId));
        $aliases = [
            'mastercard' => 'master',
            'master' => 'master',
            'american express' => 'amex',
            'americanexpress' => 'amex',
            'diners club' => 'diners',
            'dinersclub' => 'diners',
        ];

        return $aliases[$normalized] ?? $normalized;
    }

    /**
     * Persiste a transao por `external_id` sem duplicar vendas contabilizadas.
     *
     * @since 1.0.0
     */
    private function persistTransactionByExternalId(array $transactionPayload): void
    {
        $repository = $this->requireRepository();
        $existingTransaction = $repository->findTransactionByExternalId((string) $transactionPayload['external_id']);
        $alreadyCounted = $existingTransaction
            && in_array((string) ($existingTransaction['status'] ?? ''), ['approved', 'completed'], true);

        if ($existingTransaction) {
            $repository->updateMaterialPaymentTransactionByExternalId((string) $transactionPayload['external_id'], $transactionPayload);
        } else {
            $repository->createMaterialPaymentTransaction($transactionPayload);
        }

        if (
            in_array((string) $transactionPayload['status'], ['approved', 'completed'], true)
            && !$alreadyCounted
        ) {
            $repository->incrementMaterialSalesCount((string) $transactionPayload['material_id']);
            $this->notifyMaterialPaymentApproved($transactionPayload);
        }
    }

    /**
     * Persiste a transao por PaymentIntent do Stripe, com fallback para `external_id`.
     *
     * @since 1.0.0
     */
    private function persistTransactionByProviderPaymentIntentId(string $paymentIntentId, array $transactionPayload): void
    {
        $repository = $this->requireRepository();
        $existingByIntent = $repository->findTransactionByProviderPaymentIntentId($paymentIntentId);
        $alreadyCounted = $existingByIntent
            && in_array((string) ($existingByIntent['status'] ?? ''), ['approved', 'completed'], true);

        if ($existingByIntent) {
            $repository->updateMaterialPaymentTransactionByProviderPaymentIntentId($paymentIntentId, $transactionPayload);
        } else {
            $repository->createMaterialPaymentTransaction($transactionPayload);
        }

        if (
            in_array((string) $transactionPayload['status'], ['approved', 'completed'], true)
            && !$alreadyCounted
        ) {
            $repository->incrementMaterialSalesCount((string) $transactionPayload['material_id']);
            $this->notifyMaterialPaymentApproved($transactionPayload);
        }
    }

    /**
     * Monta o payload base da transao local do marketplace.
     *
     * @since 1.0.0
     */
    private function buildMaterialTransactionPayload(array $material, array $user, array $overrides): array
    {
        $amount = round((float) ($overrides['amount'] ?? ($material['price'] ?? 0)), 2);

        return [
            'external_id' => (string) ($overrides['external_id'] ?? ''),
            'user_id' => (string) ($overrides['user_id'] ?? $user['id'] ?? ''),
            'material_id' => (string) ($overrides['material_id'] ?? $material['id'] ?? ''),
            'seller_id' => (string) ($overrides['seller_id'] ?? $material['author_id'] ?? ''),
            'amount' => $amount,
            'platform_fee' => round((float) ($overrides['platform_fee'] ?? ($amount * 0.20)), 2),
            'status' => (string) ($overrides['status'] ?? 'pending'),
            'payment_method' => (string) ($overrides['payment_method'] ?? ''),
            'payment_provider' => normalizePaymentProvider((string) ($overrides['payment_provider'] ?? 'stripe')),
            'provider_payment_intent_id' => $overrides['provider_payment_intent_id'] ?? null,
            'provider_customer_id' => $overrides['provider_customer_id'] ?? null,
            'installments' => (int) ($overrides['installments'] ?? 1),
            'payer_email' => (string) ($overrides['payer_email'] ?? ($user['email'] ?? '')),
            'buyer_name' => (string) ($user['name'] ?? 'Aluno'),
            'material_title' => (string) ($material['title'] ?? 'Material'),
        ];
    }

    /**
     * Notifica comprador, vendedor e admin quando o pagamento libera o material.
     *
     * @since 1.0.0
     */
    private function notifyMaterialPaymentApproved(array $transactionPayload): void
    {
        if (!$this->db) {
            return;
        }

        $buyerId = trim((string) ($transactionPayload['user_id'] ?? ''));
        $sellerId = trim((string) ($transactionPayload['seller_id'] ?? ''));
        $buyerName = trim((string) ($transactionPayload['buyer_name'] ?? 'Aluno'));
        $materialTitle = trim((string) ($transactionPayload['material_title'] ?? 'Material'));
        $amount = round((float) ($transactionPayload['amount'] ?? 0), 2);
        $platformFee = round((float) ($transactionPayload['platform_fee'] ?? 0), 2);
        $externalId = trim((string) ($transactionPayload['provider_payment_intent_id'] ?? $transactionPayload['external_id'] ?? ''));

        if ($buyerId !== '') {
            createNotification(
                $this->db,
                $buyerId,
                'Material liberado',
                'Pagamento de R$ ' . number_format($amount, 2, ',', '.') . ' confirmado. "' . $materialTitle . '" ja esta disponivel na sua biblioteca.',
                'success',
                'marketplace',
                '/profile?tab=materials',
                null,
                $amount,
                'Valor pago'
            );
        }

        if ($sellerId !== '' && $sellerId !== $buyerId) {
            $netAmount = max(0, round($amount - $platformFee, 2));
            createNotification(
                $this->db,
                $sellerId,
                'Nova venda no marketplace',
                $buyerName . ' comprou "' . $materialTitle . '". Valor liquido estimado: R$ ' . number_format($netAmount, 2, ',', '.') . '.',
                'success',
                'marketplace',
                '/partner'
            );
        }

        createFinancialAdminNotification(
            $this->db,
            'Compra de material confirmada',
            'Pagamento' . ($externalId !== '' ? ' ' . $externalId : '') . ' liberou "' . $materialTitle . '" para ' . $buyerName . '.',
            'success',
            'finance',
            '/admin/finance/transactions',
            'finance_transaction_created',
            $amount,
            'Valor recebido'
        );

        applyMarketplaceSaleGamification(
            $this->db,
            $buyerId,
            $sellerId,
            (string) ($transactionPayload['material_id'] ?? ''),
            $materialTitle,
            $externalId !== '' ? $externalId : (string) ($transactionPayload['external_id'] ?? '')
        );
    }

    /**
     * Normaliza status tcnicos do gateway para os estados usados pela plataforma.
     *
     * @since 1.0.0
     */
    private function normalizeGatewayPaymentStatus(string $gatewayStatus): string
    {
        $normalized = strtolower(trim($gatewayStatus));

        return match ($normalized) {
            'approved', 'completed', 'succeeded' => 'approved',
            'pending', 'in_process', 'in_mediation', 'processing' => 'pending',
            default => 'rejected',
        };
    }

    /**
     * Produz uma mensagem clara para o frontend reagir sem parsing manual.
     *
     * @since 1.0.0
     */
    private function buildMaterialPaymentMessage(string $status, string $statusDetail): string
    {
        return match ($status) {
            'approved' => 'Pagamento aprovado.',
            'pending' => 'Pagamento recebido e aguardando confirmacao.',
            default => $statusDetail !== ''
                ? 'Pagamento recusado: ' . $statusDetail
                : 'Pagamento recusado ou erro no processamento.',
        };
    }

    /**
     * Fallback local por BIN para no quebrar o checkout quando a consulta externa falha.
     *
     * @since 1.0.0
     */
    private function getBrandFromBin(string $binOrPaymentMethod): ?string
    {
        if ($binOrPaymentMethod === '') {
            return null;
        }

        $bin = substr(preg_replace('/\D+/', '', $binOrPaymentMethod), 0, 6);
        if ($bin !== '') {
            if (preg_match('/^4/', $bin)) {
                return 'visa';
            }
            if (preg_match('/^(5[1-5]|2[2-7])/', $bin)) {
                return 'master';
            }
            if (preg_match('/^3[47]/', $bin)) {
                return 'amex';
            }
            if (preg_match('/^(6062|3841|6370|6375|6376|6372|6371|6040)/', $bin)) {
                return 'hipercard';
            }
            if (preg_match('/^(4011|5067|4576|4389|5041|6363|6362|5066|5090|6504|6505|6506|6507|6509|6516|6550|6552)/', $bin)) {
                return 'elo';
            }
            if (preg_match('/^(6011|622|64|65)/', $bin)) {
                return 'discover';
            }
        }

        $normalizedMethod = strtolower(trim($binOrPaymentMethod));
        if (in_array($normalizedMethod, ['visa', 'master', 'amex', 'elo', 'hipercard', 'discover', 'diners'], true)) {
            return $normalizedMethod;
        }

        return null;
    }
}
