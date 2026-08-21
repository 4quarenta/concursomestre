<?php

declare(strict_types=1);

/**
 * Public identity and publication controls for the existing materials domain.
 * Existing rows remain private drafts and no catalog data is backfilled.
 *
 * Rollback: backend/database/rollbacks/20260821_120000_public_materials.sql
 */
return static function (PDO $db): void {
    $columnExists = static function (string $column) use ($db): bool {
        $stmt = $db->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materials' AND COLUMN_NAME = :column");
        $stmt->execute([':column' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $indexExists = static function (string $index) use ($db): bool {
        $stmt = $db->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materials' AND INDEX_NAME = :index");
        $stmt->execute([':index' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $add = static function (string $column, string $definition) use ($db, $columnExists): void {
        if (!$columnExists($column)) $db->exec("ALTER TABLE materials ADD COLUMN `{$column}` {$definition}");
    };

    $add('slug', 'VARCHAR(190) NULL AFTER id');
    $add('publication_status', "ENUM('draft','scheduled','published','archived') NOT NULL DEFAULT 'draft' AFTER status");
    $add('visibility_status', "ENUM('public','unlisted','private','internal') NOT NULL DEFAULT 'private' AFTER publication_status");
    $add('rights_status', "ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending' AFTER visibility_status");
    $add('availability_status', "ENUM('not_for_sale','available','unavailable','included_in_plan') NOT NULL DEFAULT 'not_for_sale' AFTER rights_status");
    $add('currency', 'CHAR(3) NULL AFTER price');
    $add('is_free', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER currency');
    $add('public_author_name', 'VARCHAR(190) NULL AFTER author_id');
    $add('cover_is_public', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER cover_url');
    $add('preview_is_public', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER preview_url');
    $add('scheduled_at', 'DATETIME NULL AFTER created_at');
    $add('published_at', 'DATETIME NULL AFTER scheduled_at');
    $add('archived_at', 'DATETIME NULL AFTER published_at');
    $add('updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER archived_at');

    if (!$indexExists('uq_materials_slug')) $db->exec('CREATE UNIQUE INDEX uq_materials_slug ON materials (slug)');
    if (!$indexExists('idx_materials_public')) {
        $db->exec('CREATE INDEX idx_materials_public ON materials (publication_status, visibility_status, rights_status, archived_at, id)');
    }
    if (!$indexExists('idx_materials_marketplace')) {
        $db->exec('CREATE INDEX idx_materials_marketplace ON materials (publication_status, visibility_status, rights_status, availability_status, id)');
    }
    if (!$indexExists('idx_materials_updated')) $db->exec('CREATE INDEX idx_materials_updated ON materials (updated_at, id)');

    $db->exec("CREATE TABLE IF NOT EXISTS material_aliases (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        material_id VARCHAR(36) NOT NULL,
        alias VARCHAR(190) NOT NULL,
        normalized_alias VARCHAR(190) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_material_alias_lookup (normalized_alias),
        KEY idx_material_alias_material (material_id),
        CONSTRAINT fk_material_alias_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
