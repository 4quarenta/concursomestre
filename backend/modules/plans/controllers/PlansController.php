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

require_once __DIR__ . '/../services/PlansService.php';

/**
 * Controller HTTP do dominio de planos.
 * Mantem a entrada fina e delega o catalogo ao service.
 *
 * @since 1.0.0
 */
class PlansController
{
    private PlansService $service;

    /**
     * Inicializa o controller de planos.
     *
     * @since 1.0.0
     */
    public function __construct(PlansService $service)
    {
        $this->service = $service;
    }

    /**
     * Lista o catalogo publico de planos.
     *
     * @since 1.0.0
     */
    public function list(): array
    {
        return $this->service->list();
    }
}
