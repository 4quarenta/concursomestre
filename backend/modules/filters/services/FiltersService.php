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
                'description' => $row['description'],
                'website' => $row['website'],
            ];

            switch ($row['type']) {
                case 'banca':
                    $item['sigla'] = strtoupper((string) $row['slug']);
                    $result['bancas'][] = $item;
                    break;

                case 'orgao':
                    $item['sigla'] = strtoupper((string) $row['slug']);
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

                case 'ano':
                    $result['anos'][] = (int) $row['name'];
                    break;
            }
        }

        return $result;
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
        $parentId = isset($data['parent_id']) && $data['parent_id'] !== '' ? (int) $data['parent_id'] : null;
        $description = trim((string) ($data['description'] ?? ''));
        $website = trim((string) ($data['website'] ?? ''));
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

        if ($this->repository->slugExists($slug, $id)) {
            throw new RuntimeException("O slug '{$slug}' ja esta em uso por outra taxonomia.", 409);
        }

        $payload = [
            'id' => $id,
            'type' => $type,
            'name' => $name,
            'slug' => $slug,
            'parent_id' => $parentId,
            'description' => $description !== '' ? $description : null,
            'website' => $website !== '' ? $website : null,
            'meta_materia' => $metaMateria,
            'taxonomy_level' => $taxonomyLevel,
            'meta_carreira' => $metaCarreira,
        ];

        if ($id !== null && $id > 0) {
            $this->repository->update($payload);

            return [
                'id' => $id,
                'message' => 'Filtro atualizado com sucesso',
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
}
