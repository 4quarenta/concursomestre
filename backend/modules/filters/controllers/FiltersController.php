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
}
