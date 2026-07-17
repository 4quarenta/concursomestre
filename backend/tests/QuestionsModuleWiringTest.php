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

function assertContainsQuestionsDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsQuestionsDelegate(
    $base . '/api/questions/create.php',
    'handleQuestionsCreateRoute',
    'Questions create endpoint must delegate to questions module routes'
);

assertContainsQuestionsDelegate(
    $base . '/api/questions/save.php',
    'handleQuestionsSaveRoute',
    'Questions save endpoint must delegate to questions module routes'
);

assertContainsQuestionsDelegate(
    $base . '/api/questions/update.php',
    'handleQuestionsUpdateRoute',
    'Questions update endpoint must delegate to questions module routes'
);

assertContainsQuestionsDelegate(
    $base . '/api/questions/edit.php',
    'handleQuestionsEditRoute',
    'Questions edit endpoint must delegate to questions module routes'
);

assertContainsQuestionsDelegate(
    $base . '/api/questions/delete.php',
    'handleQuestionsDeleteRoute',
    'Questions delete endpoint must delegate to questions module routes'
);

assertContainsQuestionsDelegate(
    $base . '/api/questions/list.php',
    'handleQuestionsListRoute',
    'Questions list endpoint must delegate to questions module routes'
);

assertContainsQuestionsDelegate(
    $base . '/api/questions/filter.php',
    'handleQuestionsFilterRoute',
    'Questions filter endpoint must delegate to questions module routes'
);

assertContainsQuestionsDelegate(
    $base . '/api/questions/get_stats.php',
    'handleQuestionsStatsRoute',
    'Questions get_stats endpoint must delegate to questions module routes'
);

assertContainsQuestionsDelegate(
    $base . '/api/questions/answer.php',
    'handleQuestionsAnswerRoute',
    'Questions answer endpoint must delegate to questions module routes'
);

assertContainsQuestionsDelegate(
    $base . '/api/questions/history.php',
    'handleQuestionsHistoryRoute',
    'Questions history endpoint must delegate to questions module routes'
);

assertContainsQuestionsDelegate(
    $base . '/api/questions/reset_answers.php',
    'handleQuestionsResetAnswersRoute',
    'Questions reset_answers endpoint must delegate to questions module routes'
);

assertContainsQuestionsDelegate(
    $base . '/api/questions/toggle_save.php',
    'handleQuestionsToggleSaveRoute',
    'Questions toggle_save endpoint must delegate to questions module routes'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/routes.php',
    'function handleQuestionsCreateRoute',
    'Questions routes must expose the create handler'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/routes.php',
    'function handleQuestionsSaveRoute',
    'Questions routes must expose the save handler'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/routes.php',
    'function handleQuestionsUpdateRoute',
    'Questions routes must expose the update handler'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/routes.php',
    'function handleQuestionsEditRoute',
    'Questions routes must expose the edit handler'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/routes.php',
    'function handleQuestionsDeleteRoute',
    'Questions routes must expose the delete handler'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/routes.php',
    'function handleQuestionsListRoute',
    'Questions routes must expose the list handler'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/routes.php',
    'function handleQuestionsFilterRoute',
    'Questions routes must expose the filter handler'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/routes.php',
    'function handleQuestionsStatsRoute',
    'Questions routes must expose the stats handler'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/routes.php',
    'function handleQuestionsAnswerRoute',
    'Questions routes must expose the answer handler'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/routes.php',
    'function handleQuestionsHistoryRoute',
    'Questions routes must expose the history handler'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/routes.php',
    'function handleQuestionsResetAnswersRoute',
    'Questions routes must expose the reset handler'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/routes.php',
    'function handleQuestionsToggleSaveRoute',
    'Questions routes must expose the toggle save handler'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/routes.php',
    'Questions exam import publish failed',
    'Imported exam publish route must log backend failures with a searchable prefix'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/services/QuestionsService.php',
    'resolveImportedContextText($context)',
    'Imported exam contexts must preserve richText/HTML before falling back to plain text'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/services/QuestionsService.php',
    "\$examPayload['publishedExamId']",
    'Imported question publishing must preserve the already published exam id from the frontend'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/repositories/QuestionsRepository.php',
    'WHERE id = :id',
    'Imported exam lookup must prefer the published exam id before slug/name matching'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/validators/QuestionsValidator.php',
    "?? \$payload['richText']",
    'Manual question context saving must accept richText/rich_text payloads'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/services/QuestionsRewardService.php',
    'applyAnswerProgressRewards',
    'Question answers must update streaks and badges, not only XP'
);

assertContainsQuestionsDelegate(
    $base . '/database/migrations/20260711_010010_questions_exams_compatibility.php',
    'CREATE TABLE IF NOT EXISTS user_streaks',
    'Question migration must provision the daily streak table outside requests'
);

assertContainsQuestionsDelegate(
    $base . '/modules/questions/repositories/QuestionsRepository.php',
    'INSERT IGNORE INTO user_badges',
    'Question badges must be granted idempotently'
);

fwrite(STDOUT, "Questions module wiring assertions passed.\n");
