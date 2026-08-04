<?php

declare(strict_types=1);

/**
 * Persiste o motivo sanitizado de falha por questao nos lotes do crawler Gran.
 *
 * Rollback: backend/database/rollbacks/20260804_010000_gran_question_failure_diagnostics.sql
 */
return static function (PDO $db): void {
    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
    );
    $stmt->execute([
        ':table_name' => 'private_ingestion_batches',
        ':column_name' => 'question_errors_json',
    ]);
    if ((int) $stmt->fetchColumn() === 0) {
        $db->exec(
            'ALTER TABLE private_ingestion_batches '
            . 'ADD COLUMN question_errors_json LONGTEXT NULL AFTER question_statuses_json'
        );
    }
};
