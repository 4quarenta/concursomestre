<?php

declare(strict_types=1);

return static function (PDO $db): void {
    $db->exec(
        "CREATE TABLE IF NOT EXISTS auth_sessions (
            id CHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            csrf_token_hash CHAR(64) NOT NULL,
            user_agent TEXT NULL,
            ip_address VARCHAR(45) NULL,
            issuer_host VARCHAR(255) NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            last_seen_at DATETIME NULL,
            last_refreshed_at DATETIME NULL,
            expires_at DATETIME NOT NULL,
            revoked_at DATETIME NULL,
            revoked_reason VARCHAR(120) NULL,
            reuse_detected_at DATETIME NULL,
            INDEX idx_auth_sessions_user (user_id),
            INDEX idx_auth_sessions_status_expires (status, expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
            id CHAR(36) PRIMARY KEY,
            session_id CHAR(36) NOT NULL,
            token_hash CHAR(64) NOT NULL UNIQUE,
            previous_token_id CHAR(36) NULL,
            rotated_to_token_id CHAR(36) NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL,
            expires_at DATETIME NOT NULL,
            used_at DATETIME NULL,
            rotated_at DATETIME NULL,
            revoked_at DATETIME NULL,
            revoked_reason VARCHAR(120) NULL,
            reuse_detected_at DATETIME NULL,
            ip_address VARCHAR(45) NULL,
            user_agent TEXT NULL,
            INDEX idx_auth_refresh_session (session_id),
            INDEX idx_auth_refresh_status_expires (status, expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            title VARCHAR(255) NULL,
            message TEXT NULL,
            type VARCHAR(20) NOT NULL DEFAULT 'info',
            category VARCHAR(40) NOT NULL DEFAULT 'system',
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            link VARCHAR(255) NULL,
            evidence_url VARCHAR(500) NULL,
            deleted_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_notifications_user_visible (user_id, deleted_at, created_at),
            INDEX idx_notifications_user_unread (user_id, is_read, deleted_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS provider_webhook_events (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            provider VARCHAR(40) NOT NULL,
            event_id VARCHAR(191) NOT NULL,
            event_type VARCHAR(120) NULL,
            object_id VARCHAR(191) NULL,
            payload_hash VARCHAR(128) NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'processing',
            event_created_at DATETIME NULL,
            processed_at DATETIME NULL,
            error_message VARCHAR(1000) NULL,
            attempt_count INT NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_provider_webhook_event (provider, event_id),
            INDEX idx_provider_webhook_status (provider, status, updated_at),
            INDEX idx_provider_webhook_object (provider, object_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS user_study_schedules (
            user_id VARCHAR(36) PRIMARY KEY,
            form_json MEDIUMTEXT NOT NULL,
            plan_json MEDIUMTEXT NULL,
            generated_at DATETIME NULL,
            saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user_study_schedules_saved_at (saved_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
};
