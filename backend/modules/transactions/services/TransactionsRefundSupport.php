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
 * Suporte transversal do dominio de transacoes para estornos e metadados de reembolso.
 * Centraliza a integracao com gateways e a montagem de informacoes exibidas ao usuario.
 */
require_once dirname(__DIR__, 3) . '/config/payment_provider.php';
require_once dirname(__DIR__, 3) . '/config/stripe.php';
require_once dirname(__DIR__, 3) . '/modules/subscriptions/services/SubscriptionsBillingSupport.php';
require_once dirname(__DIR__, 2) . '/finance/services/FinancialLedger.php';
require_once dirname(__DIR__, 3) . '/shared/observability/RuntimeMutationEvidence.php';

/**
 * Normaliza o rotulo do tipo de referencia bancaria do reembolso.
 *
 * @since 1.0.0
 */
function formatRefundReferenceTypeLabel(?string $type): string
{
    $normalized = strtolower(trim((string) $type));
    $labels = [
        'acquirer_reference_number' => 'Numero de referencia da adquirente (ARN)',
        'arn' => 'Numero de referencia da adquirente (ARN)',
        'rrn' => 'Numero de referencia de recuperacao (RRN)',
        'stan' => 'Numero de sequencia da transacao (STAN)',
    ];

    return $labels[$normalized] ?? strtoupper($normalized ?: 'Referencia bancaria');
}

/**
 * Normaliza o status de referencia bancaria retornado pelo gateway.
 *
 * @since 1.0.0
 */
function formatRefundReferenceStatusLabel(?string $status): string
{
    $normalized = strtolower(trim((string) $status));
    $labels = [
        'available' => 'Disponivel',
        'pending' => 'Pendente',
        'unavailable' => 'Indisponivel',
    ];

    return $labels[$normalized] ?? ($normalized !== '' ? ucfirst($normalized) : '');
}

/**
 * Extrai os metadados de reembolso retornados pela Stripe.
 *
 * @since 1.0.0
 */
function extractStripeRefundDetails($refund): array
{
    $destinationType = trim((string) ($refund->destination_details->type ?? ''));
    $destinationPayload = null;

    if ($destinationType !== '' && isset($refund->destination_details->{$destinationType})) {
        $destinationPayload = $refund->destination_details->{$destinationType};
    }

    return [
        'refund_amount' => isset($refund->amount) ? round(((float) $refund->amount) / 100, 2) : null,
        'currency' => strtoupper(trim((string) ($refund->currency ?? 'BRL'))),
        'refund_status' => trim((string) ($refund->status ?? '')),
        'refund_created_at' => !empty($refund->created) ? date('Y-m-d H:i:s', (int) $refund->created) : null,
        'destination_type' => $destinationType,
        'reference' => trim((string) ($destinationPayload->reference ?? '')),
        'reference_type' => trim((string) ($destinationPayload->reference_type ?? '')),
        'reference_status' => trim((string) ($destinationPayload->reference_status ?? '')),
        'network_decline_code' => trim((string) ($destinationPayload->network_decline_code ?? '')),
    ];
}

/**
 * Monta o resumo de detalhes do reembolso para envio em email.
 *
 * @since 1.0.0
 */
function getRefundEmailDetails(?array $transaction = null, ?array $refundResult = null): array
{
    $refundDetails = is_array($refundResult['provider_refund_details'] ?? null)
        ? $refundResult['provider_refund_details']
        : [];

    if (empty($refundDetails) && !empty($transaction['provider_refund_details_json'])) {
        $decoded = json_decode((string) $transaction['provider_refund_details_json'], true);
        if (is_array($decoded)) {
            $refundDetails = $decoded;
        }
    }

    $transactionReference = trim((string) (
        $refundResult['provider_payment_intent_id']
        ?? $transaction['provider_payment_intent_id']
        ?? $refundResult['provider_invoice_id']
        ?? $transaction['provider_invoice_id']
        ?? $transaction['external_id']
        ?? ''
    ));

    return [
        'transaction_reference' => $transactionReference,
        'refund_id' => trim((string) ($refundResult['provider_refund_id'] ?? $transaction['provider_refund_id'] ?? '')),
        'refund_status' => trim((string) ($refundDetails['refund_status'] ?? $refundResult['gateway_status'] ?? '')),
        'refund_created_at' => trim((string) ($refundDetails['refund_created_at'] ?? '')),
        'reference' => trim((string) ($refundDetails['reference'] ?? '')),
        'reference_type' => trim((string) ($refundDetails['reference_type'] ?? '')),
        'reference_type_label' => formatRefundReferenceTypeLabel((string) ($refundDetails['reference_type'] ?? '')),
        'reference_status' => trim((string) ($refundDetails['reference_status'] ?? '')),
        'reference_status_label' => formatRefundReferenceStatusLabel((string) ($refundDetails['reference_status'] ?? '')),
        'destination_type' => trim((string) ($refundDetails['destination_type'] ?? '')),
    ];
}

/**
 * Gera o HTML informativo com dados do reembolso para o email.
 *
 * @since 1.0.0
 */
function buildRefundEmailDetailsHtml(?array $transaction = null, ?array $refundResult = null): string
{
    $details = getRefundEmailDetails($transaction, $refundResult);
    $lines = [];

    if ($details['transaction_reference'] !== '') {
        $lines[] = '<b>Referencia da cobranca:</b> ' . htmlspecialchars($details['transaction_reference'], ENT_QUOTES, 'UTF-8');
    }

    if ($details['refund_id'] !== '') {
        $lines[] = '<b>ID do reembolso:</b> ' . htmlspecialchars($details['refund_id'], ENT_QUOTES, 'UTF-8');
    }

    if ($details['refund_status'] !== '') {
        $lines[] = '<b>Status do reembolso:</b> ' . htmlspecialchars($details['refund_status'], ENT_QUOTES, 'UTF-8');
    }

    if ($details['reference'] !== '') {
        $label = $details['reference_type_label'] ?: 'Referencia bancaria do reembolso';
        $lines[] = '<b>' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . ':</b> ' . htmlspecialchars($details['reference'], ENT_QUOTES, 'UTF-8');
    }

    if ($details['reference_status_label'] !== '') {
        $lines[] = '<b>Status da referencia bancaria:</b> ' . htmlspecialchars($details['reference_status_label'], ENT_QUOTES, 'UTF-8');
    }

    if ($details['refund_created_at'] !== '') {
        $timestamp = strtotime($details['refund_created_at']);
        if ($timestamp) {
            $lines[] = '<b>Reembolso registrado em:</b> ' . date('d/m/Y H:i', $timestamp);
        }
    }

    if ($details['reference'] !== '') {
        $lines[] = 'Se necessario, compartilhe essa referencia com o banco ou emissor do cartao para acompanhar o estorno.';
    }

    return $lines ? implode('<br>', $lines) : '';
}

/**
 * Resolve o PaymentIntent a partir da lista oficial de invoice payments da Stripe.
 *
 * @since 1.0.0
 */
function resolveStripePaymentIntentIdFromInvoicePayments($stripe, string $invoiceId): string
{
    if ($invoiceId === '' || !isset($stripe->invoicePayments)) {
        return '';
    }

    $collection = $stripe->invoicePayments->all([
        'invoice' => $invoiceId,
        'limit' => 10,
        'expand' => ['data.payment.payment_intent'],
    ]);

    if (!isset($collection->data) || !is_iterable($collection->data)) {
        return '';
    }

    foreach ($collection->data as $invoicePayment) {
        if (isset($invoicePayment->payment)) {
            if (is_string($invoicePayment->payment) && str_starts_with($invoicePayment->payment, 'pi_')) {
                return $invoicePayment->payment;
            }

            if (is_object($invoicePayment->payment)) {
                $paymentIntentId = getStripeObjectId($invoicePayment->payment->payment_intent ?? null);
                if ($paymentIntentId !== '') {
                    return $paymentIntentId;
                }

                $paymentId = getStripeObjectId($invoicePayment->payment);
                if (str_starts_with($paymentId, 'pi_')) {
                    return $paymentId;
                }
            }
        }

        $directPaymentIntentId = getStripeObjectId($invoicePayment->payment_intent ?? null);
        if ($directPaymentIntentId !== '') {
            return $directPaymentIntentId;
        }
    }

    return '';
}

/**
 * Procura o PaymentIntent do cliente quando a invoice nao expoe o vinculo diretamente.
 *
 * @since 1.0.0
 */
function resolveStripePaymentIntentIdByCustomerSearch($stripe, $invoice): string
{
    if (!is_object($invoice)) {
        return '';
    }

    $customerId = getStripeObjectId($invoice->customer ?? null);
    if ($customerId === '') {
        return '';
    }

    $invoiceId = trim((string) ($invoice->id ?? ''));
    $invoiceAmount = (int) ($invoice->amount_paid ?? $invoice->amount_due ?? 0);
    $invoiceCreated = (int) ($invoice->created ?? 0);
    $paymentIntents = $stripe->paymentIntents->all([
        'customer' => $customerId,
        'limit' => 20,
    ]);

    if (!isset($paymentIntents->data) || !is_iterable($paymentIntents->data)) {
        return '';
    }

    foreach ($paymentIntents->data as $paymentIntent) {
        $intentInvoiceId = getStripeObjectId($paymentIntent->invoice ?? null);
        if ($invoiceId !== '' && $intentInvoiceId === $invoiceId) {
            return getStripeObjectId($paymentIntent);
        }
    }

    foreach ($paymentIntents->data as $paymentIntent) {
        $intentStatus = (string) ($paymentIntent->status ?? '');
        $intentAmount = (int) ($paymentIntent->amount_received ?? $paymentIntent->amount ?? 0);
        $intentCreated = (int) ($paymentIntent->created ?? 0);

        if ($intentStatus !== 'succeeded' || $intentAmount !== $invoiceAmount) {
            continue;
        }

        if ($invoiceCreated > 0 && abs($intentCreated - $invoiceCreated) > 3600) {
            continue;
        }

        return getStripeObjectId($paymentIntent);
    }

    return '';
}

/**
 * Resolve o PaymentIntent da Stripe associado a uma transacao.
 *
 * @since 1.0.0
 */
function resolveStripePaymentIntentIdForTransaction(PDO $db, array $transaction, $stripe = null): string
{
    $paymentIntentId = trim((string) ($transaction['provider_payment_intent_id'] ?? ''));
    if ($paymentIntentId !== '') {
        return $paymentIntentId;
    }

    $stripe = $stripe ?: getStripeClient();
    $invoiceId = trim((string) ($transaction['provider_invoice_id'] ?? ''));
    $externalId = trim((string) ($transaction['external_id'] ?? ''));

    if ($invoiceId === '' && str_starts_with($externalId, 'in_')) {
        $invoiceId = $externalId;
    }

    if ($invoiceId !== '') {
        $invoice = $stripe->invoices->retrieve($invoiceId, ['expand' => ['payment_intent']]);
        $paymentIntentId = getStripeInvoicePaymentIntentId($invoice);

        if ($paymentIntentId === '') {
            $paymentIntentId = resolveStripePaymentIntentIdFromInvoicePayments($stripe, $invoiceId);
        }

        if ($paymentIntentId === '') {
            $paymentIntentId = resolveStripePaymentIntentIdByCustomerSearch($stripe, $invoice);
        }

        if ($paymentIntentId !== '') {
            $db->prepare("
                UPDATE transactions
                SET provider_invoice_id = :provider_invoice_id,
                    provider_payment_intent_id = :provider_payment_intent_id
                WHERE id = :id
            ")->execute([
                ':provider_invoice_id' => $invoiceId,
                ':provider_payment_intent_id' => $paymentIntentId,
                ':id' => (int) $transaction['id'],
            ]);

            return $paymentIntentId;
        }
    }

    if (str_starts_with($externalId, 'pi_')) {
        $paymentIntentId = $externalId;
    }

    if ($paymentIntentId === '') {
        throw new RuntimeException('Nao foi possivel localizar o PaymentIntent da cobranca Stripe para reembolso.');
    }

    return $paymentIntentId;
}

/**
 * Executa o reembolso no gateway correto para a transacao informada.
 *
 * @since 1.0.0
 */
function processGatewayRefundForTransaction(PDO $db, array $transaction, ?string $refundReason = null): array
{
    $currentStatus = strtolower(trim((string) ($transaction['status'] ?? '')));
    $existingRefundId = trim((string) ($transaction['provider_refund_id'] ?? ''));

    if ($currentStatus === 'refunded' || $existingRefundId !== '') {
        throw new RuntimeException('Esta transacao ja foi reembolsada anteriormente.');
    }

    $paymentProvider = normalizePaymentProvider($transaction['payment_provider'] ?? 'stripe');

    if ($paymentProvider === 'stripe') {
        if (!stripeIsConfigured()) {
            throw new RuntimeException('Stripe nao configurado para processar o reembolso.');
        }

        $stripe = getStripeClient();
        $paymentIntentId = resolveStripePaymentIntentIdForTransaction($db, $transaction, $stripe);
        $metadata = [
            'transaction_id' => (string) ($transaction['id'] ?? ''),
            'user_id' => (string) ($transaction['user_id'] ?? ''),
        ];

        $note = trim((string) ($refundReason ?? ''));
        if ($note !== '') {
            $metadata['refund_reason_note'] = substr($note, 0, 450);
        }

        $refund = $stripe->refunds->create([
            'payment_intent' => $paymentIntentId,
            'reason' => 'requested_by_customer',
            'metadata' => $metadata,
        ], [
            'idempotency_key' => 'transaction_refund_' . (string) ($transaction['id'] ?? sha1($paymentIntentId)),
        ]);

        $refundDetails = extractStripeRefundDetails($refund);
        $refundId = getStripeObjectId($refund);

        return [
            'payment_provider' => 'stripe',
            'provider_refund_id' => $refundId,
            'provider_payment_intent_id' => $paymentIntentId,
            'provider_invoice_id' => trim((string) ($transaction['provider_invoice_id'] ?? $transaction['external_id'] ?? '')),
            'gateway_status' => (string) ($refund->status ?? ''),
            'provider_refund_details' => $refundDetails,
        ];
    }

    throw new RuntimeException('Reembolso indisponivel para transacoes legadas fora da Stripe.');
}

/**
 * Determina se a transacao reembolsada representa uma assinatura.
 *
 * @since 1.0.0
 */
function isPlanTransactionRefundTarget(array $transaction): bool
{
    $type = strtolower(trim((string) ($transaction['type'] ?? '')));
    return $type === 'plan' || (($transaction['material_id'] ?? null) === null && $type !== 'material');
}

/**
 * Localiza a assinatura local mais provavel para a cobranca informada.
 *
 * @since 1.0.0
 */
function findSubscriptionNearPlanTransaction(PDO $db, array $transaction): ?array
{
    if (!isPlanTransactionRefundTarget($transaction)) {
        return null;
    }

    $userId = trim((string) ($transaction['user_id'] ?? ''));
    $planId = (int) ($transaction['plan_id'] ?? 0);
    $createdAt = trim((string) ($transaction['created_at'] ?? ''));
    if ($userId === '' || $planId <= 0 || $createdAt === '') {
        return null;
    }

    $paymentProvider = normalizePaymentProvider($transaction['payment_provider'] ?? 'stripe');
    $providerCustomerId = trim((string) ($transaction['provider_customer_id'] ?? ''));

    $query = "
        SELECT *
        FROM user_subscriptions
        WHERE user_id = :user_id
          AND plan_id = :plan_id
          AND (payment_provider = :payment_provider OR payment_provider IS NULL OR payment_provider = '')
          AND created_at BETWEEN DATE_SUB(:created_at_start, INTERVAL 1 DAY) AND DATE_ADD(:created_at_end, INTERVAL 1 DAY)
    ";
    $params = [
        ':user_id' => $userId,
        ':plan_id' => $planId,
        ':payment_provider' => $paymentProvider,
        ':created_at_start' => $createdAt,
        ':created_at_end' => $createdAt,
        ':created_at_order' => $createdAt,
    ];

    if ($providerCustomerId !== '') {
        $query .= " AND (provider_customer_id = :provider_customer_id OR provider_customer_id IS NULL OR provider_customer_id = '')";
        $params[':provider_customer_id'] = $providerCustomerId;
    }

    $query .= "
        ORDER BY ABS(TIMESTAMPDIFF(SECOND, created_at, :created_at_order)) ASC, id DESC
        LIMIT 1
    ";

    $stmt = $db->prepare($query);
    $stmt->execute($params);

    $subscription = $stmt->fetch(PDO::FETCH_ASSOC);
    return $subscription ?: null;
}

/**
 * Coleta assinaturas locais ligadas por upgrade/substituicao.
 *
 * @since 1.0.0
 */
function collectSubscriptionUpgradeChain(PDO $db, array $subscription): array
{
    $rootId = (int) ($subscription['id'] ?? 0);
    $userId = trim((string) ($subscription['user_id'] ?? ''));
    if ($rootId <= 0 || $userId === '') {
        return [];
    }

    $chain = [$rootId => $subscription];
    $cursor = $subscription;

    for ($i = 0; $i < 12; $i++) {
        $nextId = (int) ($cursor['superseded_by_subscription_id'] ?? 0);
        if ($nextId <= 0 || isset($chain[$nextId])) {
            break;
        }

        $stmt = $db->prepare('SELECT * FROM user_subscriptions WHERE id = :id AND user_id = :user_id LIMIT 1');
        $stmt->execute([':id' => $nextId, ':user_id' => $userId]);
        $next = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$next) {
            break;
        }

        $chain[$nextId] = $next;
        $cursor = $next;
    }

    for ($i = 0; $i < 12; $i++) {
        $ids = array_keys($chain);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $params = array_merge([$userId], $ids);
        $stmt = $db->prepare("
            SELECT *
            FROM user_subscriptions
            WHERE user_id = ?
              AND superseded_by_subscription_id IN ({$placeholders})
            ORDER BY id ASC
        ");
        $stmt->execute($params);

        $added = false;
        foreach (($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) as $previous) {
            $previousId = (int) ($previous['id'] ?? 0);
            if ($previousId <= 0 || isset($chain[$previousId])) {
                continue;
            }

            $chain[$previousId] = $previous;
            $added = true;
        }

        if (!$added) {
            break;
        }
    }

    uasort($chain, static function (array $left, array $right): int {
        return strtotime((string) ($left['created_at'] ?? '')) <=> strtotime((string) ($right['created_at'] ?? ''));
    });

    return array_values($chain);
}

/**
 * Localiza cobrancas pagas da mesma cadeia de upgrade para reembolso conjunto.
 *
 * @since 1.0.0
 */
function findRefundablePlanTransactionChain(PDO $db, array $transaction, bool $forUpdate = false): array
{
    if (!isPlanTransactionRefundTarget($transaction)) {
        return [$transaction];
    }

    $userId = trim((string) ($transaction['user_id'] ?? ''));
    $paymentProvider = normalizePaymentProvider($transaction['payment_provider'] ?? 'stripe');
    $transactionId = (int) ($transaction['id'] ?? 0);
    if ($userId === '' || $transactionId <= 0) {
        return [$transaction];
    }

    $subscription = findSubscriptionNearPlanTransaction($db, $transaction);
    if (!$subscription) {
        return [$transaction];
    }

    $subscriptions = collectSubscriptionUpgradeChain($db, $subscription);
    if (empty($subscriptions)) {
        return [$transaction];
    }

    $planIds = [];
    $timestamps = [];
    foreach ($subscriptions as $subscriptionRow) {
        $planId = (int) ($subscriptionRow['plan_id'] ?? 0);
        if ($planId > 0) {
            $planIds[$planId] = $planId;
        }

        foreach (['created_at', 'current_period_start'] as $field) {
            $timestamp = strtotime((string) ($subscriptionRow[$field] ?? ''));
            if ($timestamp) {
                $timestamps[] = $timestamp;
            }
        }
    }

    $selectedCreatedAt = strtotime((string) ($transaction['created_at'] ?? ''));
    if ($selectedCreatedAt) {
        $timestamps[] = $selectedCreatedAt;
    }

    if (empty($planIds) || empty($timestamps)) {
        return [$transaction];
    }

    $windowStart = date('Y-m-d H:i:s', min($timestamps) - 900);
    $windowEnd = date('Y-m-d H:i:s', max($timestamps) + 21600);
    $providerCustomerId = trim((string) ($transaction['provider_customer_id'] ?? ''));
    $planPlaceholders = implode(',', array_fill(0, count($planIds), '?'));

    $query = "
        SELECT *
        FROM transactions
        WHERE user_id = ?
          AND type = 'plan'
          AND COALESCE(amount, 0) > 0
          AND payment_provider = ?
          AND status IN ('approved', 'completed', 'refund_requested')
          AND (provider_refund_id IS NULL OR provider_refund_id = '')
          AND refunded_at IS NULL
          AND created_at BETWEEN ? AND ?
          AND plan_id IN ({$planPlaceholders})
    ";
    $params = array_merge([$userId, $paymentProvider, $windowStart, $windowEnd], array_values($planIds));

    if ($providerCustomerId !== '') {
        $query .= " AND (provider_customer_id = ? OR provider_customer_id IS NULL OR provider_customer_id = '')";
        $params[] = $providerCustomerId;
    }

    $query .= " ORDER BY created_at ASC, id ASC";
    if ($forUpdate) {
        $query .= " FOR UPDATE";
    }

    $stmt = $db->prepare($query);
    $stmt->execute($params);

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if (empty($rows)) {
        return [$transaction];
    }

    return $rows;
}

/**
 * Marca como pendentes as demais cobrancas da mesma cadeia de upgrade.
 *
 * @since 1.0.0
 */
function markPlanRefundChainAsRequested(PDO $db, array $transaction, string $reason): int
{
    $chain = findRefundablePlanTransactionChain($db, $transaction, false);
    $ids = [];
    foreach ($chain as $candidate) {
        $status = strtolower(trim((string) ($candidate['status'] ?? '')));
        $id = (int) ($candidate['id'] ?? 0);
        if ($id <= 0 || !in_array($status, ['approved', 'completed'], true)) {
            continue;
        }

        $ids[] = $id;
    }

    if (empty($ids)) {
        return 0;
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $db->prepare("
        UPDATE transactions
        SET status = 'refund_requested',
            refund_reason = ?,
            refund_requested_at = COALESCE(refund_requested_at, NOW())
        WHERE id IN ({$placeholders})
    ");
    $stmt->execute(array_merge([$reason], $ids));

    return $stmt->rowCount();
}

/**
 * Resolve o invoice id Stripe associado a transacao.
 *
 * @since 1.0.0
 */
function resolveStripeInvoiceIdFromTransaction(array $transaction, ?array $refundResult = null): string
{
    $invoiceId = trim((string) ($refundResult['provider_invoice_id'] ?? ''));
    if ($invoiceId === '') {
        $invoiceId = trim((string) ($transaction['provider_invoice_id'] ?? ''));
    }

    if ($invoiceId !== '') {
        return $invoiceId;
    }

    $externalId = trim((string) ($transaction['external_id'] ?? ''));
    if ($externalId !== '' && str_starts_with($externalId, 'in_')) {
        return $externalId;
    }

    return '';
}

/**
 * Extrai o subscription id Stripe a partir do payload da invoice.
 *
 * @since 1.0.0
 */
function resolveStripeSubscriptionIdFromInvoiceObject($invoice): string
{
    if (!is_object($invoice)) {
        return '';
    }

    $subscriptionId = getStripeObjectId($invoice->subscription ?? null);
    if ($subscriptionId !== '') {
        return $subscriptionId;
    }

    $subscriptionId = getStripeObjectId($invoice->parent->subscription_details->subscription ?? null);
    if ($subscriptionId !== '') {
        return $subscriptionId;
    }

    if (isset($invoice->lines->data) && is_iterable($invoice->lines->data)) {
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

    return '';
}

/**
 * Resolve o subscription id Stripe vinculado a cobranca reembolsada.
 *
 * @since 1.0.0
 */
function resolveStripeSubscriptionIdForTransactionRefund(PDO $db, array $transaction, ?array $refundResult = null, $stripe = null): string
{
    if (!stripeIsConfigured()) {
        return '';
    }

    if (normalizePaymentProvider($transaction['payment_provider'] ?? 'stripe') !== 'stripe') {
        return '';
    }

    $stripe = $stripe ?: getStripeClient();
    $invoiceId = resolveStripeInvoiceIdFromTransaction($transaction, $refundResult);
    $paymentIntentId = trim((string) (
        $refundResult['provider_payment_intent_id']
        ?? $transaction['provider_payment_intent_id']
        ?? ''
    ));

    if ($invoiceId !== '') {
        try {
            $invoice = $stripe->invoices->retrieve($invoiceId, [
                'expand' => ['subscription', 'lines.data.subscription'],
            ]);
            $subscriptionId = resolveStripeSubscriptionIdFromInvoiceObject($invoice);
            if ($subscriptionId !== '') {
                return $subscriptionId;
            }

            if ($paymentIntentId === '') {
                $paymentIntentId = getStripeInvoicePaymentIntentId($invoice);
            }
        } catch (Throwable $e) {
            error_log('[transactions_refund_support] stripe invoice resolve warning: ' . $e->getMessage());
        }
    }

    if ($paymentIntentId !== '') {
        try {
            $paymentIntent = $stripe->paymentIntents->retrieve($paymentIntentId, [
                'expand' => ['invoice.subscription', 'invoice.lines.data.subscription'],
            ]);
            $invoiceFromIntent = $paymentIntent->invoice ?? null;

            if ($invoiceFromIntent) {
                if (is_object($invoiceFromIntent)) {
                    $subscriptionId = resolveStripeSubscriptionIdFromInvoiceObject($invoiceFromIntent);
                    if ($subscriptionId !== '') {
                        return $subscriptionId;
                    }
                } else {
                    $invoiceFromIntentId = getStripeObjectId($invoiceFromIntent);
                    if ($invoiceFromIntentId !== '') {
                        $invoice = $stripe->invoices->retrieve($invoiceFromIntentId, [
                            'expand' => ['subscription', 'lines.data.subscription'],
                        ]);
                        $subscriptionId = resolveStripeSubscriptionIdFromInvoiceObject($invoice);
                        if ($subscriptionId !== '') {
                            return $subscriptionId;
                        }
                    }
                }
            }
        } catch (Throwable $e) {
            error_log('[transactions_refund_support] stripe payment intent resolve warning: ' . $e->getMessage());
        }
    }

    $customerId = trim((string) ($transaction['provider_customer_id'] ?? ''));
    if ($customerId === '') {
        return '';
    }

    try {
        $subscriptions = $stripe->subscriptions->all([
            'customer' => $customerId,
            'status' => 'all',
            'limit' => 10,
            'expand' => ['data.latest_invoice', 'data.latest_invoice.payment_intent'],
        ]);
    } catch (Throwable $e) {
        error_log('[transactions_refund_support] stripe subscription list warning: ' . $e->getMessage());
        return '';
    }

    foreach (($subscriptions->data ?? []) as $subscription) {
        $candidateId = trim((string) ($subscription->id ?? ''));
        if ($candidateId === '') {
            continue;
        }

        $latestInvoiceId = getStripeObjectId($subscription->latest_invoice ?? null);
        if ($invoiceId !== '' && $latestInvoiceId === $invoiceId) {
            return $candidateId;
        }

        if ($paymentIntentId !== '' && is_object($subscription->latest_invoice)) {
            $latestPaymentIntentId = getStripeInvoicePaymentIntentId($subscription->latest_invoice);
            if ($latestPaymentIntentId !== '' && $latestPaymentIntentId === $paymentIntentId) {
                return $candidateId;
            }
        }
    }

    return '';
}

/**
 * Cancela localmente assinaturas afetadas por reembolso.
 *
 * @since 1.0.0
 */
function cancelLocalSubscriptionsForRefund(PDO $db, string $userId, ?string $providerSubscriptionId = null, int $planId = 0): int
{
    $safeUserId = trim($userId);
    if ($safeUserId === '') {
        return 0;
    }

    $safeProviderSubscriptionId = trim((string) $providerSubscriptionId);
    if ($safeProviderSubscriptionId !== '') {
        $stmt = $db->prepare("
            UPDATE user_subscriptions
            SET status = 'canceled',
                auto_renew = 0,
                cancel_at_period_end = 0,
                current_period_end = NOW(),
                provider_current_period_end = NOW(),
                next_renewal_amount = NULL,
                next_renewal_date = NULL,
                next_renewal_price_source = NULL,
                next_renewal_cycle_label = NULL,
                next_renewal_snapshot_json = NULL
            WHERE user_id = :user_id
              AND provider_subscription_id = :provider_subscription_id
        ");
        $stmt->execute([
            ':user_id' => $safeUserId,
            ':provider_subscription_id' => $safeProviderSubscriptionId,
        ]);

        return $stmt->rowCount();
    }

    $query = "
        UPDATE user_subscriptions
        SET status = 'canceled',
            auto_renew = 0,
            cancel_at_period_end = 0,
            current_period_end = NOW(),
            provider_current_period_end = NOW(),
            next_renewal_amount = NULL,
            next_renewal_date = NULL,
            next_renewal_price_source = NULL,
            next_renewal_cycle_label = NULL,
            next_renewal_snapshot_json = NULL
        WHERE user_id = :user_id
          AND status IN ('active', 'trialing', 'past_due', 'incomplete')
    ";
    $params = [':user_id' => $safeUserId];
    if ($planId > 0) {
        $query .= " AND plan_id = :plan_id";
        $params[':plan_id'] = $planId;
    }

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    return $stmt->rowCount();
}

/**
 * Ajusta snapshot local do usuario apos cancelamento ligado a reembolso.
 *
 * @since 1.0.0
 */
function syncUserSnapshotAfterRefundedSubscription(PDO $db, string $userId): void
{
    $safeUserId = trim($userId);
    if ($safeUserId === '') {
        return;
    }

    $activeStmt = $db->prepare("
        SELECT COUNT(*)
        FROM user_subscriptions
        WHERE user_id = :user_id
          AND status IN ('active', 'trialing', 'past_due', 'incomplete')
    ");
    $activeStmt->execute([':user_id' => $safeUserId]);
    $activeCount = (int) $activeStmt->fetchColumn();

    if ($activeCount <= 0) {
        $db->prepare("
            UPDATE users
            SET current_plan_id = NULL,
                plan = 'Gratuito',
                subscription_end = NULL
            WHERE id = :user_id
        ")->execute([':user_id' => $safeUserId]);
    }

    $db->prepare("
        UPDATE user_cards
        SET locked_by_recurring = 0
        WHERE user_id = :user_id
    ")->execute([':user_id' => $safeUserId]);
    RuntimeMutationEvidence::record('user_cards', 'UPDATE', 'http-auth-account', 'billing_card_refund_unlock');
}

/**
 * Cancela imediatamente a assinatura Stripe associada ao reembolso.
 *
 * @since 1.0.0
 */
function cancelStripeSubscriptionImmediatelyAfterRefund(PDO $db, array $transaction, ?array $refundResult = null): array
{
    $result = [
        'attempted' => false,
        'payment_provider' => normalizePaymentProvider($transaction['payment_provider'] ?? 'stripe'),
        'subscription_id' => null,
        'remote_canceled' => false,
        'local_canceled' => false,
        'warning' => null,
    ];

    if (!isPlanTransactionRefundTarget($transaction)) {
        return $result;
    }

    $userId = trim((string) ($transaction['user_id'] ?? ''));
    if ($userId === '') {
        $result['warning'] = 'Transacao de plano sem user_id valido para sincronizar cancelamento apos reembolso.';
        return $result;
    }

    $result['attempted'] = true;
    $planId = (int) ($transaction['plan_id'] ?? 0);
    $paymentProvider = (string) $result['payment_provider'];

    if ($paymentProvider !== 'stripe' || !stripeIsConfigured()) {
        $localAffected = cancelLocalSubscriptionsForRefund($db, $userId, null, $planId);
        syncUserSnapshotAfterRefundedSubscription($db, $userId);
        $result['local_canceled'] = $localAffected > 0;
        return $result;
    }

    $stripe = getStripeClient();
    $providerSubscriptionId = resolveStripeSubscriptionIdForTransactionRefund($db, $transaction, $refundResult, $stripe);

    if ($providerSubscriptionId !== '') {
        $result['subscription_id'] = $providerSubscriptionId;
        try {
            $remoteSubscription = $stripe->subscriptions->retrieve($providerSubscriptionId, []);
            $remoteStatus = strtolower(trim((string) ($remoteSubscription->status ?? '')));
            if ($remoteStatus === 'canceled') {
                $result['remote_canceled'] = true;
            } else {
                $stripe->subscriptions->cancel($providerSubscriptionId, []);
                $result['remote_canceled'] = true;
            }
        } catch (Throwable $e) {
            $errorMessage = trim($e->getMessage());
            if (stripos($errorMessage, 'No such subscription') !== false) {
                $result['remote_canceled'] = true;
            } else {
                $result['warning'] = 'Falha ao cancelar assinatura Stripe imediatamente apos reembolso: ' . $errorMessage;
                error_log('[transactions_refund_support] ' . $result['warning']);
            }
        }

        $localAffected = cancelLocalSubscriptionsForRefund($db, $userId, $providerSubscriptionId, $planId);
        if ($localAffected <= 0) {
            $localAffected = cancelLocalSubscriptionsForRefund($db, $userId, null, $planId);
        }
        $result['local_canceled'] = $localAffected > 0;
        syncUserSnapshotAfterRefundedSubscription($db, $userId);

        return $result;
    }

    $result['warning'] = 'Assinatura Stripe vinculada ao reembolso nao foi localizada pela cobranca (invoice/payment_intent).';
    error_log('[transactions_refund_support] ' . $result['warning']);

    $localAffected = cancelLocalSubscriptionsForRefund($db, $userId, null, $planId);
    $result['local_canceled'] = $localAffected > 0;
    syncUserSnapshotAfterRefundedSubscription($db, $userId);

    return $result;
}

/**
 * Marca a transacao como reembolsada e persiste metadados.
 *
 * @since 1.0.0
 */
function markTransactionAsRefunded(PDO $db, string $transactionId, ?string $refundReason, array $refundResult): void
{
    $refundAmount = round((float) ($refundResult['provider_refund_details']['refund_amount'] ?? 0), 2);
    $stmt = $db->prepare("
        UPDATE transactions
        SET status = CASE
                WHEN :status_refunded_amount > 0 AND :status_refunded_amount < amount THEN 'partially_refunded'
                ELSE 'refunded'
            END,
            refund_reason = :refund_reason,
            refund_requested_at = NOW(),
            refunded_at = NOW(),
            refunded_amount = CASE
                WHEN :stored_refunded_amount > 0 THEN :stored_refunded_amount
                ELSE amount
            END,
            provider_refund_id = :provider_refund_id,
            provider_payment_intent_id = CASE
                WHEN provider_payment_intent_id IS NULL OR provider_payment_intent_id = ''
                    THEN :provider_payment_intent_id
                ELSE provider_payment_intent_id
            END,
            provider_refund_details_json = :provider_refund_details_json,
            provider_invoice_id = CASE
                WHEN provider_invoice_id IS NULL OR provider_invoice_id = ''
                    THEN :provider_invoice_id
                ELSE provider_invoice_id
            END
        WHERE id = :id
    ");

    $stmt->execute([
        ':refund_reason' => $refundReason,
        ':status_refunded_amount' => $refundAmount,
        ':stored_refunded_amount' => $refundAmount,
        ':provider_refund_id' => trim((string) ($refundResult['provider_refund_id'] ?? '')),
        ':provider_payment_intent_id' => trim((string) ($refundResult['provider_payment_intent_id'] ?? '')),
        ':provider_refund_details_json' => json_encode($refundResult['provider_refund_details'] ?? [], JSON_UNESCAPED_UNICODE),
        ':provider_invoice_id' => trim((string) ($refundResult['provider_invoice_id'] ?? '')),
        ':id' => $transactionId,
    ]);

    FinancialLedger::syncTransactionById($db, (int) $transactionId, 'refund_gateway');
}

/**
 * Localiza a ultima transacao de plano elegivel a reembolso.
 *
 * @since 1.0.0
 */
function getLatestRefundablePlanTransactionForUser(
    PDO $db,
    string $userId,
    string $paymentProvider,
    bool $forUpdate = false,
    ?array $subscription = null
): ?array {
    $query = "
        SELECT *
        FROM transactions
        WHERE user_id = :user_id
          AND type = 'plan'
          AND payment_provider = :payment_provider
          AND COALESCE(amount, 0) > 0
          AND status IN ('approved', 'completed', 'refund_requested')
    ";
    $params = [
        ':user_id' => $userId,
        ':payment_provider' => $paymentProvider,
    ];

    if ($subscription) {
        $subscriptionPlanId = (int) ($subscription['plan_id'] ?? 0);
        if ($subscriptionPlanId > 0) {
            $query .= " AND plan_id = :plan_id";
            $params[':plan_id'] = $subscriptionPlanId;
        }

        $currentPeriodStart = trim((string) ($subscription['current_period_start'] ?? ''));
        $currentPeriodStartTimestamp = $currentPeriodStart !== '' ? strtotime($currentPeriodStart) : 0;
        if ($currentPeriodStartTimestamp) {
            $query .= " AND created_at >= :current_period_start";
            $params[':current_period_start'] = date('Y-m-d H:i:s', $currentPeriodStartTimestamp);
        }
    }

    $query .= "
        ORDER BY COALESCE(due_date, created_at) DESC, created_at DESC, id DESC
        LIMIT 1
    ";

    if ($forUpdate) {
        $query .= " FOR UPDATE";
    }

    $stmt = $db->prepare($query);
    $stmt->execute($params);

    $transaction = $stmt->fetch(PDO::FETCH_ASSOC);
    return $transaction ?: null;
}
