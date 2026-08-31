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

require_once __DIR__ . '/../services/RankingsService.php';

/**
 * Controller HTTP do dominio de rankings.
 *
 * @since 1.0.0
 */
class RankingsController
{
    private RankingsService $service;

    /**
     * Inicializa o controller de rankings.
     *
     * @since 1.0.0
     */
    public function __construct(RankingsService $service)
    {
        $this->service = $service;
    }

    /**
     * Lista rankings, incluindo pendentes quando admin.
     *
     * @since 1.0.0
     */
    public function list(bool $isAdmin): array
    {
        return $this->service->list($isAdmin);
    }

    /**
     * Cria um ranking novo.
     *
     * @since 1.0.0
     */
    public function create(array $payload, bool $isAdmin): array
    {
        return $this->service->create($payload, $isAdmin);
    }

    /**
     * Registra a participacao de um usuario.
     *
     * @since 1.0.0
     */
    public function join(array $payload): array
    {
        return $this->service->join($payload);
    }

    /**
     * Modera o status de um ranking.
     *
     * @since 1.0.0
     */
    public function moderate(string $rankingId, string $status): void
    {
        $this->service->moderate($rankingId, $status);
    }

    /**
     * Atualiza os dados de um ranking.
     *
     * @since 1.0.0
     */
    public function update(array $payload): void
    {
        $this->service->update($payload);
    }

    /**
     * Exclui um ranking e suas entradas.
     *
     * @since 1.0.0
     */
    public function delete(string $rankingId): array
    {
        return $this->service->delete($rankingId);
    }

    /**
     * Cria as tabelas base do modulo.
     *
     * @since 1.0.0
     */
    public function install(): array
    {
        return $this->service->install();
    }

    /**
     * Migra o schema de rankings para a versao atual.
     *
     * @since 1.0.0
     */
    public function migrate(): array
    {
        return $this->service->migrate();
    }
}
