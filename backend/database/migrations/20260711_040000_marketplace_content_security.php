<?php

declare(strict_types=1);

/**
 * Marketplace content security foundation.
 *
 * The migration is additive and idempotent. It removes recoverable PDF
 * passwords from material metadata, introduces upload ownership records, and
 * records moderation as append-only events.
 */
return static function (PDO $db): void {
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
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table_name
               AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([
            ':table_name' => $table,
            ':column_name' => $column,
        ]);

        return (int) $stmt->fetchColumn() > 0;
    };

    $indexExists = static function (string $table, string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table_name
               AND INDEX_NAME = :index_name'
        );
        $stmt->execute([
            ':table_name' => $table,
            ':index_name' => $index,
        ]);

        return (int) $stmt->fetchColumn() > 0;
    };

    $ensureColumn = static function (string $table, string $column, string $definition) use ($db, $tableExists, $columnExists): void {
        if ($tableExists($table) && !$columnExists($table, $column)) {
            $db->exec("ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$definition}");
        }
    };

    $ensureIndex = static function (string $table, string $index, string $columns) use ($db, $tableExists, $indexExists): void {
        if ($tableExists($table) && !$indexExists($table, $index)) {
            $db->exec("CREATE INDEX `{$index}` ON `{$table}` ({$columns})");
        }
    };

    if ($tableExists('materials')) {
        foreach ([
            'updated_by_user_id' => 'VARCHAR(64) NULL',
            'moderated_by_user_id' => 'VARCHAR(64) NULL',
            'moderated_at' => 'DATETIME NULL',
            'moderation_reason' => 'TEXT NULL',
        ] as $column => $definition) {
            $ensureColumn('materials', $column, $definition);
        }

        $ensureIndex('materials', 'idx_materials_author_status', 'author_id, status');
        $ensureIndex('materials', 'idx_materials_moderated_at', 'moderated_at');

        // Passwords were historically kept inside files_json. They are not
        // required by the protected access flow and must not remain recoverable.
        $db->exec(
            "UPDATE materials
             SET files_json = CASE
                 WHEN files_json IS NULL THEN NULL
                 ELSE JSON_REMOVE(files_json, '$.pdfPassword', '$.password')
             END
             WHERE JSON_EXTRACT(files_json, '$.pdfPassword') IS NOT NULL
                OR JSON_EXTRACT(files_json, '$.password') IS NOT NULL"
        );
    }

    $db->exec(
        "CREATE TABLE IF NOT EXISTS material_ratings (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            material_id VARCHAR(64) NOT NULL,
            rating DECIMAL(3,1) NOT NULL,
            created_at DATETIME NOT NULL,
            UNIQUE KEY uniq_material_ratings_user_material (user_id, material_id),
            INDEX idx_material_ratings_material (material_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS material_uploads (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            storage_key VARCHAR(191) NOT NULL,
            uploaded_by_user_id VARCHAR(64) NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            size_bytes BIGINT UNSIGNED NOT NULL,
            checksum_sha256 CHAR(64) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            attached_material_id VARCHAR(64) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            attached_at DATETIME NULL,
            UNIQUE KEY uq_material_upload_storage_key (storage_key),
            INDEX idx_material_uploads_owner_status (uploaded_by_user_id, status),
            INDEX idx_material_uploads_material (attached_material_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS material_moderation_events (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            material_id VARCHAR(64) NOT NULL,
            actor_user_id VARCHAR(64) NOT NULL,
            action VARCHAR(40) NOT NULL,
            previous_status VARCHAR(20) NULL,
            next_status VARCHAR(20) NOT NULL,
            reason TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_material_moderation_events_material (material_id, created_at),
            INDEX idx_material_moderation_events_actor (actor_user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
};
