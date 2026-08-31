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

function assertContains(string $needle, string $path): void
{
    $contents = file_get_contents($path);
    if ($contents === false || strpos($contents, $needle) === false) {
        fwrite(STDERR, "Assertion failed: expected '{$needle}' in {$path}" . PHP_EOL);
        exit(1);
    }
}

assertContains('/shared/utils/Mailer.php', __DIR__ . '/../api/utils/Mailer.php');
assertContains('/shared/security/Recaptcha.php', __DIR__ . '/../api/utils/recaptcha_helper.php');
assertContains('/shared/security/Validator.php', __DIR__ . '/../api/utils/Validator.php');
assertContains('/shared/security/SQLSecurity.php', __DIR__ . '/../api/utils/SQLSecurity.php');
assertContains('/shared/utils/SimpleCache.php', __DIR__ . '/../api/utils/SimpleCache.php');
assertContains('/shared/utils/cache_helpers.php', __DIR__ . '/../api/utils/cache_helpers.php');
assertContains('/shared/utils/Mailer.php', __DIR__ . '/../modules/auth/services/AuthService.php');
assertContains('/shared/security/Recaptcha.php', __DIR__ . '/../modules/auth/routes.php');
assertContains('/shared/utils/Mailer.php', __DIR__ . '/../modules/subscriptions/services/SubscriptionsService.php');
assertContains('/shared/security/Recaptcha.php', __DIR__ . '/../modules/users/routes.php');
assertContains('/shared/utils/Mailer.php', __DIR__ . '/../modules/admin/services/AdminUserCommunicationService.php');
assertContains('/shared/utils/SimpleCache.php', __DIR__ . '/../modules/questions/routes.php');
assertContains('/shared/utils/SimpleCache.php', __DIR__ . '/../modules/statistics/routes.php');

fwrite(STDOUT, 'Shared utils/security wiring test passed.' . PHP_EOL);
