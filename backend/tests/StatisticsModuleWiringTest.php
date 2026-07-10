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

function assertContainsStatisticsDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';

assertContainsStatisticsDelegate(
    $base . '/api/statistics/xray.php',
    'handleStatisticsXrayRoute',
    'Statistics xray endpoint must delegate to statistics module routes'
);

assertContainsStatisticsDelegate(
    $base . '/api/statistics/banca_info.php',
    'handleStatisticsBancaInfoRoute',
    'Statistics banca_info endpoint must delegate to statistics module routes'
);

assertContainsStatisticsDelegate(
    $base . '/api/statistics/user.php',
    'handleStatisticsUserRoute',
    'Statistics user endpoint must delegate to statistics module routes'
);

assertContainsStatisticsDelegate(
    $base . '/api/statistics/question.php',
    'handleStatisticsQuestionRoute',
    'Statistics question endpoint must delegate to statistics module routes'
);

assertContainsStatisticsDelegate(
    $base . '/api/statistics/platform.php',
    'handleStatisticsPlatformRoute',
    'Statistics platform endpoint must delegate to statistics module routes'
);

assertContainsStatisticsDelegate(
    $base . '/api/statistics/install.php',
    'handleStatisticsInstallRoute',
    'Statistics install endpoint must delegate to statistics module routes'
);

assertContainsStatisticsDelegate(
    $base . '/modules/statistics/routes.php',
    'function handleStatisticsXrayRoute',
    'Statistics routes must expose the xray handler'
);

assertContainsStatisticsDelegate(
    $base . '/modules/statistics/routes.php',
    'function handleStatisticsBancaInfoRoute',
    'Statistics routes must expose the banca info handler'
);

assertContainsStatisticsDelegate(
    $base . '/modules/statistics/routes.php',
    'function handleStatisticsUserRoute',
    'Statistics routes must expose the user handler'
);

assertContainsStatisticsDelegate(
    $base . '/modules/statistics/routes.php',
    'function handleStatisticsQuestionRoute',
    'Statistics routes must expose the question handler'
);

assertContainsStatisticsDelegate(
    $base . '/modules/statistics/routes.php',
    'function handleStatisticsPlatformRoute',
    'Statistics routes must expose the platform handler'
);

assertContainsStatisticsDelegate(
    $base . '/modules/statistics/routes.php',
    'function handleStatisticsInstallRoute',
    'Statistics routes must expose the install handler'
);

fwrite(STDOUT, "Statistics module wiring assertions passed.\n");
