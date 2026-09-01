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

/**
 * Script CLI oficial para processar recompensas de indicacao.
 * Substitui o job procedural antigo de `api/tasks/ProcessRewards.php`.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/cron_lock.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/users/routes.php';

$graceDays = isset($argv[1]) ? max(0, (int) $argv[1]) : 7;
$cronLock = acquireCronLockOrThrow('users_referral_rewards');
register_shutdown_function([$cronLock, 'release']);
$coverageNoop = in_array('--coverage-noop', array_slice($argv, 1), true);

$database = new Database();
$db = $database->getConnection();
$summary = null;
if ($coverageNoop) {
    echo json_encode([
        'success' => true,
        'mode' => 'coverage-noop',
        'graceDays' => $graceDays,
        'bootstrapped' => true,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(0);
}
$summary = runUsersReferralRewardsCron($db, $graceDays);

echo json_encode([
    'success' => true,
    'summary' => $summary,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
