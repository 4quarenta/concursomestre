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

function assertContainsCommentsDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsCommentsDelegate(
    $base . '/api/comments/list.php',
    'handleCommentsListRoute',
    'Comments list endpoint must delegate to comments module routes'
);

assertContainsCommentsDelegate(
    $base . '/api/comments/handle.php',
    'handleCommentsMutationRoute',
    'Comments handle endpoint must delegate to comments module routes'
);

assertContainsCommentsDelegate(
    $base . '/api/comments/list_cached.php',
    'handleCommentsCachedListRoute',
    'Comments cached list endpoint must delegate to comments module routes'
);

assertContainsCommentsDelegate(
    $base . '/modules/comments/routes.php',
    'function handleCommentsListRoute',
    'Comments routes must expose the list handler'
);

assertContainsCommentsDelegate(
    $base . '/modules/comments/repositories/CommentsRepository.php',
    "SignedKeysetCursor::decode(\$cursor, 'comments.target')",
    'Public comment listing must use a signed keyset cursor'
);

assertContainsCommentsDelegate(
    $base . '/modules/comments/repositories/CommentsRepository.php',
    'LIMIT \' . ($safeLimit + 1)',
    'Public comment listing must be bounded'
);

assertContainsCommentsDelegate(
    $base . '/modules/comments/routes.php',
    'function handleCommentsMutationRoute',
    'Comments routes must expose the mutation handler'
);

assertContainsCommentsDelegate(
    $base . '/modules/comments/routes.php',
    'function handleCommentsCachedListRoute',
    'Comments routes must expose the cached list handler'
);

assertContainsCommentsDelegate(
    $base . '/modules/admin/repositories/AdminCommentsModerationRepository.php',
    'notifyModerationOutcome',
    'Comment moderation must notify authors when status changes'
);

assertContainsCommentsDelegate(
    $base . '/modules/admin/repositories/AdminCommentsModerationRepository.php',
    'notifyVisibleGenericComment',
    'Approved comments must trigger the visible social notification path'
);

fwrite(STDOUT, "Comments module wiring assertions passed.\n");
