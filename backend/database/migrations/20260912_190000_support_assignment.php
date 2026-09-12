<?php

declare(strict_types=1);

/**
 * Adiciona a atribuicao do operador por uma tabela filha de suporte.
 *
 * A tabela e opcional para preservar threads existentes. As referencias nao
 * usam foreign keys porque os identificadores legados possuem contratos de
 * collation variavel; a autoridade valida a thread e o operador ativo.
 *
 * Rollback:
 * backend/database/rollbacks/20260912_190000_support_assignment.sql
 */
return static function (PDO $db): void {
    $db->exec(
        "CREATE TABLE IF NOT EXISTS support_case_assignments (
            feedback_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
            assigned_to VARCHAR(64) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_support_case_assignments_assignee (assigned_to, updated_at, feedback_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
};
