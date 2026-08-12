<?php

declare(strict_types=1);

/**
 * Checkpoint duravel, por administrador, do modo automatico do coletor Gran.
 *
 * Nao armazena credencial da Gran nem payload de questoes. Guarda somente o
 * proximo ano/pagina, o filtro publico e a chave idempotente do ciclo.
 *
 * Rollback: backend/database/rollbacks/20260808_191500_gran_automatic_crawler_checkpoint.sql
 */
return static function (PDO $db): void {
    $db->exec(
        "CREATE TABLE IF NOT EXISTS gran_automatic_crawler_checkpoints (
            actor_user_id VARCHAR(80) NOT NULL,
            run_key CHAR(36) NOT NULL,
            request_url VARCHAR(8000) NOT NULL,
            per_page INT UNSIGNED NOT NULL,
            current_year SMALLINT UNSIGNED NOT NULL,
            current_page INT UNSIGNED NOT NULL,
            total_pages INT UNSIGNED NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'paused',
            last_batch_public_id CHAR(36) NULL,
            last_error VARCHAR(1000) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (actor_user_id),
            KEY idx_gran_auto_checkpoint_status (status, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
};
