<?php

declare(strict_types=1);

/**
 * Adds an O(1) database-native sitemap dataset revision authority.
 * Existing releases ignore this additive infrastructure.
 *
 * Rollback: backend/database/rollbacks/20260828_120000_sitemap_dataset_revision.sql
 */
return static function (PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS seo_dataset_revisions (
        id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
        revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT chk_seo_dataset_revision_singleton CHECK (id = 1)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec('INSERT IGNORE INTO seo_dataset_revisions (id, revision) VALUES (1, 0)');

    $tables = [
        'blog_articles',
        'contest_organizations',
        'contests',
        'filters',
        'law_articles',
        'laws',
        'material_uploads',
        'materials',
        'provas',
        'public_simulation_questions',
        'public_simulations',
        'questions',
    ];
    $tableExists = static function (string $table) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name'
        );
        $stmt->execute([':table_name' => $table]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $triggerExists = static function (string $trigger) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TRIGGERS '
            . 'WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = :trigger_name'
        );
        $stmt->execute([':trigger_name' => $trigger]);
        return (int) $stmt->fetchColumn() > 0;
    };

    foreach ($tables as $table) {
        if (!$tableExists($table)) {
            continue;
        }
        foreach (['ai' => 'INSERT', 'au' => 'UPDATE', 'ad' => 'DELETE'] as $suffix => $event) {
            $trigger = 'trg_sitemap_revision_' . $table . '_' . $suffix;
            if ($triggerExists($trigger)) {
                continue;
            }
            $db->exec(
                "CREATE TRIGGER `{$trigger}` AFTER {$event} ON `{$table}` FOR EACH ROW "
                . 'UPDATE seo_dataset_revisions '
                . 'SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP(6) WHERE id = 1'
            );
        }
    }
};
