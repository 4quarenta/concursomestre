<?php

declare(strict_types=1);

/**
 * Enforces the global canonical namespace used by /provas/{slug}.
 *
 * The collision check intentionally aborts without changing rows. Existing
 * duplicate data must be resolved by an explicit editorial/data operation.
 * Rollback: backend/database/rollbacks/20260829_120000_provas_slug_uniqueness.sql
 */
return static function (PDO $db): void {
    $tableExists = $db->prepare("SELECT COUNT(*) FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'provas'");
    $tableExists->execute();
    if ((int) $tableExists->fetchColumn() === 0) {
        throw new RuntimeException('Tabela provas ausente; migration nao pode validar o namespace canonico.');
    }

    $duplicates = $db->query("SELECT slug, COUNT(*) AS duplicate_count
        FROM provas
        WHERE slug IS NOT NULL
        GROUP BY slug
        HAVING COUNT(*) > 1
        LIMIT 1")->fetch(PDO::FETCH_ASSOC);
    if (is_array($duplicates)) {
        throw new RuntimeException('Migration abortada: existem slugs duplicados em provas. Nenhuma linha foi alterada.');
    }

    $index = $db->prepare("SELECT INDEX_NAME, NON_UNIQUE
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'provas'
          AND COLUMN_NAME = 'slug'
        ORDER BY SEQ_IN_INDEX");
    $index->execute();
    $slugIndexes = $index->fetchAll(PDO::FETCH_ASSOC) ?: [];
    foreach ($slugIndexes as $slugIndex) {
        if ((int) ($slugIndex['NON_UNIQUE'] ?? 1) === 0) {
            return;
        }
        if ((string) ($slugIndex['INDEX_NAME'] ?? '') === 'uq_provas_slug') {
            throw new RuntimeException('Indice uq_provas_slug existe mas nao e UNIQUE; correcao manual necessaria.');
        }
    }

    $db->exec('CREATE UNIQUE INDEX uq_provas_slug ON provas (slug)');
};
