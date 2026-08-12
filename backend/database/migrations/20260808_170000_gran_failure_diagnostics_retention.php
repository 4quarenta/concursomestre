<?php

declare(strict_types=1);

/**
 * Keeps the manual Gran diagnostic purge on an indexed, bounded read path.
 *
 * Rollback: backend/database/rollbacks/20260808_170000_gran_failure_diagnostics_retention.sql
 */
return static function (PDO $db): void {
    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM information_schema.STATISTICS '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name'
    );
    $stmt->execute([
        ':table_name' => 'gran_question_publication_failures',
        ':index_name' => 'idx_gran_failure_retention',
    ]);
    if ((int) $stmt->fetchColumn() === 0) {
        $db->exec(
            'ALTER TABLE gran_question_publication_failures '
            . 'ADD KEY idx_gran_failure_retention (status, resolved_at, id)'
        );
    }
};
