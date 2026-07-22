<?php

declare(strict_types=1);

/**
 * Formaliza nome, sigla e logo como atributos de uma unica taxonomia.
 * Tambem consolida duplicatas comprovadas da PM-PB e do CBM-PB depois de
 * transferir seus relacionamentos para o registro canonico.
 */
return static function (PDO $db): void {
    $tableExists = static function (string $table) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name'
        );
        $stmt->execute([':table_name' => $table]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $columnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table_name
               AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $indexExists = static function (string $table, string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table_name
               AND INDEX_NAME = :index_name'
        );
        $stmt->execute([':table_name' => $table, ':index_name' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $normalizeAlias = static function (string $value): string {
        $value = trim(mb_strtolower($value, 'UTF-8'));
        $transliterated = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        $value = $transliterated !== false ? $transliterated : $value;
        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', $value));
    };

    if (!$tableExists('filters')) {
        return;
    }
    if (!$columnExists('filters', 'acronym')) {
        $db->exec('ALTER TABLE filters ADD COLUMN acronym VARCHAR(40) NULL AFTER slug');
    }

    $findBySlug = static function (string $type, string $slug) use ($db): ?array {
        $stmt = $db->prepare(
            'SELECT id, name, slug, acronym FROM filters
             WHERE type = :type AND slug = :slug LIMIT 1'
        );
        $stmt->execute([':type' => $type, ':slug' => $slug]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    };
    $addAlias = static function (int $filterId, string $alias) use ($db, $tableExists, $normalizeAlias): void {
        if (!$tableExists('filter_aliases')) {
            return;
        }
        $alias = trim($alias);
        $normalized = $normalizeAlias($alias);
        if ($alias === '' || $normalized === '') {
            return;
        }
        $stmt = $db->prepare(
            'INSERT IGNORE INTO filter_aliases (filter_id, alias, normalized_alias)
             VALUES (:filter_id, :alias, :normalized_alias)'
        );
        $stmt->execute([
            ':filter_id' => $filterId,
            ':alias' => $alias,
            ':normalized_alias' => $normalized,
        ]);
    };
    $mergeFilter = static function (int $sourceId, int $targetId) use ($db, $tableExists, $columnExists, $addAlias): void {
        if ($sourceId <= 0 || $targetId <= 0 || $sourceId === $targetId) {
            return;
        }
        $sourceStmt = $db->prepare('SELECT name, slug, acronym FROM filters WHERE id = :id LIMIT 1');
        $sourceStmt->execute([':id' => $sourceId]);
        $source = $sourceStmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($source)) {
            return;
        }
        foreach ([(string) ($source['name'] ?? ''), (string) ($source['slug'] ?? ''), (string) ($source['acronym'] ?? '')] as $alias) {
            $addAlias($targetId, $alias);
        }

        if ($tableExists('question_filters')) {
            $copy = $db->prepare(
                'INSERT IGNORE INTO question_filters (question_id, filter_id)
                 SELECT question_id, :target_id FROM question_filters WHERE filter_id = :source_id'
            );
            $copy->execute([':target_id' => $targetId, ':source_id' => $sourceId]);
            $delete = $db->prepare('DELETE FROM question_filters WHERE filter_id = :source_id');
            $delete->execute([':source_id' => $sourceId]);
        }
        if ($tableExists('prova_filters')) {
            $copy = $db->prepare(
                'INSERT IGNORE INTO prova_filters (prova_id, filter_id, role)
                 SELECT prova_id, :target_id, role FROM prova_filters WHERE filter_id = :source_id'
            );
            $copy->execute([':target_id' => $targetId, ':source_id' => $sourceId]);
            $delete = $db->prepare('DELETE FROM prova_filters WHERE filter_id = :source_id');
            $delete->execute([':source_id' => $sourceId]);
        }
        if ($tableExists('prova_caderno_filters')) {
            $copy = $db->prepare(
                'INSERT IGNORE INTO prova_caderno_filters (caderno_id, filter_id, role)
                 SELECT caderno_id, :target_id, role FROM prova_caderno_filters WHERE filter_id = :source_id'
            );
            $copy->execute([':target_id' => $targetId, ':source_id' => $sourceId]);
            $delete = $db->prepare('DELETE FROM prova_caderno_filters WHERE filter_id = :source_id');
            $delete->execute([':source_id' => $sourceId]);
        }
        if ($tableExists('provas')) {
            foreach (['banca_id', 'orgao_id', 'cargo_id', 'nivel_id', 'tipo_prova_id'] as $column) {
                if (!$columnExists('provas', $column)) {
                    continue;
                }
                $stmt = $db->prepare("UPDATE provas SET {$column} = :target_id WHERE {$column} = :source_id");
                $stmt->execute([':target_id' => $targetId, ':source_id' => $sourceId]);
            }
        }
        $parents = $db->prepare('UPDATE filters SET parent_id = :target_id WHERE parent_id = :source_id');
        $parents->execute([':target_id' => $targetId, ':source_id' => $sourceId]);

        if ($tableExists('filter_aliases')) {
            $aliases = $db->prepare(
                'INSERT IGNORE INTO filter_aliases (filter_id, alias, normalized_alias)
                 SELECT :target_id, alias, normalized_alias FROM filter_aliases WHERE filter_id = :source_id'
            );
            $aliases->execute([':target_id' => $targetId, ':source_id' => $sourceId]);
            $deleteAliases = $db->prepare('DELETE FROM filter_aliases WHERE filter_id = :source_id');
            $deleteAliases->execute([':source_id' => $sourceId]);
        }

        $deleteFilter = $db->prepare('DELETE FROM filters WHERE id = :source_id');
        $deleteFilter->execute([':source_id' => $sourceId]);
    };
    $consolidateOrganization = static function (
        string $canonicalSlug,
        string $canonicalName,
        string $acronym,
        array $duplicateSlugs
    ) use ($db, $findBySlug, $mergeFilter, $addAlias): void {
        $canonical = $findBySlug('orgao', $canonicalSlug);
        if (!is_array($canonical)) {
            return;
        }
        $canonicalId = (int) $canonical['id'];
        $update = $db->prepare('UPDATE filters SET name = :name, acronym = :acronym WHERE id = :id');
        $update->execute([':name' => $canonicalName, ':acronym' => $acronym, ':id' => $canonicalId]);
        $addAlias($canonicalId, $acronym);

        foreach ($duplicateSlugs as $duplicateSlug) {
            $duplicate = $findBySlug('orgao', $duplicateSlug);
            if (is_array($duplicate)) {
                $mergeFilter((int) $duplicate['id'], $canonicalId);
            }
        }
    };

    $consolidateOrganization(
        'policia-militar-da-paraiba',
        'Polícia Militar da Paraíba',
        'PM-PB',
        ['pm-pb']
    );
    $consolidateOrganization(
        'corpo-de-bombeiros-militar-da-paraiba',
        'Corpo de Bombeiros Militar da Paraíba',
        'CBM-PB',
        ['cbm-pb', 'corpo-de-bombeiros-militar']
    );

    if (!$indexExists('filters', 'uq_filters_type_acronym')) {
        $db->exec('CREATE UNIQUE INDEX uq_filters_type_acronym ON filters (type, acronym)');
    }
};
