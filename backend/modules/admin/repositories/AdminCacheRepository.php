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
 * Repositorio das operacoes administrativas de cache.
 * Centraliza descoberta de schema real e leitura/escrita das configuracoes.
 */
class AdminCacheRepository
{
    private PDO $db;
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
     * Resolve informacoes da tabela de cache ativa.
     *
     * @since 1.0.0
     * @return array{table_name:string,data_column:?string,expires_column:?string,source:string}|null
     */
    public function resolveCacheTableInfo(): ?array
    {
        foreach (['question_cache', 'cache', 'api_cache', 'response_cache'] as $candidateTable) {
            if (!$this->tableExists($candidateTable)) {
                continue;
            }

            $columns = $this->getTableColumns($candidateTable);
            $dataColumn = $this->resolveFirstAvailableColumn($columns, ['data', 'payload', 'value_json', 'response_body', 'content']);
            $expiresColumn = $this->resolveFirstAvailableColumn($columns, ['expires_at', 'expiration_at', 'ttl_expires_at', 'valid_until']);

            return [
                'table_name' => $candidateTable,
                'data_column' => $dataColumn,
                'expires_column' => $expiresColumn,
                'source' => $candidateTable,
            ];
        }

        return null;
    }

    /**
     * Garante a tabela de configuracao usada pelos endpoints cacheados.
     *
     * @since 1.0.0
     */
    public function ensureCacheSettingsTable(): void
    {
        $this->db->exec("
            CREATE TABLE IF NOT EXISTS cache_settings (
                id TINYINT UNSIGNED NOT NULL DEFAULT 1 PRIMARY KEY,
                enabled TINYINT(1) NOT NULL DEFAULT 0,
                default_ttl INT NOT NULL DEFAULT 300,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    /**
     * Le a configuracao de cache realmente consumida pelos endpoints.
     *
     * @since 1.0.0
     */
    public function fetchCacheSettings(): ?array
    {
        $this->ensureCacheSettingsTable();

        $stmt = $this->db->prepare('SELECT enabled, default_ttl FROM cache_settings LIMIT 1');
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Persiste o estado do cache no schema operacional, nao apenas no system_settings.
     *
     * @since 1.0.0
     */
    public function upsertCacheSettings(bool $enabled, int $defaultTtl): void
    {
        $this->ensureCacheSettingsTable();

        $stmt = $this->db->prepare(
            "INSERT INTO cache_settings (id, enabled, default_ttl)
             VALUES (1, :enabled, :default_ttl)
             ON DUPLICATE KEY UPDATE enabled = :enabled_update, default_ttl = :default_ttl_update"
        );
        $stmt->execute([
            ':enabled' => $enabled ? 1 : 0,
            ':default_ttl' => max(1, $defaultTtl),
            ':enabled_update' => $enabled ? 1 : 0,
            ':default_ttl_update' => max(1, $defaultTtl),
        ]);
    }

    /**
     * Retorna estatisticas agregadas da tabela de cache.
     *
     * @since 1.0.0
     * @param array{table_name:string,data_column:?string,expires_column:?string,source:string} $tableInfo
     */
    public function fetchCacheAggregateStats(array $tableInfo): array
    {
        $tableName = $tableInfo['table_name'];
        $expiresColumn = $tableInfo['expires_column'];
        $dataColumn = $tableInfo['data_column'];

        $validExpr = $expiresColumn
            ? "SUM(CASE WHEN {$expiresColumn} > NOW() OR {$expiresColumn} IS NULL THEN 1 ELSE 0 END)"
            : 'COUNT(*)';
        $expiredExpr = $expiresColumn
            ? "SUM(CASE WHEN {$expiresColumn} <= NOW() THEN 1 ELSE 0 END)"
            : '0';
        $sizeExpr = $dataColumn
            ? "ROUND(SUM(LENGTH({$dataColumn})) / 1024 / 1024, 2)"
            : '0';

        $row = $this->db->query(
            "SELECT
                COUNT(*) AS total,
                {$validExpr} AS valid_entries,
                {$expiredExpr} AS expired_entries,
                {$sizeExpr} AS size_mb
             FROM `{$tableName}`"
        )->fetch(PDO::FETCH_ASSOC);

        return $row ?: [];
    }

    /**
     * Busca um valor de configuracao no system_settings.
     *
     * @since 1.0.0
     */
    public function fetchSystemSetting(string $key): ?string
    {
        $stmt = $this->db->prepare("SELECT value_json FROM system_settings WHERE key_name = :key LIMIT 1");
        $stmt->execute([':key' => $key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? (string) $row['value_json'] : null;
    }

    /**
     * Salva ou atualiza uma configuracao do system_settings.
     *
     * @since 1.0.0
     */
    public function upsertSystemSetting(string $key, string $valueJson): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO system_settings (key_name, value_json)
             VALUES (:key_name, :value_json)
             ON DUPLICATE KEY UPDATE value_json = :value_json_update"
        );
        $stmt->execute([
            ':key_name' => $key,
            ':value_json' => $valueJson,
            ':value_json_update' => $valueJson,
        ]);
    }

    /**
     * Limpa todas as entradas da tabela de cache.
     *
     * @since 1.0.0
     * @param array{table_name:string,data_column:?string,expires_column:?string,source:string} $tableInfo
     */
    public function clearCacheTable(array $tableInfo): void
    {
        $this->db->exec("DELETE FROM `{$tableInfo['table_name']}`");
    }

    /**
     * Remove apenas entradas expiradas da tabela de cache.
     *
     * @since 1.0.0
     * @param array{table_name:string,data_column:?string,expires_column:?string,source:string} $tableInfo
     */
    public function clearExpiredCacheEntries(array $tableInfo): int
    {
        if (empty($tableInfo['expires_column'])) {
            return 0;
        }

        return (int) $this->db->exec(
            "DELETE FROM `{$tableInfo['table_name']}` WHERE {$tableInfo['expires_column']} IS NOT NULL AND {$tableInfo['expires_column']} <= NOW()"
        );
    }

    /**
     * Resolve a primeira coluna suportada entre as candidatas.
     *
     * @since 1.0.0
     * @param array<int, string> $columns
     * @param array<int, string> $candidates
     */
    private function resolveFirstAvailableColumn(array $columns, array $candidates): ?string
    {
        foreach ($candidates as $candidate) {
            if (in_array($candidate, $columns, true)) {
                return $candidate;
            }
        }

        return null;
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

        $stmt = $this->db->query("DESCRIBE `{$tableName}`");
        $columns = $stmt ? array_map(
            static fn (array $row): string => (string) ($row['Field'] ?? ''),
            $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []
        ) : [];

        $this->columnCache[$tableName] = array_values(array_filter($columns));
        return $this->columnCache[$tableName];
    }

    /**
     * Verifica se uma tabela existe.
     *
     * @since 1.0.0
     */
    private function tableExists(string $tableName): bool
    {
        $stmt = $this->db->prepare('SHOW TABLES LIKE :table_name');
        $stmt->execute([':table_name' => $tableName]);
        return (bool) $stmt->fetch(PDO::FETCH_NUM);
    }
}
