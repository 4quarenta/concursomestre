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

function assertContainsFeedbackDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';

assertContainsFeedbackDelegate(
    $base . '/api/feedback/list.php',
    'handleFeedbackListRoute',
    'Feedback list endpoint must delegate to feedback module routes'
);

assertContainsFeedbackDelegate(
    $base . '/api/feedback/create.php',
    'handleFeedbackCreateRoute',
    'Feedback create endpoint must delegate to feedback module routes'
);

assertContainsFeedbackDelegate(
    $base . '/modules/feedback/routes.php',
    'function handleFeedbackListRoute',
    'Feedback routes must expose the list handler'
);

assertContainsFeedbackDelegate(
    $base . '/modules/feedback/routes.php',
    'function handleFeedbackCreateRoute',
    'Feedback routes must expose the create handler'
);

assertContainsFeedbackDelegate(
    $base . '/modules/admin/repositories/AdminFeedbackRepository.php',
    'function notifyThreadOwnerReply',
    'Admin feedback replies must be able to notify the thread owner in-app'
);

assertContainsFeedbackDelegate(
    $base . '/modules/admin/repositories/AdminFeedbackRepository.php',
    "'/support?threadId='",
    'Admin feedback reply notification must link users back to support'
);

assertContainsFeedbackDelegate(
    $base . '/modules/admin/services/AdminFeedbackService.php',
    'notifyThreadOwnerReply($thread, $parentId)',
    'Admin feedback reply flow must create an in-app notification for the user'
);

assertContainsFeedbackDelegate(
    $base . '/modules/feedback/validators/FeedbackValidator.php',
    "'testimonial', 'rating', 'platform-rating', 'platform_rating' => 'platform-rating'",
    'Platform ratings must be stored as platform-rating, not as public suggestions'
);

assertContainsFeedbackDelegate(
    $base . '/modules/feedback/repositories/FeedbackRepository.php',
    "f.public_rating IS NULL",
    'Public suggestion listing must ignore platform ratings stored in legacy rows'
);

assertContainsFeedbackDelegate(
    $base . '/modules/feedback/repositories/FeedbackRepository.php',
    "'platform-rating'",
    'Feedback schema must allow platform-rating type'
);

assertContainsFeedbackDelegate(
    $base . '/modules/feedback/repositories/FeedbackRepository.php',
    "SET type = 'platform-rating'",
    'Feedback schema repair must migrate legacy platform ratings out of suggestions'
);

fwrite(STDOUT, "Feedback module wiring assertions passed.\n");
