<?php

declare(strict_types=1);

/**
 * Persistencia da maquina de estados das operacoes administrativas sensiveis.
 * Nenhum endpoint executa DDL; a migration e aplicada somente pelo runner CLI.
 * Rollback: backend/database/rollbacks/20260916_180000_safe_operations.sql
 */
return static function (PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS safe_operation_runs (
        operation_id CHAR(36) NOT NULL PRIMARY KEY,
        operation_type VARCHAR(80) NOT NULL,
        actor_user_id VARCHAR(64) NOT NULL,
        actor_session_hash CHAR(64) NOT NULL,
        environment VARCHAR(32) NOT NULL,
        risk_class VARCHAR(40) NOT NULL,
        target_scope_json JSON NOT NULL,
        namespace_key VARCHAR(120) NULL,
        dry_run TINYINT(1) NOT NULL DEFAULT 1,
        preview_fingerprint CHAR(64) NOT NULL,
        preview_expires_at DATETIME(6) NOT NULL,
        confirmation_hash CHAR(64) NULL,
        confirmation_expires_at DATETIME(6) NULL,
        idempotency_hash CHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL,
        expected_count INT UNSIGNED NOT NULL DEFAULT 0,
        actual_count INT UNSIGNED NULL,
        recovery_class VARCHAR(32) NOT NULL,
        recovery_status VARCHAR(32) NOT NULL,
        result_json JSON NULL,
        error_code VARCHAR(64) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY uq_safe_operation_idempotency (actor_user_id, idempotency_hash),
        KEY idx_safe_operation_actor_status (actor_user_id, status, created_at),
        KEY idx_safe_operation_namespace (namespace_key, status),
        CONSTRAINT chk_safe_operation_dry_run CHECK (dry_run = 1)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
