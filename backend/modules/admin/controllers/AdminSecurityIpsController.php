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
 * Controller fino para IPs suspeitos no painel admin.
 *
 * @since 1.0.0
 */
class AdminSecurityIpsController
{
    public function __construct(private readonly AdminSecurityIpsService $service)
    {
    }

    public function overview(array $query): array
    {
        return $this->service->overview($query);
    }

    public function mutate(array $payload, string $adminUserId): array
    {
        return $this->service->mutate($payload, $adminUserId);
    }
}
