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

function assertBridge(string $path, string $handler): void
{
    $content = file_get_contents($path);
    if ($content === false) {
        throw new RuntimeException('Não foi possível ler ' . $path);
    }

    if (strpos($content, "require_once __DIR__ . '/../../modules/admin/routes.php';") === false) {
        throw new RuntimeException('Bridge admin sem dependencia do modulo oficial: ' . $path);
    }

    if (strpos($content, $handler) === false) {
        throw new RuntimeException('Bridge admin sem handler esperado ' . $handler . ': ' . $path);
    }
}

$base = dirname(__DIR__) . '/api/admin';

assertBridge($base . '/feedback.php', 'handleAdminFeedbackRoute($db);');
assertBridge($base . '/list_tables.php', 'handleAdminDatabaseTablesRoute($db);');
assertBridge($base . '/report_actions.php', 'handleAdminReportModerationRoute($db);');
assertBridge($base . '/reset_db.php', 'handleAdminDatabaseResetRoute($db);');
assertBridge($base . '/settings.php', 'handleAdminSettingsRoute($db);');
assertBridge($base . '/stats.php', 'handleAdminStatsRoute($db);');
assertBridge($base . '/user_actions.php', 'handleAdminUserActionsRoute($db);');
assertBridge($base . '/user_details.php', 'handleAdminUserDetailsRoute($db);');
assertBridge($base . '/cache.php', 'handleAdminCacheRoute($db);');
assertBridge($base . '/logs.php', 'handleAdminSystemLogsRoute($db);');

fwrite(STDOUT, "Admin legacy bridge wiring assertions passed.\n");
