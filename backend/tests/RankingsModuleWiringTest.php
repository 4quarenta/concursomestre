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

function assertContainsRankingsDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';

foreach ([
    ['api/rankings/list.php', 'handleRankingsListRoute'],
    ['api/rankings/create.php', 'handleRankingsCreateRoute'],
    ['api/rankings/join.php', 'handleRankingsJoinRoute'],
    ['api/rankings/update.php', 'handleRankingsUpdateRoute'],
    ['api/rankings/moderate.php', 'handleRankingsModerateRoute'],
    ['api/rankings/delete.php', 'handleRankingsDeleteRoute'],
    ['api/rankings/install.php', 'handleRankingsInstallRoute'],
    ['api/rankings/migrate.php', 'handleRankingsMigrateRoute'],
] as [$file, $needle]) {
    assertContainsRankingsDelegate(
        $base . '/' . $file,
        $needle,
        'Ranking endpoint must delegate to rankings module routes'
    );
}

foreach ([
    'function handleRankingsListRoute',
    'function handleRankingsCreateRoute',
    'function handleRankingsJoinRoute',
    'function handleRankingsUpdateRoute',
    'function handleRankingsModerateRoute',
    'function handleRankingsDeleteRoute',
    'function handleRankingsInstallRoute',
    'function handleRankingsMigrateRoute',
] as $needle) {
    assertContainsRankingsDelegate(
        $base . '/modules/rankings/routes.php',
        $needle,
        'Rankings routes must expose required handlers'
    );
}

assertContainsRankingsDelegate(
    $base . '/modules/rankings/routes.php',
    'AuthMiddleware::requireAuth()',
    'Ranking create/join routes must require an authenticated user'
);

assertContainsRankingsDelegate(
    $base . '/modules/rankings/routes.php',
    "\$data['userId'] = (string) (\$authUser['user_id'] ?? '')",
    'Ranking join route must ignore userId supplied by the client'
);

foreach ([
    'function notifyAdminsPendingRanking',
    'function notifyRankingCreatorModeration',
    'function notifyRankingParticipantJoin',
    'function notifyRankingParticipantsOfficialKey',
    'function applyRankingCreatorModerationGamification',
    'function applyRankingParticipantJoinGamification',
    'function applyRankingOfficialKeyGamification',
    'function fetchActiveRankingEntries',
] as $needle) {
    assertContainsRankingsDelegate(
        $base . '/modules/rankings/repositories/RankingsRepository.php',
        $needle,
        'Rankings repository must expose notification and gamification hooks'
    );
}

foreach ([
    'notifyAdminsPendingRanking',
    'notifyRankingParticipantJoin',
    'notifyRankingCreatorModeration',
    'notifyRankingParticipantsOfficialKey',
    'applyRankingParticipantJoinGamification',
    'applyRankingCreatorModerationGamification',
    'applyRankingOfficialKeyGamification',
] as $needle) {
    assertContainsRankingsDelegate(
        $base . '/modules/rankings/services/RankingsService.php',
        $needle,
        'Rankings service must call notification and gamification hooks'
    );
}

assertContainsRankingsDelegate(
    $base . '/modules/rankings/services/RankingsService.php',
    'findEntryByRankingAndUser',
    'Ranking join must detect existing user participation before creating notifications'
);

assertContainsRankingsDelegate(
    $base . '/database/migrations/20260501_rankings_notifications.sql',
    'created_by_user_id',
    'Rankings notification migration must preserve creator ownership'
);

assertContainsRankingsDelegate(
    $base . '/modules/rankings/repositories/RankingsRepository.php',
    "'ranking_result:' . \$rankingId . ':' . \$userId",
    'Ranking official results must reward participants idempotently'
);

assertContainsRankingsDelegate(
    $base . '/modules/rankings/repositories/RankingsRepository.php',
    "'ranking_first_place'",
    'Ranking gamification must include a first place badge'
);

fwrite(STDOUT, "Rankings module wiring assertions passed.\n");
