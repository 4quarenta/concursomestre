<?php

declare(strict_types=1);

function assertQuestionsPhase04(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$root = dirname(__DIR__);

foreach ([
    'modules/questions/repositories/QuestionsRepository.php',
    'modules/exams/repositories/ExamsRepository.php',
] as $relativePath) {
    $contents = (string) file_get_contents($root . '/' . $relativePath);
    assertQuestionsPhase04(str_contains($contents, 'SchemaReadiness::assertTablesAndColumns'), $relativePath . ' deve validar schema por readiness.');
    foreach (['CREATE TABLE', 'ALTER TABLE', 'DROP TABLE'] as $ddl) {
        assertQuestionsPhase04(!str_contains($contents, $ddl), $relativePath . ' ainda contem DDL runtime: ' . $ddl);
    }
}

foreach ([
    'database/migrations/20260711_010000_questions_import_canonical.php',
    'database/migrations/20260711_010010_questions_exams_compatibility.php',
    'database/migrations/20260711_010020_question_import_identity_constraints.php',
    'modules/questions/repositories/QuestionCanonicalRepository.php',
    'modules/questions/services/PrivateQuestionIngestionService.php',
    'api/internal/questions/ingest.php',
    'scripts/workers/process_question_ingestion_jobs.php',
    '../tools/local-question-crawler/ingest_client.py',
] as $relativePath) {
    assertQuestionsPhase04(is_file($root . '/' . $relativePath), 'Artefato da fase 04 ausente: ' . $relativePath);
}

$service = (string) file_get_contents($root . '/modules/questions/services/QuestionsService.php');
assertQuestionsPhase04(str_contains($service, "schemaVersion'] ?? null) !== 'question-import.v2'"), 'Importacao em massa deve exigir question-import.v2.');
assertQuestionsPhase04(str_contains($service, "\$savepoint = 'question_import_'"), 'Importacao deve isolar falhas por item com savepoint.');
assertQuestionsPhase04(str_contains($service, 'recordExtractionItem'), 'Importacao deve registrar itens da extracao.');

$statsRepository = (string) file_get_contents($root . '/modules/questions/repositories/QuestionsRepository.php');
assertQuestionsPhase04(!str_contains($statsRepository, 'MAX(id) AS latest_id'), 'Estatisticas publicas devem usar todas as tentativas, nao apenas a ultima por aluno.');

fwrite(STDOUT, "Questions phase 04 wiring assertions passed.\n");
