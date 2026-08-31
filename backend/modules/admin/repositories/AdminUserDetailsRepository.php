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
 * Repositorio do fluxo administrativo de detalhes do usuario.
 * Centraliza consultas resilientes ao schema real do ambiente.
 */
class AdminUserDetailsRepository
{
    private PDO $db;
    /** @var array<string, bool> */
    private array $tableCache = [];
    /** @var array<string, array<int, string>> */
    private array $columnCache = [];

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
     * Busca o perfil completo do usuario com joins opcionais.
     *
     * @since 1.0.0
     */
    public function findProfileById(string $userId): ?array
    {
        if (!$this->tableExists('users')) {
            return null;
        }

        $selects = ['u.*'];
        $joins = [];

        if ($this->tableExists('addresses')) {
            $joins[] = 'LEFT JOIN addresses a ON u.id = a.user_id';
            foreach (['zip_code', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'] as $column) {
                if ($this->columnExists('addresses', $column)) {
                    $selects[] = "a.{$column} AS {$column}";
                }
            }
        }

        if ($this->tableExists('bank_accounts')) {
            $joins[] = 'LEFT JOIN bank_accounts b ON u.id = b.user_id';
            foreach (['bank_code', 'bank_name', 'agency', 'account', 'account_digit', 'holder_name', 'holder_document', 'account_type'] as $column) {
                if ($this->columnExists('bank_accounts', $column)) {
                    $selects[] = "b.{$column} AS {$column}";
                }
            }
        }

        $query = "
            SELECT " . implode(",\n                   ", $selects) . "
            FROM users u
            " . implode("\n            ", $joins) . "
            WHERE u.id = :id
            LIMIT 1
        ";

        $stmt = $this->db->prepare($query);
        $stmt->execute([':id' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }

    /**
     * Lista assinaturas vinculadas ao usuario.
     *
     * @since 1.0.0
     */
    public function fetchSubscriptions(string $userId): array
    {
        if (!$this->tableExists('user_subscriptions')) {
            return [];
        }

        $selects = ['us.*'];
        $joins = [];
        $orderBy = 'us.id DESC';

        if ($this->tableExists('plans')) {
            $joins[] = 'LEFT JOIN plans p ON us.plan_id = p.id';
            if ($this->columnExists('plans', 'name')) {
                $selects[] = 'p.name AS plan_name';
            }
            if ($this->columnExists('plans', 'price')) {
                $selects[] = 'p.price AS price';
            }
        }

        if ($this->columnExists('user_subscriptions', 'current_period_start')) {
            $orderBy = 'us.current_period_start DESC';
        }

        $stmt = $this->db->prepare("
            SELECT " . implode(', ', $selects) . "
            FROM user_subscriptions us
            " . implode("\n", $joins) . "
            WHERE us.user_id = :id
            ORDER BY {$orderBy}
        ");
        $stmt->execute([':id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Lista os planos disponiveis para a operacao manual do admin.
     *
     * @since 1.0.0
     */
    public function fetchAvailablePlans(): array
    {
        if (!$this->tableExists('plans')) {
            return [];
        }

        $columns = $this->getTableColumns('plans');
        $selects = array_values(array_intersect(
            ['id', 'name', 'price', 'interval_count', 'interval_unit', 'active'],
            $columns
        ));

        if ($selects === []) {
            return [];
        }

        $stmt = $this->db->query("
            SELECT " . implode(', ', $selects) . "
            FROM plans
            ORDER BY " . (in_array('price', $columns, true) ? 'price ASC, ' : '') . "id ASC
        ");

        return $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
    }

    /**
     * Lista transacoes relevantes do usuario.
     *
     * @since 1.0.0
     */
    public function fetchTransactions(string $userId): array
    {
        if (!$this->tableExists('transactions')) {
            return [];
        }

        $columns = $this->getTableColumns('transactions');
        $whereParts = [];

        if (in_array('user_id', $columns, true) && in_array('type', $columns, true)) {
            $whereParts[] = "(t.user_id = :id AND t.type = 'plan')";
            $whereParts[] = "(t.user_id = :id AND t.type = 'material_purchase')";
        }

        if (in_array('seller_id', $columns, true) && in_array('type', $columns, true)) {
            $whereParts[] = "(t.seller_id = :id AND t.type = 'material_sale')";
        }

        if ($whereParts === []) {
            return [];
        }

        $orderColumn = in_array('created_at', $columns, true)
            ? 't.created_at'
            : (in_array('timestamp', $columns, true) ? 't.timestamp' : 't.id');

        $stmt = $this->db->prepare("
            SELECT t.*
            FROM transactions t
            WHERE " . implode(' OR ', $whereParts) . "
            ORDER BY {$orderColumn} DESC
        ");
        $stmt->execute([':id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Lista materiais comprados pelo usuario.
     *
     * @since 1.0.0
     */
    public function fetchPurchasedMaterials(string $userId): array
    {
        if (!$this->tableExists('transactions') || !$this->tableExists('materials')) {
            return [];
        }

        $transactionColumns = $this->getTableColumns('transactions');
        $materialColumns = $this->getTableColumns('materials');
        if (!in_array('material_id', $transactionColumns, true) || !in_array('id', $materialColumns, true)) {
            return [];
        }

        $purchaseDateColumn = in_array('created_at', $transactionColumns, true)
            ? 't.created_at'
            : (in_array('timestamp', $transactionColumns, true) ? 't.timestamp' : 'NULL');

        $titleColumn = in_array('title', $materialColumns, true) ? 'm.title' : 'NULL';
        $priceColumn = in_array('price', $materialColumns, true) ? 'm.price' : '0';

        $stmt = $this->db->prepare("
            SELECT m.id, {$titleColumn} AS title, {$priceColumn} AS price, {$purchaseDateColumn} AS purchase_date
            FROM transactions t
            JOIN materials m ON t.material_id = m.id
            WHERE t.user_id = :id
              AND t.type = 'material_purchase'
            ORDER BY {$purchaseDateColumn} DESC
        ");
        $stmt->execute([':id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Conta comentarios feitos pelo usuario em questoes.
     *
     * @since 1.0.0
     */
    public function fetchCommentsCount(string $userId): int
    {
        if (!$this->tableExists('comments')) {
            return 0;
        }

        $columns = $this->getTableColumns('comments');
        if (!in_array('user_id', $columns, true)) {
            return 0;
        }

        $where = 'user_id = :id';
        if (in_array('target_type', $columns, true)) {
          $where .= " AND target_type = 'question'";
        }

        $stmt = $this->db->prepare("SELECT COUNT(*) AS exact_count FROM comments WHERE {$where}");
        $stmt->execute([':id' => $userId]);

        return (int) (($stmt->fetch(PDO::FETCH_ASSOC) ?: [])['exact_count'] ?? 0);
    }

    /**
     * Lista os comentarios mais recentes do usuario.
     *
     * @since 1.0.0
     */
    public function fetchRecentComments(string $userId): array
    {
        if (!$this->tableExists('comments')) {
            return [];
        }

        $columns = $this->getTableColumns('comments');
        if (!in_array('user_id', $columns, true)) {
            return [];
        }

        $commentColumn = in_array('content', $columns, true) ? 'content' : (in_array('comment', $columns, true) ? 'comment' : "''");
        $createdColumn = in_array('created_at', $columns, true) ? 'created_at' : (in_array('timestamp', $columns, true) ? 'timestamp' : 'NULL');
        $questionColumn = in_array('target_id', $columns, true) ? 'target_id' : 'NULL';

        $where = 'user_id = :id';
        if (in_array('target_type', $columns, true)) {
            $where .= " AND target_type = 'question'";
        }

        $stmt = $this->db->prepare("
            SELECT id, {$commentColumn} AS comment, {$createdColumn} AS created_at, {$questionColumn} AS question_id
            FROM comments
            WHERE {$where}
            ORDER BY " . ($createdColumn === 'NULL' ? 'id' : $createdColumn) . " DESC
            LIMIT 50
        ");
        $stmt->execute([':id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Lista threads raiz de suporte/feedback abertas pelo usuario.
     *
     * @since 1.0.0
     */
    public function fetchUserFeedbackThreads(string $userId): array
    {
        if (!$this->tableExists('user_feedback')) {
            return [];
        }

        $columns = $this->getTableColumns('user_feedback');
        if (!in_array('user_id', $columns, true)) {
            return [];
        }

        $selectParts = ['id'];
        foreach (['type', 'reason', 'details', 'status', 'created_at', 'public_rating', 'public_display_name', 'public_headline', 'home_published_at'] as $column) {
            if (in_array($column, $columns, true)) {
                $selectParts[] = $column;
            }
        }

        $whereParts = ['user_id = :id'];
        if (in_array('parent_id', $columns, true)) {
            $whereParts[] = 'parent_id IS NULL';
        }

        $orderBy = in_array('created_at', $columns, true) ? 'created_at DESC' : 'id DESC';

        $stmt = $this->db->prepare("
            SELECT " . implode(', ', $selectParts) . "
            FROM user_feedback
            WHERE " . implode(' AND ', $whereParts) . "
            ORDER BY {$orderBy}
            LIMIT 100
        ");
        $stmt->execute([':id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Lista denuncias vinculadas ao usuario no dominio reports.
     *
     * @since 1.0.0
     */
    public function fetchUserReports(string $userId): array
    {
        if (!$this->tableExists('reports')) {
            return [];
        }

        $columns = $this->getTableColumns('reports');
        $reporterColumn = in_array('reporter_id', $columns, true)
            ? 'reporter_id'
            : (in_array('user_id', $columns, true) ? 'user_id' : null);

        if ($reporterColumn === null) {
            return [];
        }

        $selectParts = ['id'];
        foreach (['target_type', 'target_id', 'reason', 'details', 'status', 'created_at', 'resolved_at', 'admin_reason'] as $column) {
            if (in_array($column, $columns, true)) {
                $selectParts[] = $column;
            }
        }

        $orderBy = in_array('created_at', $columns, true) ? 'created_at DESC' : 'id DESC';

        $stmt = $this->db->prepare("
            SELECT " . implode(', ', $selectParts) . "
            FROM reports
            WHERE {$reporterColumn} = :id
            ORDER BY {$orderBy}
            LIMIT 100
        ");
        $stmt->execute([':id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Verifica se o usuario possui cartao salvo em alguma estrutura suportada.
     *
     * @since 1.0.0
     */
    public function fetchHasSavedCard(string $userId): bool
    {
        $candidateTables = ['saved_cards', 'user_cards', 'cards'];

        foreach ($candidateTables as $tableName) {
            if (!$this->tableExists($tableName)) {
                continue;
            }

            $columns = $this->getTableColumns($tableName);
            if (!in_array('user_id', $columns, true)) {
                continue;
            }

            $where = ['user_id = :id'];
            if (in_array('status', $columns, true)) {
                $where[] = "status NOT IN ('deleted', 'inactive')";
            }

            $stmt = $this->db->prepare("SELECT COUNT(*) AS total FROM {$tableName} WHERE " . implode(' AND ', $where));
            $stmt->execute([':id' => $userId]);
            $total = (int) (($stmt->fetch(PDO::FETCH_ASSOC) ?: [])['total'] ?? 0);
            if ($total > 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Checa se uma tabela existe.
     *
     * @since 1.0.0
     */
    private function tableExists(string $tableName): bool
    {
        if (array_key_exists($tableName, $this->tableCache)) {
            return $this->tableCache[$tableName];
        }

        $stmt = $this->db->prepare('SHOW TABLES LIKE :table_name');
        $stmt->execute([':table_name' => $tableName]);
        $this->tableCache[$tableName] = (bool) $stmt->fetch(PDO::FETCH_NUM);

        return $this->tableCache[$tableName];
    }

    /**
     * Checa se uma coluna existe.
     *
     * @since 1.0.0
     */
    private function columnExists(string $tableName, string $columnName): bool
    {
        return in_array($columnName, $this->getTableColumns($tableName), true);
    }

    /**
     * Retorna as colunas da tabela informada.
     *
     * @since 1.0.0
     * @return array<int, string>
     */
    private function getTableColumns(string $tableName): array
    {
        if (array_key_exists($tableName, $this->columnCache)) {
            return $this->columnCache[$tableName];
        }

        if (!$this->tableExists($tableName)) {
            $this->columnCache[$tableName] = [];
            return [];
        }

        $stmt = $this->db->query("DESCRIBE {$tableName}");
        $columns = $stmt ? array_map(
            static fn (array $row): string => (string) ($row['Field'] ?? ''),
            $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []
        ) : [];

        $this->columnCache[$tableName] = array_values(array_filter($columns));
        return $this->columnCache[$tableName];
    }
}
