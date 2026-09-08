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

require_once __DIR__ . '/../repositories/TransactionsRepository.php';
require_once __DIR__ . '/../validators/TransactionsValidator.php';
require_once __DIR__ . '/../../../shared/utils/Mailer.php';
require_once __DIR__ . '/../../../shared/utils/EmailTemplateResolver.php';
require_once __DIR__ . '/TransactionsRefundSupport.php';
require_once __DIR__ . '/../../finance/services/FinancialLedger.php';
require_once __DIR__ . '/../../../config/stripe.php';
require_once __DIR__ . '/../../../config/notification_helper.php';
require_once __DIR__ . '/../../../config/gamification_helper.php';
require_once __DIR__ . '/../../subscriptions/services/SubscriptionsBillingSupport.php';
require_once __DIR__ . '/../../benefits/services/BenefitService.php';
require_once __DIR__ . '/../../billing/services/BillingExtensionService.php';

/**
 * Servico do dominio de transacoes do marketplace.
 * Centraliza compra direta de materiais e o ciclo de estorno.
 */
class TransactionsService
{
    private PDO $db;
    private TransactionsRepository $repository;
    private TransactionsValidator $validator;

    /**
     * @since 1.0.0
     */
    public function __construct(
        PDO $db,
        TransactionsRepository $repository,
        TransactionsValidator $validator
    ) {
        $this->db = $db;
        $this->repository = $repository;
        $this->validator = $validator;
    }

    /**
     * Lista transacoes com filtros, estatisticas e metadados para o admin.
     *
     * @since 1.0.0
     */
    public function listTransactions(array $query): array
    {
        backfillTransactionPlanMetadata($this->db);

        $filters = $this->validator->validateListFilters($query);
        $userId = $filters['user_id'];
        $offset = ($filters['page'] - 1) * $filters['limit'];

        $whereConditions = [];
        $params = [];

        if ($userId !== '') {
            if ($filters['scope'] === 'seller') {
                $whereConditions[] = 't.seller_id = ?';
                $params[] = $userId;
            } elseif ($filters['scope'] === 'all') {
                $whereConditions[] = '(t.user_id = ? OR t.seller_id = ?)';
                $params[] = $userId;
                $params[] = $userId;
            } else {
                $whereConditions[] = 't.user_id = ?';
                $params[] = $userId;
            }
        }

        if ($filters['start_date'] !== '') {
            $whereConditions[] = 'DATE(t.created_at) >= ?';
            $params[] = $filters['start_date'];
        }

        if ($filters['end_date'] !== '') {
            $whereConditions[] = 'DATE(t.created_at) <= ?';
            $params[] = $filters['end_date'];
        }

        if ($filters['status'] !== '' && $filters['status'] !== 'All') {
            $statusFilter = $this->buildStatusFilterCondition($filters['status']);
            if ($statusFilter !== null) {
                $whereConditions[] = $statusFilter['condition'];
                $params = array_merge($params, $statusFilter['params']);
            }
        }

        if ($filters['type'] !== '' && $filters['type'] !== 'All') {
            $whereConditions[] = 't.type = ?';
            $params[] = $filters['type'];
        }

        $whereConditions[] = "NOT (
            t.type = 'plan'
            AND COALESCE(t.payment_provider, '') = 'stripe'
            AND COALESCE(t.amount, 0) <= 0
            AND COALESCE(t.provider_invoice_id, '') = ''
            AND COALESCE(t.provider_payment_intent_id, '') = ''
        )";

        $whereClause = $whereConditions ? 'WHERE ' . implode(' AND ', $whereConditions) : '';
        $totals = $this->repository->fetchTransactionTotals($whereClause, $params);
        $rows = $this->repository->fetchTransactionRows($whereClause, $params, $filters['limit'], $offset);

        $transactions = [];
        foreach ($rows as $row) {
            $displayDate = $row['due_date'] ?: $row['created_at'];
            $type = $row['type'] ?: ($row['material_id'] ? 'material' : 'plan');
            $paymentProvider = normalizePaymentProvider($row['payment_provider'] ?? 'stripe');
            $description = trim((string) (
                $row['plan_name']
                ?: $row['storedPlanName']
                ?: $row['materialTitle']
                ?: ($type === 'plan' ? 'Assinatura' : 'Transacao')
            ));
            $providerTransactionId = trim((string) (
                $paymentProvider === 'stripe'
                    ? ($row['provider_payment_intent_id'] ?: $row['provider_invoice_id'] ?: $row['external_id'])
                    : ($row['external_id'] ?: $row['provider_payment_intent_id'] ?: $row['provider_invoice_id'])
            ));
            $referenceId = $providerTransactionId !== '' ? $providerTransactionId : (string) $row['id'];
            $providerTransactionLabel = $paymentProvider === 'stripe'
                ? (!empty($row['provider_payment_intent_id']) ? 'PaymentIntent' : (!empty($row['provider_invoice_id']) ? 'Invoice' : 'Stripe'))
                : 'Pagamento';
            $refundDetails = [];
            if (!empty($row['provider_refund_details_json'])) {
                $decodedRefundDetails = json_decode((string) $row['provider_refund_details_json'], true);
                if (is_array($decodedRefundDetails)) {
                    $refundDetails = $decodedRefundDetails;
                }
            }
            $effectiveStatus = $this->normalizeTransactionStatus($row);
            $revenueRecognized = $this->isRevenueRecognizedTransaction($row);
            $amount = (float) $row['amount'];
            $refundedAmount = $this->resolveRefundedAmount($row, $effectiveStatus, $amount);
            $recognizedAmount = $revenueRecognized ? max(0.0, $amount - $refundedAmount) : 0.0;
            $platformFee = $revenueRecognized && $amount > 0
                ? round(((float) $row['platform_fee']) * ($recognizedAmount / $amount), 2)
                : 0.0;
            $commercialPlatformRevenue = $type === 'plan'
                ? $recognizedAmount
                : $platformFee;
            $sellerPayable = $type === 'material'
                ? round($recognizedAmount - $commercialPlatformRevenue, 2)
                : 0.0;
            $netAmount = $sellerPayable;
            $referralPayable = $revenueRecognized ? round((float) ($row['referralPayable'] ?? 0), 2) : 0.0;
            $platformNet = round($commercialPlatformRevenue - $referralPayable, 2);
            $buyerEmail = trim((string) ($row['payer_email'] ?? ''));
            if ($buyerEmail === '') {
                $buyerEmail = trim((string) ($row['buyerEmail'] ?? ''));
            }
            $installmentNumber = null;
            $installmentCount = null;
            $subscriptionInstallmentCount = max(1, (int) ($row['subscriptionTotalInstallments'] ?? 1));
            if (
                $paymentProvider === 'stripe'
                && $type === 'plan'
                && $subscriptionInstallmentCount > 1
            ) {
                $installmentNumber = min(
                    $subscriptionInstallmentCount,
                    max(1, (int) ($row['installments'] ?? 1))
                );
                $installmentCount = $subscriptionInstallmentCount;
            }

            $transactions[] = [
                'id' => (int) $row['id'],
                'internalId' => (int) $row['id'],
                'referenceId' => $referenceId,
                'providerTransactionId' => $providerTransactionId,
                'providerTransactionLabel' => $providerTransactionLabel,
                'buyerId' => $row['user_id'],
                'buyerName' => $row['buyerName'],
                'buyerEmail' => $buyerEmail !== '' ? $buyerEmail : null,
                'payerEmail' => $buyerEmail !== '' ? $buyerEmail : null,
                'userSubscriptionId' => isset($row['user_subscription_id']) ? (int) $row['user_subscription_id'] : null,
                'materialId' => $row['material_id'],
                'materialTitle' => $row['materialTitle'],
                'planId' => $row['plan_id'],
                'planName' => $row['plan_name'] ?: $row['storedPlanName'],
                'transactionName' => $description,
                'description' => $description,
                'sellerId' => $row['seller_id'],
                'sellerName' => $row['sellerName'] ?: 'Plataforma',
                'amount' => $amount,
                'refundedAmount' => $refundedAmount,
                'recognizedAmount' => $recognizedAmount,
                'platformFee' => $commercialPlatformRevenue,
                'netAmount' => $netAmount,
                'financial' => [
                    'currency' => 'BRL',
                    'grossCaptured' => $revenueRecognized || in_array($effectiveStatus, ['refunded', 'partially_refunded'], true) ? $amount : 0.0,
                    'refunded' => $refundedAmount,
                    'recognizedGross' => $recognizedAmount,
                    'commercialPlatformRevenue' => $commercialPlatformRevenue,
                    'sellerPayable' => $sellerPayable,
                    'providerFee' => null,
                    'referralPayable' => $referralPayable,
                    'platformNet' => $platformNet,
                ],
                'status' => $effectiveStatus ?: 'completed',
                'type' => $type,
                'externalId' => $row['external_id'],
                'paymentMethod' => $row['payment_method'],
                'paymentMethodLabel' => $this->formatTransactionPaymentMethodLabel($row['payment_method'] ?? null, $paymentProvider),
                'paymentProvider' => $paymentProvider,
                'providerInvoiceId' => $row['provider_invoice_id'],
                'providerPaymentIntentId' => $row['provider_payment_intent_id'],
                'providerRefundId' => $row['provider_refund_id'],
                'providerRefundDetails' => $refundDetails,
                'providerCustomerId' => $row['provider_customer_id'],
                'refundReason' => $row['refund_reason'],
                'refundRequestedAt' => $row['refund_requested_at'],
                'retentionOffer' => !empty($row['retention_offer_id']) ? [
                    'id' => $row['retention_offer_id'],
                    'status' => $row['retention_offer_status'],
                    'refundAmount' => (float) ($row['retention_offer_refund_amount'] ?? 0),
                    'paidPlan' => $row['retention_offer_paid_plan'],
                    'currentRenewalAt' => $row['retention_offer_current_renewal_at'],
                    'offeredDays' => (int) ($row['retention_offer_offered_days'] ?? 0),
                    'expectedRenewalAt' => $row['retention_offer_expected_renewal_at'],
                    'expiresAt' => $row['retention_offer_expires_at'],
                    'userNote' => $row['retention_offer_user_note'],
                    'providerConfirmedAt' => $row['retention_offer_provider_confirmed_at'],
                    'providerReference' => $row['retention_offer_provider_reference'],
                    'benefitGrantId' => $row['retention_offer_benefit_grant_id'],
                ] : null,
                'timestamp' => strtotime($displayDate) * 1000,
                'dateFormatted' => date('d/m/Y', strtotime($displayDate)),
                'dateTimeFormatted' => date('d/m/Y H:i:s', strtotime($displayDate)),
                'createdAt' => $row['created_at'],
                'dueDate' => $row['due_date'],
                'installmentNumber' => $installmentNumber,
                'installmentCount' => $installmentCount,
            ];
        }

        $transactions = $this->hydrateStripeInvoiceMetadata($transactions);

        $relevantStripeInstallmentSubscription = null;
        $projectedTransactions = [];
        if (
            $userId !== ''
            && in_array($filters['scope'], ['buyer', 'all'], true)
            && ($filters['type'] === '' || $filters['type'] === 'plan' || $filters['type'] === 'All')
        ) {
            $relevantStripeInstallmentSubscription = $this->repository->findRelevantStripeInstallmentSubscription($userId);
            $transactions = $this->applyActiveStripeInstallmentMetadata($transactions, $relevantStripeInstallmentSubscription);
            $projectedTransactions = $this->buildProjectedStripeInstallmentTransactions($userId, $transactions, $relevantStripeInstallmentSubscription);
            if (!empty($projectedTransactions)) {
                $transactions = array_merge($transactions, $projectedTransactions);
            }
        }

        usort($transactions, static function (array $left, array $right): int {
            return (int) $right['timestamp'] <=> (int) $left['timestamp'];
        });

        if (count($transactions) > $filters['limit']) {
            $transactions = array_slice($transactions, 0, $filters['limit']);
        }

        $totalRecords = !empty($totals['total_count']) ? (int) $totals['total_count'] : 0;
        $totalRecords += count($projectedTransactions);
        $totalPages = (int) ceil($totalRecords / $filters['limit']);

        return [
            'rows' => $transactions,
            'pagination' => [
                'page' => $filters['page'],
                'limit' => $filters['limit'],
                'total' => $totalRecords,
                'pages' => $totalPages,
            ],
            'stats' => [
                'grossCaptured' => (float) ($totals['gross_captured'] ?? 0),
                'refundedAmount' => (float) ($totals['refunded_amount'] ?? 0),
                'recognizedGross' => (float) ($totals['recognized_gross'] ?? 0),
                'commercialPlatformRevenue' => (float) ($totals['platform_revenue'] ?? 0),
                'sellerPayable' => (float) ($totals['seller_payable'] ?? 0),
                'referralPayable' => (float) ($totals['referral_payable'] ?? 0),
                'providerFees' => null,
                'platformNet' => (float) ($totals['platform_net'] ?? 0),
                'totalHeld' => (float) ($totals['total_held'] ?? 0),
                'count' => $totalRecords,
            ],
        ];
    }

    private function normalizeTransactionStatus(array $transaction): string
    {
        if (
            trim((string) ($transaction['provider_refund_id'] ?? '')) !== ''
            || trim((string) ($transaction['refunded_at'] ?? '')) !== ''
        ) {
            if (
                (float) ($transaction['refunded_amount'] ?? 0) > 0
                && (float) ($transaction['refunded_amount'] ?? 0) < (float) ($transaction['amount'] ?? 0)
            ) {
                return 'partially_refunded';
            }
            return 'refunded';
        }

        $status = strtolower(trim((string) ($transaction['status'] ?? '')));
        if ($status === 'canceled') {
            return 'cancelled';
        }
        if ($status === 'succeeded' || $status === 'paid') {
            return 'approved';
        }

        return $status;
    }

    private function isRevenueRecognizedTransaction(array $transaction): bool
    {
        return in_array($this->normalizeTransactionStatus($transaction), ['approved', 'completed', 'partially_refunded'], true);
    }

    private function resolveRefundedAmount(array $transaction, string $status, float $amount): float
    {
        if ($status === 'refunded') {
            return $amount;
        }

        if ($status === 'partially_refunded') {
            return min($amount, max(0.0, (float) ($transaction['refunded_amount'] ?? 0)));
        }

        return 0.0;
    }

    private function buildStatusFilterCondition(string $status): ?array
    {
        $normalizedStatus = strtolower(trim($status));
        if ($normalizedStatus === '' || $normalizedStatus === 'all') {
            return null;
        }

        if (in_array($normalizedStatus, ['paid', 'approved', 'completed'], true)) {
            return [
                'condition' => "t.status IN ('approved', 'completed') AND COALESCE(t.provider_refund_id, '') = '' AND t.refunded_at IS NULL",
                'params' => [],
            ];
        }

        if ($normalizedStatus === 'refunded') {
            return [
                'condition' => "(t.status IN ('refunded', 'partially_refunded') OR COALESCE(t.provider_refund_id, '') <> '' OR t.refunded_at IS NOT NULL)",
                'params' => [],
            ];
        }

        if (in_array($normalizedStatus, ['cancelled', 'canceled'], true)) {
            return [
                'condition' => "t.status IN ('cancelled', 'canceled')",
                'params' => [],
            ];
        }

        if (in_array($normalizedStatus, ['failed', 'rejected'], true)) {
            return [
                'condition' => "t.status IN ('failed', 'rejected')",
                'params' => [],
            ];
        }

        return [
            'condition' => 't.status = ?',
            'params' => [$normalizedStatus],
        ];
    }

    /**
     * Registra a compra direta de material pelo usuario.
     *
     * @since 1.0.0
     */
    public function createMaterialPurchase(string $userId, array $data): array
    {
        $payload = $this->validator->validateMaterialPurchase($data);
        $this->db->beginTransaction();
        try {
        $material = $this->repository->findMaterialByIdForUpdate($payload['material_id']);
        if (!$material) {
            throw new OutOfBoundsException('Material não encontrado.');
        }

        if (($material['status'] ?? '') !== 'approved') {
            throw new RuntimeException('Este material ainda nao esta disponivel para compra.');
        }

        $user = $this->repository->findUserById($userId);
        if (!$user) {
            throw new OutOfBoundsException('Usuário não encontrado.');
        }

        if (hash_equals((string) ($material['author_id'] ?? ''), $userId)) {
            throw new RuntimeException('Nao e permitido comprar o proprio material.');
        }

        if ($this->repository->hasCompletedMaterialPurchase($userId, $payload['material_id'])) {
            throw new RuntimeException('Você já possui este material.');
        }

        $amount = round((float) ($material['price'] ?? 0), 2);
        $couponResult = validateCouponForAmount(
            $this->db,
            $payload['coupon_code'],
            $amount,
            [
                'item_id' => (string) $material['id'],
                'target_type' => 'item',
                'target_id' => (string) $material['id'],
            ]
        );
        $finalAmount = $couponResult['valid'] ? (float) $couponResult['final_amount'] : $amount;

        if ($amount > 0 && $finalAmount > 0) {
            throw new RuntimeException('Checkout de materiais pagos continua indisponível no fluxo atual.');
        }

        $platformFee = round($finalAmount * 0.20, 2);
        $transactionId = $this->repository->createMaterialPurchaseTransaction(
            $userId,
            (string) $material['id'],
            (string) $material['author_id'],
            $finalAmount,
            $platformFee
        );
        FinancialLedger::syncTransactionById($this->db, $transactionId, 'material_purchase');
        $this->repository->incrementMaterialSalesCount((string) $material['id']);

        if (!empty($couponResult['valid']) && !empty($couponResult['coupon']['code'])) {
            incrementCouponUsage($this->db, (string) $couponResult['coupon']['code'], true);
        }

        $this->db->commit();
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }

        $this->notifyMaterialPurchaseCompleted($material, $user, (string) $transactionId, $finalAmount, $platformFee);

        return [
            'transaction' => [
                'id' => $transactionId,
                'buyerId' => $userId,
                'buyerName' => $user['name'],
                'materialId' => (string) $material['id'],
                'materialTitle' => $material['title'],
                'sellerId' => $material['author_id'],
                'amount' => $finalAmount,
                'platformFee' => $platformFee,
                'status' => 'completed',
                'timestamp' => time() * 1000,
            ],
            'coupon' => $couponResult['valid'] ? array_merge($couponResult['coupon'], [
                'discount_amount' => $couponResult['discount_amount'],
                'final_amount' => $couponResult['final_amount'],
                'auto_applied' => !empty($couponResult['auto_applied']),
            ]) : null,
        ];
    }

    /**
     * Recebe a solicitacao de reembolso do usuario.
     *
     * @since 1.0.0
     */
    public function requestRefund(string $userId, array $data): array
    {
        $payload = $this->validator->validateRefundRequest($data);
        $transaction = $this->repository->findRefundableTransactionForUser(
            $payload['transaction_id'],
            $userId,
            ['completed', 'approved']
        );

        if (!$transaction) {
            throw new OutOfBoundsException('Transação elegível para reembolso não encontrada.');
        }

        $autoRefund = (bool) getSystemSettingValue($this->db, 'autoRefundEnabled', false);
        if ($autoRefund) {
            try {
                $chainResults = $this->processRefundForTransactionChain($transaction, $payload['reason']);
                $refundResult = $this->resolvePrimaryRefundResult($chainResults, $payload['transaction_id']);
                $this->revokePlanAccessAfterRefund($transaction, $refundResult);
                $chainNotice = $this->buildRefundChainEmailNotice($chainResults, $payload['transaction_id']);
                $this->sendRefundEmail(
                    (string) $transaction['user_id'],
                    $payload['transaction_id'],
                    $transaction,
                    $refundResult,
                    'Seu reembolso foi processado',
                    'Reembolso processado',
                    'Sua solicitação de reembolso para a transação <b>#' . $payload['transaction_id'] . '</b> foi processada com sucesso.<br><br>'
                    . $chainNotice
                    . 'O valor será devolvido para o mesmo método de pagamento utilizado na compra.<br><br>'
                );
                $this->notifyRefundProcessed((string) $transaction['user_id'], $transaction, $chainResults);

                return [
                    'message' => 'Reembolso processado automaticamente com sucesso.',
                ];
            } catch (Throwable $refundError) {
                error_log('[transactions_service] auto refund failed for transaction '
                    . $payload['transaction_id'] . ': ' . $refundError->getMessage());
            }
        }

        markPlanRefundChainAsRequested($this->db, $transaction, $payload['reason']);
        $this->notifyAdminAboutRefundRequest($payload['transaction_id'], $payload['reason'], $transaction);
        $this->notifySellerAboutRefundRequest($transaction, $payload['reason']);

        return [
            'message' => 'Reembolso solicitado.',
        ];
    }

    /**
     * Processa a aprovacao administrativa do reembolso.
     *
     * @since 1.0.0
     */
    public function approveRefund(array $data): array
    {
        $payload = $this->validator->validateRefundResolution($data);
        $refundReason = $payload['reason'] !== '' ? $payload['reason'] : 'Aprovado pelo administrador';
        $this->db->beginTransaction();

        try {
            $transaction = $this->repository->findTransactionByIdForUpdate($payload['transaction_id']);
            if (!$transaction) {
                throw new OutOfBoundsException('Transação não encontrada.');
            }

            $currentStatus = strtolower(trim((string) ($transaction['status'] ?? '')));
            $existingRefundId = trim((string) ($transaction['provider_refund_id'] ?? ''));

            if ($currentStatus === 'refunded' || $existingRefundId !== '') {
                throw new RuntimeException('Esta transação já foi reembolsada anteriormente.');
            }

            if ($currentStatus !== 'refund_requested') {
                throw new InvalidArgumentException('Esta transação não possui solicitação de estorno pendente.');
            }

            $retentionOffer = $this->repository->findRetentionOfferForTransaction($payload['transaction_id'], true);
            if ($retentionOffer && in_array(strtoupper((string) $retentionOffer['status']), ['PENDING', 'ACCEPTED_PENDING_BENEFIT'], true)) {
                throw new DomainException('Esta solicitação possui uma oferta de retenção ativa.');
            }

            $chainResults = $this->processRefundForTransactionChain($transaction, $refundReason);
            $refundResult = $this->resolvePrimaryRefundResult($chainResults, $payload['transaction_id']);
            $this->revokePlanAccessAfterRefund($transaction, $refundResult);
            (new BenefitService($this->db))->recordDomainEvent(
                BenefitService::EVENT_REFUND_COMPLETED,
                (string) $transaction['user_id'],
                null,
                'REFUND',
                (string) $payload['transaction_id'],
                [
                    'transaction_id' => (string) $payload['transaction_id'],
                    'amount' => round((float) ($refundResult['amount'] ?? $transaction['amount'] ?? 0), 2),
                    'reason' => $refundReason,
                ],
                null
            );
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $error;
        }

        $this->sendRefundEmail(
            (string) $transaction['user_id'],
            $payload['transaction_id'],
            $transaction,
            $refundResult,
            'Seu reembolso foi aprovado',
            'Reembolso aprovado',
            'Sua solicitação de reembolso para a transação <b>#' . $payload['transaction_id'] . '</b> foi aprovada e processada com sucesso.<br><br>'
            . $this->buildRefundChainEmailNotice($chainResults ?? [], $payload['transaction_id'])
            . 'O valor será devolvido ao mesmo método de pagamento utilizado na compra.<br><br>'
        );
        $this->notifyRefundProcessed((string) $transaction['user_id'], $transaction, $chainResults ?? []);

        return [
            'transaction' => $transaction,
            'message' => 'Estorno realizado com sucesso.',
        ];
    }

    /**
     * Envia uma proposta de retencao mantendo a solicitacao em analise.
     *
     * @since 1.0.0
     */
    public function sendRefundRetentionOffer(array $data): array
    {
        $payload = $this->validator->validateRetentionOffer($data);
        $this->db->beginTransaction();
        try {
            $transaction = $this->repository->findTransactionByIdForUpdate($payload['transaction_id']);
            if (!$transaction) {
                throw new OutOfBoundsException('Transação não encontrada.');
            }
            if (($transaction['status'] ?? '') !== 'refund_requested' || !isPlanTransactionRefundTarget($transaction)) {
                throw new InvalidArgumentException('Somente uma solicitação elegível de assinatura pode receber oferta de retenção.');
            }
            if (trim((string) ($transaction['provider_refund_id'] ?? '')) !== '') {
                throw new InvalidArgumentException('Uma transação já reembolsada não pode receber oferta.');
            }

            $existing = $this->repository->findRetentionOfferForTransaction($payload['transaction_id'], true);
            if ($existing) {
                if (in_array(strtoupper((string) $existing['status']), ['PENDING', 'ACCEPTED_PENDING_BENEFIT'], true)) {
                    $this->db->commit();
                    return ['transaction' => $transaction, 'offer' => $existing, 'message' => 'A oferta de retenção já está ativa.'];
                }
                throw new DomainException('Esta solicitação já possui uma oferta encerrada.');
            }

            $subscription = getActiveSubscriptionForUser($this->db, (string) $transaction['user_id']);
            $currentRenewal = $subscription
                ? trim((string) ($subscription['provider_current_period_end'] ?? $subscription['current_period_end'] ?? ''))
                : '';
            if (!$subscription || $currentRenewal === '') {
                throw new DomainException('Não foi possível confirmar a renovação atual do provedor.');
            }
            $renewalTimestamp = strtotime($currentRenewal);
            if ($renewalTimestamp === false) {
                throw new DomainException('Data de renovação do provedor inválida.');
            }
            // Preserve the database/application timezone used by the provider
            // snapshot so the user-facing estimate does not drift by offset.
            $expectedRenewal = date('Y-m-d H:i:s', $renewalTimestamp + ($payload['offered_days'] * 86400));
            $benefits = new BenefitService($this->db);
            $definitionKey = 'refund-retention-' . hash('sha256', $payload['transaction_id']);
            $definition = $benefits->findDefinitionByKey($definitionKey);
            if (!$definition) {
                $definition = $benefits->createDefinition([
                    'definition_key' => $definitionKey,
                    'name' => 'Oferta de retenção de reembolso',
                    'benefit_mode' => 'BILLING_EXTENSION_ONLY',
                    'billing_extension_days' => $payload['offered_days'],
                    'stacking_policy' => 'EXTEND',
                    'source_scope' => 'REFUND_RETENTION_OFFER',
                    'active' => 1,
                ], $payload['actor_id']);
            } elseif ((int) ($definition['billing_extension_days'] ?? 0) !== $payload['offered_days']) {
                throw new DomainException('A oferta de retenção já possui termos incompatíveis.');
            }
            $offer = [
                'id' => self::retentionUuid(),
                'transaction_id' => $payload['transaction_id'],
                'user_id' => (string) $transaction['user_id'],
                'status' => 'PENDING',
                'refund_amount' => round((float) ($transaction['amount'] ?? 0), 2),
                'paid_plan' => trim((string) ($subscription['plan_name'] ?? $transaction['plan_name'] ?? 'Plano pago')),
                'current_renewal_at' => $currentRenewal,
                'offered_days' => $payload['offered_days'],
                'expected_renewal_at' => $expectedRenewal,
                'expires_at' => $payload['expires_at'],
                'user_note' => $payload['user_note'],
                'internal_note' => $payload['internal_note'],
                'benefit_definition_id' => $definition['id'],
                'idempotency_key' => hash('sha256', 'refund-retention-offer:' . $payload['transaction_id']),
                'created_by' => $payload['actor_id'],
            ];
            $this->repository->createRetentionOffer($offer);
            $benefits->recordDomainEvent(
                BenefitService::EVENT_REFUND_RETENTION_OFFER_CREATED,
                (string) $transaction['user_id'],
                null,
                'REFUND_RETENTION_OFFER',
                (string) $offer['id'],
                [
                    'transaction_id' => (string) $transaction['id'],
                    'offered_days' => (int) $offer['offered_days'],
                    'current_renewal_at' => $offer['current_renewal_at'],
                    'expected_renewal_at' => $offer['expected_renewal_at'],
                    'expires_at' => $offer['expires_at'],
                ],
                $payload['actor_id']
            );
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }

        $offer['reason_label'] = $this->formatRefundReasonLabel((string) ($transaction['refund_reason'] ?? ''));
        $this->sendRefundRetentionEmail((string) $transaction['user_id'], $transaction, $offer);

        if (!empty($transaction['user_id'])) {
            createNotification(
                $this->db,
                (string) $transaction['user_id'],
                'Proposta para continuar com seu acesso',
                'Oferta de ' . $offer['offered_days'] . ' dia(s) de extensão de cobrança enviada para sua decisão.',
                'info',
                'marketplace',
                '/profile?tab=billing'
            );
        }

        return [
            'transaction' => $transaction,
            'offer' => $offer,
            'message' => 'Oferta de retenção enviada. A solicitação segue protegida até a decisão do usuário.',
        ];
    }

    public function decideRefundRetentionOffer(string $userId, array $data): array
    {
        $offerId = trim((string) ($data['offer_id'] ?? ''));
        $decision = strtoupper(trim((string) ($data['decision'] ?? '')));
        if ($offerId === '' || !in_array($decision, ['ACCEPT', 'DECLINE'], true)) {
            throw new InvalidArgumentException('Decisão de oferta inválida.');
        }

        $this->db->beginTransaction();
        try {
            $offer = $this->repository->findRetentionOfferForUser($offerId, $userId, false);
            if (!$offer) {
                throw new OutOfBoundsException('Oferta de retenção não encontrada.');
            }
            $transaction = $this->repository->findTransactionByIdForUpdate((string) $offer['transaction_id']);
            if (!$transaction) {
                throw new OutOfBoundsException('Transação da oferta não encontrada.');
            }
            $offer = $this->repository->findRetentionOfferForUser($offerId, $userId, true);
            if (!$offer) {
                throw new OutOfBoundsException('Oferta de retenção não encontrada.');
            }
            $status = strtoupper((string) $offer['status']);
            if ($status === 'CLOSED_RETAINED') {
                $this->db->commit();
                return ['offer' => $offer, 'message' => 'A oferta já foi confirmada.'];
            }
            if ($status === 'RETENTION_OFFER_REJECTED') {
                if ($decision === 'DECLINE' && strtolower((string) ($transaction['status'] ?? '')) === 'refunded') {
                    $this->db->commit();
                    return ['offer' => $offer, 'message' => 'A oferta já foi recusada e o reembolso já foi processado.'];
                }
                throw new DomainException('Esta oferta não está mais disponível.');
            }
            if (in_array($status, ['EXPIRED', 'ACCEPTED_PENDING_BENEFIT'], true)) {
                throw new DomainException('Esta oferta não está mais disponível.');
            }
            if ($this->isRetentionOfferExpired((string) $offer['expires_at'])) {
                $this->repository->updateRetentionOffer($offerId, ['status' => 'EXPIRED', 'expired_at' => gmdate('Y-m-d H:i:s')], $status);
                (new BenefitService($this->db))->recordDomainEvent(BenefitService::EVENT_REFUND_RETENTION_EXPIRED, $userId, null, 'REFUND_RETENTION_OFFER', $offerId, ['offered_days' => (int) $offer['offered_days'], 'transaction_id' => (string) $transaction['id']], $userId);
                $this->db->commit();
                $this->approveRefund(['transaction_id' => (string) $transaction['id'], 'reason' => 'Oferta de retenção expirada']);
                return ['offer' => $offer, 'message' => 'A oferta expirou e o reembolso canônico foi processado.'];
            }
            if ($decision === 'DECLINE') {
                $this->repository->updateRetentionOffer($offerId, ['status' => 'RETENTION_OFFER_REJECTED', 'user_decision_at' => gmdate('Y-m-d H:i:s')], $status);
                (new BenefitService($this->db))->recordDomainEvent(BenefitService::EVENT_REFUND_RETENTION_DECLINED, $userId, null, 'REFUND_RETENTION_OFFER', $offerId, ['offered_days' => (int) $offer['offered_days'], 'transaction_id' => (string) $transaction['id']], $userId);
                $this->db->commit();
                $result = $this->approveRefund(['transaction_id' => (string) $transaction['id'], 'reason' => 'Usuário recusou oferta de retenção']);
                return ['offer' => $offer, 'refund' => $result, 'message' => 'A oferta foi recusada e o reembolso canônico foi solicitado.'];
            }
            $this->repository->updateRetentionOffer($offerId, ['status' => 'ACCEPTED_PENDING_BENEFIT', 'user_decision_at' => gmdate('Y-m-d H:i:s'), 'failure_reason' => null], $status);
            (new BenefitService($this->db))->recordDomainEvent(BenefitService::EVENT_REFUND_RETENTION_ACCEPTED, $userId, null, 'REFUND_RETENTION_OFFER', $offerId, ['offered_days' => (int) $offer['offered_days'], 'transaction_id' => (string) $transaction['id'], 'provider_status' => 'PENDING'], $userId);
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $error;
        }

        try {
            $grant = (new BenefitService($this->db))->grant($userId, (string) $offer['benefit_definition_id'], [
                'source_type' => 'REFUND_RETENTION_OFFER',
                'source_reference' => $offerId,
                'reason' => 'Oferta de retenção de reembolso aceita pelo usuário',
                'idempotency_key' => 'refund-retention-benefit:' . $offerId,
                'metadata' => ['refund_retention_offer_id' => $offerId, 'offered_days' => (int) $offer['offered_days']],
            ], $userId);
            $grant = (new BillingExtensionService($this->db))->apply((string) $grant['id'], $userId);
            if (strtoupper((string) ($grant['status'] ?? '')) !== 'APPLIED') {
                throw new DomainException('O provedor ainda não confirmou o benefício.');
            }
            $this->db->beginTransaction();
            $this->repository->updateRetentionOffer($offerId, [
                'status' => 'CLOSED_RETAINED',
                'benefit_grant_id' => $grant['id'],
                'provider_confirmed_at' => gmdate('Y-m-d H:i:s'),
                'provider_reference' => $grant['provider_reference'] ?? null,
                'failure_reason' => null,
            ], 'ACCEPTED_PENDING_BENEFIT');
            $this->repository->updateTransactionStatus((string) $transaction['id'], 'refund_retained');
            $this->db->commit();
            $offer['status'] = 'CLOSED_RETAINED';
            $offer['benefit_grant_id'] = $grant['id'];
            $offer['provider_confirmed_at'] = gmdate('Y-m-d H:i:s');
            $offer['provider_reference'] = $grant['provider_reference'] ?? null;
            return ['offer' => $offer, 'grant' => $grant, 'message' => 'Benefício confirmado e assinatura mantida.'];
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            $this->db->beginTransaction();
            try {
                $this->repository->updateRetentionOffer($offerId, ['status' => 'ACCEPTED_PENDING_BENEFIT', 'failure_reason' => mb_substr($error->getMessage(), 0, 500)], 'ACCEPTED_PENDING_BENEFIT');
                $this->db->commit();
            } catch (Throwable $persistError) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                error_log('[transactions_service] retention failure persistence: ' . $persistError->getMessage());
            }
            throw $error;
        }
    }

    /**
     * Expira ofertas vencidas e encaminha o reembolso pela autoridade canonica.
     * O limite evita varreduras ilimitadas; reexecucoes sao protegidas pelo
     * lock da transacao e pela idempotencia do fluxo de reembolso.
     *
     * @since 1.0.0
     */
    public function processExpiredRefundRetentionOffers(int $limit = 50): array
    {
        $limit = max(1, min(100, $limit));
        $summary = [
            'scanned' => 0,
            'expired' => 0,
            'refunds_processed' => 0,
            'refund_failures' => 0,
            'rows' => [],
        ];
        $attemptedOfferIds = [];

        for ($attempt = 0; $attempt < $limit; $attempt++) {
            $candidate = $this->repository->findNextExpiredRetentionOfferCandidate(array_keys($attemptedOfferIds));
            if (!$candidate) {
                break;
            }
            $summary['scanned']++;

            $offerId = (string) ($candidate['id'] ?? '');
            $transactionId = (string) ($candidate['transaction_id'] ?? '');
            if ($offerId === '' || $transactionId === '') {
                continue;
            }
            $attemptedOfferIds[$offerId] = true;

            $shouldRefund = false;
            $this->db->beginTransaction();
            try {
                // Keep the same transaction-first lock order used by user/Admin decisions.
                $transaction = $this->repository->findTransactionByIdForUpdate($transactionId);
                $offer = $this->repository->findRetentionOfferForTransaction($transactionId, true);
                if (!$transaction || !$offer || strtolower((string) ($transaction['status'] ?? '')) !== 'refund_requested') {
                    $this->db->commit();
                    continue;
                }

                $status = strtoupper((string) ($offer['status'] ?? ''));
                if ($status === 'PENDING' && $this->isRetentionOfferExpired((string) ($offer['expires_at'] ?? ''))) {
                    $this->repository->updateRetentionOffer(
                        $offerId,
                        ['status' => 'EXPIRED', 'expired_at' => gmdate('Y-m-d H:i:s')],
                        'PENDING'
                    );
                    (new BenefitService($this->db))->recordDomainEvent(
                        BenefitService::EVENT_REFUND_RETENTION_EXPIRED,
                        (string) $transaction['user_id'],
                        null,
                        'REFUND_RETENTION_OFFER',
                        $offerId,
                        [
                            'offered_days' => (int) ($offer['offered_days'] ?? 0),
                            'transaction_id' => $transactionId,
                        ],
                        (string) $transaction['user_id']
                    );
                    $summary['expired']++;
                    $shouldRefund = true;
                } elseif ($status === 'EXPIRED') {
                    // A prior attempt may have reached the provider and failed locally.
                    $shouldRefund = true;
                }
                $this->db->commit();
            } catch (Throwable $error) {
                if ($this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                $summary['refund_failures']++;
                $summary['rows'][] = [
                    'offer_id' => $offerId,
                    'transaction_id' => $transactionId,
                    'error' => 'expiry_claim_failed',
                ];
                continue;
            }

            if (!$shouldRefund) {
                continue;
            }

            try {
                $this->approveRefund([
                    'transaction_id' => $transactionId,
                    'reason' => 'Oferta de retenção expirada',
                ]);
                $summary['refunds_processed']++;
            } catch (Throwable $error) {
                // Keep EXPIRED + refund_requested recoverable for the next cron pass.
                $summary['refund_failures']++;
                $summary['rows'][] = [
                    'offer_id' => $offerId,
                    'transaction_id' => $transactionId,
                    'error' => 'expiry_refund_retryable_failure',
                ];
            }
        }

        return $summary;
    }

    private static function retentionUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    private function isRetentionOfferExpired(string $expiresAt): bool
    {
        if (trim($expiresAt) === '') {
            return false;
        }

        try {
            $expiration = new DateTimeImmutable($expiresAt, new DateTimeZone('UTC'));
            $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
            return $expiration <= $now;
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * Processa reembolso da transacao e de cobrancas ligadas por upgrade.
     *
     * @since 1.0.0
     */
    private function processRefundForTransactionChain(array $transaction, string $refundReason): array
    {
        $chainTransactions = findRefundablePlanTransactionChain($this->db, $transaction, true);
        $results = [];

        foreach ($chainTransactions as $chainTransaction) {
            $status = strtolower(trim((string) ($chainTransaction['status'] ?? '')));
            $transactionId = (string) ($chainTransaction['id'] ?? '');
            if ($transactionId === '' || !in_array($status, ['approved', 'completed', 'refund_requested'], true)) {
                continue;
            }

            $refundResult = processGatewayRefundForTransaction($this->db, $chainTransaction, $refundReason);
            markTransactionAsRefunded($this->db, $transactionId, $refundReason, $refundResult);
            $results[] = [
                'transaction' => $chainTransaction,
                'refund_result' => $refundResult,
            ];
        }

        if (empty($results)) {
            throw new RuntimeException('Nenhuma cobrança elegível foi localizada para processar o reembolso.');
        }

        return $results;
    }

    /**
     * Seleciona o resultado primario usado por emails e cancelamento de assinatura.
     *
     * @since 1.0.0
     */
    private function resolvePrimaryRefundResult(array $chainResults, string $transactionId): array
    {
        foreach ($chainResults as $entry) {
            $entryTransactionId = (string) ($entry['transaction']['id'] ?? '');
            if ($entryTransactionId === $transactionId) {
                return $entry['refund_result'] ?? [];
            }
        }

        return $chainResults[0]['refund_result'] ?? [];
    }

    /**
     * Monta aviso para o usuario quando o reembolso envolve upgrade.
     *
     * @since 1.0.0
     */
    private function buildRefundChainEmailNotice(array $chainResults, string $primaryTransactionId): string
    {
        if (count($chainResults) <= 1) {
            return '';
        }

        $total = 0.0;
        $lines = [];
        foreach ($chainResults as $entry) {
            $transaction = $entry['transaction'] ?? [];
            $id = (string) ($transaction['id'] ?? '');
            $amount = round((float) ($transaction['amount'] ?? 0), 2);
            $planName = trim((string) ($transaction['plan_name'] ?? 'Plano'));
            $total += $amount;
            $lines[] = '#' . $id . ' - ' . htmlspecialchars($planName, ENT_QUOTES, 'UTF-8')
                . ' (R$ ' . number_format($amount, 2, ',', '.') . ')';
        }

        return 'Como este pedido está ligado a uma troca de plano, também processamos as cobranças relacionadas da mesma cadeia de assinatura: '
            . implode('; ', $lines)
            . '.<br><b>Total estornado:</b> R$ ' . number_format($total, 2, ',', '.') . '.<br><br>';
    }

    /**
     * Revoga acesso do plano quando o reembolso e concluido.
     *
     * @since 1.0.0
     */
    private function revokePlanAccessAfterRefund(array $transaction, ?array $refundResult = null): void
    {
        if (!isPlanTransactionRefundTarget($transaction) || empty($transaction['user_id'])) {
            return;
        }

        $cancellationResult = cancelStripeSubscriptionImmediatelyAfterRefund($this->db, $transaction, $refundResult);
        if (!empty($cancellationResult['warning'])) {
            error_log('[transactions_service] refund cancellation warning: ' . $cancellationResult['warning']);
        }
    }

    /**
     * Envia email ao usuario com detalhes do reembolso.
     *
     * @since 1.0.0
     */
    private function sendRefundEmail(
        string $userId,
        string $transactionId,
        ?array $transaction,
        ?array $refundResult,
        string $subject,
        string $title,
        string $content
    ): void {
        $user = $this->repository->findUserById($userId);
        if (!$user) {
            return;
        }

        $refundDetailsHtml = buildRefundEmailDetailsHtml($transaction, $refundResult);
        if ($refundDetailsHtml !== '') {
            $content .= $refundDetailsHtml;
        }

        $bodyHtml = Mailer::htmlTemplate(
            $title,
            'Olá ' . $user['name'] . ',<br><br>' . $content,
            buildAppHashRoute('/profile', ['tab' => 'billing']),
            'Ver historico'
        );

        $billingUrl = buildAppHashRoute('/profile', ['tab' => 'billing']);
        $template = resolveSystemEmailTemplate(
            'transaction_refund_completed',
            [
                'subject' => $subject,
                'htmlBody' => $bodyHtml,
                'textBody' => "Olá {$user['name']},\n\n{$subject}\nAcompanhe em: {$billingUrl}",
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
     * Envia email de retencao personalizado a partir do motivo do reembolso.
     *
     * @since 1.0.0
     */
    private function sendRefundRetentionEmail(string $userId, array $transaction, array $offer): void
    {
        $user = $this->repository->findUserById($userId);
        if (!$user) {
            return;
        }

        $reason = trim((string) ($offer['reason_label'] ?? $transaction['refund_reason'] ?? ''));
        $highlightsHtml = '';
        foreach (($offer['highlights'] ?? []) as $highlight) {
            $highlightsHtml .= '<li>' . htmlspecialchars((string) $highlight, ENT_QUOTES, 'UTF-8') . '</li>';
        }

        $reasonHtml = $reason !== ''
            ? '<p><b>Motivo informado:</b> ' . htmlspecialchars($reason, ENT_QUOTES, 'UTF-8') . '</p>'
            : '';

        $bodyHtml = Mailer::htmlTemplate(
            (string) ($offer['title'] ?? 'Antes de encerrar seu acesso'),
            'Olá ' . $user['name'] . ',<br><br>'
                . '<p>Recebemos seu pedido de reembolso e, antes de concluir esse processo, queremos te apresentar uma alternativa melhor para o motivo informado.</p>'
                . '<p><b>Valor solicitado:</b> R$ ' . number_format((float) ($offer['refund_amount'] ?? 0), 2, ',', '.') . '<br>'
                . '<b>Plano atual:</b> ' . htmlspecialchars((string) ($offer['paid_plan'] ?? 'Plano pago'), ENT_QUOTES, 'UTF-8') . '<br>'
                . '<b>Renovação atual:</b> ' . htmlspecialchars((string) ($offer['current_renewal_at'] ?? 'não informada'), ENT_QUOTES, 'UTF-8') . '<br>'
                . '<b>Dias adicionais sem cobrança:</b> ' . (int) ($offer['offered_days'] ?? 0) . '<br>'
                . '<b>Nova renovação estimada:</b> ' . htmlspecialchars((string) ($offer['expected_renewal_at'] ?? 'a confirmar pelo provedor'), ENT_QUOTES, 'UTF-8') . '<br>'
                . '<b>Oferta válida até:</b> ' . htmlspecialchars((string) ($offer['expires_at'] ?? ''), ENT_QUOTES, 'UTF-8') . '</p>'
                . $reasonHtml
                . '<p>' . htmlspecialchars((string) ($offer['intro'] ?? ''), ENT_QUOTES, 'UTF-8') . '</p>'
                . ($highlightsHtml !== '' ? '<ul>' . $highlightsHtml . '</ul>' : '')
                . '<p>' . htmlspecialchars((string) ($offer['closing'] ?? ''), ENT_QUOTES, 'UTF-8') . '</p>',
            buildAppHashRoute('/profile', ['tab' => 'billing']),
            'Quero analisar a proposta'
        );

        $billingUrl = buildAppHashRoute('/profile', ['tab' => 'billing']);
        $template = resolveSystemEmailTemplate(
            'transaction_refund_retention_offer',
            [
                'subject' => (string) ($offer['subject'] ?? 'Uma proposta para você continuar com seu acesso'),
                'htmlBody' => $bodyHtml,
                'textBody' => "Olá {$user['name']},\n\nRecebemos seu pedido de reembolso por {$reason} e temos uma proposta para você.\nAcesse: {$billingUrl}",
            ],
            [
                'name' => (string) ($user['name'] ?? ''),
                'email' => (string) ($user['email'] ?? ''),
                'content' => strip_tags((string) ($offer['intro'] ?? '')),
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
     * Envia notificacao ao usuario apos estorno concluido.
     *
     * @since 1.0.0
     */
    private function notifyMaterialPurchaseCompleted(
        array $material,
        array $buyer,
        string $transactionId,
        float $amount,
        float $platformFee
    ): void {
        $materialTitle = trim((string) ($material['title'] ?? 'Material'));
        $buyerId = trim((string) ($buyer['id'] ?? ''));
        $buyerName = trim((string) ($buyer['name'] ?? 'Um aluno'));
        $sellerId = trim((string) ($material['author_id'] ?? ''));

        if ($buyerId !== '') {
            $amountLabel = 'R$ ' . number_format($amount, 2, ',', '.');
            createNotification(
                $this->db,
                $buyerId,
                'Material liberado',
                'Sua compra de "' . $materialTitle . '" foi confirmada por ' . $amountLabel . '. O material ja esta disponivel na sua biblioteca.',
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
            $amountLabel = 'R$ ' . number_format($netAmount, 2, ',', '.');
            createNotification(
                $this->db,
                $sellerId,
                'Nova venda no marketplace',
                $buyerName . ' comprou "' . $materialTitle . '". Valor liquido estimado: ' . $amountLabel . '.',
                'success',
                'marketplace',
                '/partner'
            );
        }

        createFinancialAdminNotification(
            $this->db,
            'Compra de material confirmada',
            'Transacao #' . $transactionId . ' liberou o material "' . $materialTitle . '" para ' . $buyerName . '.',
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
            (string) ($material['id'] ?? ''),
            $materialTitle,
            $transactionId
        );
    }

    /**
     * Envia notificacao ao usuario e vendedor apos estorno concluido.
     *
     * @since 1.0.0
     */
    private function notifyRefundProcessed(string $userId, ?array $transaction = null, array $chainResults = []): void
    {
        $transactionId = trim((string) ($transaction['id'] ?? ''));
        $refundedAmount = 0.0;
        foreach ($chainResults as $entry) {
            $refundedAmount += round((float) ($entry['transaction']['amount'] ?? 0), 2);
        }
        if ($refundedAmount <= 0) {
            $refundedAmount = round((float) ($transaction['amount'] ?? 0), 2);
        }
        $refundAmountLabel = 'R$ ' . number_format($refundedAmount, 2, ',', '.');
        $material = $this->resolveTransactionMaterialSummary($transaction);
        $materialTitle = trim((string) ($material['title'] ?? ''));
        $buyerMessage = $materialTitle !== ''
            ? 'O estorno da compra "' . $materialTitle . '" foi processado com sucesso. Valor reembolsado: ' . $refundAmountLabel . '.'
            : 'Seu estorno foi processado com sucesso. Valor reembolsado: ' . $refundAmountLabel . '.';

        createNotification(
            $this->db,
            $userId,
            'Reembolso processado',
            $buyerMessage,
            'success',
            'marketplace',
            '/profile?tab=billing',
            null,
            $refundedAmount,
            'Valor reembolsado'
        );

        $sellerId = trim((string) ($transaction['seller_id'] ?? ($material['author_id'] ?? '')));
        if ($sellerId !== '' && $sellerId !== $userId && $materialTitle !== '') {
            createNotification(
                $this->db,
                $sellerId,
                'Reembolso concluído',
                'A compra do material "' . $materialTitle . '" foi reembolsada. A venda deixou de contar como receita consolidada.',
                'warning',
                'marketplace',
                '/partner',
                null,
                $refundedAmount,
                'Valor reembolsado'
            );
        }

        createFinancialAdminNotification(
            $this->db,
            'Reembolso processado',
            'O reembolso' . ($transactionId !== '' ? ' da transação #' . $transactionId : '') . ' foi concluído no valor de ' . $refundAmountLabel . '.',
            'success',
            'finance',
            '/admin/finance/transactions',
            'finance_refund_completed',
            $refundedAmount,
            'Valor reembolsado'
        );

        applyMarketplaceRefundGamification(
            $this->db,
            $userId,
            $sellerId,
            $transactionId,
            $materialTitle !== '' ? $materialTitle : 'Material'
        );
    }

    /**
     * Envia alerta ao admin quando um reembolso e solicitado.
     *
     * @since 1.0.0
     */
    private function notifyAdminAboutRefundRequest(string $transactionId, string $reason, ?array $transaction = null): void
    {
        try {
            $material = $this->resolveTransactionMaterialSummary($transaction);
            $materialTitle = trim((string) ($material['title'] ?? ''));
            $requestedAmount = $this->resolveRefundRequestAmount($transaction);
            $requestedAmountLabel = 'R$ ' . number_format($requestedAmount, 2, ',', '.');
            $message = 'Foi registrada uma nova solicitação de reembolso para a transação #' . $transactionId . '.';
            if ($materialTitle !== '') {
                $message .= ' Material: "' . $materialTitle . '".';
            }
            if (trim($reason) !== '') {
                $message .= ' Motivo: ' . trim($reason);
            }
            $message .= ' Valor solicitado: ' . $requestedAmountLabel . '.';

            createFinancialAdminNotification(
                $this->db,
                'Reembolso aguardando análise',
                $message,
                'warning',
                'finance',
                '/admin/finance/refunds',
                'finance_refund_requested',
                $requestedAmount,
                'Valor solicitado'
            );

            $admin = $this->repository->findFirstAdmin();
            if (!$admin) {
                return;
            }

            $subject = 'Nova solicitação de reembolso - #' . $transactionId;
            $content = 'Olá ' . $admin['name'] . ',<br><br>'
                . 'Uma nova solicitação de reembolso foi registrada no sistema.<br><br>'
                . '<b>ID da transação:</b> ' . $transactionId . '<br>'
                . '<b>Valor solicitado:</b> ' . $requestedAmountLabel . '<br>'
                . '<b>Motivo:</b> ' . $reason . '<br><br>'
                . 'Acesse o painel administrativo para revisar esta solicitação.';

            $adminUrl = buildAppHashRoute('/admin');
            $bodyHtml = Mailer::htmlTemplate('Solicitação de reembolso', $content, $adminUrl, 'Abrir painel');
            $template = resolveSystemEmailTemplate(
                'transaction_refund_request_admin',
                [
                    'subject' => $subject,
                    'htmlBody' => $bodyHtml,
                    'textBody' => "Olá {$admin['name']},\n\nNova solicitação de reembolso registrada para a transação #{$transactionId}.\nValor solicitado: {$requestedAmountLabel}\nMotivo: {$reason}\n\nAbrir painel: {$adminUrl}",
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
        } catch (Throwable $e) {
            error_log('[transactions_service] admin refund request email error: ' . $e->getMessage());
        }
    }

    /**
     * Notifica o vendedor quando uma venda de material entra em pedido de estorno.
     *
     * @since 1.0.0
     */
    private function notifySellerAboutRefundRequest(?array $transaction, string $reason): void
    {
        if (!$transaction) {
            return;
        }

        $sellerId = trim((string) ($transaction['seller_id'] ?? ''));
        $buyerId = trim((string) ($transaction['user_id'] ?? ''));
        if ($sellerId === '' || $sellerId === $buyerId) {
            return;
        }

        $material = $this->resolveTransactionMaterialSummary($transaction);
        $materialTitle = trim((string) ($material['title'] ?? 'Material'));
        $requestedAmount = round((float) ($transaction['amount'] ?? 0), 2);
        $message = 'Uma compra do material "' . $materialTitle . '" recebeu pedido de reembolso no valor de R$ '
            . number_format($requestedAmount, 2, ',', '.') . '.';
        if (trim($reason) !== '') {
            $message .= ' Motivo informado: ' . trim($reason);
        }

        createNotification(
            $this->db,
            $sellerId,
            'Pedido de reembolso em análise',
            $message,
            'warning',
            'marketplace',
            '/partner',
            null,
            $requestedAmount,
            'Valor solicitado'
        );
    }

    /**
     * Soma as cobrancas elegiveis ligadas a uma compra/upgrade para que a
     * notificacao de reembolso informe o valor integral em analise.
     *
     * @since 1.0.0
     */
    private function resolveRefundRequestAmount(?array $transaction): float
    {
        if (!$transaction) {
            return 0.0;
        }

        $fallbackAmount = round((float) ($transaction['amount'] ?? 0), 2);
        if (!isPlanTransactionRefundTarget($transaction)) {
            return $fallbackAmount;
        }

        try {
            $total = 0.0;
            foreach (findRefundablePlanTransactionChain($this->db, $transaction, false) as $chainTransaction) {
                $status = strtolower(trim((string) ($chainTransaction['status'] ?? '')));
                if (!in_array($status, ['approved', 'completed', 'refund_requested'], true)) {
                    continue;
                }
                $total += round((float) ($chainTransaction['amount'] ?? 0), 2);
            }

            return $total > 0 ? round($total, 2) : $fallbackAmount;
        } catch (Throwable $error) {
            error_log('[transactions_service] refund notification amount warning: ' . $error->getMessage());
            return $fallbackAmount;
        }
    }

    /**
     * Recupera titulo/autor do material quando a transacao representa marketplace.
     *
     * @since 1.0.0
     */
    private function resolveTransactionMaterialSummary(?array $transaction): ?array
    {
        if (!$transaction || empty($transaction['material_id'])) {
            return null;
        }

        try {
            return $this->repository->findMaterialById((string) $transaction['material_id']);
        } catch (Throwable $e) {
            error_log('[transactions_service] material summary lookup failed: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Traduz codigos internos de cancelamento/reembolso para texto claro.
     *
     * @since 1.0.0
     */
    private function formatRefundReasonLabel(string $reason): string
    {
        $normalized = $this->normalizeRefundReasonForMatching($reason);
        $labels = [
            'price' => 'Valor da assinatura',
            'valor_da_assinatura' => 'Valor da assinatura',
            'usage' => 'Não estou usando o suficiente',
            'nao_estou_usando_o_suficiente' => 'Não estou usando o suficiente',
            'technical' => 'Problemas técnicos',
            'problemas_tecnicos' => 'Problemas técnicos',
            'content' => 'Falta de conteúdos específicos',
            'falta_de_conteudos_especificos' => 'Falta de conteúdos específicos',
            'other' => 'Outros motivos',
            'outros_motivos' => 'Outros motivos',
            'arrependimento' => 'Arrependimento dentro do prazo de garantia',
        ];

        return $labels[$normalized] ?? trim($reason);
    }

    /**
     * Normaliza texto para casar motivos escritos e codigos internos.
     *
     * @since 1.0.0
     */
    private function normalizeRefundReasonForMatching(string $reason): string
    {
        $value = trim($reason);
        $value = strtr($value, [
            'Á' => 'A', 'À' => 'A', 'Â' => 'A', 'Ã' => 'A', 'Ä' => 'A',
            'á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a',
            'É' => 'E', 'Ê' => 'E', 'Ë' => 'E', 'é' => 'e', 'ê' => 'e', 'ë' => 'e',
            'Í' => 'I', 'Î' => 'I', 'Ï' => 'I', 'í' => 'i', 'î' => 'i', 'ï' => 'i',
            'Ó' => 'O', 'Ô' => 'O', 'Õ' => 'O', 'Ö' => 'O', 'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o',
            'Ú' => 'U', 'Û' => 'U', 'Ü' => 'U', 'ú' => 'u', 'û' => 'u', 'ü' => 'u',
            'Ç' => 'C', 'ç' => 'c',
        ]);
        $value = function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
        $value = preg_replace('/[\s-]+/', '_', $value) ?: $value;

        return trim($value, '_');
    }

    /**
     * Monta a proposta de retencao com base no motivo informado pelo usuario.
     *
     * @since 1.0.0
     */
    private function buildRefundRetentionOffer(string $refundReason, array $transaction): array
    {
        $normalizedReason = $this->normalizeRefundReasonForMatching($refundReason);
        $isPlan = strtolower(trim((string) ($transaction['type'] ?? ''))) === 'plan';
        $productLabel = $isPlan ? 'assinatura' : 'compra';

        if (
            str_contains($normalizedReason, 'caro')
            || str_contains($normalizedReason, 'preco')
            || str_contains($normalizedReason, 'price')
            || str_contains($normalizedReason, 'valor')
            || str_contains($normalizedReason, 'custo')
            || str_contains($normalizedReason, 'mensal')
            || str_contains($normalizedReason, 'anual')
        ) {
            return [
                'subject' => 'Podemos ajustar o custo do seu acesso',
                'title' => 'Podemos ajustar o custo sem você perder seu acesso',
                'intro' => 'Se o principal ponto foi investimento, podemos te ajudar a continuar com uma rota mais leve e sem quebrar sua continuidade.',
                'highlights' => [
                    'avaliar migração para um ciclo mais confortável no seu momento atual',
                    'manter seu progresso e seu histórico de estudo sem reiniciar a jornada',
                    'seguir com acesso ativo enquanto você decide a melhor configuração',
                ],
                'closing' => 'Se fizer sentido, responda este e-mail e nossa equipe te ajuda a encontrar a alternativa mais adequada para manter sua preparação.',
            ];
        }

        if (
            str_contains($normalizedReason, 'tempo')
            || str_contains($normalizedReason, 'rotina')
            || str_contains($normalizedReason, 'correria')
            || str_contains($normalizedReason, 'sem estudar')
            || str_contains($normalizedReason, 'nao consigo')
        ) {
            return [
                'subject' => 'Podemos adaptar o ConcursoMestre à sua rotina',
                'title' => 'Sua rotina pode ser reorganizada sem perder a ' . $productLabel,
                'intro' => 'Quando o problema é falta de tempo, normalmente o melhor ajuste não é encerrar o acesso, e sim simplificar o plano de uso para manter constância.',
                'highlights' => [
                    'retomar com uma rotina mais enxuta e focada no que mais gera evolução',
                    'preservar desempenho, histórico e configurações já construídas',
                    'continuar avançando sem a pressão de recomeçar do zero depois',
                ],
                'closing' => 'Se quiser continuar, responda este e-mail e estruturamos um caminho mais viável para o seu momento.',
            ];
        }

        if (
            str_contains($normalizedReason, 'erro')
            || str_contains($normalizedReason, 'bug')
            || str_contains($normalizedReason, 'acesso')
            || str_contains($normalizedReason, 'nao funciona')
            || str_contains($normalizedReason, 'problema')
            || str_contains($normalizedReason, 'pagamento')
        ) {
            return [
                'subject' => 'Vamos resolver seu problema antes do cancelamento',
                'title' => 'Antes de cancelar, podemos resolver o problema técnico',
                'intro' => 'Se a solicitação nasceu de alguma falha operacional, faz mais sentido corrigirmos isso rapidamente do que interromper sua preparação.',
                'highlights' => [
                    'prioridade no tratamento do problema reportado',
                    'apoio direto para normalizar acesso, cobrança ou recurso afetado',
                    'continuidade do seu progresso sem perda de histórico',
                ],
                'closing' => 'Se topar, responda este e-mail com mais detalhes e nossa equipe segue com o atendimento prioritário.',
            ];
        }

        return [
            'subject' => 'Uma proposta para você continuar com seu acesso',
            'title' => 'Antes de encerrar, queremos te oferecer uma alternativa melhor',
            'intro' => 'Recebemos seu pedido e entendemos que algo não atendeu sua expectativa. Antes de concluir o reembolso, queremos te ajudar a manter seu acesso de um jeito que faça mais sentido para o seu momento.',
            'highlights' => [
                'preservar seu histórico, desempenho e configurações atuais',
                'reavaliar a melhor forma de seguir com a plataforma sem perder continuidade',
                'ter apoio humano para ajustar sua experiência de uso',
            ],
            'closing' => 'Se fizer sentido conversar antes de encerrar, basta responder este e-mail. A solicitação continua em análise até sua decisão final.',
        ];
    }

    /**
     * Gera o rotulo amigavel do metodo de pagamento.
     *
     * @since 1.0.0
     */
    private function formatTransactionPaymentMethodLabel(?string $paymentMethod, string $paymentProvider): string
    {
        $normalizedMethod = strtolower(trim((string) $paymentMethod));

        if ($normalizedMethod === '') {
            return $paymentProvider === 'stripe' ? 'Cartão' : 'Não informado';
        }

        return match ($normalizedMethod) {
            'credit_card', 'debit_card', 'master', 'visa', 'amex', 'elo', 'hipercard' => 'Cartão',
            'pix' => 'Pix',
            'bolbradesco', 'boleto' => 'Boleto',
            default => strtoupper($normalizedMethod),
        };
    }

    /**
     * Gera transacoes projetadas para parcelas Stripe futuras.
     *
     * @since 1.0.0
     */
    private function buildProjectedStripeInstallmentTransactions(string $userId, array $existingTransactions, ?array $activeSubscription = null): array
    {
        if ($userId === '') {
            return [];
        }

        $subscription = $activeSubscription ?: $this->repository->findRelevantStripeInstallmentSubscription($userId);
        if (!$subscription) {
            return [];
        }

        if (normalizePaymentProvider($subscription['payment_provider'] ?? 'stripe') !== 'stripe') {
            return [];
        }

        if (!in_array((string) ($subscription['status'] ?? ''), ['active', 'trialing'], true)) {
            return [];
        }

        $totalInstallments = max(1, (int) ($subscription['total_installments'] ?? 1));
        $paidInstallments = max(0, (int) ($subscription['paid_installments'] ?? 0));
        $recurringAmount = round((float) ($subscription['recurring_amount'] ?? 0), 2);

        if ($totalInstallments <= 1 || $paidInstallments >= $totalInstallments || $recurringAmount <= 0) {
            return [];
        }

        $currentPeriodStartTimestamp = !empty($subscription['current_period_start'])
            ? strtotime((string) $subscription['current_period_start'])
            : 0;
        if (!$currentPeriodStartTimestamp) {
            return [];
        }

        $planContext = [
            'name' => (string) ($subscription['plan_name'] ?? ''),
            'interval_unit' => (string) ($subscription['interval_unit'] ?? 'month'),
            'interval_count' => (int) ($subscription['interval_count'] ?? 1),
        ];
        $chargeIntervalDays = getStripeChargeIntervalDays($planContext, $totalInstallments);
        $nextChargeTimestamp = strtotime('+' . ($chargeIntervalDays * $paidInstallments) . ' days', $currentPeriodStartTimestamp);
        if (!$nextChargeTimestamp) {
            return [];
        }
        $nextChargeAt = date('Y-m-d H:i:s', $nextChargeTimestamp);

        $occupiedFutureSlotKeys = [];

        foreach ($existingTransactions as $transaction) {
            if (($transaction['paymentProvider'] ?? '') !== 'stripe') {
                continue;
            }

            if (($transaction['type'] ?? '') !== 'plan') {
                continue;
            }

            if ((int) ($transaction['planId'] ?? 0) !== (int) ($subscription['plan_id'] ?? 0)) {
                continue;
            }

            $normalizedStatus = strtolower((string) ($transaction['status'] ?? ''));
            if (in_array($normalizedStatus, ['approved', 'completed', 'refunded', 'refund_requested'], true)) {
                continue;
            }

            $candidateTimestamp = 0;
            if (!empty($transaction['dueDate'])) {
                $candidateTimestamp = strtotime((string) $transaction['dueDate']);
            }
            if (!$candidateTimestamp && !empty($transaction['createdAt'])) {
                $candidateTimestamp = strtotime((string) $transaction['createdAt']);
            }

            if ($currentPeriodStartTimestamp && $candidateTimestamp && $candidateTimestamp < $currentPeriodStartTimestamp) {
                continue;
            }

            $slotKey = $candidateTimestamp > 0
                ? date('Y-m-d H:i:s', $candidateTimestamp)
                : (string) ($transaction['providerInvoiceId'] ?? $transaction['referenceId'] ?? $transaction['id'] ?? '');
            if ($slotKey !== '') {
                $occupiedFutureSlotKeys[$slotKey] = true;
            }
        }

        $occupiedFutureSlots = count($occupiedFutureSlotKeys);
        $remainingInstallments = max(0, $totalInstallments - $paidInstallments - $occupiedFutureSlots);
        if ($remainingInstallments <= 0) {
            return [];
        }

        $providerSubscriptionId = trim((string) ($subscription['provider_subscription_id'] ?? $subscription['external_subscription_id'] ?? ''));
        $planName = trim((string) ($subscription['plan_name'] ?? 'Assinatura'));
        $projectedUser = $this->repository->findUserById($userId);
        $projectedBuyerName = $projectedUser['name'] ?? null;
        $projectedBuyerEmail = $projectedUser['email'] ?? null;
        $projectedTransactions = [];
        $currentInstallmentNumber = $paidInstallments + $occupiedFutureSlots + 1;
        $projectedIntervalDays = max(1, $chargeIntervalDays);
        $scheduledChargeAt = date(
            'Y-m-d H:i:s',
            strtotime('+' . ($projectedIntervalDays * $occupiedFutureSlots) . ' days', strtotime($nextChargeAt))
        );

        for ($i = 0; $i < $remainingInstallments && $currentInstallmentNumber <= $totalInstallments; $i++, $currentInstallmentNumber++) {
            $scheduledTimestamp = strtotime($scheduledChargeAt);
            if (!$scheduledTimestamp) {
                break;
            }

            $projectedTransactions[] = [
                'id' => 'projected-stripe-' . (int) $subscription['id'] . '-' . $currentInstallmentNumber,
                'internalId' => null,
                'referenceId' => $providerSubscriptionId !== '' ? $providerSubscriptionId : ('stripe-term-' . (int) $subscription['id']),
                'providerTransactionId' => $providerSubscriptionId !== '' ? $providerSubscriptionId : null,
                'providerTransactionLabel' => 'Subscription ID',
                'buyerId' => $userId,
                'buyerName' => $projectedBuyerName,
                'buyerEmail' => $projectedBuyerEmail,
                'payerEmail' => $projectedBuyerEmail,
                'userSubscriptionId' => (int) ($subscription['id'] ?? 0),
                'materialId' => null,
                'materialTitle' => null,
                'planId' => (int) ($subscription['plan_id'] ?? 0),
                'planName' => $planName,
                'transactionName' => $planName,
                'description' => $planName,
                'sellerId' => null,
                'sellerName' => 'Plataforma',
                'amount' => $recurringAmount,
                'platformFee' => 0.0,
                'netAmount' => $recurringAmount,
                'status' => 'pre-approved',
                'type' => 'plan',
                'externalId' => null,
                'paymentMethod' => 'credit_card',
                'paymentMethodLabel' => 'Cartao',
                'paymentProvider' => 'stripe',
                'providerInvoiceId' => null,
                'providerPaymentIntentId' => null,
                'providerRefundId' => null,
                'providerRefundDetails' => [],
                'providerCustomerId' => $subscription['provider_customer_id'] ?? null,
                'refundReason' => null,
                'refundRequestedAt' => null,
                'timestamp' => $scheduledTimestamp * 1000,
                'dateFormatted' => date('d/m/Y', $scheduledTimestamp),
                'dateTimeFormatted' => date('d/m/Y H:i:s', $scheduledTimestamp),
                'createdAt' => null,
                'dueDate' => $scheduledChargeAt,
                'isProjected' => true,
                'installmentNumber' => $currentInstallmentNumber,
                'installmentCount' => $totalInstallments,
                'scheduleLabel' => 'Prevista para ' . date('d/m/Y H:i:s', $scheduledTimestamp),
            ];

            $scheduledChargeAt = calculateSubscriptionRenewalPeriodRange('day', $projectedIntervalDays, $scheduledChargeAt)['end'];
        }

        return $projectedTransactions;
    }

    /**
     * Injeta metadata de parcelas em transacoes de assinaturas Stripe.
     *
     * @since 1.0.0
     */
    private function applyActiveStripeInstallmentMetadata(array $transactions, ?array $subscription): array
    {
        if (!$subscription) {
            return $transactions;
        }

        if (normalizePaymentProvider($subscription['payment_provider'] ?? 'stripe') !== 'stripe') {
            return $transactions;
        }

        $totalInstallments = max(1, (int) ($subscription['total_installments'] ?? 1));
        $paidInstallments = max(0, (int) ($subscription['paid_installments'] ?? 0));
        if ($totalInstallments <= 1 || $paidInstallments <= 0) {
            return $transactions;
        }

        $currentPeriodStartTimestamp = !empty($subscription['current_period_start'])
            ? strtotime((string) $subscription['current_period_start'])
            : 0;
        $eligibleIndexes = [];

        foreach ($transactions as $index => $transaction) {
            if (($transaction['paymentProvider'] ?? '') !== 'stripe') {
                continue;
            }

            if (($transaction['type'] ?? '') !== 'plan') {
                continue;
            }

            if ((int) ($transaction['planId'] ?? 0) !== (int) ($subscription['plan_id'] ?? 0)) {
                continue;
            }

            $normalizedStatus = strtolower((string) ($transaction['status'] ?? ''));
            if (!in_array($normalizedStatus, ['approved', 'completed', 'refunded', 'refund_requested'], true)) {
                continue;
            }

            $candidateTimestamp = !empty($transaction['createdAt'])
                ? strtotime((string) $transaction['createdAt'])
                : 0;
            if ($currentPeriodStartTimestamp && $candidateTimestamp && $candidateTimestamp < $currentPeriodStartTimestamp) {
                continue;
            }

            $eligibleIndexes[] = [
                'index' => $index,
                'timestamp' => (int) ($transaction['timestamp'] ?? 0),
            ];
        }

        if (empty($eligibleIndexes)) {
            return $transactions;
        }

        usort($eligibleIndexes, static function (array $left, array $right): int {
            return $left['timestamp'] <=> $right['timestamp'];
        });

        $visibleSuccessfulInstallments = count($eligibleIndexes);
        $startingInstallmentNumber = max(1, $paidInstallments - $visibleSuccessfulInstallments + 1);

        foreach ($eligibleIndexes as $offset => $item) {
            $installmentNumber = min($totalInstallments, $startingInstallmentNumber + $offset);
            $transactions[$item['index']]['installmentNumber'] = $installmentNumber;
            $transactions[$item['index']]['installmentCount'] = $totalInstallments;
        }

        return $transactions;
    }

    /**
     * Completa metadados de invoice Stripe no resultado final.
     *
     * @since 1.0.0
     */
    private function hydrateStripeInvoiceMetadata(array $transactions): array
    {
        if (!stripeIsConfigured()) {
            return $transactions;
        }

        $invoiceIds = [];
        foreach ($transactions as $transaction) {
            if (($transaction['paymentProvider'] ?? '') !== 'stripe') {
                continue;
            }

            $invoiceId = trim((string) ($transaction['providerInvoiceId'] ?? ''));
            if ($invoiceId !== '') {
                $invoiceIds[$invoiceId] = $invoiceId;
            }
        }

        if (empty($invoiceIds)) {
            return $transactions;
        }

        $stripe = getStripeClient();
        $invoiceCache = [];

        foreach ($invoiceIds as $invoiceId) {
            try {
                $invoice = $stripe->invoices->retrieve($invoiceId, []);
                $invoiceCache[$invoiceId] = [
                    'invoicePdfUrl' => trim((string) ($invoice->invoice_pdf ?? '')),
                    'hostedInvoiceUrl' => trim((string) ($invoice->hosted_invoice_url ?? '')),
                    'invoiceNumber' => trim((string) ($invoice->number ?? '')),
                ];
            } catch (Throwable $e) {
                $invoiceCache[$invoiceId] = [
                    'invoicePdfUrl' => '',
                    'hostedInvoiceUrl' => '',
                    'invoiceNumber' => '',
                ];
            }
        }

        foreach ($transactions as $index => $transaction) {
            $invoiceId = trim((string) ($transaction['providerInvoiceId'] ?? ''));
            if ($invoiceId === '' || empty($invoiceCache[$invoiceId])) {
                $transactions[$index]['invoicePdfUrl'] = null;
                $transactions[$index]['hostedInvoiceUrl'] = null;
                $transactions[$index]['invoiceNumber'] = null;
                continue;
            }

            $transactions[$index]['invoicePdfUrl'] = $invoiceCache[$invoiceId]['invoicePdfUrl'] !== '' ? $invoiceCache[$invoiceId]['invoicePdfUrl'] : null;
            $transactions[$index]['hostedInvoiceUrl'] = $invoiceCache[$invoiceId]['hostedInvoiceUrl'] !== '' ? $invoiceCache[$invoiceId]['hostedInvoiceUrl'] : null;
            $transactions[$index]['invoiceNumber'] = $invoiceCache[$invoiceId]['invoiceNumber'] !== '' ? $invoiceCache[$invoiceId]['invoiceNumber'] : null;
        }

        return $transactions;
    }
}
