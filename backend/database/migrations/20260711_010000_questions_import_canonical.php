<?php

declare(strict_types=1);

/**
 * Foundation for the canonical question-import.v2 aggregate.
 *
 * This migration is additive. The legacy questions.data_json column remains a
 * compatibility snapshot while normalized rows become the authoritative source
 * for new and updated question aggregates.
 */
return static function (PDO $db): void {
    $db->exec(
        "CREATE TABLE IF NOT EXISTS question_options (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            question_id INT NOT NULL,
            external_key VARCHAR(120) NULL,
            display_order INT NOT NULL,
            label VARCHAR(20) NOT NULL,
            body MEDIUMTEXT NOT NULL,
            body_clean MEDIUMTEXT NULL,
            is_correct TINYINT(1) NOT NULL DEFAULT 0,
            metadata_json JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_question_options_order (question_id, display_order),
            UNIQUE KEY uq_question_options_external_key (question_id, external_key),
            INDEX idx_question_options_question (question_id),
            INDEX idx_question_options_correct (question_id, is_correct)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS question_contexts (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            external_key VARCHAR(120) NULL,
            context_type VARCHAR(30) NOT NULL DEFAULT 'shared',
            body MEDIUMTEXT NOT NULL,
            body_clean MEDIUMTEXT NULL,
            reference_text MEDIUMTEXT NULL,
            source_page INT NULL,
            metadata_json JSON NULL,
            created_by_user_id VARCHAR(64) NULL,
            updated_by_user_id VARCHAR(64) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_question_contexts_external_key (external_key),
            INDEX idx_question_contexts_type_page (context_type, source_page)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS question_context_questions (
            context_id BIGINT UNSIGNED NOT NULL,
            question_id INT NOT NULL,
            relation_role VARCHAR(30) NOT NULL DEFAULT 'shared',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (context_id, question_id),
            INDEX idx_question_context_questions_question (question_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS question_assets (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            question_id INT NULL,
            context_id BIGINT UNSIGNED NULL,
            option_id BIGINT UNSIGNED NULL,
            external_key VARCHAR(120) NULL,
            asset_type VARCHAR(30) NOT NULL DEFAULT 'image',
            usage_type VARCHAR(40) NOT NULL,
            storage_path VARCHAR(500) NULL,
            public_url VARCHAR(1000) NULL,
            alt_text VARCHAR(1000) NULL,
            caption TEXT NULL,
            source_page INT NULL,
            display_order INT NOT NULL DEFAULT 0,
            metadata_json JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_question_assets_question (question_id, usage_type, display_order),
            INDEX idx_question_assets_context (context_id, usage_type, display_order),
            INDEX idx_question_assets_option (option_id, usage_type, display_order),
            INDEX idx_question_assets_external_key (external_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS question_editorials (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            question_id INT NOT NULL,
            editorial_type VARCHAR(40) NOT NULL,
            title VARCHAR(255) NULL,
            body MEDIUMTEXT NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'draft',
            generated_by VARCHAR(30) NULL,
            metadata_json JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_question_editorials_type (question_id, editorial_type),
            INDEX idx_question_editorials_question (question_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS prova_extracao_itens (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            extracao_id BIGINT UNSIGNED NULL,
            prova_id INT NULL,
            question_id INT NULL,
            external_key VARCHAR(120) NULL,
            item_type VARCHAR(40) NOT NULL,
            item_number INT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            payload_json JSON NULL,
            diagnostics_json JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_prova_extracao_itens_extracao (extracao_id, item_type),
            INDEX idx_prova_extracao_itens_prova (prova_id, item_number),
            INDEX idx_prova_extracao_itens_question (question_id),
            INDEX idx_prova_extracao_itens_external_key (external_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS private_ingestion_nonces (
            nonce_hash CHAR(64) PRIMARY KEY,
            request_timestamp BIGINT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_private_ingestion_nonces_expires (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS private_ingestion_requests (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            client_key VARCHAR(80) NOT NULL,
            idempotency_key VARCHAR(120) NOT NULL,
            payload_hash CHAR(64) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            job_id BIGINT UNSIGNED NULL,
            response_json JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_private_ingestion_idempotency (client_key, idempotency_key),
            INDEX idx_private_ingestion_requests_status (status, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS private_ingestion_jobs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            request_id BIGINT UNSIGNED NOT NULL,
            actor_user_id VARCHAR(64) NULL,
            payload_json MEDIUMTEXT NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            result_json JSON NULL,
            error_message TEXT NULL,
            attempts INT NOT NULL DEFAULT 0,
            locked_at DATETIME NULL,
            completed_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_private_ingestion_jobs_status (status, created_at),
            INDEX idx_private_ingestion_jobs_request (request_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
};
