<?php

declare(strict_types=1);

/**
 * Persiste o ano filtrado que originou um lote do crawler Gran.
 *
 * Rollback: backend/database/rollbacks/20260804_020000_gran_batch_collection_year.sql
 */
return static function (PDO $db): void {
    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
    );
    $stmt->execute([
        ':table_name' => 'private_ingestion_batches',
        ':column_name' => 'collection_years_json',
    ]);
    if ((int) $stmt->fetchColumn() === 0) {
        $db->exec(
            'ALTER TABLE private_ingestion_batches '
            . 'ADD COLUMN collection_years_json VARCHAR(128) NULL AFTER collection_pages_json'
        );
    }
};
