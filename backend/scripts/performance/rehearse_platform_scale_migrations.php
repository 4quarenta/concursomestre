<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/env.php';

$options = getopt('', ['database:']);
$databaseName = trim((string) ($options['database'] ?? ''));
if (!preg_match('/^concursomestre_scale_stage_[0-9]{8}(?:_[0-9]{4})?$/', $databaseName)) {
    fwrite(STDERR, "Use exclusivamente uma base temporaria concursomestre_scale_stage_YYYYMMDD[_HHMM].\n");
    exit(2);
}

$host = getEnvString('DB_HOST', '127.0.0.1');
$port = getEnvString('DB_PORT', '3306');
$user = getEnvString('DB_USER');
$password = getEnvString('DB_PASSWORD', getEnvString('DB_PASS'));
if ($user === '' || $password === '') {
    fwrite(STDERR, "Credenciais do banco nao configuradas.\n");
    exit(2);
}

try {
    $db = new PDO(
        "mysql:host={$host};port={$port};dbname={$databaseName};charset=utf8mb4",
        $user,
        $password,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    $db->exec("SET time_zone = '" . getDatabaseTimezoneOffset() . "'");

    $migrationFiles = [
        __DIR__ . '/../../database/migrations/20260722_020000_platform_scale_readiness.php',
        __DIR__ . '/../../database/migrations/20260722_030000_user_identity_hot_paths.php',
        __DIR__ . '/../../database/migrations/20260722_050000_async_events_and_answer_archive.php',
    ];
    $timings = [];
    foreach ([1, 2] as $pass) {
        foreach ($migrationFiles as $migrationFile) {
            $migration = require $migrationFile;
            if (!is_callable($migration)) {
                throw new RuntimeException('Migration invalida: ' . basename($migrationFile));
            }
            $startedAt = microtime(true);
            $migration($db);
            $timings[] = [
                'pass' => $pass,
                'migration' => basename($migrationFile),
                'executionMs' => (int) round((microtime(true) - $startedAt) * 1000),
            ];
        }
    }

    $requiredIndexes = [
        'private_ingestion_jobs.idx_private_ingestion_jobs_available',
        'comments.idx_comments_target_public_keyset',
        'comments.idx_comments_type_target_public_keyset',
        'notifications.idx_notifications_visible_keyset',
        'notifications.idx_notifications_unread_count',
        'legal_user_comments.idx_legal_comments_article_keyset',
        'legal_content_reactions.idx_legal_reactions_target_value',
        'materials.idx_materials_public_keyset',
        'reports.idx_reports_moderation_queue',
        'simulations.idx_simulations_user_latest',
        'transactions.idx_transactions_user_keyset',
        'platform_event_outbox.idx_platform_event_outbox_claim',
        'user_answer_counters.idx_user_answer_counters_ranking',
        'user_answers_archive.idx_user_answers_archive_history',
        'user_answers.idx_user_answers_archive_candidates',
        'provas.idx_provas_admin_keyset',
        'laws.idx_laws_admin_keyset',
    ];
    $missingIndexes = [];
    foreach ($requiredIndexes as $qualifiedIndex) {
        [$table, $index] = explode('.', $qualifiedIndex, 2);
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name'
        );
        $stmt->execute([':table_name' => $table, ':index_name' => $index]);
        if ((int) $stmt->fetchColumn() === 0) {
            $missingIndexes[] = $qualifiedIndex;
        }
    }

    $identityColumns = $db->query(
        "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLLATION_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND (
                (TABLE_NAME IN ('auth_sessions', 'email_verifications', 'user_bookmarks', 'user_highlights',
                    'material_ratings', 'analytics_lifecycle_events', 'legal_comment_reports',
                    'legal_content_reactions', 'legal_user_comments', 'legal_user_favorites',
                    'legal_user_notes', 'legal_user_progress', 'legal_user_reader_annotations')
                 AND COLUMN_NAME = 'user_id')
                OR (TABLE_NAME = 'admin_audit_logs' AND COLUMN_NAME = 'admin_user_id')
                OR (TABLE_NAME = 'laws' AND COLUMN_NAME IN ('created_by_user_id', 'updated_by_user_id', 'published_by_user_id'))
                OR (TABLE_NAME = 'questions_groups' AND COLUMN_NAME IN ('created_by_user_id', 'updated_by_user_id'))
           )
         ORDER BY TABLE_NAME, COLUMN_NAME"
    )->fetchAll();
    $nonCanonicalIdentityColumns = array_values(array_filter(
        $identityColumns,
        static fn (array $row): bool => strtolower((string) $row['COLUMN_TYPE']) !== 'varchar(36)'
            || strtolower((string) $row['COLLATION_NAME']) !== 'utf8mb4_unicode_ci'
    ));

    $orphanChecks = [];
    foreach ($identityColumns as $row) {
        $table = preg_replace('/[^a-z0-9_]/i', '', (string) $row['TABLE_NAME']);
        $column = preg_replace('/[^a-z0-9_]/i', '', (string) $row['COLUMN_NAME']);
        $count = (int) $db->query(
            "SELECT COUNT(*) FROM `{$table}` source_row "
            . "LEFT JOIN users u ON u.id = source_row.`{$column}` "
            . "WHERE source_row.`{$column}` IS NOT NULL AND source_row.`{$column}` <> '' AND u.id IS NULL"
        )->fetchColumn();
        if ($count > 0) {
            $orphanChecks["{$table}.{$column}"] = $count;
        }
    }

    $commentStatusRows = [];
    foreach (['comments', 'legal_user_comments'] as $table) {
        $commentStatusRows[$table] = (int) $db->query(
            "SELECT COUNT(*) FROM `{$table}` WHERE moderation_status IS NULL OR TRIM(moderation_status) = ''"
        )->fetchColumn();
    }
    $legacyTransactionReferences = (int) $db->query(
        'SELECT COUNT(*) FROM transactions WHERE legacy_user_reference IS NOT NULL'
    )->fetchColumn();

    $failures = [];
    if ($missingIndexes !== []) {
        $failures['missingIndexes'] = $missingIndexes;
    }
    if ($nonCanonicalIdentityColumns !== []) {
        $failures['nonCanonicalIdentityColumns'] = $nonCanonicalIdentityColumns;
    }
    if ($orphanChecks !== []) {
        $failures['orphanIdentityReferences'] = $orphanChecks;
    }
    if (array_sum($commentStatusRows) > 0) {
        $failures['emptyCommentModerationStatuses'] = $commentStatusRows;
    }

    $result = [
        'database' => $databaseName,
        'status' => $failures === [] ? 'PASS' : 'FAIL',
        'timings' => $timings,
        'indexesChecked' => count($requiredIndexes),
        'identityColumnsChecked' => count($identityColumns),
        'legacyTransactionReferencesPreserved' => $legacyTransactionReferences,
        'failures' => $failures,
    ];
    fwrite(STDOUT, json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit($failures === [] ? 0 : 1);
} catch (Throwable $error) {
    fwrite(STDERR, json_encode([
        'database' => $databaseName,
        'status' => 'FAIL',
        'message' => $error->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
}
