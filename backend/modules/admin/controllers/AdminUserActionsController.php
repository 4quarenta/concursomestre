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

require_once __DIR__ . '/../services/AdminUserActionsService.php';

/**
 * Controller HTTP das mutacoes administrativas de usuario.
 */
class AdminUserActionsController
{
    private AdminUserActionsService $service;

    /**
     * Inicializa o controller com o servico de acoes administrativas.
     *
     * @since 1.0.0
     */
    public function __construct(AdminUserActionsService $service)
    {
        $this->service = $service;
    }

    /**
     * Executa uma acao administrativa sobre usuarios.
     *
     * @since 1.0.0
     */
    public function execute(array $payload): array
    {
        return $this->service->execute($payload);
    }
}
