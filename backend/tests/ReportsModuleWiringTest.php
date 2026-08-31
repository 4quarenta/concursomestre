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

function assertContainsReportsDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';

assertContainsReportsDelegate(
    $base . '/api/reports/handle.php',
    'handleReportsCreateRoute',
    'Reports create endpoint must delegate to reports module routes'
);

assertContainsReportsDelegate(
    $base . '/api/reports/list.php',
    'handleReportsListRoute',
    'Reports list endpoint must delegate to reports module routes'
);

assertContainsReportsDelegate(
    $base . '/modules/reports/routes.php',
    'function handleReportsCreateRoute',
    'Reports routes must expose the create handler'
);

assertContainsReportsDelegate(
    $base . '/modules/reports/routes.php',
    'function handleReportsListRoute',
    'Reports routes must expose the list handler'
);

assertContainsReportsDelegate(
    $base . '/modules/admin/services/AdminReportModerationService.php',
    'createNotification(',
    'Report moderation must notify the reporter after admin decision'
);

assertContainsReportsDelegate(
    $base . '/modules/admin/services/AdminReportModerationService.php',
    "'Denuncia aceita'",
    'Resolved report notification must have an accepted-report title'
);

assertContainsReportsDelegate(
    $base . '/modules/admin/services/AdminReportModerationService.php',
    "'report'",
    'Report moderation notification must use the report category'
);

fwrite(STDOUT, "Reports module wiring assertions passed.\n");
