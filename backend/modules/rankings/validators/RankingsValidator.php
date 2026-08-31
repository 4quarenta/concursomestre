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
 * Validador do dominio de rankings.
 *
 * @since 1.0.0
 */
class RankingsValidator
{
    /**
     * Valida o payload de criacao.
     *
     * @since 1.0.0
     */
    public function validateCreatePayload(array $data): void
    {
        if (trim((string) ($data['name'] ?? '')) === '' || trim((string) ($data['institution'] ?? '')) === '') {
            throw new InvalidArgumentException('Incomplete data.');
        }
    }

    /**
     * Valida o payload de participacao.
     *
     * @since 1.0.0
     */
    public function validateJoinPayload(array $data): void
    {
        if (trim((string) ($data['rankingId'] ?? '')) === '' || trim((string) ($data['userId'] ?? '')) === '') {
            throw new InvalidArgumentException('Incomplete data.');
        }
    }

    /**
     * Valida o id do ranking.
     *
     * @since 1.0.0
     */
    public function validateRankingId(string $rankingId, string $message): void
    {
        if (trim($rankingId) === '') {
            throw new InvalidArgumentException($message);
        }
    }

    /**
     * Valida o status de moderacao.
     *
     * @since 1.0.0
     */
    public function validateModerationStatus(string $status): void
    {
        if (!in_array($status, ['approved', 'rejected'], true)) {
            throw new InvalidArgumentException('Parametros invalidos para moderar o ranking.');
        }
    }
}
