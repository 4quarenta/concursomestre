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

require_once __DIR__ . '/../services/ChangelogService.php';

/**
 * Controller fino do dominio de changelog.
 * Apenas encaminha a leitura publica para o service oficial.
 *
 * @since 1.0.0
 */
class ChangelogController
{
    private ChangelogService $service;

    /**
     * Inicializa o controller de changelog.
     *
     * @since 1.0.0
     */
    public function __construct(ChangelogService $service)
    {
        $this->service = $service;
    }

    /**
     * Lista as versoes publicadas da plataforma.
     *
     * @since 1.0.0
     */
    public function listEntries(): array
    {
        return $this->service->listEntries();
    }
}
