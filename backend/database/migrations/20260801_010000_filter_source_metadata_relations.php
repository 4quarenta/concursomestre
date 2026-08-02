<?php

declare(strict_types=1);

/**
 * Preserva metadados de catalogos externos e suas relacoes multiplas.
 *
 * Rollback: backend/database/rollbacks/20260801_010000_filter_source_metadata_relations.sql
 */
return static function (PDO $db): void {
    $columnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    };

    if (!$columnExists('filter_source_identities', 'source_metadata_json')) {
        $db->exec('ALTER TABLE filter_source_identities ADD COLUMN source_metadata_json JSON NULL AFTER source_root_external_id');
    }

    $db->exec(
        "CREATE TABLE IF NOT EXISTS filter_relationships (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            source_filter_id INT NOT NULL,
            target_filter_id INT NOT NULL,
            relation_type VARCHAR(60) NOT NULL,
            source_provider VARCHAR(40) NOT NULL DEFAULT 'platform',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_filter_relationship (
                source_filter_id, target_filter_id, relation_type, source_provider
            ),
            KEY idx_filter_relationship_target (target_filter_id, relation_type, source_filter_id),
            KEY idx_filter_relationship_source (source_filter_id, relation_type, target_filter_id),
            CONSTRAINT fk_filter_relationship_source
                FOREIGN KEY (source_filter_id) REFERENCES filters(id) ON DELETE CASCADE,
            CONSTRAINT fk_filter_relationship_target
                FOREIGN KEY (target_filter_id) REFERENCES filters(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
};
