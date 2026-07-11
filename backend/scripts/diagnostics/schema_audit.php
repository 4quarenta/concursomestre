<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';

function schemaAuditIdentifier(string $identifier): string
{
    if (preg_match('/^[a-z0-9_]+$/i', $identifier) !== 1) {
        throw new InvalidArgumentException('Identificador de schema invalido.');
    }

    return chr(96) . $identifier . chr(96);
}

function schemaAuditTableExists(PDO $db, string $table): bool
{
    $stmt = $db->prepare(
        'SELECT COUNT(*)
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name'
    );
    $stmt->execute([':table_name' => $table]);
    return (int) $stmt->fetchColumn() > 0;
}

function schemaAuditColumnExists(PDO $db, string $table, string $column): bool
{
    $stmt = $db->prepare(
        'SELECT COUNT(*)
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
           AND COLUMN_NAME = :column_name'
    );
    $stmt->execute([
        ':table_name' => $table,
        ':column_name' => $column,
    ]);
    return (int) $stmt->fetchColumn() > 0;
}

function schemaAuditJsonValidity(PDO $db, string $table, string $column): array
{
    $quotedTable = schemaAuditIdentifier($table);
    $quotedColumn = schemaAuditIdentifier($column);
    $sql = "SELECT
                COUNT(*) AS non_empty_count,
                SUM(CASE WHEN JSON_VALID({$quotedColumn}) = 0 THEN 1 ELSE 0 END) AS invalid_count
            FROM {$quotedTable}
            WHERE {$quotedColumn} IS NOT NULL
              AND TRIM({$quotedColumn}) <> ''";
    $row = $db->query($sql)->fetch(PDO::FETCH_ASSOC) ?: [];

    return [
        'non_empty_count' => (int) ($row['non_empty_count'] ?? 0),
        'invalid_count' => (int) ($row['invalid_count'] ?? 0),
    ];
}

$options = getopt('', ['output::']);

try {
    $db = (new Database())->getConnection();
    $databaseName = (string) $db->query('SELECT DATABASE()')->fetchColumn();
    $usersId = $db->query(
        "SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'users'
           AND COLUMN_NAME = 'id'"
    )->fetch(PDO::FETCH_ASSOC) ?: null;

    $userIdColumns = $db->query(
        "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND COLUMN_NAME IN ('user_id', 'seller_id', 'created_by', 'created_by_user_id', 'updated_by_user_id')
         ORDER BY TABLE_NAME, COLUMN_NAME"
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $userIdMismatches = array_values(array_filter($userIdColumns, static function (array $column) use ($usersId): bool {
        if ($usersId === null || !in_array($column['COLUMN_NAME'], ['user_id', 'seller_id'], true)) {
            return false;
        }

        return strtolower((string) $column['COLUMN_TYPE']) !== strtolower((string) $usersId['COLUMN_TYPE'])
            || strtolower((string) $column['COLLATION_NAME']) !== strtolower((string) $usersId['COLLATION_NAME']);
    }));

    $jsonTextColumns = $db->query(
        "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND COLUMN_NAME LIKE '%\\\\_json' ESCAPE '\\\\'
           AND DATA_TYPE IN ('text', 'mediumtext', 'longtext')
         ORDER BY TABLE_NAME, COLUMN_NAME"
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];
    foreach ($jsonTextColumns as &$column) {
        try {
            $column['validity'] = schemaAuditJsonValidity($db, (string) $column['TABLE_NAME'], (string) $column['COLUMN_NAME']);
        } catch (Throwable $exception) {
            $column['validity'] = ['error' => $exception->getMessage()];
        }
    }
    unset($column);

    $duplicateIndexes = $db->query(
        "SELECT table_name, non_unique, indexed_columns, GROUP_CONCAT(index_name ORDER BY index_name) AS index_names
         FROM (
             SELECT TABLE_NAME AS table_name,
                    NON_UNIQUE AS non_unique,
                    INDEX_NAME AS index_name,
                    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS indexed_columns
             FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
             GROUP BY TABLE_NAME, NON_UNIQUE, INDEX_NAME
         ) index_definitions
         GROUP BY table_name, non_unique, indexed_columns
         HAVING COUNT(*) > 1
         ORDER BY table_name, indexed_columns"
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $foreignKeyMismatches = $db->query(
        "SELECT kcu.TABLE_NAME,
                kcu.COLUMN_NAME,
                kcu.REFERENCED_TABLE_NAME,
                kcu.REFERENCED_COLUMN_NAME,
                local_column.COLUMN_TYPE AS local_type,
                local_column.COLLATION_NAME AS local_collation,
                referenced_column.COLUMN_TYPE AS referenced_type,
                referenced_column.COLLATION_NAME AS referenced_collation
         FROM information_schema.KEY_COLUMN_USAGE kcu
         INNER JOIN information_schema.COLUMNS local_column
           ON local_column.TABLE_SCHEMA = kcu.TABLE_SCHEMA
          AND local_column.TABLE_NAME = kcu.TABLE_NAME
          AND local_column.COLUMN_NAME = kcu.COLUMN_NAME
         INNER JOIN information_schema.COLUMNS referenced_column
           ON referenced_column.TABLE_SCHEMA = kcu.REFERENCED_TABLE_SCHEMA
          AND referenced_column.TABLE_NAME = kcu.REFERENCED_TABLE_NAME
          AND referenced_column.COLUMN_NAME = kcu.REFERENCED_COLUMN_NAME
         WHERE kcu.TABLE_SCHEMA = DATABASE()
           AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
           AND (
               local_column.COLUMN_TYPE <> referenced_column.COLUMN_TYPE
               OR BINARY COALESCE(local_column.COLLATION_NAME, '') <> BINARY COALESCE(referenced_column.COLLATION_NAME, '')
           )
         ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME"
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $orphanTargets = [
        ['table' => 'auth_sessions', 'column' => 'user_id', 'reference_table' => 'users', 'reference_column' => 'id'],
        ['table' => 'user_subscriptions', 'column' => 'user_id', 'reference_table' => 'users', 'reference_column' => 'id'],
        ['table' => 'transactions', 'column' => 'user_id', 'reference_table' => 'users', 'reference_column' => 'id'],
        ['table' => 'user_study_schedules', 'column' => 'user_id', 'reference_table' => 'users', 'reference_column' => 'id'],
    ];
    $orphans = [];
    foreach ($orphanTargets as $target) {
        if (!schemaAuditTableExists($db, $target['table'])
            || !schemaAuditColumnExists($db, $target['table'], $target['column'])
            || !schemaAuditTableExists($db, $target['reference_table'])) {
            continue;
        }

        $table = schemaAuditIdentifier($target['table']);
        $column = schemaAuditIdentifier($target['column']);
        $referenceTable = schemaAuditIdentifier($target['reference_table']);
        $referenceColumn = schemaAuditIdentifier($target['reference_column']);
        $count = (int) $db->query(
            "SELECT COUNT(*)
             FROM {$table} source_row
             LEFT JOIN {$referenceTable} referenced_row
               ON BINARY referenced_row.{$referenceColumn} = BINARY source_row.{$column}
             WHERE source_row.{$column} IS NOT NULL
               AND source_row.{$column} <> ''
               AND referenced_row.{$referenceColumn} IS NULL"
        )->fetchColumn();
        $orphans[] = [...$target, 'orphan_count' => $count];
    }

    $collations = $db->query(
        "SELECT COALESCE(COLLATION_NAME, '(none)') AS collation_name, COUNT(*) AS column_count
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
         GROUP BY COLLATION_NAME
         ORDER BY column_count DESC"
    )->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $migrationTableExists = schemaAuditTableExists($db, 'schema_migrations');
    $migrationCount = $migrationTableExists
        ? (int) $db->query('SELECT COUNT(*) FROM schema_migrations')->fetchColumn()
        : 0;

    $report = [
        'generated_at' => gmdate(DATE_ATOM),
        'database' => $databaseName,
        'users_id' => $usersId,
        'user_id_columns' => $userIdColumns,
        'user_id_mismatches' => $userIdMismatches,
        'json_text_columns' => $jsonTextColumns,
        'duplicate_indexes' => $duplicateIndexes,
        'foreign_key_mismatches' => $foreignKeyMismatches,
        'orphans' => $orphans,
        'collations' => $collations,
        'schema_migrations' => [
            'exists' => $migrationTableExists,
            'count' => $migrationCount,
        ],
    ];

    $json = json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        throw new RuntimeException('Nao foi possivel serializar o diagnostico.');
    }

    if (isset($options['output']) && is_string($options['output']) && trim($options['output']) !== '') {
        file_put_contents((string) $options['output'], $json . PHP_EOL);
    }

    fwrite(STDOUT, $json . PHP_EOL);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Schema audit failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
