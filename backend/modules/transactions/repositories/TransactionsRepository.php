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

require_once __DIR__ . '/../../../shared/observability/RuntimeMutationEvidence.php';

/**
 * Repositorio do dominio de transacoes.
 * Concentra acesso a materiais, usuarios, transacoes e reflexos de assinatura.
 */
class TransactionsRepository
{
    private PDO $db;

    /**
     * @since 1.0.0
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Busca os dados base de um material para compra direta.
     *
     * @since 1.0.0
     */
    public function findMaterialById(string $materialId): ?array
    {
        $stmt = $this->db->prepare('SELECT id, title, price, author_id, status FROM materials WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $materialId]);
        $material = $stmt->fetch(PDO::FETCH_ASSOC);

        return $material ?: null;
    }

    /**
     * Busca e bloqueia a linha do material durante a aquisicao gratuita para
     * impedir duas compras concorrentes do mesmo usuario.
     */
    public function findMaterialByIdForUpdate(string $materialId): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id, title, price, author_id, status FROM materials WHERE id = :id LIMIT 1 FOR UPDATE'
        );
        $stmt->execute([':id' => $materialId]);
        $material = $stmt->fetch(PDO::FETCH_ASSOC);

        return $material ?: null;
    }

    /**
     * Busca o usuario pelo identificador para validar a compra.
     *
     * @since 1.0.0
     */
    public function findUserById(string $userId): ?array
    {
        $stmt = $this->db->prepare('SELECT id, name, email FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }

    /**
     * Retorna o primeiro admin para notificacoes de fallback.
     *
     * @since 1.0.0
     */
    public function findFirstAdmin(): ?array
    {
        $stmt = $this->db->query("SELECT id, name, email FROM users WHERE role = 'admin' LIMIT 1");
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);

        return $admin ?: null;
    }

    /**
     * Verifica se um usuario ja comprou um material com sucesso.
     *
     * @since 1.0.0
     */
    public function hasCompletedMaterialPurchase(string $userId, string $materialId): bool
    {
        $stmt = $this->db->prepare("
            SELECT id
            FROM transactions
            WHERE user_id = :user_id
              AND material_id = :material_id
              AND status IN ('completed', 'approved')
            LIMIT 1
        ");
        $stmt->execute([
            ':user_id' => $userId,
            ':material_id' => $materialId,
        ]);

        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Registra a transacao de compra imediata de material.
     *
     * @since 1.0.0
     */
    public function createMaterialPurchaseTransaction(
        string $userId,
        string $materialId,
        string $sellerId,
        float $amount,
        float $platformFee
    ): int {
        $stmt = $this->db->prepare("
            INSERT INTO transactions (
                user_id,
                material_id,
                seller_id,
                amount,
                platform_fee,
                status,
                type,
                created_at
            ) VALUES (
                :user_id,
                :material_id,
                :seller_id,
                :amount,
                :platform_fee,
                'completed',
                'material',
                NOW()
            )
        ");
        $stmt->execute([
            ':user_id' => $userId,
            ':material_id' => $materialId,
            ':seller_id' => $sellerId,
            ':amount' => $amount,
            ':platform_fee' => $platformFee,
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Incrementa o contador de vendas do material apos a compra.
     *
     * @since 1.0.0
     */
    public function incrementMaterialSalesCount(string $materialId): void
    {
        $stmt = $this->db->prepare('UPDATE materials SET sales_count = sales_count + 1 WHERE id = :id');
        $stmt->execute([':id' => $materialId]);
    }

    /**
     * Busca uma transacao elegivel para reembolso do usuario.
     *
     * @since 1.0.0
     */
    public function findRefundableTransactionForUser(string $transactionId, string $userId, array $statuses): ?array
    {
        $placeholders = implode(',', array_fill(0, count($statuses), '?'));
        $params = array_merge([$transactionId, $userId], $statuses);
        $stmt = $this->db->prepare("
            SELECT *
            FROM transactions
            WHERE id = ?
              AND user_id = ?
              AND status IN ({$placeholders})
            LIMIT 1
        ");
        $stmt->execute($params);

        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);
        return $transaction ?: null;
    }

    /**
     * Marca a transacao como reembolso solicitado.
     *
     * @since 1.0.0
     */
    public function markRefundRequested(string $transactionId, string $userId, string $reason): void
    {
        $stmt = $this->db->prepare("
            UPDATE transactions
            SET status = 'refund_requested',
                refund_reason = :refund_reason,
                refund_requested_at = NOW()
            WHERE id = :id
              AND user_id = :user_id
        ");
        $stmt->execute([
            ':refund_reason' => $reason,
            ':id' => $transactionId,
            ':user_id' => $userId,
        ]);
    }

    /**
     * Busca uma transacao especifica pelo identificador.
     *
     * @since 1.0.0
     */
    public function findTransactionById(string $transactionId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM transactions WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $transactionId]);
        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);

        return $transaction ?: null;
    }

    /**
     * Busca e bloqueia a transacao para mutacoes financeiras idempotentes.
     *
     * @since 1.0.0
     */
    public function findTransactionByIdForUpdate(string $transactionId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM transactions WHERE id = :id LIMIT 1 FOR UPDATE');
        $stmt->execute([':id' => $transactionId]);
        $transaction = $stmt->fetch(PDO::FETCH_ASSOC);

        return $transaction ?: null;
    }

    public function findRetentionOfferForTransaction(string $transactionId, bool $forUpdate = false): ?array
    {
        $lock = $forUpdate ? ' FOR UPDATE' : '';
        $stmt = $this->db->prepare("SELECT * FROM refund_retention_offers WHERE transaction_id = :transaction_id LIMIT 1{$lock}");
        $stmt->execute([':transaction_id' => $transactionId]);
        $offer = $stmt->fetch(PDO::FETCH_ASSOC);
        return $offer ?: null;
    }

    public function findRetentionOfferForUser(string $offerId, string $userId, bool $forUpdate = false): ?array
    {
        $lock = $forUpdate ? ' FOR UPDATE' : '';
        $stmt = $this->db->prepare("SELECT * FROM refund_retention_offers WHERE id = :id AND user_id = :user_id LIMIT 1{$lock}");
        $stmt->execute([':id' => $offerId, ':user_id' => $userId]);
        $offer = $stmt->fetch(PDO::FETCH_ASSOC);
        return $offer ?: null;
    }

    public function createRetentionOffer(array $offer): void
    {
        $stmt = $this->db->prepare(
            'INSERT INTO refund_retention_offers (
                id, transaction_id, user_id, status, refund_amount, paid_plan,
                current_renewal_at, offered_days, expected_renewal_at, expires_at,
                user_note, internal_note, benefit_definition_id, idempotency_key, created_by
            ) VALUES (
                :id, :transaction_id, :user_id, :status, :refund_amount, :paid_plan,
                :current_renewal_at, :offered_days, :expected_renewal_at, :expires_at,
                :user_note, :internal_note, :benefit_definition_id, :idempotency_key, :created_by
            )'
        );
        $stmt->execute([
            ':id' => $offer['id'],
            ':transaction_id' => $offer['transaction_id'],
            ':user_id' => $offer['user_id'],
            ':status' => $offer['status'] ?? 'PENDING',
            ':refund_amount' => $offer['refund_amount'],
            ':paid_plan' => $offer['paid_plan'],
            ':current_renewal_at' => $offer['current_renewal_at'],
            ':offered_days' => $offer['offered_days'],
            ':expected_renewal_at' => $offer['expected_renewal_at'],
            ':expires_at' => $offer['expires_at'],
            ':user_note' => $offer['user_note'],
            ':internal_note' => $offer['internal_note'],
            ':benefit_definition_id' => $offer['benefit_definition_id'],
            ':idempotency_key' => $offer['idempotency_key'],
            ':created_by' => $offer['created_by'],
        ]);
    }

    public function updateRetentionOffer(string $offerId, array $fields, ?string $whereStatus = null): void
    {
        $allowed = ['status', 'benefit_grant_id', 'provider_confirmed_at', 'provider_reference', 'failure_reason', 'user_decision_at', 'expired_at'];
        $sets = [];
        $params = [':id' => $offerId];
        foreach ($fields as $field => $value) {
            if (!in_array($field, $allowed, true)) {
                continue;
            }
            $sets[] = "{$field} = :{$field}";
            $params[":{$field}"] = $value;
        }
        if (!$sets) {
            return;
        }
        $statusClause = '';
        if ($whereStatus !== null) {
            $statusClause = ' AND status = :where_status';
            $params[':where_status'] = $whereStatus;
        }
        $stmt = $this->db->prepare('UPDATE refund_retention_offers SET ' . implode(', ', $sets) . ', updated_at = NOW() WHERE id = :id' . $statusClause);
        $stmt->execute($params);
    }

    /**
     * Atualiza o status de uma transacao no banco.
     *
     * @since 1.0.0
     */
    public function updateTransactionStatus(string $transactionId, string $status): void
    {
        $stmt = $this->db->prepare('UPDATE transactions SET status = :status WHERE id = :id');
        $stmt->execute([
            ':status' => $status,
            ':id' => $transactionId,
        ]);
    }

    /**
     * Cancela assinaturas ativas do usuario durante o reembolso.
     *
     * @since 1.0.0
     */
    public function cancelActiveSubscriptionsForUser(string $userId): void
    {
        $stmt = $this->db->prepare("
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
        ");
        $stmt->execute([':user_id' => $userId]);
    }

    /**
     * Reseta o plano do usuario para o estado gratuito.
     *
     * @since 1.0.0
     */
    public function resetUserPlanToFree(string $userId): void
    {
        $stmt = $this->db->prepare("
            UPDATE users
            SET current_plan_id = NULL,
                plan = 'Gratuito',
                subscription_end = NULL
            WHERE id = :user_id
        ");
        $stmt->execute([':user_id' => $userId]);
    }

    /**
     * Desbloqueia cartoes do usuario apos ajustes de assinatura.
     *
     * @since 1.0.0
     */
    public function unlockUserCards(string $userId): void
    {
        $stmt = $this->db->prepare("
            UPDATE user_cards
            SET locked_by_recurring = 0
            WHERE user_id = :user_id
        ");
        $stmt->execute([':user_id' => $userId]);
        RuntimeMutationEvidence::record('user_cards', 'UPDATE', 'http-auth-account', 'billing_card_refund_unlock');
    }

    /**
     * Localiza assinatura parcelada ativa no Stripe para reembolso.
     *
     * @since 1.0.0
     */
    public function findRelevantStripeInstallmentSubscription(string $userId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT us.*, p.name AS plan_name, p.price AS plan_price, p.interval_unit, p.interval_count
            FROM user_subscriptions us
            JOIN plans p ON us.plan_id = p.id
            WHERE us.user_id = :user_id
              AND COALESCE(us.payment_provider, 'stripe') = 'stripe'
              AND COALESCE(us.total_installments, 1) > 1
              AND COALESCE(us.paid_installments, 0) < COALESCE(us.total_installments, 1)
              AND us.status IN ('active', 'trialing')
            ORDER BY us.id DESC
            LIMIT 1
        ");
        $stmt->execute([':user_id' => $userId]);

        $subscription = $stmt->fetch(PDO::FETCH_ASSOC);
        return $subscription ?: null;
    }

    /**
     * Consolida totais financeiros para o painel administrativo.
     *
     * @since 1.0.0
     */
    public function fetchTransactionTotals(string $whereClause, array $params): array
    {
        $recognizedRevenueAmount = "
            CASE
                WHEN t.status IN ('approved', 'completed', 'refund_requested', 'partially_refunded')
                    THEN GREATEST(0, COALESCE(t.amount, 0) - COALESCE(NULLIF(t.refunded_amount, 0), 0))
                ELSE 0
            END
        ";
        $recognizedFeeAmount = "
            CASE
                WHEN t.status IN ('approved', 'completed', 'refund_requested', 'partially_refunded')
                     AND COALESCE(t.amount, 0) > 0
                    THEN ROUND(
                        COALESCE(t.platform_fee, 0)
                        * ({$recognizedRevenueAmount})
                        / COALESCE(t.amount, 1),
                        2
                    )
                ELSE 0
            END
        ";

        $recognizedSellerPayable = "
            CASE
                WHEN t.type = 'material'
                    THEN GREATEST(0, ({$recognizedRevenueAmount}) - ({$recognizedFeeAmount}))
                ELSE 0
            END
        ";

        $recognizedPlatformRevenue = "
            CASE
                WHEN t.type = 'plan' THEN ({$recognizedRevenueAmount})
                WHEN t.type = 'material' THEN ({$recognizedFeeAmount})
                ELSE ({$recognizedFeeAmount})
            END
        ";

        $query = "SELECT
                    COUNT(*) as total_count,
                    COALESCE(SUM(CASE WHEN t.status IN ('approved', 'completed', 'refund_requested', 'partially_refunded', 'refunded') THEN COALESCE(t.amount, 0) ELSE 0 END), 0) AS gross_captured,
                    COALESCE(SUM(CASE WHEN t.status IN ('refunded', 'partially_refunded') THEN COALESCE(NULLIF(t.refunded_amount, 0), t.amount, 0) ELSE 0 END), 0) AS refunded_amount,
                    COALESCE(SUM({$recognizedRevenueAmount}), 0) as recognized_gross,
                    COALESCE(SUM({$recognizedPlatformRevenue}), 0) as platform_revenue,
                    COALESCE(SUM({$recognizedSellerPayable}), 0) as seller_payable,
                    COALESCE(SUM(rc.referral_payable), 0) as referral_payable,
                    COALESCE(SUM({$recognizedPlatformRevenue}), 0) - COALESCE(SUM(rc.referral_payable), 0) as platform_net,
                    SUM(CASE WHEN t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                             THEN {$recognizedSellerPayable}
                             ELSE 0 END) as total_held
                  FROM transactions t
                  LEFT JOIN (
                      SELECT transaction_id, SUM(amount) AS referral_payable
                      FROM referral_commission_entries
                      GROUP BY transaction_id
                  ) rc ON rc.transaction_id = t.id
                  {$whereClause}";

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);

        return $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Retorna a lista de transacoes com detalhes de material e usuario.
     *
     * @since 1.0.0
     */
    public function fetchTransactionRows(string $whereClause, array $params, int $limit, int $offset): array
    {
        $query = "SELECT
                    t.*,
                    m.title AS materialTitle,
                    s.name AS sellerName,
                    b.name AS buyerName,
                    b.email AS buyerEmail,
                    p.name AS storedPlanName,
                    us.total_installments AS subscriptionTotalInstallments,
                    us.paid_installments AS subscriptionPaidInstallments,
                    t.provider_payment_intent_id,
                    t.provider_invoice_id,
                    t.provider_refund_id,
                    t.provider_customer_id,
                    t.provider_refund_details_json,
                    t.refund_reason,
                    t.refund_requested_at,
                    rro.id AS retention_offer_id,
                    rro.status AS retention_offer_status,
                    rro.refund_amount AS retention_offer_refund_amount,
                    rro.paid_plan AS retention_offer_paid_plan,
                    rro.current_renewal_at AS retention_offer_current_renewal_at,
                    rro.offered_days AS retention_offer_offered_days,
                    rro.expected_renewal_at AS retention_offer_expected_renewal_at,
                    rro.expires_at AS retention_offer_expires_at,
                    rro.user_note AS retention_offer_user_note,
                    rro.provider_confirmed_at AS retention_offer_provider_confirmed_at,
                    rro.provider_reference AS retention_offer_provider_reference,
                    rro.benefit_grant_id AS retention_offer_benefit_grant_id,
                    COALESCE(rc.referralPayable, 0) AS referralPayable
                  FROM transactions t
                  LEFT JOIN materials m ON t.material_id = m.id
                  LEFT JOIN plans p ON t.plan_id = p.id
                  LEFT JOIN user_subscriptions us ON t.user_subscription_id = us.id
                  LEFT JOIN users s ON t.seller_id = s.id
                  LEFT JOIN users b ON t.user_id = b.id
                  LEFT JOIN refund_retention_offers rro ON rro.transaction_id = t.id
                  LEFT JOIN (
                      SELECT transaction_id, SUM(amount) AS referralPayable
                      FROM referral_commission_entries
                      GROUP BY transaction_id
                  ) rc ON rc.transaction_id = t.id
                  {$whereClause}
                  ORDER BY COALESCE(t.due_date, t.created_at) DESC, t.id DESC
                  LIMIT {$limit} OFFSET {$offset}";

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
}
