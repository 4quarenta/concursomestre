<?php

declare(strict_types=1);

/**
 * Reconciles canonical scale contracts when migration metadata exists but the
 * corresponding DDL was not materialized. Both source migrations are
 * idempotent; this migration intentionally keeps their original contracts as
 * the single source of truth.
 */
return static function (PDO $db): void {
    $root = __DIR__;
    $foundations = [
        $root . '/20260717_010000_question_scale_foundation.php',
        $root . '/20260722_010000_filter_organization_identity.php',
    ];

    foreach ($foundations as $foundationPath) {
        $foundation = require $foundationPath;
        if (!is_callable($foundation)) {
            throw new RuntimeException('Migration foundation invalida: ' . basename($foundationPath));
        }
        $foundation($db);
    }

    $tableExists = static function (string $table) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name'
        );
        $stmt->execute([':table_name' => $table]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $columnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $indexExists = static function (string $table, string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name'
        );
        $stmt->execute([':table_name' => $table, ':index_name' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    };

    $requiredTables = [
        'filter_types',
        'filter_aliases',
        'question_answer_idempotency',
        'question_search_documents',
    ];
    foreach ($requiredTables as $table) {
        if (!$tableExists($table)) {
            throw new RuntimeException("Contrato de escala nao materializado: tabela {$table} ausente.");
        }
    }

    $requiredColumns = [
        'questions' => [
            'published_sort_at',
            'has_image',
            'has_teacher_comment',
            'has_detailed_comment',
        ],
        'filters' => [
            'acronym',
            'description',
            'website',
            'asset_url',
            'icon_key',
            'keywords_json',
            'taxonomy_level',
        ],
        'user_answers' => ['selected_option_id'],
    ];
    foreach ($requiredColumns as $table => $columns) {
        foreach ($columns as $column) {
            if (!$columnExists($table, $column)) {
                throw new RuntimeException("Contrato de escala nao materializado: {$table}.{$column} ausente.");
            }
        }
    }

    $requiredIndexes = [
        ['questions', 'idx_questions_public_keyset_v2'],
        ['question_filters', 'idx_question_filters_filter_question'],
        ['filters', 'idx_filters_type_name_id'],
        ['filters', 'uq_filters_type_acronym'],
        ['user_answers', 'idx_user_answers_selected_option'],
        ['user_answers', 'idx_user_answers_user_question_latest'],
        ['question_search_documents', 'ft_question_search_statement'],
        ['filter_aliases', 'idx_filter_alias_lookup'],
    ];
    foreach ($requiredIndexes as [$table, $index]) {
        if (!$indexExists($table, $index)) {
            throw new RuntimeException("Contrato de escala nao materializado: indice {$table}.{$index} ausente.");
        }
    }
};
