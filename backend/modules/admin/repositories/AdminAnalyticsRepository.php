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

require_once __DIR__ . '/../../analytics/repositories/AnalyticsTrackingRepository.php';

/**
 * Repositorio das consultas analiticas do admin.
 *
 * @since 1.0.0
 */
class AdminAnalyticsRepository
{
    private AnalyticsTrackingRepository $trackingRepository;
    private array $tableColumnsCache = [];
    private array $tableExistsCache = [];

    public function __construct(private readonly PDO $db)
    {
        $this->trackingRepository = new AnalyticsTrackingRepository($db);
        $this->trackingRepository->ensureSchema();
    }

    public function fetchLifecycleEvents(?string $startDateTime = null, ?string $endDateTime = null, array $eventNames = []): array
    {
        $conditions = [];
        $params = [];

        if ($startDateTime && $endDateTime) {
            $conditions[] = 'created_at BETWEEN :start AND :end';
            $params[':start'] = $startDateTime;
            $params[':end'] = $endDateTime;
        }

        if ($eventNames !== []) {
            $placeholders = [];
            foreach (array_values($eventNames) as $index => $eventName) {
                $placeholder = ':event_' . $index;
                $placeholders[] = $placeholder;
                $params[$placeholder] = $eventName;
            }
            $conditions[] = 'event_name IN (' . implode(', ', $placeholders) . ')';
        }

        $query = 'SELECT * FROM analytics_lifecycle_events';
        if ($conditions !== []) {
            $query .= ' WHERE ' . implode(' AND ', $conditions);
        }
        $query .= ' ORDER BY created_at DESC';

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function fetchTransactions(?string $startDateTime = null, ?string $endDateTime = null): array
    {
        $refundedAtSelect = $this->columnExists('transactions', 'refunded_at')
            ? 'refunded_at'
            : 'NULL AS refunded_at';
        $refundedAmountSelect = $this->columnExists('transactions', 'refunded_amount')
            ? 'refunded_amount'
            : 'NULL AS refunded_amount';
        $providerRefundIdSelect = $this->columnExists('transactions', 'provider_refund_id')
            ? 'provider_refund_id'
            : 'NULL AS provider_refund_id';
        $planIdSelect = $this->columnExists('transactions', 'plan_id')
            ? 'plan_id'
            : 'NULL AS plan_id';
        $providerCustomerIdSelect = $this->columnExists('transactions', 'provider_customer_id')
            ? 'provider_customer_id'
            : 'NULL AS provider_customer_id';
        $providerInvoiceIdSelect = $this->columnExists('transactions', 'provider_invoice_id')
            ? 'provider_invoice_id'
            : 'NULL AS provider_invoice_id';

        $conditions = $this->buildFinancialTransactionFilters();
        $params = [];

        if ($startDateTime && $endDateTime) {
            $conditions[] = 'created_at BETWEEN :start AND :end';
            $params[':start'] = $startDateTime;
            $params[':end'] = $endDateTime;
        }

        $query = "SELECT id, user_id, {$planIdSelect}, amount, status, type, material_id, created_at,
                         {$providerCustomerIdSelect}, {$providerInvoiceIdSelect}, {$refundedAtSelect}, {$refundedAmountSelect}, {$providerRefundIdSelect}
                  FROM transactions";
        if ($conditions !== []) {
            $query .= ' WHERE ' . implode(' AND ', $conditions);
        }

        $query .= ' ORDER BY created_at DESC';

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function fetchSubscriptionsWithPlansAndUsers(): array
    {
        $planTestColumn = $this->columnExists('plans', 'is_test_plan') ? 'p.is_test_plan' : '0';
        $cardColumns = $this->buildPreferredCardSelectColumns();

        $conditions = [
            "COALESCE(us.user_id, '') NOT LIKE 'billing-e2e-%'",
        ];

        if ($this->columnExists('plans', 'is_test_plan')) {
            $conditions[] = 'COALESCE(p.is_test_plan, 0) = 0';
        }

        $stmt = $this->db->query(
            "SELECT
                us.*,
                p.name AS plan_name,
                p.price,
                p.interval_unit,
                p.interval_count,
                p.tier,
                {$planTestColumn} AS is_test_plan,
                u.name AS user_name,
                u.email AS user_email,
                {$cardColumns}
             FROM user_subscriptions us
             INNER JOIN plans p ON p.id = us.plan_id
             LEFT JOIN users u ON u.id = us.user_id
             WHERE " . implode(' AND ', $conditions) . "
             ORDER BY us.id DESC"
        );

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function getConnection(): PDO
    {
        return $this->db;
    }

    public function fetchUserDirectory(): array
    {
        $stmt = $this->db->query(
            "SELECT id, name, email, role, plan, created_at
             FROM users
             ORDER BY created_at DESC"
        );

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public function fetchPlatformCounts(): array
    {
        return [
            'users_count' => $this->countRows('users'),
            'materials_count' => $this->countRows('materials'),
            'questions_count' => $this->countRows('questions'),
            'laws_count' => $this->countRows('laws'),
            'feedback_count' => $this->countRows('user_feedback', 'parent_id IS NULL'),
            'reports_count' => $this->countRows('reports', "status = 'pending'"),
            'active_vendors_count' => $this->countRows('users', "role IN ('partner', 'admin')"),
            'published_marketplace_materials_count' => $this->countRows('materials', "status = 'approved'"),
            'comments_count' => $this->countUnifiedComments(),
            'pending_comments_count' => $this->countUnifiedCommentsByStatus('pending'),
            'approved_comments_count' => $this->countUnifiedCommentsByStatus('approved'),
            'spam_comments_count' => $this->countUnifiedCommentsByStatus('spam'),
        ];
    }

    public function countCreatedInWindow(string $table, string $column, string $startDateTime, string $endDateTime): int
    {
        if (!$this->tableExists($table) || !$this->columnExists($table, $column)) {
            return 0;
        }

        $stmt = $this->db->prepare(
            "SELECT COUNT(*)
             FROM {$table}
             WHERE {$column} BETWEEN :start AND :end"
        );
        $stmt->execute([
            ':start' => $startDateTime,
            ':end' => $endDateTime,
        ]);

        return (int) $stmt->fetchColumn();
    }

    public function countUnifiedCommentsCreatedInWindow(string $startDateTime, string $endDateTime): int
    {
        return $this->countCreatedRows('comments', 'created_at', $startDateTime, $endDateTime)
            + $this->countCreatedRows('legal_user_comments', 'created_at', $startDateTime, $endDateTime);
    }

    private function countUnifiedComments(): int
    {
        return $this->countUnifiedCommentsByStatus('pending')
            + $this->countUnifiedCommentsByStatus('approved')
            + $this->countUnifiedCommentsByStatus('spam');
    }

    private function countUnifiedCommentsByStatus(string $status): int
    {
        $commentsCount = $this->countRows('comments', "COALESCE(moderation_status, 'approved') = " . $this->db->quote($status));
        $legalCommentsCount = $this->countRows(
            'legal_user_comments',
            "status != 'deleted' AND COALESCE(moderation_status, 'approved') = " . $this->db->quote($status)
        );

        return $commentsCount + $legalCommentsCount;
    }

    private function countRows(string $table, ?string $whereClause = null): int
    {
        if (!$this->tableExists($table)) {
            return 0;
        }

        try {
            $query = "SELECT COUNT(*) FROM {$table}";
            if ($whereClause !== null && trim($whereClause) !== '') {
                $query .= " WHERE {$whereClause}";
            }

            return (int) ($this->db->query($query)->fetchColumn() ?: 0);
        } catch (Throwable) {
            return 0;
        }
    }

    private function countCreatedRows(string $table, string $column, string $startDateTime, string $endDateTime): int
    {
        if (!$this->tableExists($table) || !$this->columnExists($table, $column)) {
            return 0;
        }

        try {
            $stmt = $this->db->prepare(
                "SELECT COUNT(*)
                 FROM {$table}
                 WHERE {$column} BETWEEN :start AND :end"
            );
            $stmt->execute([
                ':start' => $startDateTime,
                ':end' => $endDateTime,
            ]);

            return (int) $stmt->fetchColumn();
        } catch (Throwable) {
            return 0;
        }
    }

    private function buildFinancialTransactionFilters(): array
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

        return $conditions;
    }

    private function buildPreferredCardSelectColumns(): string
    {
        if (!$this->tableExists('user_cards')) {
            return implode(', ', [
                '0 AS has_payment_card',
                "'' AS card_payment_provider",
                "'' AS card_brand",
                "'' AS card_last_four_digits",
                '0 AS card_exp_month',
                '0 AS card_exp_year',
                '0 AS card_is_default',
                '0 AS card_locked_by_recurring',
            ]);
        }

        $orderParts = [];
        if ($this->columnExists('user_cards', 'locked_by_recurring')) {
            $orderParts[] = 'uc.locked_by_recurring DESC';
        }
        if ($this->columnExists('user_cards', 'is_default')) {
            $orderParts[] = 'uc.is_default DESC';
        }
        if ($this->columnExists('user_cards', 'created_at')) {
            $orderParts[] = 'uc.created_at DESC';
        }
        $orderParts[] = 'uc.id DESC';
        $orderBy = implode(', ', $orderParts);

        $selectCardColumn = function (string $column, string $alias, string $fallback) use ($orderBy): string {
            if (!$this->columnExists('user_cards', $column)) {
                return "{$fallback} AS {$alias}";
            }

            return "(SELECT uc.{$column} FROM user_cards uc WHERE uc.user_id = us.user_id ORDER BY {$orderBy} LIMIT 1) AS {$alias}";
        };

        return implode(', ', [
            '(SELECT COUNT(*) FROM user_cards uc WHERE uc.user_id = us.user_id) AS has_payment_card',
            $selectCardColumn('payment_provider', 'card_payment_provider', "''"),
            $selectCardColumn('brand', 'card_brand', "''"),
            $selectCardColumn('last_four_digits', 'card_last_four_digits', "''"),
            $selectCardColumn('exp_month', 'card_exp_month', '0'),
            $selectCardColumn('exp_year', 'card_exp_year', '0'),
            $selectCardColumn('is_default', 'card_is_default', '0'),
            $selectCardColumn('locked_by_recurring', 'card_locked_by_recurring', '0'),
        ]);
    }

    private function tableExists(string $table): bool
    {
        if (!array_key_exists($table, $this->tableExistsCache)) {
            try {
                $stmt = $this->db->prepare("
                    SELECT COUNT(*)
                    FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = :table
                ");
                $stmt->execute([':table' => $table]);
                $this->tableExistsCache[$table] = (int) $stmt->fetchColumn() > 0;
            } catch (Throwable) {
                $this->tableExistsCache[$table] = false;
            }
        }

        return $this->tableExistsCache[$table];
    }

    private function columnExists(string $table, string $column): bool
    {
        if (!isset($this->tableColumnsCache[$table])) {
            $stmt = $this->db->prepare("SHOW COLUMNS FROM {$table}");
            $stmt->execute();
            $this->tableColumnsCache[$table] = array_map(
                static fn (array $row): string => (string) ($row['Field'] ?? ''),
                $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []
            );
        }

        return in_array($column, $this->tableColumnsCache[$table], true);
    }
}
