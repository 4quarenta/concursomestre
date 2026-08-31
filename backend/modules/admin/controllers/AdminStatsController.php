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

require_once __DIR__ . '/../services/AdminStatsService.php';

/**
 * Controller HTTP do dashboard de metricas administrativas.
 */
class AdminStatsController
{
    private AdminStatsService $service;

    /**
     * Inicializa o controller com o servico de metricas.
     *
     * @since 1.0.0
     */
    public function __construct(AdminStatsService $service)
    {
        $this->service = $service;
    }

    /**
     * Retorna as metricas do painel conforme periodo solicitado.
     *
     * @since 1.0.0
     */
    public function index(?string $period, ?string $startDate, ?string $endDate): array
    {
        return $this->service->getStats($period, $startDate, $endDate);
    }
}
