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

require_once __DIR__ . '/../services/AiService.php';

/**
 * Controller fino do dominio de IA.
 * Mantem a rota legada desacoplada da integracao com o provedor.
 *
 * @since 1.0.0
 */
class AiController
{
    /**
     * Inicializa o controller de IA.
     *
     * @since 1.0.0
     */
    public function __construct(private readonly AiService $service)
    {
    }

    /**
     * Gera texto com base no prompt recebido.
     *
     * @since 1.0.0
     */
    public function generate(array $payload)
    {
        return $this->service->generate($payload);
    }
}
