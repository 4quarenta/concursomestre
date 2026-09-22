<?php

declare(strict_types=1);

/**
 * Adds an explicit audience channel to editorial novidades.
 * Existing rows remain visible on both surfaces for compatibility.
 */
return static function (PDO $db): void {
    $columnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT 1 FROM information_schema.COLUMNS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name '
            . 'AND COLUMN_NAME = :column_name LIMIT 1'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (bool) $stmt->fetchColumn();
    };

    if (!$columnExists('changelogs', 'channel')) {
        $db->exec("ALTER TABLE changelogs ADD COLUMN channel VARCHAR(8) NOT NULL DEFAULT 'BOTH' AFTER status");
    }

    // The column is introduced as NOT NULL with a BOTH default, so existing
    // rows remain visible on both surfaces without requiring DML privileges.
    $indexExists = $db->query(
        "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() "
        . "AND TABLE_NAME = 'changelogs' AND INDEX_NAME = 'idx_changelogs_channel_publication' LIMIT 1"
    )->fetchColumn();
    if (!$indexExists) {
        $db->exec('CREATE INDEX idx_changelogs_channel_publication ON changelogs (channel, status, published_at, id)');
    }
};
