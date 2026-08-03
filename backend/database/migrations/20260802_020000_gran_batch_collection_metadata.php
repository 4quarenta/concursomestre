<?php

declare(strict_types=1);

/**
 * Preserva as paginas da consulta Gran que originaram cada lote de publicacao.
 *
 * Rollback: backend/database/rollbacks/20260802_020000_gran_batch_collection_metadata.sql
 */
return static function (PDO $db): void {
    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
    );
    $stmt->execute([
        ':table_name' => 'private_ingestion_batches',
        ':column_name' => 'collection_pages_json',
    ]);
    if ((int) $stmt->fetchColumn() === 0) {
        $db->exec(
            'ALTER TABLE private_ingestion_batches '
            . 'ADD COLUMN collection_pages_json LONGTEXT NULL AFTER question_statuses_json'
        );
    }
};
