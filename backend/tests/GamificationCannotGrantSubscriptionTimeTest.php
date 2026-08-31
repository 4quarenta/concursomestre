<?php

declare(strict_types=1);

function gamificationSubscriptionAssert(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$root = dirname(__DIR__);
$rewardService = (string) file_get_contents($root . '/modules/questions/services/QuestionsRewardService.php');
$worker = (string) file_get_contents($root . '/scripts/workers/process_platform_events.php');
$questionService = (string) file_get_contents($root . '/modules/questions/services/QuestionsService.php');
$questionRepository = (string) file_get_contents($root . '/modules/questions/repositories/QuestionsRepository.php');

gamificationSubscriptionAssert(
    $rewardService !== '' && $worker !== '' && $questionService !== '' && $questionRepository !== '',
    'Gamification sources could not be read.'
);

foreach ([
    'applyLevelUpReward',
    'level_up_reward',
    'rewardDays',
    'subscription_end',
    'current_plan_id',
    'updateUserRewardPlan',
    'stripe',
    'Stripe',
] as $forbidden) {
    gamificationSubscriptionAssert(
        !str_contains($rewardService, $forbidden),
        'Gamification reward service still contains a subscription/billing side effect: ' . $forbidden
    );
}

gamificationSubscriptionAssert(
    !str_contains($worker, 'applyLevelUpReward')
        && !str_contains($worker, 'updateUserRewardPlan')
        && str_contains($worker, 'applyAnswerProgressRewards'),
    'The platform event worker must retain non-billing progress rewards only.'
);

gamificationSubscriptionAssert(
    str_contains($questionService, '$this->repository->incrementUserXp($userId, $xpGain)')
        && str_contains($questionRepository, 'level = FLOOR((xp + :xp_gain) / :xp_per_level) + 1'),
    'XP and level progression must remain in the canonical answer transaction.'
);

// These fixtures document the states that must remain unchanged by level-up processing.
$states = [
    'active_subscription' => ['plan' => 'Pro', 'subscription_end' => '2030-01-01 00:00:00', 'status' => 'active'],
    'no_subscription' => ['plan' => 'Gratuito', 'subscription_end' => null, 'status' => null],
    'cancelled' => ['plan' => 'Pro', 'subscription_end' => '2020-01-01 00:00:00', 'status' => 'canceled'],
    'expired' => ['plan' => 'Pro', 'subscription_end' => '2020-01-01 00:00:00', 'status' => 'expired'],
    'past_due' => ['plan' => 'Pro', 'subscription_end' => '2030-01-01 00:00:00', 'status' => 'past_due'],
];

foreach ($states as $name => $state) {
    foreach (['plan', 'subscription_end', 'status'] as $field) {
        gamificationSubscriptionAssert(
            array_key_exists($field, $state),
            'Billing state fixture is incomplete: ' . $name . '.' . $field
        );
    }
}

// Replay/concurrency safety is structural: there is no billing mutation to replay or race.
gamificationSubscriptionAssert(
    !str_contains($rewardService, 'subscription')
        && !str_contains($worker, 'subscription'),
    'Replay and concurrent level-up handling must have zero subscription effect.'
);

fwrite(STDOUT, "Gamification subscription-time regression assertions passed.\n");
