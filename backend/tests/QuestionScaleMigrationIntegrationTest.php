<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

function migrationAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function migrationColumnType(PDO $db, string $table, string $column): string
{
    $stmt = $db->prepare(
        'SELECT COLUMN_TYPE
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
    );
    $stmt->execute([':table_name' => $table, ':column_name' => $column]);
    return (string) $stmt->fetchColumn();
}

function migrationSnapshot(PDO $db): string
{
    $tables = [
        'filter_aliases', 'filter_types', 'filters', 'question_answer_idempotency',
        'question_filters', 'question_search_documents', 'questions', 'user_answers',
    ];
    $placeholders = implode(',', array_fill(0, count($tables), '?'));
    $result = [];
    foreach ([
        "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ({$placeholders})
         ORDER BY TABLE_NAME, ORDINAL_POSITION",
        "SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, INDEX_TYPE
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ({$placeholders})
         ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX",
        "SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
         FROM information_schema.TABLE_CONSTRAINTS
         WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME IN ({$placeholders})
         ORDER BY TABLE_NAME, CONSTRAINT_NAME",
    ] as $sql) {
        $stmt = $db->prepare($sql);
        $stmt->execute($tables);
        $result[] = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
    $encoded = json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return hash('sha256', is_string($encoded) ? $encoded : '');
}

try {
    $db = (new Database())->getConnection();
    $beforeFilterType = migrationColumnType($db, 'filters', 'type');
    $migration = require __DIR__ . '/../database/migrations/20260717_010000_question_scale_foundation.php';
    migrationAssert(is_callable($migration), 'A migration nao retornou um callable.');

    $migration($db);
    $firstSnapshot = migrationSnapshot($db);
    $migration($db);
    $secondSnapshot = migrationSnapshot($db);

    migrationAssert($firstSnapshot === $secondSnapshot, 'O segundo up alterou novamente o schema.');
    migrationAssert(
        migrationColumnType($db, 'filters', 'type') === $beforeFilterType,
        'A migration alterou o tipo legado de filters.type.'
    );
    foreach ([
        ['questions', 'published_sort_at'],
        ['questions', 'has_image'],
        ['questions', 'has_teacher_comment'],
        ['questions', 'has_detailed_comment'],
        ['filters', 'asset_url'],
        ['filters', 'icon_key'],
        ['filters', 'keywords_json'],
        ['user_answers', 'selected_option_id'],
    ] as [$table, $column]) {
        migrationAssert(migrationColumnType($db, $table, $column) !== '', "Coluna ausente: {$table}.{$column}");
    }
    foreach (['filter_types', 'filter_aliases', 'question_search_documents', 'question_answer_idempotency'] as $table) {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name'
        );
        $stmt->execute([':table_name' => $table]);
        migrationAssert((int) $stmt->fetchColumn() === 1, 'Tabela ausente: ' . $table);
    }

    fwrite(STDOUT, json_encode([
        'test' => 'QuestionScaleMigrationIntegrationTest',
        'status' => 'PASS',
        'schemaHash' => $secondSnapshot,
        'filterTypePreserved' => $beforeFilterType,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
} catch (Throwable $error) {
    fwrite(STDERR, json_encode([
        'test' => 'QuestionScaleMigrationIntegrationTest',
        'status' => 'FAIL',
        'message' => $error->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
}
