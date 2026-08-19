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

require_once __DIR__ . '/../services/FiltersService.php';

/**
 * Controller HTTP do dominio de filtros/taxonomias.
 *
 * @since 1.0.0
 */
class FiltersController
{
    private FiltersService $service;

    /**
     * Inicializa o controller de filtros.
     *
     * @since 1.0.0
     */
    public function __construct(FiltersService $service)
    {
        $this->service = $service;
    }

    /**
     * Lista os filtros disponiveis.
     *
     * @since 1.0.0
     */
    public function list(): array
    {
        return $this->service->list();
    }

    public function listPracticeCatalog(): array
    {
        return $this->service->listPracticeCatalog();
    }

    public function listPage(int $page, int $perPage, string $type = 'all', string $search = ''): array
    {
        return $this->service->listPage($page, $perPage, $type, $search);
    }

    public function listPublicDirectory(
        string $directoryType,
        int $page,
        int $perPage,
        string $search = '',
        string $letter = ''
    ): array {
        return $this->service->listPublicDirectory($directoryType, $page, $perPage, $search, $letter);
    }

    public function getPublicBoardDetail(string $slug, int $page, int $perPage, string $status = 'all'): ?array
    {
        return $this->service->getPublicBoardDetail($slug, $page, $perPage, $status);
    }

    public function getPublicDisciplineDetail(string $slug): ?array
    {
        return $this->service->getPublicDisciplineProjection($slug);
    }

    public function getPublicOrganizationDetail(string $slug): ?array
    {
        return $this->service->getPublicOrganizationProjection($slug);
    }

    public function listPublicTaxonomyChildren(int $parentId, int $page, int $perPage): array
    {
        return $this->service->listPublicTaxonomyChildren($parentId, $page, $perPage);
    }

    public function getAdminDetail(int $id): array
    {
        return $this->service->getAdminDetail($id);
    }

    /**
     * Persiste ou atualiza uma taxonomia.
     *
     * @since 1.0.0
     */
    public function save(array $payload): array
    {
        return $this->service->save($payload);
    }

    /**
     * Remove uma taxonomia existente.
     *
     * @since 1.0.0
     */
    public function delete(int $id): array
    {
        return $this->service->delete($id);
    }

    /**
     * Remove varias taxonomias com validacao e transacao compartilhadas.
     */
    public function deleteMany(mixed $ids): array
    {
        return $this->service->deleteMany($ids);
    }
}
