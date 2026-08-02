<?php

declare(strict_types=1);

/**
 * Estado incremental das taxonomias Gran e lote-pai da publicacao assíncrona.
 *
 * Rollback: backend/database/rollbacks/20260802_010000_gran_crawler_batches.sql
 */
return static function (PDO $db): void {
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
    $foreignKeyExists = static function (string $table, string $constraint) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS '
            . "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND CONSTRAINT_NAME = :constraint_name AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
        );
        $stmt->execute([':table_name' => $table, ':constraint_name' => $constraint]);
        return (int) $stmt->fetchColumn() > 0;
    };

    $db->exec(
        "CREATE TABLE IF NOT EXISTS gran_taxonomy_sync_manifests (
            taxonomy_kind VARCHAR(40) NOT NULL,
            remote_total INT UNSIGNED NOT NULL DEFAULT 0,
            remote_index_signature VARCHAR(255) NULL,
            remote_updated_at VARCHAR(80) NULL,
            remote_fingerprint CHAR(64) NOT NULL,
            synced_total INT UNSIGNED NULL,
            synced_index_signature VARCHAR(255) NULL,
            synced_updated_at VARCHAR(80) NULL,
            synced_fingerprint CHAR(64) NULL,
            checked_at DATETIME NOT NULL,
            synced_at DATETIME NULL,
            PRIMARY KEY (taxonomy_kind),
            KEY idx_gran_taxonomy_checked (checked_at),
            KEY idx_gran_taxonomy_synced (synced_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS private_ingestion_batches (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            public_id CHAR(36) NOT NULL,
            actor_user_id VARCHAR(80) NOT NULL,
            idempotency_key VARCHAR(120) NOT NULL,
            payload_hash CHAR(64) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            question_count INT UNSIGNED NOT NULL DEFAULT 0,
            job_count INT UNSIGNED NOT NULL DEFAULT 0,
            pending_job_count INT UNSIGNED NOT NULL DEFAULT 0,
            processing_job_count INT UNSIGNED NOT NULL DEFAULT 0,
            completed_job_count INT UNSIGNED NOT NULL DEFAULT 0,
            failed_job_count INT UNSIGNED NOT NULL DEFAULT 0,
            created_question_count INT UNSIGNED NOT NULL DEFAULT 0,
            duplicate_question_count INT UNSIGNED NOT NULL DEFAULT 0,
            failed_question_count INT UNSIGNED NOT NULL DEFAULT 0,
            question_keys_json LONGTEXT NULL,
            question_statuses_json LONGTEXT NULL,
            error_summary VARCHAR(3000) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            started_at DATETIME NULL,
            completed_at DATETIME NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_private_ingestion_batch_public (public_id),
            UNIQUE KEY uq_private_ingestion_batch_actor_key (actor_user_id, idempotency_key),
            KEY idx_private_ingestion_batch_actor_created (actor_user_id, created_at, id),
            KEY idx_private_ingestion_batch_status (status, created_at, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!$columnExists('private_ingestion_jobs', 'batch_id')) {
        $db->exec('ALTER TABLE private_ingestion_jobs ADD COLUMN batch_id BIGINT UNSIGNED NULL AFTER request_id');
    }
    if (!$indexExists('private_ingestion_jobs', 'idx_private_ingestion_jobs_batch')) {
        $db->exec('CREATE INDEX idx_private_ingestion_jobs_batch ON private_ingestion_jobs (batch_id, status, id)');
    }
    if (!$foreignKeyExists('private_ingestion_jobs', 'fk_private_ingestion_jobs_batch')) {
        $db->exec(
            'ALTER TABLE private_ingestion_jobs ADD CONSTRAINT fk_private_ingestion_jobs_batch '
            . 'FOREIGN KEY (batch_id) REFERENCES private_ingestion_batches(id) ON DELETE SET NULL'
        );
    }
};
