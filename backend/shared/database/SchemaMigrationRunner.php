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
            $appliedRow = $applied[$migration['version']] ?? null;
            $checksumMatches = $appliedRow === null
                || hash_equals((string) $appliedRow['checksum'], $migration['checksum']);

            $result[] = [
                ...$migration,
                'applied' => $appliedRow !== null,
                'applied_at' => $appliedRow['applied_at'] ?? null,
                'applied_by' => $appliedRow['applied_by'] ?? null,
                'execution_ms' => isset($appliedRow['execution_ms']) ? (int) $appliedRow['execution_ms'] : null,
                'checksum_matches' => $checksumMatches,
            ];
        }

        return $result;
    }

    public function baselineLegacy(): array
    {
        $this->ensureMetadataTable();
        $applied = $this->loadAppliedMigrations();
        $recorded = [];

        foreach ($this->discoverMigrations() as $migration) {
            if (strcmp($migration['version'], self::BASELINE_VERSION) >= 0 || isset($applied[$migration['version']])) {
                continue;
            }

            $this->recordMigration($migration, 0, 'baseline');
            $recorded[] = $migration['version'];
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
            if (isset($applied[$migration['version']])) {
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
        $migrations = [];

        foreach ($files as $path) {
            $filename = basename($path);
            if (!preg_match('/^(\d{8}(?:_\d{6})?)_([a-z0-9_]+)\.(sql|php)$/i', $filename, $matches)) {
                continue;
            }

            $contents = file_get_contents($path);
            if ($contents === false) {
                throw new RuntimeException('Nao foi possivel ler migration: ' . $filename);
            }

            $migrations[] = [
                'version' => $matches[1],
                'name' => $matches[2],
                'type' => strtolower($matches[3]),
                'path' => $path,
                'checksum' => hash('sha256', $contents),
            ];
        }

        usort($migrations, static fn (array $left, array $right): int => strcmp($left['version'], $right['version']));
        return $migrations;
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

    private function assertNoChecksumDrift(array $migrations, array $applied): void
    {
        foreach ($migrations as $migration) {
            $appliedRow = $applied[$migration['version']] ?? null;
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
            if (!isset($applied[$migration['version']])) {
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
