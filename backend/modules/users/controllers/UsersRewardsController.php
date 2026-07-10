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

require_once __DIR__ . '/../services/UsersReferralRewardsService.php';

/**
 * Controller fino dos jobs de recompensa ligados ao dominio de usuarios.
  * @since 1.0.0
 */
class UsersRewardsController
{
    public function __construct(private readonly UsersReferralRewardsService $service)
    {
    }

    /**
     * Processa indicacoes pendentes respeitando a carencia configurada.
      * @since 1.0.0
     */
    public function processPendingReferralRewards(int $graceDays = 7): array
    {
        return $this->service->processPendingReferralRewards($graceDays);
    }
}
