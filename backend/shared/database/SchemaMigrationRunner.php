<?php

declare(strict_types=1);

/**
 * Runner de migrations exclusivo para CLI.
 *
 * Nenhuma rota HTTP deve executar DDL. O runner registra checksum, duracao e
 * responsavel por cada migration para detectar drift antes de alterar schema.
 */
final class SchemaMigrationRunner
{
    private const BASELINE_VERSION = '20260711_000000';

    public function __construct(
        private readonly PDO $db,
        private readonly string $migrationDirectory,
        private readonly string $appliedBy = 'cli'
    ) {
    }

    public function status(): array
    {
        $migrations = $this->discoverMigrations();
        $applied = $this->loadAppliedMigrations();
        $result = [];

        foreach ($migrations as $migration) {
            $appliedRow = $this->resolveAppliedRow($migration, $applied);
            $checksumMatches = $appliedRow === null
                || hash_equals((string) $appliedRow['checksum'], $migration['checksum']);

            $result[] = [
                ...$migration,
                'applied' => $appliedRow !== null,
                'applied_at' => $appliedRow['applied_at'] ?? null,
                'applied_by' => $appliedRow['applied_by'] ?? null,
                'execution_ms' => isset($appliedRow['execution_ms']) ? (int) $appliedRow['execution_ms'] : null,
                'checksum_matches' => $checksumMatches,
                'legacy_alias' => $appliedRow !== null && !isset($applied[$migration['version']]),
            ];
        }

        return $result;
    }

    public function baselineLegacy(): array
    {
        $this->ensureMetadataTable();
        $applied = $this->loadAppliedMigrations();
        $recorded = [];

        $this->db->beginTransaction();
        try {
            foreach ($this->discoverMigrations() as $migration) {
                if (strcmp($migration['version'], self::BASELINE_VERSION) >= 0 || isset($applied[$migration['version']])) {
                    continue;
                }

                $this->recordMigration($migration, 0, 'baseline');
                $recorded[] = $migration['version'];
                $applied[$migration['version']] = ['version' => $migration['version']];
            }
            $this->db->commit();
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }

        return $recorded;
    }

    public function apply(?string $onlyVersion = null): array
    {
        $this->ensureMetadataTable();
        $migrations = $this->discoverMigrations();
        $applied = $this->loadAppliedMigrations();
        $this->assertNoChecksumDrift($migrations, $applied);
        $this->assertLegacyBaseline($migrations, $applied);
        $executed = [];

        foreach ($migrations as $migration) {
            if ($onlyVersion !== null && $migration['version'] !== $onlyVersion) {
                continue;
            }
            if ($this->resolveAppliedRow($migration, $applied) !== null) {
                continue;
            }

            $startedAt = microtime(true);
            $this->executeMigration($migration);
            $executionMs = (int) round((microtime(true) - $startedAt) * 1000);
            $this->recordMigration($migration, $executionMs, $this->appliedBy);
            $executed[] = $migration['version'];
        }

        if ($onlyVersion !== null && $executed === [] && !isset($applied[$onlyVersion])) {
            throw new RuntimeException('Migration solicitada nao encontrada: ' . $onlyVersion);
        }

        return $executed;
    }

    public function discoverMigrations(): array
    {
        if (!is_dir($this->migrationDirectory)) {
            throw new RuntimeException('Diretorio de migrations nao encontrado: ' . $this->migrationDirectory);
        }

        $files = array_merge(
            glob($this->migrationDirectory . '/*.sql') ?: [],
            glob($this->migrationDirectory . '/*.php') ?: []
        );
        $discovered = [];

        foreach ($files as $path) {
            $filename = basename($path);
            if (!preg_match('/^(\d{8}(?:_\d{6})?)_([a-z0-9_]+)\.(sql|php)$/i', $filename, $matches)) {
                continue;
            }

            $contents = file_get_contents($path);
            if ($contents === false) {
                throw new RuntimeException('Nao foi possivel ler migration: ' . $filename);
            }

            $discovered[] = [
                'base_version' => $matches[1],
                'name' => $matches[2],
                'type' => strtolower($matches[3]),
                'path' => $path,
                'filename' => $filename,
                'checksum' => hash('sha256', $contents),
            ];
        }

        usort($discovered, static fn (array $left, array $right): int => [
            $left['base_version'],
            $left['filename'],
        ] <=> [
            $right['base_version'],
            $right['filename'],
        ]);

        $baseVersionCounts = [];
        foreach ($discovered as $migration) {
            $baseVersion = (string) $migration['base_version'];
            $baseVersionCounts[$baseVersion] = ($baseVersionCounts[$baseVersion] ?? 0) + 1;
        }

        $migrations = [];
        foreach ($discovered as $migration) {
            $baseVersion = (string) $migration['base_version'];
            // Older files used a date-only prefix. A filename digest keeps
            // colliding legacy versions individually baselineable and stable.
            $version = $baseVersion;
            if (($baseVersionCounts[$baseVersion] ?? 0) > 1) {
                $version .= '_' . substr(hash('sha256', (string) $migration['filename']), 0, 12);
            }
            $migrations[] = [...$migration, 'version' => $version];
        }

        usort($migrations, static fn (array $left, array $right): int => strcmp($left['version'], $right['version']));
        return $migrations;
    }

    /**
     * Reports migration history problems without changing schema or metadata.
     * Legacy date-only rows are matched by base version and name so that a
     * duplicate date prefix does not become an invisible applied migration.
     *
     * @return array<string, mixed>
     */
    public function audit(): array
    {
        $migrations = $this->discoverMigrations();
        $applied = $this->loadAppliedMigrations();
        $matchedAppliedVersions = [];
        $legacyAliases = [];
        $checksumDrift = [];
        $discoveredWithoutApplied = [];

        foreach ($migrations as $migration) {
            $appliedRow = $this->resolveAppliedRow($migration, $applied);
            if ($appliedRow === null) {
                $discoveredWithoutApplied[] = $migration['version'];
                continue;
            }
            $matchedAppliedVersions[(string) ($appliedRow['version'] ?? $migration['version'])] = true;
            if (!isset($applied[$migration['version']])) {
                $legacyAliases[] = [
                    'applied_version' => (string) ($appliedRow['version'] ?? ''),
                    'discovered_version' => $migration['version'],
                    'filename' => $migration['filename'],
                ];
            }
            if (($appliedRow['checksum'] ?? '') !== '' && !hash_equals((string) $appliedRow['checksum'], $migration['checksum'])) {
                $checksumDrift[] = [
                    'applied_version' => (string) ($appliedRow['version'] ?? ''),
                    'discovered_version' => $migration['version'],
                    'filename' => $migration['filename'],
                ];
            }
        }

        $appliedWithoutDiscovered = [];
        foreach ($applied as $version => $row) {
            if (!isset($matchedAppliedVersions[$version])) {
                $appliedWithoutDiscovered[] = [
                    'version' => (string) $version,
                    'name' => (string) ($row['name'] ?? ''),
                    'applied_at' => $row['applied_at'] ?? null,
                ];
            }
        }

        $baseVersionGroups = [];
        $logicalIdentityGroups = [];
        foreach ($migrations as $migration) {
            $baseVersionGroups[$migration['base_version']][] = $migration['filename'];
            $logicalIdentity = $migration['base_version'] . ':' . $migration['name'];
            $logicalIdentityGroups[$logicalIdentity][] = $migration['filename'];
        }

        $ambiguousPrefix = [];
        foreach ($baseVersionGroups as $prefix => $files) {
            if (count($files) > 1) {
                $ambiguousPrefix[$prefix] = $files;
            }
        }
        $duplicateLogicalIdentity = [];
        foreach ($logicalIdentityGroups as $identity => $files) {
            if (count($files) > 1) {
                $duplicateLogicalIdentity[$identity] = $files;
            }
        }

        $orderedApplied = array_values($applied);
        usort($orderedApplied, static fn (array $left, array $right): int => strcmp(
            (string) ($left['applied_at'] ?? ''),
            (string) ($right['applied_at'] ?? '')
        ));
        $outOfOrderHistory = [];
        $previousVersion = null;
        foreach ($orderedApplied as $row) {
            $version = (string) ($row['version'] ?? '');
            if ($previousVersion !== null && strcmp($version, $previousVersion) < 0) {
                $outOfOrderHistory[] = ['previous' => $previousVersion, 'current' => $version];
            }
            $previousVersion = $version;
        }

        $ignoredManualSql = [];
        foreach (array_merge(glob($this->migrationDirectory . '/*.sql') ?: [], glob($this->migrationDirectory . '/*.php') ?: []) as $path) {
            $filename = basename($path);
            if (preg_match('/^\d{8}(?:_\d{6})?_[a-z0-9_]+\.(sql|php)$/i', $filename) === 1) {
                continue;
            }
            $contents = file_get_contents($path);
            if ($contents !== false && preg_match('/\b(CREATE|ALTER|DROP|TRUNCATE|INSERT|UPDATE|DELETE)\b/i', $contents) === 1) {
                $ignoredManualSql[] = $filename;
            }
        }

        sort($discoveredWithoutApplied);
        usort($appliedWithoutDiscovered, static fn (array $left, array $right): int => strcmp($left['version'], $right['version']));
        sort($checksumDrift);
        sort($ignoredManualSql);

        return [
            'discovered_count' => count($migrations),
            'applied_count' => count($applied),
            'applied_without_discovered_file' => $appliedWithoutDiscovered,
            'discovered_without_applied_row' => $discoveredWithoutApplied,
            'checksum_drift' => $checksumDrift,
            'duplicate_logical_identity' => $duplicateLogicalIdentity,
            'ambiguous_prefix' => $ambiguousPrefix,
            'out_of_order_history' => $outOfOrderHistory,
            'ignored_manual_sql' => $ignoredManualSql,
            'legacy_aliases_matched' => $legacyAliases,
            'codes' => [
                'APPLIED_WITHOUT_DISCOVERED_FILE' => count($appliedWithoutDiscovered),
                'DISCOVERED_WITHOUT_APPLIED_ROW' => count($discoveredWithoutApplied),
                'CHECKSUM_DRIFT' => count($checksumDrift),
                'DUPLICATE_LOGICAL_IDENTITY' => count($duplicateLogicalIdentity),
                'AMBIGUOUS_PREFIX' => count($ambiguousPrefix),
                'OUT_OF_ORDER_HISTORY' => count($outOfOrderHistory),
                'IGNORED_MANUAL_SQL' => count($ignoredManualSql),
            ],
        ];
    }

    private function ensureMetadataTable(): void
    {
        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(32) NOT NULL PRIMARY KEY,
                name VARCHAR(190) NOT NULL,
                checksum CHAR(64) NOT NULL,
                applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                execution_ms INT UNSIGNED NULL,
                applied_by VARCHAR(120) NULL,
                INDEX idx_schema_migrations_applied_at (applied_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
    }

    private function loadAppliedMigrations(): array
    {
        $exists = $this->db->query(
            "SELECT COUNT(*)
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'schema_migrations'"
        );
        if ((int) $exists->fetchColumn() === 0) {
            return [];
        }

        $rows = $this->db->query(
            'SELECT version, name, checksum, applied_at, execution_ms, applied_by
             FROM schema_migrations'
        )->fetchAll(PDO::FETCH_ASSOC);

        $applied = [];
        foreach ($rows ?: [] as $row) {
            $applied[(string) $row['version']] = $row;
        }

        return $applied;
    }

    private function resolveAppliedRow(array $migration, array $applied): ?array
    {
        if (isset($applied[$migration['version']])) {
            return $applied[$migration['version']];
        }

        $legacy = $applied[$migration['base_version']] ?? null;
        if ($legacy !== null && (string) ($legacy['name'] ?? '') === (string) $migration['name']) {
            return $legacy;
        }

        return null;
    }

    private function assertNoChecksumDrift(array $migrations, array $applied): void
    {
        foreach ($migrations as $migration) {
            $appliedRow = $this->resolveAppliedRow($migration, $applied);
            if ($appliedRow !== null && !hash_equals((string) $appliedRow['checksum'], $migration['checksum'])) {
                throw new RuntimeException('Checksum divergente para migration ja aplicada: ' . $migration['version']);
            }
        }
    }

    private function assertLegacyBaseline(array $migrations, array $applied): void
    {
        foreach ($migrations as $migration) {
            if (strcmp($migration['version'], self::BASELINE_VERSION) >= 0) {
                continue;
            }
            if ($this->resolveAppliedRow($migration, $applied) === null) {
                throw new RuntimeException(
                    'Migrations legadas nao marcadas como baseline. Revise o schema real e execute --baseline-legacy antes de aplicar novas migrations.'
                );
            }
        }
    }

    private function executeMigration(array $migration): void
    {
        if ($migration['type'] === 'php') {
            $callback = require $migration['path'];
            if (!is_callable($callback)) {
                throw new RuntimeException('Migration PHP precisa retornar um callable: ' . $migration['version']);
            }

            $callback($this->db);
            return;
        }

        $sql = file_get_contents($migration['path']);
        if ($sql === false) {
            throw new RuntimeException('Nao foi possivel ler migration SQL: ' . $migration['version']);
        }

        foreach (self::splitSqlStatements($sql) as $statement) {
            $this->db->exec($statement);
        }
    }

    private function recordMigration(array $migration, int $executionMs, string $appliedBy): void
    {
        $stmt = $this->db->prepare(
            'INSERT INTO schema_migrations (version, name, checksum, execution_ms, applied_by)
             VALUES (:version, :name, :checksum, :execution_ms, :applied_by)'
        );
        $stmt->execute([
            ':version' => $migration['version'],
            ':name' => $migration['name'],
            ':checksum' => $migration['checksum'],
            ':execution_ms' => $executionMs,
            ':applied_by' => $appliedBy,
        ]);
    }

    /**
     * Separa statements sem quebrar strings simples, duplas ou identificadores.
     */
    public static function splitSqlStatements(string $sql): array
    {
        $statements = [];
        $buffer = '';
        $quote = null;
        $length = strlen($sql);

        for ($index = 0; $index < $length; $index++) {
            $character = $sql[$index];
            $next = $index + 1 < $length ? $sql[$index + 1] : '';

            if ($quote === null && $character === '-' && $next === '-' && ($index === 0 || ctype_space($sql[$index - 1]))) {
                while ($index < $length && $sql[$index] !== "\n") {
                    $index++;
                }
                $buffer .= "\n";
                continue;
            }

            if ($quote === null && $character === '#' && ($index === 0 || $sql[$index - 1] === "\n")) {
                while ($index < $length && $sql[$index] !== "\n") {
                    $index++;
                }
                $buffer .= "\n";
                continue;
            }

            if ($quote === null && $character === '/' && $next === '*') {
                $index += 2;
                while ($index < $length - 1 && !($sql[$index] === '*' && $sql[$index + 1] === '/')) {
                    $index++;
                }
                $index++;
                continue;
            }

            if (($character === "'" || $character === '"' || $character === chr(96))) {
                if ($quote === null) {
                    $quote = $character;
                } elseif ($quote === $character && ($index === 0 || $sql[$index - 1] !== '\\')) {
                    $quote = null;
                }
            }

            if ($quote === null && $character === ';') {
                $statement = trim($buffer);
                if ($statement !== '') {
                    $statements[] = $statement;
                }
                $buffer = '';
                continue;
            }

            $buffer .= $character;
        }

        $statement = trim($buffer);
        if ($statement !== '') {
            $statements[] = $statement;
        }

        return $statements;
    }
}
