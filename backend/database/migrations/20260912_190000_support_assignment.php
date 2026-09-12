<?php

declare(strict_types=1);

/**
 * Adiciona o operador responsavel por uma thread raiz de suporte.
 *
 * O campo e opcional para preservar threads existentes. A foreign key nao e
 * criada porque users.id possui contratos legados de collation variavel; a
 * autoridade de suporte valida o operador ativo antes de cada atribuicao.
 *
 * Rollback:
 * backend/database/rollbacks/20260912_190000_support_assignment.sql
 */
return static function (PDO $db): void {
    $columnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT 1 FROM information_schema.COLUMNS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name LIMIT 1'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (bool) $stmt->fetchColumn();
    };

    $indexExists = static function (string $table, string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT 1 FROM information_schema.STATISTICS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name LIMIT 1'
        );
        $stmt->execute([':table_name' => $table, ':index_name' => $index]);
        return (bool) $stmt->fetchColumn();
    };

    if (!$columnExists('user_feedback', 'assigned_to')) {
        $db->exec(
            'ALTER TABLE user_feedback '
            . 'ADD COLUMN assigned_to VARCHAR(64) NULL AFTER user_id'
        );
    }

    if (!$indexExists('user_feedback', 'idx_feedback_assigned_to')) {
        $db->exec(
            'CREATE INDEX idx_feedback_assigned_to '
            . 'ON user_feedback (assigned_to, status, created_at, id)'
        );
    }
};
