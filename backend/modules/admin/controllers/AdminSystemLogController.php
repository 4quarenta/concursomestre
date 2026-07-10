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

require_once __DIR__ . '/../services/AdminSystemLogService.php';

/**
 * Controller HTTP do fluxo de logs administrativos.
 * Mantem a borda do caso de uso enxuta, sem logica de acesso a arquivo.
 */
class AdminSystemLogController
{
    private AdminSystemLogService $service;

    /**
     * Inicializa o controller com o servico de logs.
     *
     * @since 1.0.0
     */
    public function __construct(AdminSystemLogService $service)
    {
        $this->service = $service;
    }

    /**
     * Retorna as linhas mais recentes do log do sistema.
     *
     * @return array{lines: string[], path: string, size_bytes: int, updated_at: ?string}
     *
     * @since 1.0.0
     */
    public function showLatestLogs(): array
    {
        return $this->service->getLatestLogs();
    }

    /**
     * Retorna o conteudo completo do log para download.
     *
     * @return array{content: string, path: string, size_bytes: int, updated_at: ?string}
     *
     * @since 1.0.0
     */
    public function downloadLogs(): array
    {
        return $this->service->downloadLogs();
    }

    /**
     * Limpa o arquivo de log atual.
     *
     * @return array{lines: string[], path: string, size_bytes: int, updated_at: ?string, cleared: bool}
     *
     * @since 1.0.0
     */
    public function clearLogs(): array
    {
        return $this->service->clearLogs();
    }
}
