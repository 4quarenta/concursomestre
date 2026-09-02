<?php

declare(strict_types=1);

/**
 * Historico append-only de aceites legais versionados.
 * Sem backfill: registros antigos nao sao reclassificados retroativamente.
 * Rollback: backend/database/rollbacks/20260902_120000_legal_document_acceptances.sql
 */
return static function (PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS legal_document_acceptances (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id VARCHAR(80) NOT NULL,
        document_type ENUM('terms_of_use', 'privacy_policy', 'checkout_adhesion_terms') NOT NULL,
        document_version VARCHAR(32) NOT NULL,
        accepted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        source_flow VARCHAR(80) NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY uq_legal_acceptance_revision (user_id, document_type, document_version),
        KEY idx_legal_acceptance_user (user_id, accepted_at),
        KEY idx_legal_acceptance_document (document_type, document_version, accepted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
