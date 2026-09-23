<?php

declare(strict_types=1);

/**
 * Foundation persisted for the approved post-go account policies.
 * No user data is changed by this migration.
 */
return static function (PDO $db): void {
    $tableExists = static function (string $table) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT 1 FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name LIMIT 1'
        );
        $stmt->execute([':table_name' => $table]);
        return (bool) $stmt->fetchColumn();
    };
    $columnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name
               AND COLUMN_NAME = :column_name LIMIT 1'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (bool) $stmt->fetchColumn();
    };

    if ($tableExists('email_verifications')) {
        if (!$columnExists('email_verifications', 'delivery_status')) {
            $db->exec("ALTER TABLE email_verifications ADD COLUMN delivery_status VARCHAR(24) NULL AFTER used");
        }
        if (!$columnExists('email_verifications', 'delivery_attempted_at')) {
            $db->exec("ALTER TABLE email_verifications ADD COLUMN delivery_attempted_at DATETIME NULL AFTER delivery_status");
        }
        if (!$columnExists('email_verifications', 'last_delivery_error')) {
            $db->exec("ALTER TABLE email_verifications ADD COLUMN last_delivery_error VARCHAR(500) NULL AFTER delivery_attempted_at");
        }
        $db->exec("UPDATE email_verifications SET delivery_status = 'legacy_unverified' WHERE delivery_status IS NULL");
    }

    $db->exec(
        "CREATE TABLE IF NOT EXISTS account_access_restrictions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
            kind VARCHAR(48) NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'grace',
            first_failure_at DATETIME NOT NULL,
            grace_expires_at DATETIME NOT NULL,
            blocked_at DATETIME NULL,
            source_subscription_id BIGINT UNSIGNED NULL,
            source_invoice_id VARCHAR(255) NULL,
            resolved_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_account_access_restriction (user_id, kind),
            KEY idx_account_access_restriction_expiry (status, grace_expires_at),
            KEY idx_account_access_restriction_user_status (user_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS account_access_restriction_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            restriction_id BIGINT UNSIGNED NOT NULL,
            user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
            event_name VARCHAR(96) NOT NULL,
            metadata_json JSON NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY idx_account_access_event_restriction (restriction_id, id),
            KEY idx_account_access_event_user (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS unverified_account_cleanup_runs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            run_id CHAR(36) NOT NULL,
            mode VARCHAR(16) NOT NULL,
            status VARCHAR(24) NOT NULL,
            candidate_count INT UNSIGNED NOT NULL DEFAULT 0,
            eligible_count INT UNSIGNED NOT NULL DEFAULT 0,
            protected_count INT UNSIGNED NOT NULL DEFAULT 0,
            deleted_count INT UNSIGNED NOT NULL DEFAULT 0,
            reason_summary_json JSON NULL,
            created_at DATETIME NOT NULL,
            completed_at DATETIME NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_unverified_cleanup_run (run_id),
            KEY idx_unverified_cleanup_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS unverified_account_cleanup_reviews (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
            eligibility_age_days INT UNSIGNED NOT NULL,
            protected_reasons_json JSON NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'pending',
            reviewer_id VARCHAR(36) NULL,
            created_at DATETIME NOT NULL,
            reviewed_at DATETIME NULL,
            PRIMARY KEY (id),
            KEY idx_unverified_cleanup_review_user (user_id, status),
            KEY idx_unverified_cleanup_review_status (status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
};
