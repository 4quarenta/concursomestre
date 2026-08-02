<?php

declare(strict_types=1);

/**
 * Identidade externa e hierarquia pendente das taxonomias sincronizadas.
 *
 * O importador nunca deve usar o ID da Gran como se fosse o ID local. Estes
 * campos permitem reconciliar os dois espaços de identidade com idempotencia.
 *
 * Rollback: backend/database/rollbacks/20260726_010000_gran_taxonomy_identity.sql
 */
return static function (PDO $db): void {
    $columnExists = static function (string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = \'filters\' AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([':column_name' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $indexExists = static function (string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = \'filters\' AND INDEX_NAME = :index_name'
        );
        $stmt->execute([':index_name' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    };

    foreach ([
        'source_provider' => 'VARCHAR(40) NULL',
        'source_entity_type' => 'VARCHAR(40) NULL',
        'source_external_id' => 'VARCHAR(120) NULL',
        'source_parent_external_id' => 'VARCHAR(120) NULL',
        'source_root_external_id' => 'VARCHAR(120) NULL',
    ] as $column => $definition) {
        if (!$columnExists($column)) {
            $db->exec('ALTER TABLE filters ADD COLUMN `' . $column . '` ' . $definition);
        }
    }

    if (!$indexExists('idx_filters_source_parent')) {
        $db->exec(
            'CREATE INDEX idx_filters_source_parent
             ON filters (type, source_provider, source_entity_type, source_parent_external_id)'
        );
    }
    if (!$indexExists('uq_filters_source_identity')) {
        $duplicates = $db->query(
            "SELECT COUNT(*) FROM (
                SELECT type, source_provider, source_entity_type, source_external_id, COUNT(*) AS total
                FROM filters
                WHERE source_provider IS NOT NULL AND TRIM(source_provider) <> ''
                  AND source_entity_type IS NOT NULL AND TRIM(source_entity_type) <> ''
                  AND source_external_id IS NOT NULL AND TRIM(source_external_id) <> ''
                GROUP BY type, source_provider, source_entity_type, source_external_id
                HAVING COUNT(*) > 1
            ) duplicates"
        );
        if ((int) $duplicates->fetchColumn() > 0) {
            throw new RuntimeException(
                'Nao foi possivel criar a identidade externa das taxonomias: existem duplicidades preexistentes.'
            );
        }
        $db->exec(
            'CREATE UNIQUE INDEX uq_filters_source_identity
             ON filters (type, source_provider, source_entity_type, source_external_id)'
        );
    }
};
