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

function assertContainsNotificationsDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__);

assertContainsNotificationsDelegate(
    $base . '/api/notifications/list.php',
    'handleNotificationsListRoute',
    'Notifications list endpoint must delegate to notifications module routes'
);

assertContainsNotificationsDelegate(
    $base . '/api/notifications/mark-read.php',
    'handleNotificationsMarkReadRoute',
    'Notifications mark-read endpoint must delegate to notifications module routes'
);

assertContainsNotificationsDelegate(
    $base . '/api/notifications/mark_read.php',
    'handleNotificationsMarkReadRoute',
    'Notifications mark_read endpoint must delegate to notifications module routes'
);

assertContainsNotificationsDelegate(
    $base . '/api/notifications/mark-all-read.php',
    'handleNotificationsMarkAllReadRoute',
    'Notifications mark-all-read endpoint must delegate to notifications module routes'
);

assertContainsNotificationsDelegate(
    $base . '/api/notifications/mark_all_read.php',
    'handleNotificationsMarkAllReadRoute',
    'Notifications mark_all_read endpoint must delegate to notifications module routes'
);

assertContainsNotificationsDelegate(
    $base . '/api/notifications/delete.php',
    'handleNotificationsDeleteRoute',
    'Notifications delete endpoint must delegate to notifications module routes'
);

assertContainsNotificationsDelegate(
    $base . '/api/notifications/clear_all.php',
    'handleNotificationsClearAllRoute',
    'Notifications clear_all endpoint must delegate to notifications module routes'
);

assertContainsNotificationsDelegate(
    $base . '/api/notifications/clear.php',
    'handleNotificationsClearAllRoute',
    'Notifications clear endpoint must delegate to notifications module routes'
);

assertContainsNotificationsDelegate(
    $base . '/api/notifications/send.php',
    'handleNotificationsSendRoute',
    'Notifications send endpoint must delegate to notifications module routes'
);

assertContainsNotificationsDelegate(
    $base . '/modules/notifications/routes.php',
    'function handleNotificationsListRoute',
    'Notifications routes must expose the list handler'
);

assertContainsNotificationsDelegate(
    $base . '/modules/notifications/routes.php',
    'function handleNotificationsMarkReadRoute',
    'Notifications routes must expose the mark-read handler'
);

assertContainsNotificationsDelegate(
    $base . '/modules/notifications/routes.php',
    'function handleNotificationsMarkAllReadRoute',
    'Notifications routes must expose the mark-all-read handler'
);

assertContainsNotificationsDelegate(
    $base . '/modules/notifications/routes.php',
    'function handleNotificationsDeleteRoute',
    'Notifications routes must expose the delete handler'
);

assertContainsNotificationsDelegate(
    $base . '/modules/notifications/routes.php',
    'function handleNotificationsClearAllRoute',
    'Notifications routes must expose the clear-all handler'
);

assertContainsNotificationsDelegate(
    $base . '/modules/notifications/routes.php',
    'function handleNotificationsSendRoute',
    'Notifications routes must expose the send handler'
);

fwrite(STDOUT, "Notifications module wiring assertions passed.\n");
