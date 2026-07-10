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

/**
 * Controller fino do dominio de simulados.
 * Recebe o payload HTTP e delega a orquestracao ao service.
 *
 * @since 1.0.0
 */
class SimulationsController
{
    /**
     * Injeta o service que orquestra as regras de simulados.
     *
     * @since 1.0.0
     */
    public function __construct(private readonly SimulationsService $service)
    {
    }

    /**
     * Persiste uma sessao de simulado do usuario autenticado.
     *
     * @since 1.0.0
     */
    public function saveSimulation(array $payload, array $authenticatedUserPayload): array
    {
        return $this->service->saveSimulation($payload, $authenticatedUserPayload);
    }

    /**
     * Lista os simulados persistidos do usuario autenticado.
     *
     * @since 1.0.0
     */
    public function listSimulations(array $authenticatedUserPayload): array
    {
        return $this->service->listSimulations($authenticatedUserPayload);
    }
}
