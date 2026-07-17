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

function assertSocialGamificationContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';
$commentsService = $base . '/modules/comments/services/CommentsService.php';
$commentsRepository = $base . '/modules/comments/repositories/CommentsRepository.php';
$adminCommentsRepository = $base . '/modules/admin/repositories/AdminCommentsModerationRepository.php';
$adminReportService = $base . '/modules/admin/services/AdminReportModerationService.php';

assertSocialGamificationContains(
    $commentsService,
    'applyLikeGamification($userId, $comment)',
    'Comment likes must trigger social gamification after a new like'
);

assertSocialGamificationContains(
    $commentsService,
    'applySubmittedCommentGamification(',
    'Submitted comments must trigger participation gamification'
);

assertSocialGamificationContains(
    $commentsRepository,
    'function applyLikeGamification',
    'Comments repository must expose a canonical like gamification hook'
);

assertSocialGamificationContains(
    $commentsRepository,
    'function applySubmittedCommentGamification',
    'Comments repository must expose a canonical submitted-comment gamification hook'
);

assertSocialGamificationContains(
    $commentsRepository,
    "\$eventName = \$isReply ? 'comment_reply_submitted' : 'comment_submitted';",
    'Submitted comment gamification must distinguish replies from root comments'
);

assertSocialGamificationContains(
    $commentsRepository,
    "'comment_submitted'",
    'Pending comments must use the user-facing submitted-comment notification rule'
);

assertSocialGamificationContains(
    $commentsRepository,
    "'comment_like_received'",
    'Comment like notifications must use the configurable social notification rule'
);

assertSocialGamificationContains(
    $commentsRepository,
    "'comment_published'",
    'Auto-published comment notifications must use the configurable social notification rule'
);

assertSocialGamificationContains(
    $commentsRepository,
    'resolveNotificationDeliveryRule(',
    'Direct comment notifications must apply configurable notification text'
);

assertSocialGamificationContains(
    $commentsRepository,
    "'comment_like:' . \$commentId . ':' . \$likerUserId",
    'Comment like gamification must be idempotent per liker/comment pair'
);

assertSocialGamificationContains(
    $commentsRepository,
    "'first_comment_like_received'",
    'Authors must have a badge for the first received comment like'
);

assertSocialGamificationContains(
    $adminCommentsRepository,
    "/../../../config/gamification_helper.php",
    'Comment moderation must load the gamification helper'
);

assertSocialGamificationContains(
    $adminCommentsRepository,
    "'comment_approved:' . \$sourceType . ':'",
    'Approved comments must reward the author idempotently'
);

assertSocialGamificationContains(
    $adminCommentsRepository,
    "'comment_penalty:' . \$sourceType . ':'",
    'Spam/trash moderation must penalize reputation only once per comment'
);

assertSocialGamificationContains(
    $adminReportService,
    "/../../../config/gamification_helper.php",
    'Report moderation must load the gamification helper'
);

assertSocialGamificationContains(
    $adminReportService,
    "'report_accepted:' . \$reportId",
    'Accepted reports must reward the reporter idempotently'
);

assertSocialGamificationContains(
    $adminReportService,
    "'first_accepted_report'",
    'Accepted reports must unlock a first accepted report badge'
);

fwrite(STDOUT, "Social gamification wiring assertions passed.\n");
