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

function assertApiInventoryByDirectory(string $base, array $expectedByDirectory): void
{
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($base . '/api', FilesystemIterator::SKIP_DOTS)
    );

    $actualByDirectory = [];

    foreach ($iterator as $fileInfo) {
        if (!$fileInfo->isFile()) {
            continue;
        }

        $relativePath = str_replace('\\', '/', substr($fileInfo->getPathname(), strlen($base . '/api/')));
        $directory = dirname($relativePath);
        $directory = $directory === '.' ? '.' : $directory;

        $actualByDirectory[$directory][] = basename($relativePath);
    }

    foreach ($actualByDirectory as &$files) {
        sort($files);
    }
    unset($files);

    foreach ($expectedByDirectory as &$files) {
        sort($files);
    }
    unset($files);

    ksort($actualByDirectory);
    ksort($expectedByDirectory);

    if ($actualByDirectory !== $expectedByDirectory) {
        throw new RuntimeException(
            'Inventario publico de api/ divergiu do baseline aceito: '
            . json_encode(
                [
                    'expected' => $expectedByDirectory,
                    'actual' => $actualByDirectory,
                ],
                JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
            )
        );
    }
}

$base = dirname(__DIR__) . '';

assertApiInventoryByDirectory($base, [
    '.' => [
        '.htaccess',
        'settings.php',
        'upload.php',
    ],
    'admin' => [
        'analytics_dashboard.php',
        'analytics_finance.php',
        'analytics_funnel.php',
        'analytics_funnel_export.php',
        'analytics_segments.php',
        'analytics_segments_export.php',
        'cache.php',
        'comments_moderation.php',
        'comments_moderation_bulk.php',
        'comments_moderation_export.php',
        'feedback.php',
        'list_tables.php',
        'logs.php',
        'plans.php',
        'report_actions.php',
        'report_workbench.php',
        'reset_db.php',
        'security_ips.php',
        'settings.php',
        'stats.php',
        'user_actions.php',
        'user_details.php',
    ],
    'ai' => [
        'generate.php',
    ],
    'analytics' => [
        'track.php',
    ],
    'auth' => [
        'admin-route-access.php',
        'apple.php',
        'confirm-email.php',
        'enable_2fa.php',
        'facebook.php',
        'forgot-password.php',
        'google.php',
        'login.php',
        'logout.php',
        'me.php',
        'refresh.php',
        'register.php',
        'resend-confirmation.php',
        'reset-password.php',
        'setup_2fa.php',
        'verify_2fa.php',
    ],
    'cache' => [
        'manage.php',
    ],
    'changelog' => [
        'list.php',
    ],
    'comments' => [
        'handle.php',
        'list.php',
        'list_cached.php',
    ],
    'exams' => [
        'delete.php',
        'extraction_review.php',
        'extraction_show.php',
        'extraction_start.php',
        'file_delete.php',
        'file_upload.php',
        'files.php',
        'list.php',
        'save.php',
        'show.php',
    ],
    'feedback' => [
        'create.php',
        'list.php',
        'testimonials.php',
        'vote.php',
    ],
    'filters' => [
        'delete.php',
        'list.php',
        'save.php',
    ],
    'internal/questions' => [
        'ingest.php',
    ],
    'legal-commentary' => [
        'comment.php',
        'cron_sync_updates.php',
        'detail.php',
        'favorite.php',
        'list.php',
        'notes.php',
        'progress.php',
        'reader-annotations.php',
    ],
    'legal-commentary/admin' => [
        'batch-retry.php',
        'batch-start.php',
        'batch-status.php',
        'batch-stop.php',
        'catalog.php',
        'delete.php',
        'detail.php',
        'generate.php',
        'import.php',
        'list.php',
        'save.php',
        'sync-all.php',
        'sync.php',
        'updates.php',
    ],
    'materials' => [
        'access.php',
        'create.php',
        'delete.php',
        'delete_bookmark.php',
        'delete_highlight.php',
        'download.php',
        'get_bookmarks.php',
        'get_highlights.php',
        'get_note.php',
        'list.php',
        'moderate.php',
        'rate.php',
        'save_bookmark.php',
        'save_highlight.php',
        'save_note.php',
        'update.php',
    ],
    'middleware' => [
        'Auth.php',
        'RateLimiter.php',
        'Security.php',
    ],
    'notifications' => [
        'clear.php',
        'clear_all.php',
        'delete.php',
        'list.php',
        'mark-all-read.php',
        'mark-read.php',
        'mark_all_read.php',
        'mark_read.php',
        'permanent-delete.php',
        'restore.php',
        'send.php',
    ],
    'payments' => [
        'config.php',
        'create-connect-account.php',
        'create-preference.php',
        'get-installments.php',
        'process-payment.php',
        'verify-payment.php',
        'webhook.php',
    ],
    'plans' => [
        'list.php',
    ],
    'questions' => [
        'answer.php',
        'bulk_import.php',
        'create.php',
        'delete.php',
        'edit.php',
        'editorial-feedback.php',
        'exam-files.php',
        'exam_import.php',
        'filter.php',
        'get_stats.php',
        'groups.php',
        'history.php',
        'list.php',
        'reset_answers.php',
        'save.php',
        'show.php',
        'toggle_save.php',
        'update.php',
    ],
    'rankings' => [
        'create.php',
        'delete.php',
        'install.php',
        'join.php',
        'list.php',
        'migrate.php',
        'moderate.php',
        'update.php',
    ],
    'referrals' => [
        'stats.php',
    ],
    'reports' => [
        'handle.php',
        'list.php',
    ],
    'simulations' => [
        'create.php',
        'list.php',
        'submit.php',
    ],
    'setup' => [
        'install.php',
        'status.php',
    ],
    'statistics' => [
        'banca_info.php',
        'install.php',
        'platform.php',
        'question.php',
        'study-session.php',
        'user.php',
        'xray.php',
    ],
    'study-schedule' => [
        'delete.php',
        'get.php',
        'save.php',
    ],
    'subscriptions' => [
        'automation_helper.php',
        'cancel.php',
        'cancel_refund.php',
        'create.php',
        'create_stripe_checkout.php',
        'create_stripe_portal.php',
        'create_stripe_subscription.php',
        'cron_recurring.php',
        'cron_scheduled_payments.php',
        'cron_stripe_reconciliation.php',
        'finalize_stripe_subscription.php',
        'process_payment.php',
        'stripe_pix_capability.php',
        'stripe_testing_matrix.php',
        'stripe_testing_runs.php',
        'stripe_webhook.php',
        'sync_current.php',
        'sync_plans_mp.php',
        'undo_cancel.php',
        'update_renewal.php',
        'validate_coupon.php',
        'webhook.php',
        'webhook_mp.php',
        'webhook_stripe.php',
    ],
    'system' => [
        'logs.php',
    ],
    'tasks' => [
        'ProcessRewards.php',
    ],
    'transactions' => [
        'approve_refund.php',
        'create.php',
        'list.php',
        'refund.php',
        'reject_refund.php',
    ],
    'users' => [
        'answers.php',
        'change_password.php',
        'comments.php',
        'create_stripe_setup_intent.php',
        'delete.php',
        'delete_note.php',
        'level_leaderboard.php',
        'list.php',
        'list_cards.php',
        'materials.php',
        'notes.php',
        'profile.php',
        'remove_card.php',
        'remove_photo.php',
        'save_card.php',
        'set_default_card.php',
        'sync_stripe_card.php',
        'update.php',
        'upload_photo.php',
    ],
    'users/me' => [
        'answers.php',
        'comments.php',
    ],
    'utils' => [
        'AdminSecurity.php',
        'AuthConfig.php',
        'AuthCookies.php',
        'AuthLogger.php',
        'AuthSession.php',
        'cache_helpers.php',
        'GoogleAuthenticator.php',
        'JWTAuth.php',
        'Mailer.php',
        'payment_refund_helper.php',
        'recaptcha_helper.php',
        'request_auth.php',
        'Response.php',
        'SimpleCache.php',
        'SQLSecurity.php',
        'Validator.php',
    ],
    'v2/admin/questions' => [
        'show.php',
    ],
    'v2/questions' => [
        'answer.php',
        'list.php',
        'show.php',
    ],
    'v2/users/me/billing' => [
        'payment-status.php',
    ],
]);

fwrite(STDOUT, "API bridge inventory wiring assertions passed.\n");
