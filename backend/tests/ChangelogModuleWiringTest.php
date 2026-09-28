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

function assertContainsChangelogDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsChangelogDelegate(
    $base . '/api/changelog/list.php',
    'handleChangelogListRoute',
    'Changelog list endpoint must delegate to changelog module routes'
);

assertContainsChangelogDelegate(
    $base . '/api/changelog/latest_unread.php',
    'handleChangelogLatestUnreadRoute',
    'Changelog unread endpoint must delegate to changelog module routes'
);
assertContainsChangelogDelegate(
    $base . '/api/changelog/mark_viewed.php',
    'handleChangelogMarkViewedRoute',
    'Changelog viewed endpoint must delegate to changelog module routes'
);
assertContainsChangelogDelegate(
    $base . '/modules/changelog/routes.php',
    'verifyAuthenticatedUserPayload',
    'Changelog user read state must be scoped to an authenticated account'
);
assertContainsChangelogDelegate(
    $base . '/modules/changelog/repositories/ChangelogRepository.php',
    'viewed_through_at',
    'Changelog acknowledgement must suppress older publications without a modal backlog'
);
assertContainsChangelogDelegate(
    $base . '/database/migrations/20260928_100000_changelog_user_reads.php',
    'PRIMARY KEY (user_id)',
    'Changelog read watermark must be unique per user'
);

assertContainsChangelogDelegate(
    $base . '/modules/changelog/routes.php',
    'function handleChangelogListRoute',
    'Changelog routes must expose the list handler'
);

fwrite(STDOUT, "Changelog module wiring assertions passed.\n");
