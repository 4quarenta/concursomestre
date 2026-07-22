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
 * Controller fino do dominio de denuncias.
 * Recebe a entrada HTTP e delega a regra ao service.
 *
 * @since 1.0.0
 */
class ReportsController
{
    /**
     * Injeta o service oficial de denuncias.
     *
     * @since 1.0.0
     */
    public function __construct(private readonly ReportsService $service)
    {
    }

    /**
     * Cria uma nova denuncia.
     *
     * @since 1.0.0
     */
    public function createReport(array $payload, array $authenticatedUserPayload): array
    {
        return $this->service->createReport($payload, $authenticatedUserPayload);
    }

    /**
     * Lista denuncias para o admin.
     *
     * @since 1.0.0
     */
    public function listReports(string $adminUserId, int $limit = 50, ?string $cursor = null): array
    {
        return $this->service->listReports($adminUserId, $limit, $cursor);
    }
}
