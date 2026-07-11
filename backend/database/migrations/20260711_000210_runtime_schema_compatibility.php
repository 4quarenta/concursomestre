<?php

declare(strict_types=1);

return static function (PDO $db): void {
    $columns = [
        'auth_sessions' => [
            'status' => "VARCHAR(20) NOT NULL DEFAULT 'active'",
            'csrf_token_hash' => 'CHAR(64) NOT NULL',
            'user_agent' => 'TEXT NULL',
            'ip_address' => 'VARCHAR(45) NULL',
            'issuer_host' => 'VARCHAR(255) NULL',
            'created_at' => 'DATETIME NOT NULL',
            'updated_at' => 'DATETIME NOT NULL',
            'last_seen_at' => 'DATETIME NULL',
            'last_refreshed_at' => 'DATETIME NULL',
            'expires_at' => 'DATETIME NOT NULL',
            'revoked_at' => 'DATETIME NULL',
            'revoked_reason' => 'VARCHAR(120) NULL',
            'reuse_detected_at' => 'DATETIME NULL',
        ],
        'auth_refresh_tokens' => [
            'previous_token_id' => 'CHAR(36) NULL',
            'rotated_to_token_id' => 'CHAR(36) NULL',
            'status' => "VARCHAR(20) NOT NULL DEFAULT 'active'",
            'created_at' => 'DATETIME NOT NULL',
            'expires_at' => 'DATETIME NOT NULL',
            'used_at' => 'DATETIME NULL',
            'rotated_at' => 'DATETIME NULL',
            'revoked_at' => 'DATETIME NULL',
            'revoked_reason' => 'VARCHAR(120) NULL',
            'reuse_detected_at' => 'DATETIME NULL',
            'ip_address' => 'VARCHAR(45) NULL',
            'user_agent' => 'TEXT NULL',
        ],
        'notifications' => [
            'category' => "VARCHAR(40) NOT NULL DEFAULT 'system'",
            'is_read' => 'TINYINT(1) NOT NULL DEFAULT 0',
            'link' => 'VARCHAR(255) NULL',
            'evidence_url' => 'VARCHAR(500) NULL',
            'deleted_at' => 'DATETIME NULL',
            'created_at' => 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
        ],
        'provider_webhook_events' => [
            'event_type' => 'VARCHAR(120) NULL',
            'object_id' => 'VARCHAR(191) NULL',
            'payload_hash' => 'VARCHAR(128) NULL',
            'status' => "VARCHAR(30) NOT NULL DEFAULT 'processing'",
            'event_created_at' => 'DATETIME NULL',
            'processed_at' => 'DATETIME NULL',
            'error_message' => 'VARCHAR(1000) NULL',
            'attempt_count' => 'INT NOT NULL DEFAULT 1',
            'created_at' => 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            'updated_at' => 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
        ],
        'user_study_schedules' => [
            'form_json' => 'MEDIUMTEXT NOT NULL',
            'plan_json' => 'MEDIUMTEXT NULL',
            'generated_at' => 'DATETIME NULL',
            'saved_at' => 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'created_at' => 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            'updated_at' => 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
        ],
    ];
    $indexes = [
        ['auth_sessions', 'idx_auth_sessions_user', 'user_id'],
        ['auth_sessions', 'idx_auth_sessions_status_expires', 'status, expires_at'],
        ['auth_refresh_tokens', 'idx_auth_refresh_session', 'session_id'],
        ['auth_refresh_tokens', 'idx_auth_refresh_status_expires', 'status, expires_at'],
        ['notifications', 'idx_notifications_user_visible', 'user_id, deleted_at, created_at'],
        ['notifications', 'idx_notifications_user_unread', 'user_id, is_read, deleted_at'],
        ['provider_webhook_events', 'idx_provider_webhook_status', 'provider, status, updated_at'],
        ['provider_webhook_events', 'idx_provider_webhook_object', 'provider, object_id'],
        ['user_study_schedules', 'idx_user_study_schedules_saved_at', 'saved_at'],
    ];

    $quote = static function (string $identifier): string {
        if (preg_match('/^[a-z0-9_]+$/i', $identifier) !== 1) {
            throw new InvalidArgumentException('Identificador de schema invalido.');
        }
        return chr(96) . $identifier . chr(96);
    };
    $tableExists = static function (string $table) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name'
        );
        $stmt->execute([':table_name' => $table]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $columnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $indexExists = static function (string $table, string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name'
        );
        $stmt->execute([':table_name' => $table, ':index_name' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    };

    foreach ($columns as $table => $tableColumns) {
        if (!$tableExists($table)) {
            continue;
        }
        foreach ($tableColumns as $column => $definition) {
            if (!$columnExists($table, $column)) {
                $db->exec('ALTER TABLE ' . $quote($table) . ' ADD COLUMN ' . $quote($column) . ' ' . $definition);
            }
        }
    }

    foreach ($indexes as [$table, $index, $columnsExpression]) {
        if ($tableExists($table) && !$indexExists($table, $index)) {
            $db->exec('CREATE INDEX ' . $quote($index) . ' ON ' . $quote($table) . ' (' . $columnsExpression . ')');
        }
    }
};
