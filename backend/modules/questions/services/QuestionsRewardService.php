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
 * Suporte de recompensa por progressao dentro do dominio questions.
 * Mantem a regra de bonus por level up fora dos endpoints legados.
  * @since 1.0.0
 */
class QuestionsRewardService
{
    public function __construct(private readonly QuestionsRepository $repository)
    {
    }

    /**
     * Concede dias de acesso PRO/Elite quando o usuario sobe de nivel.
      * @since 1.0.0
     */
    public function applyLevelUpReward(array $userSnapshot): void
    {
        $userId = (string) ($userSnapshot['id'] ?? '');
        if ($userId === '') {
            return;
        }

        $level = max(1, (int) ($userSnapshot['level'] ?? 1));
        $grant = $this->repository->grantGamificationEvent(
            $userId,
            'level_up_reward',
            'level_up_reward:' . $userId . ':' . $level,
            0,
            0,
            null,
            ['level' => $level]
        );
        if (empty($grant['applied'])) {
            return;
        }

        $currentPlan = (string) ($userSnapshot['plan'] ?? 'Gratuito');
        $rewardDays = $currentPlan === 'Elite' ? 7 : 5;
        $currentEnd = trim((string) ($userSnapshot['subscription_end'] ?? ''));
        $now = time();

        if ($currentEnd === '' || strtotime($currentEnd) === false || strtotime($currentEnd) < $now) {
            $newEnd = date('Y-m-d H:i:s', strtotime("+{$rewardDays} days"));
        } else {
            $newEnd = date('Y-m-d H:i:s', strtotime($currentEnd . " +{$rewardDays} days"));
        }

        $newPlan = $currentPlan;
        if ($currentPlan === 'Gratuito' || $currentPlan === 'Essencial') {
            $newPlan = 'Pro';
        }

        $this->repository->updateUserRewardPlan($userId, $newPlan, $newEnd);
        $this->repository->insertNotification([
            'id' => $this->generateNotificationId(),
            'user_id' => $userId,
            'title' => 'Bonus de nivel alcancado!',
            'message' => $currentPlan === 'Elite'
                ? "Parabens! Por subir de nivel, voce ganhou {$rewardDays} dias de acesso Elite gratis!"
                : "Parabens! Por subir de nivel, voce ganhou {$rewardDays} dias de acesso PRO gratis!",
            'category' => 'system',
            'type' => 'success',
            'link' => '/profile?tab=billing',
        ]);
    }

    /**
     * Atualiza streak diario e concede badges basicos de progresso.
     *
     * @since 1.0.0
     */
    public function applyAnswerProgressRewards(string $userId, bool $isCorrect): array
    {
        if ($userId === '') {
            return [
                'streak' => null,
                'badges' => [],
            ];
        }

        $streak = $this->repository->touchDailyAnswerStreak($userId);
        $totals = $this->repository->getUserAnswerTotals($userId);
        $badges = [];
        $xpRewards = [];

        $badgeRules = [
            [
                'key' => 'first_answer',
                'title' => 'Primeira questao respondida',
                'description' => 'Voce respondeu sua primeira questao na plataforma.',
                'unlocked' => (int) ($totals['total_answers'] ?? 0) >= 1,
            ],
            [
                'key' => 'ten_correct_answers',
                'title' => '10 acertos acumulados',
                'description' => 'Voce chegou aos 10 acertos. Boa constancia.',
                'unlocked' => (int) ($totals['correct_answers'] ?? 0) >= 10,
            ],
            [
                'key' => 'hundred_answers',
                'title' => '100 questoes respondidas',
                'description' => 'Voce ja respondeu 100 questoes. Repeticao bem feita muda o jogo.',
                'unlocked' => (int) ($totals['total_answers'] ?? 0) >= 100,
            ],
            [
                'key' => 'streak_3_days',
                'title' => '3 dias de sequencia',
                'description' => 'Voce estudou por 3 dias seguidos.',
                'unlocked' => (int) ($streak['current_streak'] ?? 0) >= 3,
            ],
            [
                'key' => 'streak_7_days',
                'title' => '7 dias de sequencia',
                'description' => 'Uma semana inteira de estudo registrada.',
                'unlocked' => (int) ($streak['current_streak'] ?? 0) >= 7,
            ],
            [
                'key' => 'streak_15_days',
                'title' => '15 dias de sequencia',
                'description' => 'Duas semanas de estudo praticamente sem perder ritmo.',
                'unlocked' => (int) ($streak['current_streak'] ?? 0) >= 15,
            ],
            [
                'key' => 'streak_30_days',
                'title' => '30 dias de sequencia',
                'description' => 'Um mes de consistencia registrado na plataforma.',
                'unlocked' => (int) ($streak['current_streak'] ?? 0) >= 30,
            ],
        ];

        foreach ($badgeRules as $rule) {
            if (empty($rule['unlocked'])) {
                continue;
            }

            if ($this->repository->grantUserBadge($userId, $rule['key'], $rule['title'], $rule['description'])) {
                $badges[] = [
                    'key' => $rule['key'],
                    'title' => $rule['title'],
                    'description' => $rule['description'],
                ];

                $this->repository->insertNotification([
                    'id' => $this->generateNotificationId(),
                    'user_id' => $userId,
                    'title' => 'Badge desbloqueado',
                    'message' => $rule['title'] . ': ' . $rule['description'],
                    'category' => 'system',
                    'type' => 'success',
                    'link' => '/profile?tab=achievements',
                ]);
            }
        }

        if (!empty($streak['advanced_today'])) {
            $dailyReward = $this->repository->grantGamificationEvent(
                $userId,
                'daily_study_activity',
                'daily_study:' . $userId . ':' . (string) ($streak['last_activity_date'] ?? date('Y-m-d')),
                5,
                0,
                null,
                [
                    'streak_days' => (int) ($streak['current_streak'] ?? 1),
                    'source' => 'question_answer',
                ]
            );

            if (!empty($dailyReward['applied'])) {
                $xpRewards[] = [
                    'key' => 'daily_study_activity',
                    'title' => 'Estudo do dia',
                    'xp' => 5,
                ];
            }
        }

        $answerMilestoneRewards = [
            [
                'key' => 'answers_25',
                'title' => '25 questoes respondidas',
                'xp' => 25,
                'unlocked' => (int) ($totals['total_answers'] ?? 0) >= 25,
            ],
            [
                'key' => 'answers_50',
                'title' => '50 questoes respondidas',
                'xp' => 50,
                'unlocked' => (int) ($totals['total_answers'] ?? 0) >= 50,
            ],
            [
                'key' => 'answers_100',
                'title' => '100 questoes respondidas',
                'xp' => 100,
                'unlocked' => (int) ($totals['total_answers'] ?? 0) >= 100,
            ],
            [
                'key' => 'correct_50',
                'title' => '50 acertos acumulados',
                'xp' => 75,
                'unlocked' => (int) ($totals['correct_answers'] ?? 0) >= 50,
            ],
            [
                'key' => 'correct_100',
                'title' => '100 acertos acumulados',
                'xp' => 150,
                'unlocked' => (int) ($totals['correct_answers'] ?? 0) >= 100,
            ],
        ];

        foreach ($answerMilestoneRewards as $rule) {
            if (empty($rule['unlocked'])) {
                continue;
            }

            $reward = $this->repository->grantGamificationEvent(
                $userId,
                'answer_progress_milestone',
                'answer_milestone:' . $userId . ':' . $rule['key'],
                (int) $rule['xp'],
                0,
                null,
                [
                    'total_answers' => (int) ($totals['total_answers'] ?? 0),
                    'correct_answers' => (int) ($totals['correct_answers'] ?? 0),
                ]
            );

            if (empty($reward['applied'])) {
                continue;
            }

            $xpRewards[] = [
                'key' => $rule['key'],
                'title' => $rule['title'],
                'xp' => (int) $rule['xp'],
            ];

            $this->repository->insertNotification([
                'id' => $this->generateNotificationId(),
                'user_id' => $userId,
                'title' => 'Bonus de XP desbloqueado',
                'message' => $rule['title'] . ': +' . (int) $rule['xp'] . ' XP.',
                'category' => 'system',
                'type' => 'success',
                'link' => '/levels',
            ]);
        }

        $streakMilestoneRewards = [
            3 => 15,
            7 => 50,
            15 => 100,
            30 => 250,
        ];
        $currentStreak = (int) ($streak['current_streak'] ?? 0);
        if (!empty($streak['advanced_today']) && isset($streakMilestoneRewards[$currentStreak])) {
            $streakXp = (int) $streakMilestoneRewards[$currentStreak];
            $reward = $this->repository->grantGamificationEvent(
                $userId,
                'study_streak_milestone',
                'streak_milestone:' . $userId . ':' . $currentStreak,
                $streakXp,
                1,
                null,
                [
                    'streak_days' => $currentStreak,
                    'longest_streak' => (int) ($streak['longest_streak'] ?? $currentStreak),
                ]
            );

            if (!empty($reward['applied'])) {
                $xpRewards[] = [
                    'key' => 'streak_' . $currentStreak,
                    'title' => $currentStreak . ' dias de sequencia',
                    'xp' => $streakXp,
                ];
            }
        }

        if (!empty($streak['advanced_today']) && in_array((int) $streak['current_streak'], [3, 7, 15, 30], true)) {
            $this->repository->insertNotification([
                'id' => $this->generateNotificationId(),
                'user_id' => $userId,
                'title' => 'Sequencia de estudos',
                'message' => 'Voce manteve uma sequencia de ' . (int) $streak['current_streak'] . ' dias.',
                'category' => 'system',
                'type' => 'success',
                'link' => '/profile?tab=achievements',
            ]);
        }

        return [
            'streak' => $streak,
            'badges' => $badges,
            'xpRewards' => $xpRewards,
            'lastAnswerCorrect' => $isCorrect,
        ];
    }

    /**
     * Gera ids compativeis com o historico atual de notificacoes.
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
