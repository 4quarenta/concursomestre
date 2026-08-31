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
 * Repositorio de metricas administrativas.
 * Centraliza acesso a dados agregados usados pelo dashboard do admin.
 */
class AdminStatsRepository
{
    private PDO $db;
    /** @var array<string, bool> */
    private array $tableExistsCache = [];
    /** @var array<string, bool> */
    private array $columnExistsCache = [];

    /**
     * Inicializa o repositorio com a conexao PDO.
     *
     * @since 1.0.0
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Lista transacoes filtradas para agregacao financeira.
     *
     * @since 1.0.0
     */
    public function fetchTransactions(string $dateCondition, array $params): array
    {
        if (!$this->tableExists('transactions')) {
            return [];
        }

        $providerRefundIdSelect = $this->columnExists('transactions', 'provider_refund_id')
            ? 'provider_refund_id'
            : "NULL AS provider_refund_id";
        $refundedAtSelect = $this->columnExists('transactions', 'refunded_at')
            ? 'refunded_at'
            : "NULL AS refunded_at";

        $query = "
            SELECT amount, platform_fee, type, material_id, created_at, status, {$providerRefundIdSelect}, {$refundedAtSelect}
            FROM transactions
            WHERE status IN ('completed', 'approved', 'refunded', 'refund_requested', 'cancelled', 'canceled', 'failed', 'rejected')"
            . $this->buildFinancialTransactionExclusionCondition()
            . $dateCondition;

        $stmt = $this->db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Retorna totais de assinaturas agrupados por status.
     *
     * @since 1.0.0
     */
    public function fetchSubscriptionStatusCounts(string $now): array
    {
        if (!$this->tableExists('user_subscriptions')) {
            return [];
        }

        $stmt = $this->db->prepare("
            SELECT normalized_status as status, COUNT(*) as count
            FROM (
                SELECT
                    CASE
                        WHEN us.status IN ('active', 'trialing') AND us.current_period_end < :now THEN 'expired'
                        ELSE us.status
                    END as normalized_status
                FROM user_subscriptions us
                " . $this->buildPlanJoinForFinancialAggregates('us') . "
                WHERE " . $this->buildSubscriptionFinancialFilter('us') . "
            ) normalized
            GROUP BY normalized_status
        ");
        $stmt->bindValue(':now', $now);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Lista planos ativos para calculo de MRR.
     *
     * @since 1.0.0
     */
    public function fetchActiveSubscriptionPlans(string $now): array
    {
        if (!$this->tableExists('user_subscriptions') || !$this->tableExists('plans')) {
            return [];
        }

        $stmt = $this->db->prepare("
            SELECT p.price, p.interval_unit, p.interval_count, us.recurring_amount, us.total_installments
            FROM user_subscriptions us
            JOIN plans p ON us.plan_id = p.id
            WHERE us.status = 'active'
              AND us.current_period_end >= :now
              AND COALESCE(us.payment_provider, '') <> 'manual_admin'
              AND COALESCE(us.auto_renew, 0) = 1
              AND COALESCE(us.cancel_at_period_end, 0) = 0
              AND " . $this->buildSubscriptionFinancialFilter('us', 'p') . "
        ");
        $stmt->bindValue(':now', $now);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Conta novos usuarios no periodo selecionado.
     *
     * @since 1.0.0
     */
    public function countNewUsers(string $dateCondition, array $params): int
    {
        if (!$this->tableExists('users')) {
            return 0;
        }

        $stmt = $this->db->prepare('SELECT COUNT(*) as count FROM users WHERE 1=1 ' . $dateCondition);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();

        return (int) ($stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0);
    }

    /**
     * Conta questoes cadastradas no periodo selecionado.
     *
     * @since 1.0.0
     */
    public function countNewQuestions(string $dateCondition, array $params): int
    {
        if (!$this->tableExists('questions')) {
            return 0;
        }

        $stmt = $this->db->prepare('SELECT COUNT(*) as count FROM questions WHERE 1=1 ' . $dateCondition);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();

        return (int) ($stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0);
    }

    /**
     * Retorna contadores globais usados no painel admin.
     *
     * @return array{
     *   questions_count:int,
     *   users_count:int,
     *   materials_count:int,
     *   pending_materials_count:int,
     *   rankings_count:int,
     *   feedback_count:int,
     *   support_threads_count:int
     * }
     *
     * @since 1.0.0
     */
    public function fetchGlobalCounters(): array
    {
        return [
            'questions_count' => $this->safeCount('questions'),
            'users_count' => $this->safeCount('users'),
            'materials_count' => $this->safeCount('materials'),
            'pending_materials_count' => $this->safeCount('materials', "status = 'pending'"),
            'rankings_count' => $this->safeCount('rankings'),
            'feedback_count' => $this->safeCount(
                'user_feedback',
                "parent_id IS NULL
                 AND COALESCE(status, 'new') <> 'resolved'
                 AND (
                    type IN ('platform-rating', 'bug', 'suggestion', 'other')
                    OR reason LIKE 'Avaliar plataforma%'
                    OR public_rating BETWEEN 1 AND 5
                 )"
            ),
            'support_threads_count' => $this->safeCount(
                'user_feedback',
                "parent_id IS NULL
                 AND COALESCE(status, 'new') <> 'resolved'
                 AND type = 'support'
                 AND (
                    reason NOT LIKE 'Avaliar plataforma%'
                    AND COALESCE(public_rating, 0) = 0
                 )"
            ),
        ];
    }

    private function safeCount(string $tableName, string $where = ''): int
    {
        if (!$this->tableExists($tableName)) {
            return 0;
        }

        $sql = 'SELECT COUNT(*) FROM ' . $tableName;
        if ($where !== '') {
            $sql .= ' WHERE ' . $where;
        }

        return (int) ($this->db->query($sql)->fetchColumn() ?: 0);
    }

    private function buildFinancialTransactionExclusionCondition(): string
    {
        $conditions = [
            "COALESCE(user_id, '') NOT LIKE 'billing-e2e-%'",
        ];

        if ($this->columnExists('transactions', 'payer_email')) {
            $conditions[] = "COALESCE(payer_email, '') NOT LIKE 'billing-e2e-%'";
        }

        if (
            $this->tableExists('plans')
            && $this->columnExists('transactions', 'plan_id')
            && $this->columnExists('plans', 'is_test_plan')
        ) {
            $conditions[] = "NOT EXISTS (
                SELECT 1
                FROM plans p_test
                WHERE p_test.id = transactions.plan_id
                  AND COALESCE(p_test.is_test_plan, 0) = 1
            )";
        }

        return ' AND ' . implode(' AND ', $conditions);
    }

    private function buildPlanJoinForFinancialAggregates(string $subscriptionAlias): string
    {
        if (!$this->tableExists('plans')) {
            return '';
        }

        return "LEFT JOIN plans p_fin ON p_fin.id = {$subscriptionAlias}.plan_id";
    }

    private function buildSubscriptionFinancialFilter(string $subscriptionAlias, string $planAlias = 'p_fin'): string
    {
        $conditions = [
            "COALESCE({$subscriptionAlias}.user_id, '') NOT LIKE 'billing-e2e-%'",
        ];

        if ($this->tableExists('plans') && $this->columnExists('plans', 'is_test_plan')) {
            $conditions[] = "COALESCE({$planAlias}.is_test_plan, 0) = 0";
        }

        return implode(' AND ', $conditions);
    }

    private function tableExists(string $tableName): bool
    {
        if (array_key_exists($tableName, $this->tableExistsCache)) {
            return $this->tableExistsCache[$tableName];
        }

        $stmt = $this->db->prepare('SHOW TABLES LIKE :table_name');
        $stmt->execute([':table_name' => $tableName]);
        $this->tableExistsCache[$tableName] = (bool) $stmt->fetch(PDO::FETCH_NUM);

        return $this->tableExistsCache[$tableName];
    }

    private function columnExists(string $tableName, string $columnName): bool
    {
        $cacheKey = $tableName . '.' . $columnName;
        if (array_key_exists($cacheKey, $this->columnExistsCache)) {
            return $this->columnExistsCache[$cacheKey];
        }

        if (!$this->tableExists($tableName)) {
            $this->columnExistsCache[$cacheKey] = false;
            return false;
        }

        $stmt = $this->db->prepare("SHOW COLUMNS FROM {$tableName} LIKE :column_name");
        $stmt->execute([':column_name' => $columnName]);
        $this->columnExistsCache[$cacheKey] = (bool) $stmt->fetch(PDO::FETCH_ASSOC);

        return $this->columnExistsCache[$cacheKey];
    }
}
