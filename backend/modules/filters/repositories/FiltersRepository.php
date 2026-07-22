<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

/**
 * Repositorio do dominio de filtros/taxonomias.
 *
 * @since 1.0.0
 */
class FiltersRepository
{
    private PDO $db;

    /**
     * Inicializa o repository com a conexao do banco.
     *
     * @since 1.0.0
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Carrega todas as taxonomias cadastradas.
     *
     * @since 1.0.0
     */
    public function fetchAll(): array
    {
        $stmt = $this->db->prepare("
            SELECT id, type, name, slug, acronym, parent_id, description, website,
                   asset_url, icon_key, keywords_json,
                   meta_materia, taxonomy_level, meta_carreira
            FROM filters
            ORDER BY name
        ");
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $aliasesByFilterId = $this->fetchAliasesByFilterIds(array_map(
            static fn (array $row): int => (int) $row['id'],
            $rows
        ));
        foreach ($rows as &$row) {
            $row['aliases'] = $aliasesByFilterId[(int) $row['id']] ?? [];
        }
        unset($row);
        return $rows;
    }

    /**
     * Verifica se o slug ja existe, ignorando um id opcional.
     *
     * @since 1.0.0
     */
    public function slugExists(string $type, string $slug, ?int $exceptId = null): bool
    {
        $query = 'SELECT id FROM filters WHERE type = :type AND slug = :slug';
        if ($exceptId !== null) {
            $query .= ' AND id != :id';
        }

        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':type', $type);
        $stmt->bindValue(':slug', $slug);
        if ($exceptId !== null) {
            $stmt->bindValue(':id', $exceptId, PDO::PARAM_INT);
        }
        $stmt->execute();

        return (bool) $stmt->fetch();
    }

    public function fetchById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT id, type, name, slug, acronym, parent_id, description, website,
                   asset_url, icon_key, keywords_json,
                   meta_materia, taxonomy_level, meta_carreira
            FROM filters
            WHERE id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }
        $aliases = $this->fetchAliasesByFilterIds([$id]);
        $row['aliases'] = $aliases[$id] ?? [];
        return $row;
    }

    /**
     * Localiza uma banca ou orgao pelo conjunto canonico nome/sigla/slug/alias.
     */
    public function findCanonicalMatch(string $type, string $name, string $slug, string $acronym): ?array
    {
        $stmt = $this->db->prepare("
            SELECT id, type, name, slug, acronym, parent_id, description, website,
                   asset_url, icon_key, keywords_json,
                   meta_materia, taxonomy_level, meta_carreira
            FROM filters
            WHERE type = :type
            ORDER BY id
        ");
        $stmt->execute([':type' => $type]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $aliasesByFilterId = $this->fetchAliasesByFilterIds(array_map(
            static fn (array $row): int => (int) $row['id'],
            $rows
        ));
        $requested = array_filter(array_unique([
            $this->normalizeLookupText($name),
            $this->normalizeLookupText($slug),
            $this->normalizeLookupText($acronym),
        ]));

        foreach ($rows as $row) {
            $aliases = $aliasesByFilterId[(int) $row['id']] ?? [];
            $candidate = array_filter(array_unique([
                $this->normalizeLookupText((string) ($row['name'] ?? '')),
                $this->normalizeLookupText((string) ($row['slug'] ?? '')),
                $this->normalizeLookupText((string) ($row['acronym'] ?? '')),
                ...array_map(fn (string $alias): string => $this->normalizeLookupText($alias), $aliases),
            ]));
            if (array_intersect($requested, $candidate) !== []) {
                $row['aliases'] = $aliases;
                return $row;
            }
        }

        return null;
    }

    public function acronymExists(string $type, string $acronym, ?int $exceptId = null): bool
    {
        if ($acronym === '') {
            return false;
        }
        $query = 'SELECT id FROM filters WHERE type = :type AND acronym = :acronym';
        if ($exceptId !== null) {
            $query .= ' AND id != :id';
        }
        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':type', $type);
        $stmt->bindValue(':acronym', $acronym);
        if ($exceptId !== null) {
            $stmt->bindValue(':id', $exceptId, PDO::PARAM_INT);
        }
        $stmt->execute();
        return (bool) $stmt->fetch();
    }

    /**
     * Atualiza um filtro existente.
     *
     * @since 1.0.0
     */
    public function update(array $payload): void
    {
        $ownsTransaction = !$this->db->inTransaction();
        if ($ownsTransaction) {
            $this->db->beginTransaction();
        }
        try {
            $stmt = $this->db->prepare("
            UPDATE filters
            SET type = :type,
                name = :name,
                slug = :slug,
                acronym = :acronym,
                parent_id = :parent_id,
                description = :description,
                website = :website,
                asset_url = :asset_url,
                icon_key = :icon_key,
                keywords_json = :keywords_json,
                meta_materia = :meta_materia,
                taxonomy_level = :taxonomy_level,
                meta_carreira = :meta_carreira
            WHERE id = :id
            ");
            $stmt->execute([
            ':type' => $payload['type'],
            ':name' => $payload['name'],
            ':slug' => $payload['slug'],
            ':acronym' => $payload['acronym'],
            ':parent_id' => $payload['parent_id'],
            ':description' => $payload['description'],
            ':website' => $payload['website'],
            ':asset_url' => $payload['asset_url'],
            ':icon_key' => $payload['icon_key'],
            ':keywords_json' => $payload['keywords_json'],
            ':meta_materia' => $payload['meta_materia'],
            ':taxonomy_level' => $payload['taxonomy_level'],
            ':meta_carreira' => $payload['meta_carreira'],
            ':id' => $payload['id'],
            ]);
            $this->replaceAliases((int) $payload['id'], $payload['aliases']);
            if ($ownsTransaction) {
                $this->db->commit();
            }
        } catch (Throwable $exception) {
            if ($ownsTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    /**
     * Cria um filtro novo.
     *
     * @since 1.0.0
     */
    public function create(array $payload): int
    {
        $ownsTransaction = !$this->db->inTransaction();
        if ($ownsTransaction) {
            $this->db->beginTransaction();
        }
        try {
            $stmt = $this->db->prepare("
                INSERT INTO filters (
                    type, name, slug, acronym, parent_id, description, website,
                    asset_url, icon_key, keywords_json,
                    meta_materia, taxonomy_level, meta_carreira
                ) VALUES (
                    :type, :name, :slug, :acronym, :parent_id, :description, :website,
                    :asset_url, :icon_key, :keywords_json,
                    :meta_materia, :taxonomy_level, :meta_carreira
                )
            ");
            $stmt->execute([
            ':type' => $payload['type'],
            ':name' => $payload['name'],
            ':slug' => $payload['slug'],
            ':acronym' => $payload['acronym'],
            ':parent_id' => $payload['parent_id'],
            ':description' => $payload['description'],
            ':website' => $payload['website'],
            ':asset_url' => $payload['asset_url'],
            ':icon_key' => $payload['icon_key'],
            ':keywords_json' => $payload['keywords_json'],
            ':meta_materia' => $payload['meta_materia'],
            ':taxonomy_level' => $payload['taxonomy_level'],
            ':meta_carreira' => $payload['meta_carreira'],
            ]);
            $id = (int) $this->db->lastInsertId();
            $this->replaceAliases($id, $payload['aliases']);
            if ($ownsTransaction) {
                $this->db->commit();
            }
            return $id;
        } catch (Throwable $exception) {
            if ($ownsTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    /**
     * Exclui um filtro pelo id.
     *
     * @since 1.0.0
     */
    public function delete(int $id): void
    {
        $stmt = $this->db->prepare('DELETE FROM filters WHERE id = :id');
        $stmt->execute([':id' => $id]);
    }

    private function fetchAliasesByFilterIds(array $filterIds): array
    {
        $filterIds = array_values(array_unique(array_filter(array_map('intval', $filterIds))));
        if ($filterIds === []) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($filterIds), '?'));
        $stmt = $this->db->prepare(
            "SELECT filter_id, alias FROM filter_aliases
             WHERE filter_id IN ({$placeholders})
             ORDER BY alias"
        );
        $stmt->execute($filterIds);
        $result = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $result[(int) $row['filter_id']][] = (string) $row['alias'];
        }
        return $result;
    }

    private function replaceAliases(int $filterId, array $aliases): void
    {
        $delete = $this->db->prepare('DELETE FROM filter_aliases WHERE filter_id = :filter_id');
        $delete->execute([':filter_id' => $filterId]);
        if ($aliases === []) {
            return;
        }
        $insert = $this->db->prepare(
            'INSERT INTO filter_aliases (filter_id, alias, normalized_alias)
             VALUES (:filter_id, :alias, :normalized_alias)'
        );
        $normalizedAliases = [];
        foreach ($aliases as $alias) {
            $alias = trim((string) $alias);
            $normalizedAlias = $this->normalizeLookupText($alias);
            if ($alias === '' || $normalizedAlias === '' || isset($normalizedAliases[$normalizedAlias])) {
                continue;
            }
            $normalizedAliases[$normalizedAlias] = true;
            $insert->execute([
                ':filter_id' => $filterId,
                ':alias' => $alias,
                ':normalized_alias' => $normalizedAlias,
            ]);
        }
    }

    private function normalizeLookupText(string $value): string
    {
        $value = trim(mb_strtolower($value, 'UTF-8'));
        $transliterated = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        $value = $transliterated !== false ? $transliterated : $value;
        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', $value));
    }
}
