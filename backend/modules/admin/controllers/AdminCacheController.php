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

require_once __DIR__ . '/../services/AdminCacheService.php';

/**
 * Controller HTTP do gerenciamento administrativo de cache.
 */
class AdminCacheController
{
    private AdminCacheService $service;

    /**
     * Inicializa o controller com o servico de cache administrativo.
     *
     * @since 1.0.0
     */
    public function __construct(AdminCacheService $service)
    {
        $this->service = $service;
    }

    /**
     * Processa a acao solicitada e delega para o servico de cache.
     *
     * @since 1.0.0
     */
    public function handle(string $action, string $method, array $body = []): array
    {
        return $this->service->handle($action, $method, $body);
    }
}
