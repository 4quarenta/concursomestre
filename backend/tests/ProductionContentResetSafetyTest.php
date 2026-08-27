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

$scriptPath = __DIR__ . '/../scripts/tasks/reset_production_content.php';
$script = (string) file_get_contents($scriptPath);

function legacyResetAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

legacyResetAssert(str_contains($script, 'LEGACY_DATASET_RESET_DISABLED'), 'Legacy reset must be visibly disabled.');
legacyResetAssert(str_contains($script, 'exit(64)'), 'Legacy reset must fail closed with a non-zero exit.');
legacyResetAssert(str_contains($script, 'reset_definitive_dataset.php'), 'Legacy reset must point operators to RESET_POLICY_V2.');
foreach (['new Database', 'DELETE FROM', 'TRUNCATE', 'FOREIGN_KEY_CHECKS', 'CONTENT_RESET_ALLOWED'] as $forbidden) {
    legacyResetAssert(!str_contains($script, $forbidden), 'Legacy reset still contains executable reset behavior: ' . $forbidden);
}

$command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($scriptPath);
$output = [];
$exitCode = 0;
exec($command . ' 2>&1', $output, $exitCode);
legacyResetAssert($exitCode === 64, 'Legacy reset must refuse every CLI invocation.');
legacyResetAssert(str_contains(implode("\n", $output), 'LEGACY_DATASET_RESET_DISABLED'), 'Legacy refusal marker missing.');

fwrite(STDOUT, "Legacy production content reset is permanently fail-closed.\n");
