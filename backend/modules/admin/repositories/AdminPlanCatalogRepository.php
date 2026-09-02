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
require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';

/**
 * Repositorio da gestao administrativa do catalogo de planos.
 *
 * @since 1.0.0
 */
class AdminPlanCatalogRepository
{
    /** @var array<string, bool> */
    private array $tableCache = [];

    /** @var array<string, array<int, string>> */
    private array $columnCache = [];

    private bool $operationalColumnsEnsured = false;

    public function __construct(private readonly PDO $db)
    {
    }

    /**
     * Expõe a conexão para serviços que precisam coordenar efeitos colaterais.
     *
     * @since v1.0.0
     */
    public function getDb(): PDO
    {
        return $this->db;
    }

    /**
     * Garante o plano curto usado em homologacao de checkout.
     *
     * @since v1.0.0
     */
    public function ensureDefaultTestPlan(): void
    {
        if (!$this->tableExists('plans')) {
            return;
        }

        $this->ensureOperationalColumns();

        foreach ($this->listCatalog('') as $plan) {
            if (!empty($plan['is_test_plan'])) {
                return;
            }
        }

        $columns = $this->getTableColumns('plans');
        if (!in_array('name', $columns, true)) {
            return;
        }

        $fields = ['name'];
        $placeholders = [':name'];
        $params = [
            ':name' => 'Elite - Teste 2 dias',
        ];

        $optionalValues = [
            'description' => 'Plano curto para testes controlados de checkout, renovacao e webhook.',
            'price' => 2.00,
            'interval_unit' => 'day',
            'interval_count' => 2,
            'tier' => 4,
            'features' => json_encode([
                ['text' => 'Acesso Elite temporario para homologacao', 'included' => true],
                ['text' => 'Renovacao curta para validar webhooks', 'included' => true],
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'is_test_plan' => 1,
            'active' => 0,
            'is_active' => 0,
        ];

        foreach ($optionalValues as $column => $value) {
            if (!in_array($column, $columns, true)) {
                continue;
            }

            $fields[] = $column;
            $placeholders[] = ':' . $column;
            $params[':' . $column] = $value;
        }

        if (in_array('created_at', $columns, true)) {
            $fields[] = 'created_at';
            $placeholders[] = 'NOW()';
        }

        if (in_array('updated_at', $columns, true)) {
            $fields[] = 'updated_at';
            $placeholders[] = 'NOW()';
        }

        $stmt = $this->db->prepare(
            'INSERT INTO plans (' . implode(', ', $fields) . ') VALUES (' . implode(', ', $placeholders) . ')'
        );
        $stmt->execute($params);
    }

    /**
     * Lista todos os planos cadastrados no catalogo interno.
     *
     * @since 1.0.0
     */
    public function listCatalog(string $search = ''): array
    {
        if (!$this->tableExists('plans')) {
            return [];
        }

        $this->ensureOperationalColumns();

        $columns = $this->getTableColumns('plans');
        $selectColumns = array_values(array_filter([
            'id',
            'name',
            in_array('description', $columns, true) ? 'description' : null,
            in_array('price', $columns, true) ? 'price' : null,
            in_array('interval_count', $columns, true) ? 'interval_count' : null,
            in_array('interval_unit', $columns, true) ? 'interval_unit' : null,
            in_array('tier', $columns, true) ? 'tier' : null,
            in_array('active', $columns, true) ? 'active' : null,
            in_array('is_active', $columns, true) ? 'is_active' : null,
            in_array('is_test_plan', $columns, true) ? 'is_test_plan' : null,
            in_array('external_plan_id', $columns, true) ? 'external_plan_id' : null,
            in_array('stripe_product_id', $columns, true) ? 'stripe_product_id' : null,
            in_array('stripe_price_id', $columns, true) ? 'stripe_price_id' : null,
            in_array('created_at', $columns, true) ? 'created_at' : null,
            in_array('updated_at', $columns, true) ? 'updated_at' : null,
        ]));

        if ($selectColumns === []) {
            return [];
        }

        $whereParts = [];
        $params = [];

        if ($search !== '' && in_array('name', $columns, true)) {
            $whereParts[] = 'name LIKE :search';
            $params[':search'] = '%' . $search . '%';
        }

        $orderBy = [];
        if (in_array('tier', $columns, true)) {
            $orderBy[] = 'tier ASC';
        }
        if (in_array('price', $columns, true)) {
            $orderBy[] = 'price ASC';
        }
        $orderBy[] = 'id ASC';

        $sql = 'SELECT ' . implode(', ', $selectColumns) . ' FROM plans';
        if ($whereParts !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $whereParts);
        }
        $sql .= ' ORDER BY ' . implode(', ', $orderBy);

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return array_map(
            fn (array $row): array => $this->normalizeRow($row, $columns),
            $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []
        );
    }

    /**
     * Busca um plano do catalogo por ID.
     *
     * @since 1.0.0
     */
    public function findById(int $planId): ?array
    {
        if (!$this->tableExists('plans')) {
            return null;
        }

        $this->ensureOperationalColumns();

        $columns = $this->getTableColumns('plans');
        $selectColumns = array_values(array_filter([
            'id',
            'name',
            in_array('description', $columns, true) ? 'description' : null,
            in_array('price', $columns, true) ? 'price' : null,
            in_array('interval_count', $columns, true) ? 'interval_count' : null,
            in_array('interval_unit', $columns, true) ? 'interval_unit' : null,
            in_array('tier', $columns, true) ? 'tier' : null,
            in_array('active', $columns, true) ? 'active' : null,
            in_array('is_active', $columns, true) ? 'is_active' : null,
            in_array('is_test_plan', $columns, true) ? 'is_test_plan' : null,
            in_array('external_plan_id', $columns, true) ? 'external_plan_id' : null,
            in_array('stripe_product_id', $columns, true) ? 'stripe_product_id' : null,
            in_array('stripe_price_id', $columns, true) ? 'stripe_price_id' : null,
            in_array('created_at', $columns, true) ? 'created_at' : null,
            in_array('updated_at', $columns, true) ? 'updated_at' : null,
        ]));

        if ($selectColumns === []) {
            return null;
        }

        $stmt = $this->db->prepare(
            'SELECT ' . implode(', ', $selectColumns) . ' FROM plans WHERE id = :id LIMIT 1'
        );
        $stmt->execute([':id' => $planId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $this->normalizeRow($row, $columns) : null;
    }

    /**
     * Atualiza um plano existente por ID.
     *
     * @since 1.0.0
     */
    public function updatePlan(int $planId, array $changes): void
    {
        if (!$this->tableExists('plans')) {
            throw new RuntimeException('Tabela de planos indisponivel.');
        }

        $this->ensureOperationalColumns();

        $columns = $this->getTableColumns('plans');
        $setParts = [];
        $params = [':id' => $planId];

        if ($changes['price'] !== null && in_array('price', $columns, true)) {
            $setParts[] = 'price = :price';
            $params[':price'] = (float) $changes['price'];
        }

        if ($changes['interval_count'] !== null && in_array('interval_count', $columns, true)) {
            $setParts[] = 'interval_count = :interval_count';
            $params[':interval_count'] = (int) $changes['interval_count'];
        }

        if ($changes['interval_unit'] !== null && in_array('interval_unit', $columns, true)) {
            $setParts[] = 'interval_unit = :interval_unit';
            $params[':interval_unit'] = (string) $changes['interval_unit'];
        }

        if ($changes['active'] !== null) {
            $activeValue = $changes['active'] ? 1 : 0;
            if (in_array('active', $columns, true)) {
                $setParts[] = 'active = :active';
                $params[':active'] = $activeValue;
            }
            if (in_array('is_active', $columns, true)) {
                $setParts[] = 'is_active = :is_active';
                $params[':is_active'] = $activeValue;
            }
        }

        if ($setParts === []) {
            return;
        }

        if (in_array('updated_at', $columns, true)) {
            $setParts[] = 'updated_at = NOW()';
        }

        $stmt = $this->db->prepare(
            'UPDATE plans SET ' . implode(', ', $setParts) . ' WHERE id = :id LIMIT 1'
        );
        $stmt->execute($params);
    }

    private function normalizeRow(array $row, array $columns = []): array
    {
        $supportsActiveToggle = in_array('active', $columns, true) || in_array('is_active', $columns, true);
        $activeRaw = array_key_exists('active', $row)
            ? $row['active']
            : ($row['is_active'] ?? 1);
        $active = filter_var($activeRaw, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
        if ($active === null) {
            $active = ((int) $activeRaw) > 0;
        }

        $explicitIsTest = null;
        if (in_array('is_test_plan', $columns, true) && array_key_exists('is_test_plan', $row)) {
            $explicitIsTest = filter_var($row['is_test_plan'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
            if ($explicitIsTest === null) {
                $explicitIsTest = ((int) $row['is_test_plan']) > 0;
            }
        }

        $isTestPlan = $explicitIsTest ?? $this->isLikelyTestPlan($row);

        return [
            'id' => (int) ($row['id'] ?? 0),
            'name' => (string) ($row['name'] ?? ''),
            'description' => (string) ($row['description'] ?? ''),
            'price' => round((float) ($row['price'] ?? 0), 2),
            'interval_count' => max(1, (int) ($row['interval_count'] ?? 1)),
            'interval_unit' => (string) ($row['interval_unit'] ?? 'month'),
            'tier' => isset($row['tier']) ? (int) $row['tier'] : null,
            'active' => (bool) $active,
            'external_plan_id' => isset($row['external_plan_id']) ? (string) $row['external_plan_id'] : null,
            'stripe_product_id' => isset($row['stripe_product_id']) ? (string) $row['stripe_product_id'] : null,
            'stripe_price_id' => isset($row['stripe_price_id']) ? (string) $row['stripe_price_id'] : null,
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
            'is_test_plan' => (bool) $isTestPlan,
            'can_edit_interval' => (bool) $isTestPlan,
            'can_toggle_active' => (bool) ($supportsActiveToggle && $isTestPlan),
        ];
    }

    private function isLikelyTestPlan(array $row): bool
    {
        $nameRaw = (string) ($row['name'] ?? '');
        $name = function_exists('mb_strtolower')
            ? mb_strtolower($nameRaw, 'UTF-8')
            : strtolower($nameRaw);
        if ($name !== '' && preg_match('/\b(teste|test|trial)\b/u', $name) === 1) {
            return true;
        }

        $intervalUnitRaw = (string) ($row['interval_unit'] ?? '');
        $intervalUnit = function_exists('mb_strtolower')
            ? mb_strtolower($intervalUnitRaw, 'UTF-8')
            : strtolower($intervalUnitRaw);
        $intervalCount = (int) ($row['interval_count'] ?? 0);
        return $intervalUnit === 'day' && $intervalCount > 0 && $intervalCount <= 7;
    }

    /**
     * Garante as colunas usadas pelo plano de teste em bases antigas.
     *
     * @since v1.0.0
     */
    private function ensureOperationalColumns(): void
    {
        if ($this->operationalColumnsEnsured) {
            return;
        }

        SchemaReadiness::assertTablesAndColumns($this->db, 'catalogo de planos', [
            'plans' => ['id', 'name', 'price', 'active', 'is_active', 'is_test_plan'],
        ]);
        $this->operationalColumnsEnsured = true;
    }

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
