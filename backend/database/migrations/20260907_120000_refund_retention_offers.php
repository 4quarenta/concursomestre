<?php

declare(strict_types=1);

/**
 * Persistencia da oferta de retencao ligada a uma solicitacao de reembolso.
 * A aplicacao do beneficio continua sob BenefitService/BillingExtensionService.
 *
 * Rollback: backend/database/rollbacks/20260907_120000_refund_retention_offers.sql
 */
return static function (PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS refund_retention_offers (
        id CHAR(36) NOT NULL PRIMARY KEY,
        transaction_id BIGINT UNSIGNED NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        status VARCHAR(48) NOT NULL DEFAULT 'PENDING',
        refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        paid_plan VARCHAR(64) NOT NULL,
        current_renewal_at DATETIME(6) NULL,
        offered_days SMALLINT UNSIGNED NOT NULL,
        expected_renewal_at DATETIME(6) NULL,
        expires_at DATETIME(6) NOT NULL,
        user_note VARCHAR(1000) NULL,
        internal_note VARCHAR(500) NULL,
        benefit_definition_id CHAR(36) NULL,
        benefit_grant_id CHAR(36) NULL,
        idempotency_key CHAR(64) NOT NULL,
        created_by VARCHAR(64) NOT NULL,
        user_decision_at DATETIME(6) NULL,
        provider_confirmed_at DATETIME(6) NULL,
        provider_reference VARCHAR(180) NULL,
        failure_reason VARCHAR(500) NULL,
        expired_at DATETIME(6) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY uq_refund_retention_transaction (transaction_id),
        UNIQUE KEY uq_refund_retention_idempotency (idempotency_key),
        KEY idx_refund_retention_user_status (user_id, status, expires_at),
        KEY idx_refund_retention_expiration (status, expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS benefit_domain_events (
        event_id CHAR(64) NOT NULL PRIMARY KEY,
        event_type VARCHAR(96) NOT NULL,
        user_id VARCHAR(64) NULL,
        benefit_grant_id CHAR(36) NULL,
        source_type VARCHAR(96) NOT NULL,
        source_reference VARCHAR(180) NULL,
        payload_json JSON NOT NULL,
        occurred_at DATETIME(6) NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        KEY idx_benefit_domain_events_user (user_id, occurred_at),
        KEY idx_benefit_domain_events_type (event_type, occurred_at),
        KEY idx_benefit_domain_events_grant (benefit_grant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
