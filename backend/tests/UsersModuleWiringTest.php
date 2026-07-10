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

function assertContainsUsersDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';

assertContainsUsersDelegate(
    $base . '/api/tasks/ProcessRewards.php',
    'handleUsersProcessReferralRewardsCronRoute',
    'Referral rewards task endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/referrals/stats.php',
    'handleUsersReferralStatsRoute',
    'Referral stats endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/upload_photo.php',
    'handleUsersUploadPhotoRoute',
    'Upload photo endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/change_password.php',
    'handleUsersChangePasswordRoute',
    'Change password endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/profile.php',
    'handleUsersAuthenticatedProfileRoute',
    'Profile endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/update.php',
    'handleUsersUpdateProfileRoute',
    'Update endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/auth/me.php',
    'handleUsersAuthenticatedProfileRoute',
    'Auth me endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/comments.php',
    'handleUsersCommentsRoute',
    'Users comments endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/notes.php',
    'handleUsersNotesRoute',
    'Users notes endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/answers.php',
    'handleUsersAnswersRoute',
    'Users answers endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/list.php',
    'handleUsersListRoute',
    'Users list endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/delete_note.php',
    'handleUsersDeleteNoteRoute',
    'Users delete note endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/delete.php',
    'handleUsersDeleteAccountRoute',
    'Users delete endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/list_cards.php',
    'handleUsersListCardsRoute',
    'Users list cards endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/remove_card.php',
    'handleUsersRemoveCardRoute',
    'Users remove card endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/set_default_card.php',
    'handleUsersSetDefaultCardRoute',
    'Users set default card endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/create_stripe_setup_intent.php',
    'handleUsersCreateStripeSetupIntentRoute',
    'Users setup intent endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/sync_stripe_card.php',
    'handleUsersSyncStripeCardRoute',
    'Users sync stripe card endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/api/users/save_card.php',
    'handleUsersSaveCardRoute',
    'Users save card endpoint must delegate to users module routes'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersProcessReferralRewardsCronRoute',
    'Users routes must expose the referral rewards cron handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersReferralStatsRoute',
    'Users routes must expose the referral stats handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersUploadPhotoRoute',
    'Users routes must expose the upload photo handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersChangePasswordRoute',
    'Users routes must expose the change password handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersAuthenticatedProfileRoute',
    'Users routes must expose the authenticated profile handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersUpdateProfileRoute',
    'Users routes must expose the update profile handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersCommentsRoute',
    'Users routes must expose the comments handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersNotesRoute',
    'Users routes must expose the notes handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersAnswersRoute',
    'Users routes must expose the answers handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersListRoute',
    'Users routes must expose the list handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersDeleteNoteRoute',
    'Users routes must expose the delete note handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersDeleteAccountRoute',
    'Users routes must expose the delete account handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersListCardsRoute',
    'Users routes must expose the list cards handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersRemoveCardRoute',
    'Users routes must expose the remove card handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersSetDefaultCardRoute',
    'Users routes must expose the set default card handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersCreateStripeSetupIntentRoute',
    'Users routes must expose the setup intent handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersSyncStripeCardRoute',
    'Users routes must expose the sync stripe card handler'
);

assertContainsUsersDelegate(
    $base . '/modules/users/routes.php',
    'function handleUsersSaveCardRoute',
    'Users routes must expose the save card handler'
);

fwrite(STDOUT, "Users module wiring assertions passed.\n");
