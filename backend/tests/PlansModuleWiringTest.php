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

function assertContainsPlansDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsPlansDelegate(
    $base . '/api/plans/list.php',
    'handlePlansListRoute',
    'Legacy plans endpoint must delegate to plans module routes'
);

assertContainsPlansDelegate(
    $base . '/modules/plans/routes.php',
    'function handlePlansListRoute',
    'Plans routes must expose the public catalog handler'
);

assertContainsPlansDelegate(
    $base . '/modules/plans/services/PlansService.php',
    'private function isPublicCatalogPlan',
    'Public plans catalog must validate whether a plan can be displayed'
);

assertContainsPlansDelegate(
    $base . '/modules/plans/services/PlansService.php',
    'return $price > 0;',
    'Public plans catalog must not expose paid plans with zero price'
);

assertContainsPlansDelegate(
    $base . '/modules/admin/services/AdminSettingsService.php',
    'upsertChargeablePlanSafely',
    'Admin pricing sync must protect paid plans from zero-price publication'
);

assertContainsPlansDelegate(
    $base . '/modules/admin/repositories/AdminSettingsRepository.php',
    'deactivatePlanByName',
    'Admin settings repository must support deactivating unsafe zero-price paid plans'
);

fwrite(STDOUT, "Plans module wiring assertions passed.\n");
