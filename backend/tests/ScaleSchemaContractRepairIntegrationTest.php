<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

function scaleRepairAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function scaleRepairSchemaObjectExists(PDO $db, string $objectType, string $table, ?string $name = null): bool
{
    $queries = [
        'table' => 'SELECT COUNT(*) FROM information_schema.TABLES '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name',
        'column' => 'SELECT COUNT(*) FROM information_schema.COLUMNS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :object_name',
        'index' => 'SELECT COUNT(*) FROM information_schema.STATISTICS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :object_name',
    ];
    scaleRepairAssert(isset($queries[$objectType]), 'Tipo de objeto de schema invalido.');
    $stmt = $db->prepare($queries[$objectType]);
    $params = [':table_name' => $table];
    if ($objectType !== 'table') {
        $params[':object_name'] = $name;
    }
    $stmt->execute($params);
    return (int) $stmt->fetchColumn() > 0;
}

try {
    $db = (new Database())->getConnection();
    $migration = require __DIR__ . '/../database/migrations/20260722_040000_scale_schema_contract_repair.php';
    scaleRepairAssert(is_callable($migration), 'A migration de reparo nao retornou um callable.');

    $migration($db);
    $migration($db);

    foreach (['filter_types', 'filter_aliases', 'question_answer_idempotency', 'question_search_documents'] as $table) {
        scaleRepairAssert(
            scaleRepairSchemaObjectExists($db, 'table', $table),
            "Tabela canonica ausente depois do reparo: {$table}"
        );
    }
    foreach ([
        ['questions', 'published_sort_at'],
        ['questions', 'has_image'],
        ['questions', 'has_teacher_comment'],
        ['questions', 'has_detailed_comment'],
        ['filters', 'acronym'],
        ['filters', 'asset_url'],
        ['filters', 'icon_key'],
        ['user_answers', 'selected_option_id'],
    ] as [$table, $column]) {
        scaleRepairAssert(
            scaleRepairSchemaObjectExists($db, 'column', $table, $column),
            "Coluna canonica ausente depois do reparo: {$table}.{$column}"
        );
    }
    foreach ([
        ['questions', 'idx_questions_public_keyset_v2'],
        ['filters', 'uq_filters_type_acronym'],
        ['user_answers', 'idx_user_answers_selected_option'],
        ['question_search_documents', 'ft_question_search_statement'],
    ] as [$table, $index]) {
        scaleRepairAssert(
            scaleRepairSchemaObjectExists($db, 'index', $table, $index),
            "Indice canonico ausente depois do reparo: {$table}.{$index}"
        );
    }

    fwrite(STDOUT, json_encode([
        'test' => 'ScaleSchemaContractRepairIntegrationTest',
        'status' => 'PASS',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
} catch (Throwable $error) {
    fwrite(STDERR, json_encode([
        'test' => 'ScaleSchemaContractRepairIntegrationTest',
        'status' => 'FAIL',
        'message' => $error->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
}
