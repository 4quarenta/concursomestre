<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$routes = file_get_contents($root . '/modules/ingestion/cm_batch_routes.php');
$service = file_get_contents($root . '/modules/ingestion/services/CmBatchImportService.php');
$adminPanel = file_get_contents($root . '/../src/app/admin/components/import/CmBatchZipImporter.tsx');
$migration = file_get_contents($root . '/database/migrations/20261025_010000_cm_batch_import.php');
$questionRepository = file_get_contents($root . '/modules/questions/repositories/QuestionsRepository.php');

foreach ([
    "verifyAuthenticatedUserPayload(false)",
    "\$role !== 'admin'",
    'assertValidCsrfToken(getCsrfTokenFromCookie(), getCsrfTokenFromRequest())',
    "RateLimiter::enforceProfile('upload'",
    "\$_FILES['archive']",
] as $needle) {
    if (!str_contains($routes, $needle)) {
        throw new RuntimeException('Missing protected route contract: ' . $needle);
    }
}
foreach ([
    'new CmBatchZipValidator()',
    'application/zip',
    'is_uploaded_file($temporaryPath)',
    "'canonicalWrites' => 0",
    "'questionWrites' => 0",
    "'pendingPublication' => (int) \$summary['questionCount']",
    'source_identity_parent_unresolved_or_mismatched',
    'same_verified_content_repeated_within_batch',
    'gran_external_id_content_conflict',
    'chmod($storedPath, 0600)',
] as $needle) {
    if (!str_contains($service, $needle)) {
        throw new RuntimeException('Missing safe preview contract: ' . $needle);
    }
}
foreach (['cm_batch_import_jobs', 'cm_batch_exam_source_identities', 'question_prova_source_identities', 'question_prova_answer_history', 'question_source_identities', 'uq_question_prova_exam_booklet_position'] as $table) {
    if (!str_contains($migration, $table)) {
        throw new RuntimeException('Missing additive CM Batch schema: ' . $table);
    }
}
if (!str_contains($questionRepository, "\$answerKey !== '' && \$answerCanBecomeActive ? \$answerKey : null")) {
    throw new RuntimeException('Unverified answer keys must not become active occurrence answers.');
}
if (preg_match('/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+questions\b/i', $migration) === 1) {
    throw new RuntimeException('CM Batch migration must not create a second canonical question table.');
}
if (preg_match('/\bCONSTRAINT\s+[a-z_]+\s+FOREIGN\s+KEY|\bREFERENCES\s+[a-z_]+\s*\(/i', $migration) === 1) {
    throw new RuntimeException('Temporary CM Batch migration must defer foreign keys until historical backfill is complete.');
}
if (str_contains($migration, 'uq_question_prova_source_question')) {
    throw new RuntimeException('Source position uniqueness already guards this identity; avoid the oversized redundant composite index.');
}
if (!str_contains($migration, 'INSERT IGNORE INTO question_source_identities')
    || str_contains($migration, 'ON DUPLICATE KEY UPDATE question_id')) {
    throw new RuntimeException('Legacy source identity backfill must be insert-only after conflict checks.');
}
foreach (['Apenas validar', 'Salvar prévia para revisão', 'nenhum item será publicado', 'admin/cm_batch.php'] as $needle) {
    if (!str_contains($adminPanel, $needle)) {
        throw new RuntimeException('Missing admin preview contract: ' . $needle);
    }
}

echo "CmBatchImportWiringTest: PASS\n";
