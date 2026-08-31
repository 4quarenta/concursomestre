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

require_once __DIR__ . '/../services/AdminUserDetailsService.php';

/**
 * Controller HTTP do detalhamento administrativo de usuario.
 */
class AdminUserDetailsController
{
    private AdminUserDetailsService $service;

    /**
     * Inicializa o controller com o servico de detalhamento.
     *
     * @since 1.0.0
     */
    public function __construct(AdminUserDetailsService $service)
    {
        $this->service = $service;
    }

    /**
     * Retorna os detalhes administrativos do usuario informado.
     *
     * @since 1.0.0
     */
    public function show(string $userId): array
    {
        return $this->service->getDetails($userId);
    }
}
