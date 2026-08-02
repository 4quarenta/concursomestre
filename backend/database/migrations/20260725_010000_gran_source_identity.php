<?php

declare(strict_types=1);

/**
 * Persiste a identidade de origem dos itens coletados de provedores externos.
 *
 * A identidade nao depende de titulo, slug ou numero exibido na prova. Para a
 * Gran, por exemplo, provider + external_id e a chave estavel de prova,
 * questao e contexto. A migration falha fechada caso encontre duplicidade
 * preexistente antes de criar os indices unicos.
 *
 * Rollback: backend/database/rollbacks/20260725_010000_gran_source_identity.sql
 */
return static function (PDO $db): void {
    $tableExists = static function (string $table) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name'
        );
        $stmt->execute([':table_name' => $table]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $columnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $indexExists = static function (string $table, string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name'
        );
        $stmt->execute([':table_name' => $table, ':index_name' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $quote = static fn (string $identifier): string => '`' . str_replace('`', '', $identifier) . '`';
    $addSourceIdentity = static function (string $table) use ($db, $tableExists, $columnExists, $quote): void {
        if (!$tableExists($table)) {
            return;
        }
        if (!$columnExists($table, 'source_provider')) {
            $db->exec('ALTER TABLE ' . $quote($table) . ' ADD COLUMN `source_provider` VARCHAR(40) NULL');
        }
        if (!$columnExists($table, 'source_external_id')) {
            $db->exec('ALTER TABLE ' . $quote($table) . ' ADD COLUMN `source_external_id` VARCHAR(120) NULL');
        }
    };
    $addUniqueIdentity = static function (string $table, string $index) use ($db, $tableExists, $indexExists, $quote): void {
        if (!$tableExists($table) || $indexExists($table, $index)) {
            return;
        }
        $duplicates = $db->query(
            'SELECT COUNT(*) FROM (
                SELECT source_provider, source_external_id, COUNT(*) AS duplicate_count
                FROM ' . $quote($table) . '
                WHERE source_provider IS NOT NULL AND TRIM(source_provider) <> \'\'
                  AND source_external_id IS NOT NULL AND TRIM(source_external_id) <> \'\'
                GROUP BY source_provider, source_external_id
                HAVING COUNT(*) > 1
            ) source_duplicates'
        );
        if ((int) $duplicates->fetchColumn() > 0) {
            throw new RuntimeException(
                'Nao foi possivel criar ' . $index . ': existem identidades externas duplicadas em ' . $table . '.'
            );
        }
        $db->exec(
            'CREATE UNIQUE INDEX ' . $quote($index) . ' ON ' . $quote($table)
            . ' (`source_provider`, `source_external_id`)'
        );
    };

    foreach (['questions', 'provas', 'questions_groups', 'question_contexts'] as $table) {
        $addSourceIdentity($table);
    }

    $addUniqueIdentity('questions', 'uq_questions_source_identity');
    $addUniqueIdentity('provas', 'uq_provas_source_identity');
    $addUniqueIdentity('questions_groups', 'uq_question_groups_source_identity');
    $addUniqueIdentity('question_contexts', 'uq_question_contexts_source_identity');
};
