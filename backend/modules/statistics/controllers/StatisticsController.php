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
 * Controller fino do dominio de estatisticas.
 * Ele apenas recebe a query autorizada e delega para a service oficial.
 */
class StatisticsController
{
    /**
     * Injeta o service oficial para manter o controller restrito a entrada HTTP.
     * @since 1.0.0
     */
    public function __construct(private readonly StatisticsService $service)
    {
    }

    /**
     * Retorna o raio-x consolidado da banca para o usurio autenticado.
     * @since 1.0.0
     */
    public function getXrayStats(string $authenticatedUserId, array $query): array
    {
        return $this->service->getXrayStats($authenticatedUserId, $query);
    }

    /**
     * Retorna a inteligencia pblica obtida do site da banca.
     * @since 1.0.0
     */
    public function getBancaInfo(string $authenticatedUserId, array $query): array
    {
        return $this->service->getBancaInfo($authenticatedUserId, $query);
    }

    /**
     * Retorna o agregado estatistico do usurio em escopo autorizado.
     * @since 1.0.0
     */
    public function getUserStatistics(array $authenticatedUserPayload, array $query): array
    {
        return $this->service->getUserStatistics($authenticatedUserPayload, $query);
    }

    /**
     * Retorna o agregado pblico de uma questo.
     * @since 1.0.0
     */
    public function getQuestionStatistics(array $query): array
    {
        return $this->service->getQuestionStatistics($query);
    }

    /**
     * Retorna indicadores globais da plataforma para o painel administrativo.
     * @since 1.0.0
     */
    public function getPlatformStatistics(array $authenticatedUserPayload): array
    {
        return $this->service->getPlatformStatistics($authenticatedUserPayload);
    }

    /**
     * Executa a instalacao/garantia das tabelas estatisticas.
     * @since 1.0.0
     */
    public function installStatistics(array $authenticatedUserPayload): array
    {
        return $this->service->installStatistics($authenticatedUserPayload);
    }

    /**
     * Persiste uma sessao de estudo e devolve o agregado atualizado do usuario.
     * @since 1.0.0
     */
    public function recordStudySession(array $authenticatedUserPayload, array $payload): array
    {
        return $this->service->recordStudySession($authenticatedUserPayload, $payload);
    }
}
