<?php

declare(strict_types=1);

/**
 * Permite que varias identidades externas equivalentes apontem para a mesma
 * taxonomia canonica. Alguns provedores mantem IDs historicos distintos para
 * o mesmo no da arvore; duplicar o filtro local quebraria a classificacao.
 *
 * Rollback: backend/database/rollbacks/20260731_010000_filter_source_identities.sql
 */
return static function (PDO $db): void {
    $db->exec(
        "CREATE TABLE IF NOT EXISTS filter_source_identities (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            filter_id INT NOT NULL,
            filter_type VARCHAR(40) NOT NULL,
            source_provider VARCHAR(40) NOT NULL,
            source_entity_type VARCHAR(40) NOT NULL,
            source_external_id VARCHAR(120) NOT NULL,
            source_parent_external_id VARCHAR(120) NULL,
            source_root_external_id VARCHAR(120) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_filter_source_identity (
                filter_type, source_provider, source_entity_type, source_external_id
            ),
            KEY idx_filter_source_filter (filter_id),
            KEY idx_filter_source_parent (
                filter_type, source_provider, source_entity_type, source_parent_external_id
            ),
            CONSTRAINT fk_filter_source_identity_filter
                FOREIGN KEY (filter_id) REFERENCES filters(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "INSERT INTO filter_source_identities (
            filter_id, filter_type, source_provider, source_entity_type,
            source_external_id, source_parent_external_id, source_root_external_id
         )
         SELECT id, type, source_provider, source_entity_type,
                source_external_id, source_parent_external_id, source_root_external_id
         FROM filters
         WHERE source_provider IS NOT NULL AND TRIM(source_provider) <> ''
           AND source_entity_type IS NOT NULL AND TRIM(source_entity_type) <> ''
           AND source_external_id IS NOT NULL AND TRIM(source_external_id) <> ''
         ON DUPLICATE KEY UPDATE
            filter_id = VALUES(filter_id),
            source_parent_external_id = VALUES(source_parent_external_id),
            source_root_external_id = VALUES(source_root_external_id),
            updated_at = CURRENT_TIMESTAMP"
    );
};
