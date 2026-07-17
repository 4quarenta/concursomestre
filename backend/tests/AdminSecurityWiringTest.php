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

function assertContainsText(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsText($base . '/api/admin/feedback.php', 'handleAdminFeedbackRoute', 'Admin feedback endpoint must delegate to the admin module');
assertContainsText($base . '/modules/admin/routes.php', 'function handleAdminFeedbackRoute', 'Admin routes must expose the feedback handler');
assertContainsText($base . '/modules/admin/routes.php', 'requireAdminSessionContext($db)', 'Admin module routes must enforce admin session context');

assertContainsText($base . '/api/rankings/update.php', 'handleRankingsUpdateRoute', 'Ranking update endpoint must delegate to rankings module');
assertContainsText($base . '/api/rankings/delete.php', 'handleRankingsDeleteRoute', 'Ranking delete endpoint must delegate to rankings module');
assertContainsText($base . '/modules/rankings/routes.php', 'requireAdminSessionContext($db)', 'Rankings module must enforce admin session context');

assertContainsText($base . '/api/materials/delete.php', 'handleMaterialsDeleteRoute', 'Material delete endpoint must delegate to materials module');
assertContainsText($base . '/modules/materials/routes.php', 'requirePlatformAdminSessionContext($db)', 'Materials module must enforce admin session context');

assertContainsText($base . '/api/feedback/create.php', 'handleFeedbackCreateRoute', 'Feedback create endpoint must delegate to feedback module');
assertContainsText($base . '/modules/feedback/routes.php', 'verifyAuthenticatedUserPayload()', 'Feedback module must require authenticated session for thread creation');

fwrite(STDOUT, "Admin security wiring assertions passed.\n");
