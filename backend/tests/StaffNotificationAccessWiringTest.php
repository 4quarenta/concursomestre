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

function staffNotificationAssertContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        fwrite(STDERR, $message . ' [' . $path . ']' . PHP_EOL);
        exit(1);
    }
}

$base = dirname(__DIR__);
$helperPath = $base . '/config/notification_helper.php';
$repositoryPath = $base . '/modules/notifications/repositories/NotificationsRepository.php';

staffNotificationAssertContains(
    $helperPath,
    "WHERE role = 'admin'",
    'Financial notifications must be created only for administrators'
);

staffNotificationAssertContains(
    $repositoryPath,
    "if (\$userRole === 'staff')",
    'Notification listing must apply the staff visibility policy'
);

staffNotificationAssertContains(
    $repositoryPath,
    "category NOT IN ('finance', 'marketing', 'marketplace', 'settings', 'security', 'users')",
    'Staff must not receive notifications from admin-only modules'
);

fwrite(STDOUT, "StaffNotificationAccessWiringTest: PASS\n");
