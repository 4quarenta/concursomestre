<?php

declare(strict_types=1);

return static function (PDO $db): void {
    $columnExists = static function (string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name
               AND COLUMN_NAME = :column_name LIMIT 1'
        );
        $stmt->execute([':table_name' => 'blog_articles', ':column_name' => $column]);
        return (bool) $stmt->fetchColumn();
    };

    if (!$columnExists('sources_json')) {
        $db->exec('ALTER TABLE blog_articles ADD COLUMN sources_json JSON NULL AFTER source_url');
    }
    if (!$columnExists('view_count')) {
        $db->exec('ALTER TABLE blog_articles ADD COLUMN view_count BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER sources_json');
    }
};
