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

declare(strict_types=1);

function assertCronLockContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';

assertCronLockContains(
    $base . '/config/cron_lock.php',
    'flock($handle, LOCK_EX | LOCK_NB)',
    'Cron lock helper must use an exclusive non-blocking lock'
);

assertCronLockContains(
    $base . '/config/cron_lock.php',
    'requireCronSecretForRequestOrRespond',
    'Cron lock helper must expose pre-connection secret validation'
);

assertCronLockContains(
    $base . '/api/tasks/ProcessRewards.php',
    "acquireCronLockOrRespond('users_referral_rewards')",
    'Referral rewards HTTP cron must acquire a lock before opening MySQL'
);

assertCronLockContains(
    $base . '/scripts/tasks/process_referral_rewards.php',
    "acquireCronLockOrThrow('users_referral_rewards')",
    'Referral rewards CLI cron must acquire a lock before processing'
);

assertCronLockContains(
    $base . '/modules/subscriptions/routes.php',
    'resolveSubscriptionsCronRequestKey',
    'Subscriptions cron route must accept query key or X-Cron-Secret header consistently'
);

fwrite(STDOUT, "Cron lock wiring assertions passed.\n");
