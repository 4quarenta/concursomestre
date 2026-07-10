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

require_once __DIR__ . '/../services/AdminDatabaseMaintenanceService.php';

/**
 * Controller HTTP da manutencao administrativa da base.
 */
class AdminDatabaseMaintenanceController
{
    private AdminDatabaseMaintenanceService $service;

    /**
     * Inicializa o controller com o servico de manutencao da base.
     *
     * @since 1.0.0
     */
    public function __construct(AdminDatabaseMaintenanceService $service)
    {
        $this->service = $service;
    }

    /**
     * Retorna as tabelas que podem ser resetadas via painel.
     *
     * @since 1.0.0
     */
    public function listTables(): array
    {
        return $this->service->listResettableTables();
    }

    /**
     * Executa o reset da base conforme os parametros recebidos.
     *
     * @since 1.0.0
     */
    public function reset(string $adminUserId, array $payload): array
    {
        return $this->service->resetDatabase($adminUserId, $payload);
    }
}
