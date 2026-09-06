<?php

declare(strict_types=1);

/**
 * Completa a persistencia necessaria para a autoridade server-side de governanca.
 * A migration e aditiva e tolera o estado parcial da primeira aplicacao do dominio.
 * Rollback: backend/database/rollbacks/20260906_120000_marketing_governance_enforcement.sql
 */
return static function (PDO $db): void {
    $columnExists = static function (PDO $db, string $table, string $column): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    };

    if (!$columnExists($db, 'marketing_campaigns', 'frequency_cap_window')) {
        $db->exec("ALTER TABLE marketing_campaigns
            ADD COLUMN frequency_cap_window VARCHAR(16) NULL DEFAULT 'session'
            AFTER frequency_cap");
    }
};
