<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

function platformScaleAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function platformScaleIndexExists(PDO $db, string $table, string $index): bool
{
    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM information_schema.STATISTICS '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name'
    );
    $stmt->execute([':table_name' => $table, ':index_name' => $index]);
    return (int) $stmt->fetchColumn() > 0;
}

function platformScaleColumnExists(PDO $db, string $table, string $column): bool
{
    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
    );
    $stmt->execute([':table_name' => $table, ':column_name' => $column]);
    return (int) $stmt->fetchColumn() > 0;
}

try {
    $db = (new Database())->getConnection();
    $migration = require __DIR__ . '/../database/migrations/20260722_020000_platform_scale_readiness.php';
    platformScaleAssert(is_callable($migration), 'A migration nao retornou um callable.');

    $migration($db);
    $migration($db);

    foreach (['available_at', 'locked_by', 'last_error_at', 'dead_lettered_at'] as $column) {
        platformScaleAssert(
            platformScaleColumnExists($db, 'private_ingestion_jobs', $column),
            'Coluna ausente na fila: private_ingestion_jobs.' . $column
        );
    }

    $indexes = [
        ['private_ingestion_jobs', 'idx_private_ingestion_jobs_available'],
        ['private_ingestion_jobs', 'idx_private_ingestion_jobs_stale'],
        ['comments', 'idx_comments_target_public_keyset'],
        ['comments', 'idx_comments_type_target_public_keyset'],
        ['notifications', 'idx_notifications_visible_keyset'],
        ['notifications', 'idx_notifications_unread_count'],
        ['legal_user_comments', 'idx_legal_comments_article_keyset'],
        ['legal_user_favorites', 'idx_legal_favorites_user_keyset'],
        ['study_sessions', 'idx_study_sessions_user_latest'],
        ['user_saved_questions', 'idx_saved_questions_user_keyset'],
        ['transactions', 'idx_transactions_user_keyset'],
        ['reports', 'idx_reports_moderation_queue'],
        ['materials', 'idx_materials_public_keyset'],
    ];
    foreach ($indexes as [$table, $index]) {
        if ($table === 'reports'
            && (!platformScaleColumnExists($db, 'reports', 'workflow_status')
                || !platformScaleColumnExists($db, 'reports', 'priority'))) {
            continue;
        }
        platformScaleAssert(platformScaleIndexExists($db, $table, $index), "Indice ausente: {$table}.{$index}");
    }

    fwrite(STDOUT, json_encode([
        'test' => 'PlatformScaleReadinessMigrationIntegrationTest',
        'status' => 'PASS',
        'indexesChecked' => count($indexes),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
} catch (Throwable $error) {
    fwrite(STDERR, json_encode([
        'test' => 'PlatformScaleReadinessMigrationIntegrationTest',
        'status' => 'FAIL',
        'message' => $error->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
}
