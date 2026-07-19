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

require_once __DIR__ . '/../repositories/UsersRepository.php';
require_once __DIR__ . '/../../../config/payment_provider.php';
require_once __DIR__ . '/../../finance/services/ReferralFinance.php';

/**
 * Job financeiro de indicacoes.
 *
 * O nome da classe e da rota foi preservado para manter o cron instalado, mas
 * o comportamento antigo de conceder dias de plano e XP foi removido. Uma
 * indicacao agora gera somente comissao monetaria lastreada em transacao paga.
 *
 * @since 1.0.0
 */
class UsersReferralRewardsService
{
    /** Monta o job oficial preservando a rota de cron instalada. */
    public function __construct(private readonly UsersRepository $repository)
    {
    }

    /** Cria o ciclo no dia configurado; a carencia e aplicada por lancamento. */
    public function processPendingReferralRewards(int $graceDays = 7): array
    {
        $result = ReferralFinance::createCycle($this->repository->getConnection(), 'cron', false);
        return [
            'mode' => 'monetary_commission',
            'legacyPlanDaysGranted' => 0,
            'legacyXpGranted' => 0,
            'cycle' => $result,
        ];
    }
}
