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

function assertContainsText(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsText($base . '/api/admin/logs.php', 'handleAdminSystemLogsRoute($db);', 'Admin logs endpoint must delegate to the admin module');
assertContainsText($base . '/modules/admin/routes.php', 'AdminSystemLogPathResolver', 'Admin module must resolve the operational log outside the HTTP bridge');
assertContainsText($base . '/api/system/logs.php', "require_once __DIR__ . '/../admin/logs.php';", 'Legacy system/logs endpoint must bridge to admin/logs.php');

fwrite(STDOUT, "Admin logs endpoint wiring assertions passed.\n");
