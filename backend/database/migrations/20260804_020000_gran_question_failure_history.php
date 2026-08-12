<?php

declare(strict_types=1);

/**
 * Historico duravel das questoes da Gran que falharam na publicacao.
 *
 * Os lotes e jobs operacionais possuem retencao curta. Esta tabela preserva
 * somente o diagnostico editorial e o rascunho canonico necessario para
 * moderar ou reenviar a questao, sem guardar credenciais do provedor.
 *
 * Rollback: backend/database/rollbacks/20260804_020000_gran_question_failure_history.sql
 */
return static function (PDO $db): void {
    $columnStmt = $db->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
    );
    $columnStmt->execute([
        ':table_name' => 'private_ingestion_batches',
        ':column_name' => 'failure_history_synced_at',
    ]);
    if ((int) $columnStmt->fetchColumn() === 0) {
        $db->exec(
            'ALTER TABLE private_ingestion_batches '
            . 'ADD COLUMN failure_history_synced_at DATETIME NULL AFTER question_errors_json'
        );
    }
    $db->exec(
        "CREATE TABLE IF NOT EXISTS gran_question_publication_failures (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            actor_user_id VARCHAR(80) NOT NULL,
            source_key VARCHAR(255) NOT NULL,
            provider VARCHAR(40) NOT NULL DEFAULT 'gran',
            external_question_id VARCHAR(80) NULL,
            question_number VARCHAR(40) NULL,
            exam_title VARCHAR(500) NULL,
            subject_slug VARCHAR(255) NULL,
            batch_id BIGINT UNSIGNED NULL,
            failure_code VARCHAR(64) NOT NULL,
            failure_message VARCHAR(500) NOT NULL,
            canonical_payload_json LONGTEXT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'open',
            attempt_count INT UNSIGNED NOT NULL DEFAULT 1,
            first_failed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_failed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_gran_failure_source (source_key),
            KEY idx_gran_failure_status_last (status, last_failed_at, id),
            KEY idx_gran_failure_external (provider, external_question_id),
            KEY idx_gran_failure_batch (batch_id),
            CONSTRAINT fk_gran_failure_batch FOREIGN KEY (batch_id)
                REFERENCES private_ingestion_batches(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
};
