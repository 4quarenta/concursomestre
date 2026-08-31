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

/**
 * Job de recompensa de indicacoes dentro do dominio de usuarios.
 * Mantem o fluxo de cron fora de `api/tasks` e reaproveita o repositorio oficial.
 *
 * @since 1.0.0
 */
class UsersReferralRewardsService
{
    /**
     * Monta o job oficial com acesso ao repositorio que persiste indicacoes, XP e notificacoes.
     *
     * @since 1.0.0
     */
    public function __construct(private readonly UsersRepository $repository)
    {
    }

    /**
     * Processa indicacoes pendentes depois da carencia minima.
     *
     * @since 1.0.0
     */
    public function processPendingReferralRewards(int $graceDays = 7): array
    {
        $pendingRewards = $this->repository->fetchPendingReferralRewards($graceDays);
        $granted = 0;
        $failed = 0;
        $items = [];

        foreach ($pendingRewards as $reward) {
            $referralId = (string) ($reward['id'] ?? '');
            $referrerId = trim((string) ($reward['referrer_id'] ?? ''));
            $referredUserId = trim((string) ($reward['referred_user_id'] ?? ''));

            if ($referralId === '' || $referrerId === '' || $referredUserId === '') {
                $failed++;
                $items[] = [
                    'referralId' => $referralId,
                    'status' => 'failed',
                    'message' => 'Indicacao com dados insuficientes para recompensa.',
                ];
                continue;
            }

            try {
                $this->repository->beginTransaction();

                $rewardSummary = $this->applyReferralReward($referrerId);
                $this->repository->incrementUserXp($referrerId, 1000);
                $this->repository->markReferralRewarded($referralId, 0.0);
                $this->repository->insertNotification([
                    'id' => $this->generateNotificationId(),
                    'user_id' => $referrerId,
                    'title' => 'Recompensa por indicacao liberada!',
                    'message' => "Uma indicacao sua passou da carencia e liberou {$rewardSummary['rewardDays']} dias adicionais no seu plano, alem de 1000 XP.",
                    'category' => 'system',
                    'type' => 'success',
                    'link' => '/profile?tab=referral',
                ]);

                $this->repository->commit();
                $granted++;
                $items[] = [
                    'referralId' => $referralId,
                    'referrerId' => $referrerId,
                    'referredUserId' => $referredUserId,
                    'status' => 'rewarded',
                    'rewardDays' => $rewardSummary['rewardDays'],
                    'plan' => $rewardSummary['plan'],
                    'subscriptionEnd' => $rewardSummary['subscriptionEnd'],
                ];
            } catch (Throwable $e) {
                if ($this->repository->inTransaction()) {
                    $this->repository->rollBack();
                }

                $failed++;
                $items[] = [
                    'referralId' => $referralId,
                    'referrerId' => $referrerId,
                    'referredUserId' => $referredUserId,
                    'status' => 'failed',
                    'message' => $e->getMessage(),
                ];
            }
        }

        return [
            'processed' => count($pendingRewards),
            'granted' => $granted,
            'failed' => $failed,
            'items' => $items,
        ];
    }

    /**
     * Aplica a extensao de plano usada no programa de indicacao.
     *
     * @since 1.0.0
     */
    private function applyReferralReward(string $userId): array
    {
        $snapshot = $this->repository->findRewardUserSnapshotById($userId);
        if (!$snapshot) {
            throw new OutOfBoundsException('Usuario indicador nao encontrado.');
        }

        $currentPlan = canonicalUserPlanValue((string) ($snapshot['plan'] ?? 'Gratuito'));
        $rewardDays = 10;
        $currentEnd = trim((string) ($snapshot['subscription_end'] ?? ''));
        $now = time();
        $currentEndTimestamp = $currentEnd !== '' ? strtotime($currentEnd) : false;

        if ($currentEndTimestamp === false || $currentEndTimestamp < $now) {
            $newEnd = date('Y-m-d H:i:s', strtotime("+{$rewardDays} days"));
        } else {
            $newEnd = date('Y-m-d H:i:s', strtotime($currentEnd . " +{$rewardDays} days"));
        }

        $newPlan = in_array($currentPlan, ['Gratuito', 'Essencial'], true) ? 'Pro' : $currentPlan;
        $this->repository->updateUserRewardPlan($userId, $newPlan, $newEnd);

        return [
            'rewardDays' => $rewardDays,
            'plan' => $newPlan,
            'subscriptionEnd' => $newEnd,
        ];
    }

    /**
     * Gera ids compativeis com o historico atual de notificacoes.
     *
     * @since 1.0.0
     */
    private function generateNotificationId(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff)
        );
    }
}
