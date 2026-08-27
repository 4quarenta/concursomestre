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

declare(strict_types=1);

require_once __DIR__ . '/DatasetResetPolicyV2.php';

final class DatasetResetReadinessReporter
{
    public function __construct(private readonly PDO $db)
    {
        $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }

    /** @return array<string, mixed> */
    public function snapshot(): array
    {
        $database = (string) $this->db->query('SELECT DATABASE()')->fetchColumn();
        if ($database === '') {
            throw new RuntimeException('Dataset reset reporter requires an explicit database.');
        }

        $tables = $this->schemaTables();
        $foreignKeys = $this->foreignKeys();
        $policyValidation = DatasetResetPolicyV2::validateAgainstSchema($tables);
        $tableCounts = $this->tableCounts($tables);
        $preserveSnapshots = $this->preserveSnapshots();
        $fkOrder = $this->resetOrder($foreignKeys);
        $schemaMetadata = $this->schemaMetadata();
        $latestMigration = $this->latestMigration();
        $structuralFingerprint = hash('sha256', json_encode([
            'policyVersion' => DatasetResetPolicyV2::VERSION,
            'policySemanticsVersion' => DatasetResetPolicyV2::SEMANTICS_VERSION,
            'database' => $database,
            'schema' => $schemaMetadata,
            'foreignKeys' => $foreignKeys,
            'latestMigration' => $latestMigration,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));

        $preservedChildDependencies = [];
        $preserveLookup = array_fill_keys(DatasetResetPolicyV2::preserveTables(), true);
        $resetLookup = array_fill_keys(DatasetResetPolicyV2::resetTables(), true);
        foreach ($foreignKeys as $foreignKey) {
            if (isset($preserveLookup[$foreignKey['childTable']], $resetLookup[$foreignKey['parentTable']])) {
                $preservedChildDependencies[] = $foreignKey;
            }
        }

        return [
            'policyVersion' => DatasetResetPolicyV2::VERSION,
            'policySemanticsVersion' => DatasetResetPolicyV2::SEMANTICS_VERSION,
            'mode' => 'read-only-snapshot',
            'database' => $database,
            'databaseVersion' => (string) $this->db->query('SELECT VERSION()')->fetchColumn(),
            'tableCount' => count($tables),
            'tables' => $tables,
            'tableCounts' => $tableCounts,
            'totalRows' => array_sum($tableCounts),
            'policyValidation' => $policyValidation,
            'preserveManifest' => DatasetResetPolicyV2::preserveManifest(),
            'preserveSnapshots' => $preserveSnapshots,
            'resetDomains' => DatasetResetPolicyV2::resetDomains(),
            'resetTables' => DatasetResetPolicyV2::resetTables(),
            'strictResetTables' => DatasetResetPolicyV2::strictResetTables(),
            'runtimeRecreatableTables' => DatasetResetPolicyV2::runtimeRecreatableTables(),
            'runtimeRecreatableManifest' => DatasetResetPolicyV2::runtimeRecreatableManifest(),
            'classificationManifest' => DatasetResetPolicyV2::classificationManifest(),
            'resetOrder' => $fkOrder['order'],
            'resetOrderCycles' => $fkOrder['cycles'],
            'foreignKeyCount' => count($foreignKeys),
            'foreignKeys' => $foreignKeys,
            'preservedChildDependencies' => $preservedChildDependencies,
            'latestMigration' => $latestMigration,
            'structuralFingerprint' => $structuralFingerprint,
            'snapshotFingerprint' => hash('sha256', json_encode([
                'structuralFingerprint' => $structuralFingerprint,
                'tableCounts' => $tableCounts,
                'preserveSnapshots' => $preserveSnapshots,
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)),
            'writesExecuted' => 0,
        ];
    }

    /** @return list<string> */
    private function schemaTables(): array
    {
        $rows = $this->db->query(
            'SELECT TABLE_NAME
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_TYPE = \'BASE TABLE\'
             ORDER BY TABLE_NAME'
        )->fetchAll(PDO::FETCH_COLUMN) ?: [];
        return array_values(array_map('strval', $rows));
    }

    /** @param list<string> $tables @return array<string, int> */
    private function tableCounts(array $tables): array
    {
        $counts = [];
        foreach ($tables as $table) {
            $counts[$table] = (int) $this->db->query(
                'SELECT COUNT(*) FROM ' . $this->quoteIdentifier($table)
            )->fetchColumn();
        }
        ksort($counts);
        return $counts;
    }

    /** @return array<string, array{rows: int, digest: string}> */
    private function preserveSnapshots(): array
    {
        $snapshots = [];
        foreach (DatasetResetPolicyV2::preserveTables() as $table) {
            $snapshots[$table] = $this->tableDigest($table);
        }
        ksort($snapshots);
        return $snapshots;
    }

    /** @return array{rows: int, digest: string} */
    private function tableDigest(string $table): array
    {
        $columns = $this->db->prepare(
            'SELECT COLUMN_NAME
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table
             ORDER BY ORDINAL_POSITION'
        );
        $columns->execute([':table' => $table]);
        $columnNames = array_values(array_map('strval', $columns->fetchAll(PDO::FETCH_COLUMN) ?: []));
        if ($columnNames === []) {
            throw new RuntimeException('Cannot digest table without columns: ' . $table);
        }

        $primaryKey = $this->db->prepare(
            'SELECT COLUMN_NAME
             FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table
               AND CONSTRAINT_NAME = \'PRIMARY\'
             ORDER BY ORDINAL_POSITION'
        );
        $primaryKey->execute([':table' => $table]);
        $orderColumns = array_values(array_map('strval', $primaryKey->fetchAll(PDO::FETCH_COLUMN) ?: []));
        if ($orderColumns === []) {
            $orderColumns = $columnNames;
        }

        $query = 'SELECT * FROM ' . $this->quoteIdentifier($table)
            . ' ORDER BY ' . implode(', ', array_map([$this, 'quoteIdentifier'], $orderColumns));
        $statement = $this->db->query($query);
        $hash = hash_init('sha256');
        $rows = 0;
        while (($row = $statement->fetch(PDO::FETCH_ASSOC)) !== false) {
            $normalized = [];
            foreach ($columnNames as $column) {
                $normalized[$column] = $row[$column] ?? null;
            }
            hash_update($hash, json_encode($normalized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . "\n");
            $rows++;
        }

        return ['rows' => $rows, 'digest' => hash_final($hash)];
    }

    /** @return list<array<string, string>> */
    private function foreignKeys(): array
    {
        $statement = $this->db->query(
            'SELECT k.CONSTRAINT_NAME,
                    k.TABLE_NAME,
                    k.COLUMN_NAME,
                    k.REFERENCED_TABLE_NAME,
                    k.REFERENCED_COLUMN_NAME,
                    r.UPDATE_RULE,
                    r.DELETE_RULE
             FROM information_schema.KEY_COLUMN_USAGE k
             JOIN information_schema.REFERENTIAL_CONSTRAINTS r
               ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
              AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
              AND r.TABLE_NAME = k.TABLE_NAME
             WHERE k.TABLE_SCHEMA = DATABASE()
               AND k.REFERENCED_TABLE_NAME IS NOT NULL
             ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION'
        );
        $rows = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $rows[] = [
                'constraint' => (string) $row['CONSTRAINT_NAME'],
                'childTable' => (string) $row['TABLE_NAME'],
                'childColumn' => (string) $row['COLUMN_NAME'],
                'parentTable' => (string) $row['REFERENCED_TABLE_NAME'],
                'parentColumn' => (string) $row['REFERENCED_COLUMN_NAME'],
                'updateRule' => (string) $row['UPDATE_RULE'],
                'deleteRule' => (string) $row['DELETE_RULE'],
            ];
        }
        return $rows;
    }

    /** @return array{order: list<string>, cycles: list<string>} */
    private function resetOrder(array $foreignKeys): array
    {
        $tables = DatasetResetPolicyV2::resetTables();
        $resetLookup = array_fill_keys($tables, true);
        $adjacency = array_fill_keys($tables, []);
        $indegree = array_fill_keys($tables, 0);

        foreach ($foreignKeys as $foreignKey) {
            $child = $foreignKey['childTable'];
            $parent = $foreignKey['parentTable'];
            if ($child === $parent || !isset($resetLookup[$child], $resetLookup[$parent])) {
                continue;
            }
            if (!in_array($parent, $adjacency[$child], true)) {
                $adjacency[$child][] = $parent;
                $indegree[$parent]++;
            }
        }

        $queue = array_keys(array_filter($indegree, static fn (int $value): bool => $value === 0));
        sort($queue);
        $order = [];
        while ($queue !== []) {
            $table = array_shift($queue);
            $order[] = $table;
            foreach ($adjacency[$table] as $parent) {
                $indegree[$parent]--;
                if ($indegree[$parent] === 0) {
                    $queue[] = $parent;
                    sort($queue);
                }
            }
        }

        $cycles = array_values(array_diff($tables, $order));
        sort($cycles);
        return ['order' => $order, 'cycles' => $cycles];
    }

    /** @return array<string, mixed> */
    private function schemaMetadata(): array
    {
        $tables = $this->db->query(
            'SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_TYPE = \'BASE TABLE\'
             ORDER BY TABLE_NAME'
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $columns = $this->db->query(
            'SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, COLUMN_TYPE,
                    IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLLATION_NAME
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
             ORDER BY TABLE_NAME, ORDINAL_POSITION'
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $indexes = $this->db->query(
            'SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
             FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
             ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX'
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return ['tables' => $tables, 'columns' => $columns, 'indexes' => $indexes];
    }

    private function latestMigration(): string
    {
        if (!in_array('schema_migrations', $this->schemaTables(), true)) {
            return '';
        }
        return (string) ($this->db->query('SELECT MAX(version) FROM schema_migrations')->fetchColumn() ?: '');
    }

    private function quoteIdentifier(string $identifier): string
    {
        if (!preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
            throw new InvalidArgumentException('Invalid SQL identifier.');
        }
        return '`' . $identifier . '`';
    }
}
