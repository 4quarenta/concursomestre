<?php

declare(strict_types=1);

/**
 * Additive notification taxonomy. Legacy type/category remain supported.
 */
return static function (PDO $db): void {
    $columnExists = static function (string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "notifications" AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([':column_name' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    };

    foreach ([
        'event_key' => 'VARCHAR(120) NULL',
        'severity' => 'VARCHAR(16) NULL',
        'channel' => 'VARCHAR(24) NULL',
        'entity_type' => 'VARCHAR(64) NULL',
        'entity_id' => 'VARCHAR(64) NULL',
        'action_key' => 'VARCHAR(120) NULL',
    ] as $column => $definition) {
        if (!$columnExists($column)) {
            $db->exec("ALTER TABLE notifications ADD COLUMN `{$column}` {$definition}");
        }
    }

    $indexExists = static function (string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "notifications" AND INDEX_NAME = :index_name'
        );
        $stmt->execute([':index_name' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    };

    if (!$indexExists('idx_notifications_event_key')) {
        $db->exec('CREATE INDEX idx_notifications_event_key ON notifications (event_key, created_at)');
    }
    if (!$indexExists('idx_notifications_entity')) {
        $db->exec('CREATE INDEX idx_notifications_entity ON notifications (entity_type, entity_id, created_at)');
    }
};
