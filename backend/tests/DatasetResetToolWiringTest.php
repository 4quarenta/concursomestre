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

function resetToolAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$path = __DIR__ . '/../scripts/data/reset_definitive_dataset.php';
$script = (string) file_get_contents($path);
$policy = (string) file_get_contents(__DIR__ . '/../scripts/data/DatasetResetPolicyV2.php');
foreach ([
    "['execute' => false, 'validate-freeze-evidence-only' => false]",
    "DB_READ_HOST",
    "DB_READ_NAME",
    "DB_READ_USER",
    "DB_READ_PASSWORD",
    "--execute",
    "--validate-freeze-evidence-only",
    "operation-token",
    "confirm-database",
    "target-kind",
    "guard-file",
    "manifest",
    "freeze-evidence",
    "freeze-state",
    "freeze-run-id",
    "DATASET_RESET_FREEZE_EVIDENCE_KEY",
    "DatasetWriterFreezeEvidence",
    "DatasetWriterFreezeReporter::inventoryHash",
    "DatasetWriterFreezeEvidence::hostFingerprint",
    "DatasetWriterSystemdFreezePolicy::bootId",
    "DatasetWriterSystemdFreezePolicy::systemdVersion",
    "DatasetWriterSystemdFreezePolicy::VERSION",
    "DatasetWriterSystemdFreezePolicy::validateRuntimeSuppression",
    "SIGNED_FREEZE_STATE_HASH_MISMATCH",
    "beginTransaction",
    "rollBack",
    "PostResetResidueReporter",
    "evaluateResetCompletion",
    "resetCompletionGate",
    "StaticSitemapArtifactState",
    "RESET_POLICY_V2_COMMITTED",
    "sitemapArtifactWithdrawn",
] as $required) {
    resetToolAssert(str_contains($script, $required), 'Reset tool guard missing: ' . $required);
}
resetToolAssert(str_contains($policy, 'approvedForExecution'), 'Execution approval guard is missing from the policy evaluator.');
resetToolAssert(str_contains($script, "'writeStatementsExecuted' => 0"), 'Dry-run must report zero writes.');
resetToolAssert(str_contains($script, "'mode' => 'validate-freeze-evidence-only'"), 'Freeze-evidence preflight mode must be explicit.');
resetToolAssert(str_contains($script, "'transactionStarted' => false"), 'Freeze-evidence preflight must report that no transaction started.');
resetToolAssert(str_contains($script, '$execute || $validateFreezeEvidenceOnly'), 'Freeze-evidence preflight must share execution guards without enabling writes.');
resetToolAssert(str_contains($script, 'if ($validateFreezeEvidenceOnly)'), 'Freeze-evidence preflight must exit before reset execution.');
resetToolAssert(str_contains($script, "'DELETE FROM '"), 'Guarded execution must use ordered DELETE.');
resetToolAssert(str_contains($script, "'expectedCounts'"), 'Expected counts must be verified before the first write.');
resetToolAssert(str_contains($script, 'PostResetResidueReporter'), 'Post-reset residue must be authoritative after cascading deletes.');
resetToolAssert(str_contains($script, 'evaluateResetCompletion'), 'Reset execution must use the completion gate, never the steady-state gate.');
resetToolAssert(str_contains($script, "'failed_after_commit'"), 'Post-commit audit failures must not be reported as pre-write refusals.');
resetToolAssert(str_contains($script, "'transactionCommitted' => \$transactionCommitted"), 'Failure diagnostics must expose transaction commit state.');
resetToolAssert(!str_contains($script, "'committedWritesAfterRefusal' => 0"), 'Failure diagnostics must not hardcode zero after a possible commit.');
resetToolAssert(!str_contains($script, 'freeze-ok'), 'Reset tool must never accept a manual freeze boolean.');
resetToolAssert(!str_contains($script, 'Delete count mismatch'), 'Per-table rowCount cannot be authoritative with self-referential cascades.');
foreach (['FOREIGN_KEY_CHECKS', 'TRUNCATE TABLE', 'DROP TABLE', 'ALTER TABLE'] as $forbidden) {
    resetToolAssert(!str_contains($script, $forbidden), 'Forbidden reset strategy present: ' . $forbidden);
}
resetToolAssert(!str_contains($script, "new Database('read')"), 'Reset tool must not use write-fallback Database read role.');

$command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($path);
$output = [];
$exitCode = 0;
exec($command . ' 2>&1', $output, $exitCode);
resetToolAssert($exitCode === 2, 'Default invocation without DB_READ must fail closed.');
$joined = implode("\n", $output);
resetToolAssert(str_contains($joined, 'DB_READ_HOST'), 'Default fail-closed reason must identify missing read configuration.');
resetToolAssert(str_contains($joined, 'writeStatementsExecutedBeforeRefusal'), 'Refusal must report write count.');

fwrite(STDOUT, "Definitive dataset reset tool wiring assertions passed.\n");
