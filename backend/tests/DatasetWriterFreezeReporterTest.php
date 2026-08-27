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

require_once __DIR__ . '/../scripts/data/DatasetWriterFreezeReporter.php';

$matrix = DatasetWriterFreezeReporter::matrix();
if (count($matrix) < 10) {
    throw new RuntimeException('Writer freeze matrix is incomplete.');
}
$writers = array_column($matrix, 'writer_id');
foreach (['http-auth-account', 'systemd-question-ingestion-consumers', 'manual-exam-import-extraction', 'cron-stripe-reconciliation', 'http-admin-editorial'] as $required) {
    if (!in_array($required, $writers, true)) {
        throw new RuntimeException('Required writer is missing: ' . $required);
    }
}
foreach ($matrix as $entry) {
    if (($entry['pause_required'] ?? false) && (($entry['pause_mechanism'] ?? '') === '' || ($entry['resume_mechanism'] ?? '') === '')) {
        throw new RuntimeException('Pause/resume contract is incomplete for ' . ($entry['writer_id'] ?? 'unknown'));
    }
    if (!in_array(($entry['classification'] ?? ''), ['MUST_FREEZE', 'SAFE_TO_CONTINUE', 'MUST_CONTINUE', 'NOT_A_WRITER'], true)) {
        throw new RuntimeException('Unknown writer classification: ' . ($entry['writer_id'] ?? 'unknown'));
    }
    if (($entry['must_freeze_during_reset'] ?? null) !== (($entry['classification'] ?? '') === 'MUST_FREEZE')) {
        throw new RuntimeException('Reset freeze semantics drifted for ' . ($entry['writer_id'] ?? 'unknown'));
    }
}

$byId = array_column($matrix, null, 'writer_id');
foreach (['http-auth-account', 'http-practice-user-activity'] as $writerId) {
    if (($byId[$writerId]['may_write_after_resume'] ?? false) !== true) {
        throw new RuntimeException('Known runtime writer is not marked MAY_WRITE_AFTER_RESUME: ' . $writerId);
    }
}
if (($byId['http-auth-account']['allowed_post_resume_events']['auth_sessions'] ?? []) === []) {
    throw new RuntimeException('Auth session post-resume event allowlist is missing.');
}
if (($byId['http-practice-user-activity']['allowed_post_resume_events']['user_statistics'] ?? []) !== ['statistics_lazy_bootstrap']) {
    throw new RuntimeException('Statistics post-resume event allowlist drifted.');
}
if (($byId['systemd-question-ingestion-consumers']['may_write_after_resume'] ?? true) !== false) {
    throw new RuntimeException('Unrelated writer was generalized into runtime recreation.');
}
$coverage = DatasetWriterFreezeReporter::tableCoverage();
foreach (DatasetResetPolicyV2::runtimeRecreatableManifest() as $table => $runtimePolicy) {
    $observedRuntimeWriters = array_values(array_diff(
        $coverage[$table] ?? [],
        ['manual-backfills-migrations-reset']
    ));
    $allowlistedWriters = array_keys($runtimePolicy['allowedWriters']);
    sort($observedRuntimeWriters);
    sort($allowlistedWriters);
    if ($observedRuntimeWriters !== $allowlistedWriters) {
        throw new RuntimeException('Runtime writer coverage is not fully allowlisted for ' . $table);
    }
}
if (DatasetWriterFreezeReporter::uncoveredTables() !== []) {
    throw new RuntimeException('Writer table coverage is incomplete: ' . implode(', ', DatasetWriterFreezeReporter::uncoveredTables()));
}
if (!preg_match('/^[a-f0-9]{64}$/', DatasetWriterFreezeReporter::inventoryHash())) {
    throw new RuntimeException('Writer inventory hash is invalid.');
}

fwrite(STDOUT, "Writer freeze matrix assertions passed.\n");
