<?php

declare(strict_types=1);

/**
 * Auditoria somente leitura para preparar o banco para crescimento.
 *
 * Uso local:
 *   php backend/scripts/performance/audit_database_capacity.php
 *
 * Uso fora da arvore da aplicacao:
 *   BACKEND_ROOT=/caminho/backend php audit_database_capacity.php
 */

$backendRoot = trim((string) getenv('BACKEND_ROOT'));
if ($backendRoot === '') {
    $backendRoot = dirname(__DIR__, 2);
}

require_once rtrim($backendRoot, DIRECTORY_SEPARATOR) . '/config/database.php';

$db = (new Database())->getConnection();
$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

$fetchAll = static function (PDO $connection, string $sql, array $params = []): array {
    $stmt = $connection->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll() ?: [];
};

$fetchOne = static function (PDO $connection, string $sql, array $params = []): array {
    $stmt = $connection->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return is_array($row) ? $row : [];
};

$criticalTables = [
    'users',
    'auth_sessions',
    'auth_refresh_tokens',
    'questions',
    'question_options',
    'question_assets',
    'question_contexts',
    'question_context_questions',
    'question_editorials',
    'question_filters',
    'question_search_documents',
    'question_stats',
    'user_answers',
    'user_statistics',
    'subject_statistics',
    'study_sessions',
    'comments',
    'comment_likes',
    'notifications',
    'saved_questions',
    'user_saved_questions',
    'user_notes',
    'user_bookmarks',
    'user_highlights',
    'user_gamification_events',
    'user_streaks',
    'user_badges',
    'legal_areas',
    'laws',
    'law_sections',
    'law_articles',
    'law_article_blocks',
    'legal_user_comments',
    'legal_user_favorites',
    'legal_user_progress',
    'legal_user_notes',
    'legal_user_reader_annotations',
    'law_versions',
    'law_article_versions',
    'legal_content_reactions',
    'legal_comment_reports',
    'transactions',
    'financial_ledger_entries',
    'provider_webhook_events',
    'user_subscriptions',
    'materials',
    'material_ratings',
    'material_uploads',
    'reports',
    'admin_audit_logs',
    'analytics_lifecycle_events',
    'simulations',
    'simulation_questions',
    'provas',
    'prova_extracoes',
    'prova_extracao_itens',
    'private_ingestion_jobs',
    'private_ingestion_requests',
];

$databaseSummary = $fetchOne(
    $db,
    "SELECT DATABASE() AS database_name,
            COUNT(*) AS table_count,
            ROUND(SUM(data_length) / 1024 / 1024, 2) AS data_mb,
            ROUND(SUM(index_length) / 1024 / 1024, 2) AS index_mb,
            ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS total_mb
       FROM information_schema.TABLES
      WHERE table_schema = DATABASE()"
);

$tables = $fetchAll(
    $db,
    "SELECT table_name,
            engine,
            table_rows AS estimated_rows,
            ROUND(data_length / 1024 / 1024, 2) AS data_mb,
            ROUND(index_length / 1024 / 1024, 2) AS index_mb,
            ROUND((data_length + index_length) / 1024 / 1024, 2) AS total_mb,
            table_collation
       FROM information_schema.TABLES
      WHERE table_schema = DATABASE()
      ORDER BY (data_length + index_length) DESC, table_name"
);

$collations = $fetchAll(
    $db,
    "SELECT table_collation, COUNT(*) AS table_count
       FROM information_schema.TABLES
      WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
      GROUP BY table_collation
      ORDER BY table_count DESC"
);

$tablesWithoutPrimaryKey = $fetchAll(
    $db,
    "SELECT t.table_name
       FROM information_schema.TABLES t
       LEFT JOIN information_schema.TABLE_CONSTRAINTS tc
         ON tc.constraint_schema = t.table_schema
        AND tc.table_name = t.table_name
        AND tc.constraint_type = 'PRIMARY KEY'
      WHERE t.table_schema = DATABASE()
        AND t.table_type = 'BASE TABLE'
        AND tc.constraint_name IS NULL
      ORDER BY t.table_name"
);

$criticalPlaceholders = implode(',', array_fill(0, count($criticalTables), '?'));
$criticalTableStats = $fetchAll(
    $db,
    "SELECT table_name,
            table_rows AS estimated_rows,
            ROUND(data_length / 1024 / 1024, 2) AS data_mb,
            ROUND(index_length / 1024 / 1024, 2) AS index_mb,
            table_collation
       FROM information_schema.TABLES
      WHERE table_schema = DATABASE()
        AND table_name IN ({$criticalPlaceholders})
      ORDER BY table_name",
    $criticalTables
);

$criticalIndexes = $fetchAll(
    $db,
    "SELECT table_name,
            index_name,
            non_unique,
            index_type,
            GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS columns
       FROM information_schema.STATISTICS
      WHERE table_schema = DATABASE()
        AND table_name IN ({$criticalPlaceholders})
      GROUP BY table_name, index_name, non_unique, index_type
      ORDER BY table_name, index_name",
    $criticalTables
);

$criticalColumns = $fetchAll(
    $db,
    "SELECT table_name,
            column_name,
            column_type,
            is_nullable,
            column_default,
            extra
       FROM information_schema.COLUMNS
      WHERE table_schema = DATABASE()
        AND table_name IN ({$criticalPlaceholders})
      ORDER BY table_name, ordinal_position",
    $criticalTables
);

$foreignKeysByTable = $fetchAll(
    $db,
    "SELECT table_name, COUNT(*) AS foreign_key_count
       FROM information_schema.TABLE_CONSTRAINTS
      WHERE constraint_schema = DATABASE()
        AND constraint_type = 'FOREIGN KEY'
      GROUP BY table_name
      ORDER BY table_name"
);

$foreignKeyDetails = $fetchAll(
    $db,
    "SELECT kcu.table_name,
            kcu.constraint_name,
            kcu.column_name,
            kcu.referenced_table_name,
            kcu.referenced_column_name,
            rc.update_rule,
            rc.delete_rule
       FROM information_schema.KEY_COLUMN_USAGE kcu
       INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
         ON rc.constraint_schema = kcu.constraint_schema
        AND rc.constraint_name = kcu.constraint_name
        AND rc.table_name = kcu.table_name
      WHERE kcu.constraint_schema = DATABASE()
        AND kcu.referenced_table_name IS NOT NULL
      ORDER BY kcu.table_name, kcu.constraint_name, kcu.ordinal_position"
);

$userIdColumns = $fetchAll(
    $db,
    "SELECT table_name,
            column_name,
            column_type,
            is_nullable,
            character_set_name,
            collation_name
       FROM information_schema.COLUMNS
      WHERE table_schema = DATABASE()
        AND (column_name = 'user_id'
          OR column_name LIKE '%_user_id'
          OR column_name IN ('author_id', 'buyer_id', 'seller_id'))
      ORDER BY column_type, table_name, ordinal_position"
);

$jsonLikeTextColumns = $fetchAll(
    $db,
    "SELECT table_name, column_name, column_type
       FROM information_schema.COLUMNS
      WHERE table_schema = DATABASE()
        AND data_type IN ('text', 'mediumtext', 'longtext', 'varchar')
        AND (column_name LIKE '%json%' OR column_name IN ('data', 'metadata', 'payload'))
      ORDER BY table_name, ordinal_position"
);

$userIdDataProfiles = [];
foreach ($userIdColumns as $column) {
    $table = (string) ($column['table_name'] ?? $column['TABLE_NAME'] ?? '');
    $columnName = (string) ($column['column_name'] ?? $column['COLUMN_NAME'] ?? '');
    if ($table === '' || $columnName === '') {
        continue;
    }
    $quotedTable = '`' . str_replace('`', '', $table) . '`';
    $quotedColumn = '`' . str_replace('`', '', $columnName) . '`';
    $profile = $fetchOne(
        $db,
        "SELECT COUNT(*) AS total_rows,
                SUM({$quotedColumn} IS NOT NULL AND TRIM({$quotedColumn}) <> '') AS populated_rows,
                MAX(CHAR_LENGTH({$quotedColumn})) AS max_length,
                SUM(
                    {$quotedColumn} IS NOT NULL
                    AND TRIM({$quotedColumn}) <> ''
                    AND {$quotedColumn} NOT REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
                ) AS non_uuid_values
           FROM {$quotedTable}"
    );
    $orphanedRows = null;
    if ($table !== 'users') {
        $orphan = $fetchOne(
            $db,
            "SELECT COUNT(*) AS orphaned_rows
               FROM {$quotedTable} source_row
               LEFT JOIN users u
                 ON u.id COLLATE utf8mb4_unicode_ci = source_row.{$quotedColumn} COLLATE utf8mb4_unicode_ci
              WHERE source_row.{$quotedColumn} IS NOT NULL
                AND TRIM(source_row.{$quotedColumn}) <> ''
                AND u.id IS NULL"
        );
        $orphanedRows = (int) ($orphan['orphaned_rows'] ?? 0);
    }
    $userIdDataProfiles[] = array_merge($column, [
        'total_rows' => (int) ($profile['total_rows'] ?? 0),
        'populated_rows' => (int) ($profile['populated_rows'] ?? 0),
        'max_length' => isset($profile['max_length']) ? (int) $profile['max_length'] : 0,
        'non_uuid_values' => (int) ($profile['non_uuid_values'] ?? 0),
        'orphaned_rows' => $orphanedRows,
    ]);
}

$variables = [];
foreach ([
    'version',
    'innodb_buffer_pool_size',
    'max_connections',
    'tmp_table_size',
    'max_heap_table_size',
    'slow_query_log',
    'long_query_time',
] as $variable) {
    $row = $fetchOne($db, 'SHOW VARIABLES LIKE ?', [$variable]);
    if ($row !== []) {
        $variables[$variable] = $row['Value'] ?? null;
    }
}

$status = [];
foreach ([
    'Threads_connected',
    'Max_used_connections',
    'Slow_queries',
    'Created_tmp_tables',
    'Created_tmp_disk_tables',
] as $statusName) {
    $row = $fetchOne($db, 'SHOW GLOBAL STATUS LIKE ?', [$statusName]);
    if ($row !== []) {
        $status[$statusName] = $row['Value'] ?? null;
    }
}

$report = [
    'generated_at' => gmdate(DATE_ATOM),
    'database' => $databaseSummary,
    'variables' => $variables,
    'status' => $status,
    'collations' => $collations,
    'tables_without_primary_key' => $tablesWithoutPrimaryKey,
    'critical_tables' => $criticalTableStats,
    'critical_indexes' => $criticalIndexes,
    'critical_columns' => $criticalColumns,
    'foreign_keys_by_table' => $foreignKeysByTable,
    'foreign_key_details' => $foreignKeyDetails,
    'user_id_columns' => $userIdColumns,
    'user_id_data_profiles' => $userIdDataProfiles,
    'json_like_text_columns' => $jsonLikeTextColumns,
    'largest_tables' => array_slice($tables, 0, 30),
];

fwrite(STDOUT, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
