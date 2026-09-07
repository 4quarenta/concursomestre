<?php

declare(strict_types=1);

/**
 * Estruturas normalizadas do eixo Benefit. Assinaturas, planos, Stripe,
 * cupons financeiros e ledger continuam nas tabelas canonicas existentes.
 *
 * Rollback: backend/database/rollbacks/20260906_130000_billing_entitlements_benefits.sql
 */
return static function (PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS benefit_definitions (
        id CHAR(36) NOT NULL PRIMARY KEY,
        definition_key VARCHAR(120) NOT NULL,
        name VARCHAR(180) NOT NULL,
        benefit_mode VARCHAR(40) NOT NULL,
        access_plan VARCHAR(32) NULL,
        access_duration_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        billing_extension_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        stacking_policy VARCHAR(32) NOT NULL DEFAULT 'DENY',
        eligibility_json JSON NULL,
        starts_at DATETIME(6) NULL,
        expires_at DATETIME(6) NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        source_scope VARCHAR(40) NOT NULL DEFAULT 'ANY',
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64) NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY uq_benefit_definition_key (definition_key),
        KEY idx_benefit_definitions_active_window (active, starts_at, expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS benefit_grants (
        id CHAR(36) NOT NULL PRIMARY KEY,
        benefit_definition_id CHAR(36) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        source_type VARCHAR(40) NOT NULL,
        source_reference VARCHAR(160) NULL,
        idempotency_key CHAR(64) NOT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'PENDING_PROVIDER',
        access_plan VARCHAR(32) NULL,
        billing_extension_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        grant_starts_at DATETIME(6) NOT NULL,
        grant_expires_at DATETIME(6) NULL,
        provider_status VARCHAR(40) NULL,
        provider_reference VARCHAR(180) NULL,
        provider_old_period_end DATETIME(6) NULL,
        provider_new_period_end DATETIME(6) NULL,
        granted_by VARCHAR(64) NOT NULL,
        reason VARCHAR(500) NULL,
        metadata_json JSON NULL,
        applied_at DATETIME(6) NULL,
        revoked_at DATETIME(6) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY uq_benefit_grant_idempotency (idempotency_key),
        KEY idx_benefit_grants_user_status (user_id, status, grant_starts_at, grant_expires_at),
        KEY idx_benefit_grants_definition (benefit_definition_id),
        KEY idx_benefit_grants_provider (provider_status, provider_reference)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS benefit_codes (
        id CHAR(36) NOT NULL PRIMARY KEY,
        benefit_definition_id CHAR(36) NOT NULL,
        code_hash CHAR(64) NOT NULL,
        code_hint VARCHAR(12) NOT NULL,
        code_scope VARCHAR(32) NOT NULL DEFAULT 'PUBLIC',
        assigned_user_id VARCHAR(64) NULL,
        segment_id CHAR(36) NULL,
        campaign_id CHAR(36) NULL,
        starts_at DATETIME(6) NULL,
        expires_at DATETIME(6) NULL,
        max_total_redemptions INT UNSIGNED NULL,
        max_redemptions_per_user INT UNSIGNED NULL,
        stacking_policy VARCHAR(32) NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64) NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY uq_benefit_code_hash (code_hash),
        KEY idx_benefit_codes_status_window (status, starts_at, expires_at),
        KEY idx_benefit_codes_assigned_user (assigned_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS benefit_code_redemptions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        benefit_code_id CHAR(36) NOT NULL,
        benefit_grant_id CHAR(36) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        idempotency_key CHAR(64) NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE KEY uq_benefit_redemption_idempotency (idempotency_key),
        KEY idx_benefit_redemptions_code_user (benefit_code_id, user_id),
        KEY idx_benefit_redemptions_user (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS benefit_audit_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        benefit_grant_id CHAR(36) NULL,
        benefit_code_id CHAR(36) NULL,
        actor_user_id VARCHAR(64) NULL,
        action VARCHAR(64) NOT NULL,
        details_json JSON NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        KEY idx_benefit_audit_grant (benefit_grant_id, created_at),
        KEY idx_benefit_audit_code (benefit_code_id, created_at),
        KEY idx_benefit_audit_actor (actor_user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
