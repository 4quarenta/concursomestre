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

function assertContainsReadinessSuite(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';
$script = $base . '/scripts/tasks/production_readiness_suite.php';

assertContainsReadinessSuite(
    $script,
    'READINESS_PROFILE',
    'Readiness suite must allow local/staging/production profiles'
);

assertContainsReadinessSuite(
    $script,
    'production_preflight.php',
    'Readiness suite must orchestrate the production preflight'
);

assertContainsReadinessSuite(
    $script,
    'production_smoke.php',
    'Readiness suite must orchestrate the production smoke'
);

assertContainsReadinessSuite(
    $script,
    'production_log_audit.php',
    'Readiness suite must orchestrate the log audit'
);

assertContainsReadinessSuite(
    $script,
    'backup_restore_rehearsal.php',
    'Readiness suite must orchestrate the backup restore rehearsal'
);

assertContainsReadinessSuite(
    $script,
    '--with-backup-rehearsal=true',
    'Readiness suite must document how to enable backup rehearsal in local runs'
);

assertContainsReadinessSuite(
    $script,
    'auth-required',
    'Readiness suite must propagate authenticated smoke requirements'
);

assertContainsReadinessSuite(
    $script,
    'admin-required',
    'Readiness suite must propagate admin smoke requirements'
);

assertContainsReadinessSuite(
    $script,
    'failed_required',
    'Readiness suite must distinguish required failures from optional failures'
);

assertContainsReadinessSuite(
    $script,
    'READINESS_REPORT_FILE',
    'Readiness suite must support writing a JSON report artifact for homologation evidence'
);

assertContainsReadinessSuite(
    $script,
    'report-file',
    'Readiness suite must expose the report artifact path through CLI'
);

echo "Production readiness suite wiring OK\n";
