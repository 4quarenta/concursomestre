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

function assertContainsAdminResetGuard(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$servicePath = dirname(__DIR__) . '/modules/admin/services/AdminDatabaseMaintenanceService.php';

assertContainsAdminResetGuard(
    $servicePath,
    'isProductionEnv()',
    'Database reset service must use APP_ENV as the authoritative production guard'
);

assertContainsAdminResetGuard(
    $servicePath,
    'ADMIN_DATABASE_RESET_ENABLED',
    'Database reset must be disabled by default in production'
);

assertContainsAdminResetGuard(
    $servicePath,
    'ADMIN_DATABASE_RESET_CONFIRMATION',
    'Database reset must require an operational confirmation token in production'
);

assertContainsAdminResetGuard(
    $servicePath,
    'hash_equals($expectedConfirmation, $providedConfirmation)',
    'Database reset confirmation must be compared using hash_equals'
);

fwrite(STDOUT, "Admin database reset production guard assertions passed.\n");
