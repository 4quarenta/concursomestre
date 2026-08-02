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

require_once __DIR__ . '/../repositories/FiltersRepository.php';
require_once __DIR__ . '/../validators/FiltersValidator.php';

/**
 * Service do dominio de filtros/taxonomias.
 * Agrupa as taxonomias para o app e centraliza o CRUD administrativo.
 *
 * @since 1.0.0
 */
class FiltersService
{
    private FiltersRepository $repository;
    private FiltersValidator $validator;

    /**
     * Inicializa o service de filtros.
     *
     * @since 1.0.0
     */
    public function __construct(
        FiltersRepository $repository,
        FiltersValidator $validator
    ) {
        $this->repository = $repository;
        $this->validator = $validator;
    }

    /**
     * Retorna a lista de filtros agrupada por tipo.
     *
     * @since 1.0.0
     */
    public function list(): array
    {
        $result = [
            'bancas' => [],
            'orgaos' => [],
            'assuntos' => [],
            'cargos' => [],
            'anos' => [],
            'carreiras' => [],
            'areas' => [],
        ];

        $rows = $this->repository->fetchAll();
        $rowsById = [];
        foreach ($rows as $entry) {
            $rowsById[(int) ($entry['id'] ?? 0)] = $entry;
        }

        foreach ($rows as $row) {
            $item = [
                'id' => $row['id'],
                'nome' => $row['name'],
                'slug' => $row['slug'],
                'sigla' => $row['acronym'] ?: null,
                'description' => $row['description'],
                'website' => $row['website'],
                'assetUrl' => $row['asset_url'],
                'iconKey' => $row['icon_key'],
                'keywords' => $this->decodeStringList($row['keywords_json'] ?? null),
                'aliases' => array_values($row['aliases'] ?? []),
            ];

            switch ($row['type']) {
                case 'banca':
                    $result['bancas'][] = $item;
                    break;

                case 'orgao':
                    $result['orgaos'][] = $item;
                    break;

                case 'assunto':
                    $taxonomyLevel = strtolower(trim((string) ($row['taxonomy_level'] ?? '')));
                    if (!in_array($taxonomyLevel, ['materia', 'topico', 'subtopico', 'assunto'], true)) {
                        if (!empty($row['meta_materia'])) {
                            $taxonomyLevel = 'materia';
                        } else {
                            $parentId = (int) ($row['parent_id'] ?? 0);
                            $parent = $parentId > 0 ? ($rowsById[$parentId] ?? null) : null;
                            if ($parent && empty($parent['meta_materia'])) {
                                $parentTaxonomyLevel = strtolower(trim((string) ($parent['taxonomy_level'] ?? '')));
                                $taxonomyLevel = $parentTaxonomyLevel === 'topico' ? 'subtopico' : ($parentTaxonomyLevel === 'subtopico' ? 'assunto' : 'topico');
                            } else {
                                $taxonomyLevel = 'topico';
                            }
                        }
                    }

                    $item['materia'] = (bool) ($row['meta_materia'] ?? 0);
                    $item['pai'] = $row['parent_id'];
                    $item['taxonomy_level'] = $taxonomyLevel;
                    $result['assuntos'][] = $item;
                    break;

                case 'cargo':
                    $item['descricao'] = $row['name'];
                    $item['carreira'] = (bool) ($row['meta_carreira'] ?? 0);
                    $item['pai'] = $row['parent_id'];
                    $result['cargos'][] = $item;
                    break;

                case 'carreira':
                    $item['pai'] = $row['parent_id'];
                    $result['carreiras'][] = $item;
                    break;

                case 'area':
                    $item['pai'] = $row['parent_id'];
                    $result['areas'][] = $item;
                    break;

                case 'ano':
                    $result['anos'][] = (int) $row['name'];
                    break;
            }
        }

        return $result;
    }

    /**
     * Lista a biblioteca administrativa de taxonomias de forma paginada.
     */
    public function listPage(int $page, int $perPage, string $type = 'all', string $search = ''): array
    {
        $pageData = $this->repository->fetchPage($page, $perPage, $type, $search);
        $filterIds = array_map(static fn (array $row): int => (int) $row['id'], $pageData['rows']);
        $usageByFilterId = $this->repository->fetchUsageOverview($filterIds);

        $rows = array_map(function (array $row) use ($usageByFilterId): array {
            return [
                'id' => (int) $row['id'],
                'type' => $this->resolveUiType($row),
                'name' => (string) $row['name'],
                'slug' => (string) $row['slug'],
                'sigla' => $row['acronym'] ?: null,
                'parentId' => $row['parent_id'] !== null ? (int) $row['parent_id'] : null,
                'parentName' => $row['parent_name'] ?: null,
                'description' => $row['description'],
                'website' => $row['website'],
                'assetUrl' => $row['asset_url'],
                'iconKey' => $row['icon_key'],
                'aliases' => array_values($row['aliases'] ?? []),
                'keywords' => $this->decodeStringList($row['keywords_json'] ?? null),
                'taxonomyLevel' => $row['taxonomy_level'] ?: null,
                'relationships' => array_values($row['relationships'] ?? []),
                'usage' => $usageByFilterId[(int) $row['id']] ?? $this->emptyUsage(),
            ];
        }, $pageData['rows']);

        return [
            'rows' => $rows,
            'total' => $pageData['total'],
            'page' => $pageData['page'],
            'perPage' => $pageData['perPage'],
            'pages' => $pageData['pages'],
            'usage' => $this->repository->fetchUsageSummary(),
        ];
    }

    /**
     * Carrega o registro administrativo completo imediatamente antes da
     * edicao. A listagem continua leve e paginada; o modal deixa de depender
     * de uma linha potencialmente antiga mantida no estado do navegador.
     */
    public function getAdminDetail(int $id): array
    {
        $this->validator->validatePositiveId($id, 'Filtro invalido.');
        $row = $this->repository->fetchById($id);
        if ($row === null) {
            throw new InvalidArgumentException('Filtro nao encontrado.');
        }

        $usageByFilterId = $this->repository->fetchUsageOverview([$id]);
        return [
            'id' => (int) $row['id'],
            'type' => $this->resolveUiType($row),
            'name' => (string) $row['name'],
            'slug' => (string) $row['slug'],
            'sigla' => $row['acronym'] ?: null,
            'parentId' => $row['parent_id'] !== null ? (int) $row['parent_id'] : null,
            'parentName' => $row['parent_name'] ?: null,
            'description' => $row['description'],
            'website' => $row['website'],
            'assetUrl' => $row['asset_url'],
            'iconKey' => $row['icon_key'],
            'aliases' => array_values($row['aliases'] ?? []),
            'keywords' => $this->decodeStringList($row['keywords_json'] ?? null),
            'taxonomyLevel' => $row['taxonomy_level'] ?: null,
            'relationships' => array_values($row['relationships'] ?? []),
            'sourceIdentities' => array_values($row['sourceIdentities'] ?? []),
            'usage' => $usageByFilterId[$id] ?? $this->emptyUsage(),
        ];
    }

    private function resolveUiType(array $row): string
    {
        if (($row['type'] ?? '') !== 'assunto') {
            return (string) ($row['type'] ?? '');
        }

        $taxonomyLevel = strtolower(trim((string) ($row['taxonomy_level'] ?? '')));
        if (!empty($row['meta_materia']) || $taxonomyLevel === 'materia') {
            return 'materia';
        }
        if ($taxonomyLevel === 'topico') {
            return 'topico';
        }
        return 'assunto';
    }

    private function emptyUsage(): array
    {
        return [
            'questions' => 0,
            'exams' => 0,
            'laws' => 0,
            'total' => 0,
        ];
    }

    /**
     * Salva uma taxonomia validando integridade de slug e hierarquia.
     *
     * @since 1.0.0
     */
    public function save(array $data): array
    {
        $this->validator->validateSavePayload($data);

        $id = isset($data['id']) ? (int) $data['id'] : null;
        $type = trim((string) ($data['type'] ?? ''));
        $name = trim((string) ($data['name'] ?? ''));
        $slug = trim((string) ($data['slug'] ?? strtolower(trim((string) preg_replace('/[^A-Za-z0-9-]+/', '-', $name)))));
        $metadata = is_array($data['metadata'] ?? null) ? $data['metadata'] : [];
        $acronym = $this->normalizeAcronym((string) ($data['sigla'] ?? $data['acronym'] ?? $metadata['sigla'] ?? ''));
        $parentId = isset($data['parent_id']) && $data['parent_id'] !== '' ? (int) $data['parent_id'] : null;
        $description = trim((string) ($data['description'] ?? ''));
        $website = trim((string) ($data['website'] ?? ''));
        $assetUrl = trim((string) ($data['assetUrl'] ?? $data['asset_url'] ?? ''));
        $iconKey = trim((string) ($data['iconKey'] ?? $data['icon_key'] ?? ''));
        $aliases = $this->normalizeStringList($data['aliases'] ?? []);
        $keywords = $this->normalizeStringList($data['keywords'] ?? []);
        $taxonomyLevelInput = strtolower(trim((string) ($data['taxonomy_level'] ?? $data['taxonomyLevel'] ?? '')));

        $metaMateria = 0;
        $metaCarreira = 0;
        $taxonomyLevel = null;
        if ($type === 'assunto') {
            $metaMateria = $parentId ? 0 : 1;
            if ($metaMateria === 1) {
                $taxonomyLevel = 'materia';
            } elseif (in_array($taxonomyLevelInput, ['topico', 'subtopico', 'assunto'], true)) {
                $taxonomyLevel = $taxonomyLevelInput;
            } elseif ($parentId) {
                $parent = $this->repository->fetchById($parentId);
                if ($parent) {
                    $parentMetaMateria = !empty($parent['meta_materia']);
                    $parentTaxonomyLevel = strtolower(trim((string) ($parent['taxonomy_level'] ?? '')));
                    if ($parentMetaMateria) {
                        $taxonomyLevel = 'topico';
                    } elseif ($parentTaxonomyLevel === 'topico') {
                        $taxonomyLevel = 'subtopico';
                    } elseif ($parentTaxonomyLevel === 'subtopico') {
                        $taxonomyLevel = 'assunto';
                    } else {
                        $taxonomyLevel = 'topico';
                    }
                } else {
                    $taxonomyLevel = 'topico';
                }
            }
        }
        if ($type === 'cargo') {
            $metaCarreira = $parentId ? 0 : 1;
        }

        $canonicalMatch = null;
        if (($type === 'banca' || $type === 'orgao') && ($id === null || $id <= 0)) {
            $canonicalMatch = $this->repository->findCanonicalMatch($type, $name, $slug, $acronym);
            if (is_array($canonicalMatch)) {
                $id = (int) $canonicalMatch['id'];
                $existingName = trim((string) ($canonicalMatch['name'] ?? ''));
                $existingAcronym = $this->normalizeAcronym((string) ($canonicalMatch['acronym'] ?? ''));
                $existingNameIsAcronym = $this->normalizeLookupText($existingName) !== ''
                    && $this->normalizeLookupText($existingName) === $this->normalizeLookupText($existingAcronym ?: $acronym);
                $incomingNameIsAcronym = $this->normalizeLookupText($name) === $this->normalizeLookupText($acronym);
                if (!$existingNameIsAcronym || $name === '' || $incomingNameIsAcronym) {
                    $name = $existingName ?: $name;
                }
                $acronym = $acronym ?: $existingAcronym;
                if (!$existingNameIsAcronym || $incomingNameIsAcronym) {
                    $slug = trim((string) ($canonicalMatch['slug'] ?? '')) ?: $slug;
                }
                $aliases = $this->normalizeStringList([
                    ...($canonicalMatch['aliases'] ?? []),
                    ...$aliases,
                    $existingName,
                    (string) ($canonicalMatch['acronym'] ?? ''),
                    $name,
                    $acronym,
                ]);
                $description = $description ?: trim((string) ($canonicalMatch['description'] ?? ''));
                $website = $website ?: trim((string) ($canonicalMatch['website'] ?? ''));
                $assetUrl = $assetUrl ?: trim((string) ($canonicalMatch['asset_url'] ?? ''));
                $iconKey = $iconKey ?: trim((string) ($canonicalMatch['icon_key'] ?? ''));
            }
        }

        if ($this->repository->acronymExists($type, $acronym, $id)) {
            throw new RuntimeException("A sigla '{$acronym}' ja pertence a outra taxonomia deste tipo.", 409);
        }

        if ($this->repository->slugExists($type, $slug, $id)) {
            throw new RuntimeException("O slug '{$slug}' ja esta em uso neste tipo de taxonomia.", 409);
        }

        $payload = [
            'id' => $id,
            'type' => $type,
            'name' => $name,
            'slug' => $slug,
            'acronym' => $acronym !== '' ? $acronym : null,
            'parent_id' => $parentId,
            'description' => $description !== '' ? $description : null,
            'website' => $website !== '' ? $website : null,
            'asset_url' => $assetUrl !== '' ? $assetUrl : null,
            'icon_key' => $iconKey !== '' ? $iconKey : null,
            'keywords_json' => $keywords !== [] ? json_encode($keywords, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
            'aliases' => $aliases,
            'meta_materia' => $metaMateria,
            'taxonomy_level' => $taxonomyLevel,
            'meta_carreira' => $metaCarreira,
        ];

        if ($id !== null && $id > 0) {
            $this->repository->update($payload);

            return [
                'id' => $id,
                'message' => $canonicalMatch ? 'Taxonomia existente reutilizada e atualizada com sucesso' : 'Filtro atualizado com sucesso',
                'audit_action' => 'filter.update',
                'audit_entity_id' => (string) $id,
                'audit_metadata' => ['type' => $type, 'name' => $name, 'slug' => $slug],
            ];
        }

        $newId = $this->repository->create($payload);

        return [
            'id' => $newId,
            'message' => 'Filtro criado com sucesso',
            'audit_action' => 'filter.create',
            'audit_entity_id' => (string) $newId,
            'audit_metadata' => ['type' => $type, 'name' => $name, 'slug' => $slug],
        ];
    }

    /**
     * Exclui uma taxonomia pelo id informado.
     *
     * @since 1.0.0
     */
    public function delete(int $id): array
    {
        $this->validator->validatePositiveId($id, 'ID nao fornecido');
        $this->repository->delete($id);

        return [
            'message' => 'Filtro excluido com sucesso',
            'audit_action' => 'filter.delete',
            'audit_entity_id' => (string) $id,
        ];
    }

    /**
     * Exclui uma selecao de taxonomias em uma unica operacao administrativa.
     */
    public function deleteMany(mixed $ids): array
    {
        $normalizedIds = $this->validator->normalizeDeleteIds($ids);
        $deletedIds = $this->repository->deleteMany($normalizedIds);

        return [
            'deletedIds' => $deletedIds,
            'deletedCount' => count($deletedIds),
            'message' => count($deletedIds) . ' taxonomia(s) excluida(s) com sucesso.',
            'audit_action' => 'filter.bulk-delete',
            'audit_entity_id' => 'bulk',
            'audit_metadata' => ['ids' => $deletedIds, 'count' => count($deletedIds)],
        ];
    }

    private function normalizeStringList(mixed $value): array
    {
        if (is_string($value)) {
            $value = preg_split('/[,;\r\n]+/', $value) ?: [];
        }
        if (!is_array($value)) {
            return [];
        }
        $normalized = [];
        foreach ($value as $item) {
            $item = trim((string) $item);
            if ($item !== '') {
                $normalized[mb_strtolower($item, 'UTF-8')] = $item;
            }
        }
        return array_values($normalized);
    }

    private function decodeStringList(mixed $value): array
    {
        if (is_array($value)) {
            return $this->normalizeStringList($value);
        }
        if (!is_string($value) || trim($value) === '') {
            return [];
        }
        $decoded = json_decode($value, true);
        return $this->normalizeStringList(is_array($decoded) ? $decoded : []);
    }

    private function normalizeAcronym(string $value): string
    {
        $value = trim((string) preg_replace('/\s+/', ' ', $value));
        return mb_substr(mb_strtoupper($value, 'UTF-8'), 0, 40, 'UTF-8');
    }

    private function normalizeLookupText(string $value): string
    {
        $value = trim(mb_strtolower($value, 'UTF-8'));
        $transliterated = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        $value = $transliterated !== false ? $transliterated : $value;
        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', $value));
    }
}
