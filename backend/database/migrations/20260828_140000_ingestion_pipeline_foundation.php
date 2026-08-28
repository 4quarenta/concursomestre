<?php

declare(strict_types=1);

/**
 * Additive control-plane schema for continuous ingestion. It stores lifecycle
 * and lineage metadata only; canonical domain tables are not backfilled here.
 *
 * Rollback: backend/database/rollbacks/20260828_140000_ingestion_pipeline_foundation.sql
 */
return static function (PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS ingestion_runs (
        run_id CHAR(36) NOT NULL PRIMARY KEY,
        source_provider VARCHAR(80) NOT NULL,
        contract_version VARCHAR(80) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED',
        cursor_value VARCHAR(500) NULL,
        checkpoint_json JSON NULL,
        started_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        completed_at DATETIME(6) NULL,
        last_error_class VARCHAR(40) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        KEY idx_ingestion_runs_source_status (source_provider, status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS ingestion_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        run_id CHAR(36) NOT NULL,
        idempotency_key CHAR(64) NOT NULL,
        source_provider VARCHAR(80) NOT NULL,
        source_entity_type VARCHAR(80) NOT NULL,
        source_entity_id VARCHAR(190) NOT NULL,
        source_version VARCHAR(120) NOT NULL,
        content_hash CHAR(64) NOT NULL,
        domain_identity_key CHAR(64) NULL,
        canonical_domain VARCHAR(80) NOT NULL,
        canonical_entity_id VARCHAR(190) NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED',
        action VARCHAR(30) NULL,
        attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
        next_attempt_at DATETIME(6) NULL,
        last_error_class VARCHAR(40) NULL,
        last_error_message VARCHAR(500) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY uq_ingestion_item_idempotency (idempotency_key),
        UNIQUE KEY uq_ingestion_item_source_version (source_provider, source_entity_type, source_entity_id, source_version),
        KEY idx_ingestion_items_domain_identity (domain_identity_key, id),
        KEY idx_ingestion_items_source (source_provider, source_entity_type, source_entity_id, id),
        KEY idx_ingestion_items_status_retry (status, next_attempt_at, id),
        CONSTRAINT fk_ingestion_items_run FOREIGN KEY (run_id) REFERENCES ingestion_runs(run_id) ON DELETE RESTRICT ON UPDATE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS ingestion_provenance (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        item_idempotency_key CHAR(64) NOT NULL,
        run_id CHAR(36) NOT NULL,
        domain VARCHAR(80) NOT NULL,
        canonical_entity_id VARCHAR(190) NOT NULL,
        source_provider VARCHAR(80) NOT NULL,
        source_entity_type VARCHAR(80) NOT NULL,
        source_entity_id VARCHAR(190) NOT NULL,
        source_version VARCHAR(120) NOT NULL,
        source_reference VARCHAR(1000) NULL,
        first_seen_at DATETIME(6) NOT NULL,
        last_seen_at DATETIME(6) NOT NULL,
        UNIQUE KEY uq_ingestion_provenance_item (item_idempotency_key),
        KEY idx_ingestion_provenance_canonical (domain, canonical_entity_id),
        CONSTRAINT fk_ingestion_provenance_run FOREIGN KEY (run_id) REFERENCES ingestion_runs(run_id) ON DELETE RESTRICT ON UPDATE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS ingestion_item_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        run_id CHAR(36) NOT NULL,
        item_idempotency_key CHAR(64) NOT NULL,
        state VARCHAR(30) NOT NULL,
        details_json JSON NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        KEY idx_ingestion_item_events_item (item_idempotency_key, created_at),
        KEY idx_ingestion_item_events_state (state, created_at),
        CONSTRAINT fk_ingestion_item_events_run FOREIGN KEY (run_id) REFERENCES ingestion_runs(run_id) ON DELETE RESTRICT ON UPDATE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS ingestion_leases (
        source_key VARCHAR(190) NOT NULL PRIMARY KEY,
        lease_id VARCHAR(190) NOT NULL,
        expires_at DATETIME(6) NOT NULL,
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        KEY idx_ingestion_leases_expiry (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
