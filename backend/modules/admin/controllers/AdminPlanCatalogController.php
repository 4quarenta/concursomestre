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
 * Controller fino do catalogo de planos no admin.
 *
 * @since 1.0.0
 */
class AdminPlanCatalogController
{
    public function __construct(private readonly AdminPlanCatalogService $service)
    {
    }

    public function list(array $query): array
    {
        return $this->service->list($query);
    }

    public function update(array $payload, string $adminUserId): array
    {
        return $this->service->update($payload, $adminUserId);
    }
}

