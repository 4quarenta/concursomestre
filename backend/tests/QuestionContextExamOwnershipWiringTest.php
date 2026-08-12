<?php

declare(strict_types=1);

function contextExamOwnershipAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$backend = dirname(__DIR__);
$migration = (string) file_get_contents($backend . '/database/migrations/20260808_160000_question_context_exam_ownership.php');
$legacyResolution = (string) file_get_contents($backend . '/database/migrations/20260808_160100_resolve_legacy_question_group_exam_ownership.php');
$rollback = (string) file_get_contents($backend . '/database/rollbacks/20260808_160000_question_context_exam_ownership.sql');
$canonical = (string) file_get_contents($backend . '/modules/questions/repositories/QuestionCanonicalRepository.php');
$repository = (string) file_get_contents($backend . '/modules/questions/repositories/QuestionsRepository.php');
$service = (string) file_get_contents($backend . '/modules/questions/services/QuestionsService.php');
$validator = (string) file_get_contents($backend . '/modules/questions/validators/QuestionsValidator.php');

foreach (['question_contexts', 'questions_groups'] as $table) {
    contextExamOwnershipAssert(
        str_contains($migration, "'" . $table . "'")
        && str_contains($migration, 'prova_id INT NULL')
        && str_contains($rollback, 'ALTER TABLE ' . $table . ' DROP COLUMN prova_id'),
        'Migration/rollback do vinculo de prova esta incompleto para ' . $table . '.'
    );
}
contextExamOwnershipAssert(
    str_contains($migration, 'COUNT(DISTINCT q.prova_id) = 1')
    && str_contains($migration, "CONCAT('legacy_group_', g.id)")
    && str_contains($legacyResolution, 'MD5(TRIM(c.body)) = MD5(TRIM(COALESCE(legacy.texto, legacy.enunciado, \'\')))')
    && str_contains($legacyResolution, 'HAVING COUNT(DISTINCT c.prova_id) = 1')
    && str_contains($migration, 'fk_question_contexts_prova')
    && str_contains($migration, 'fk_question_groups_prova'),
    'Backfill/FKs precisam impedir contexto ambiguo ou solto.'
);
contextExamOwnershipAssert(
    str_contains($canonical, 'Todo contexto de questoes precisa estar vinculado a uma prova.')
    && str_contains($canonical, "'provaId' =>"),
    'Repositorio canonico precisa receber provaId.'
);
contextExamOwnershipAssert(
    str_contains($repository, 'resolveQuestionGroupProvaId')
    && str_contains($repository, 'As questoes vinculadas ao contexto devem pertencer a uma unica prova.')
    && str_contains($repository, 'g.prova_id')
    && str_contains($repository, 'p.nome AS prova_title'),
    'Repositorio legado precisa validar e listar a prova do contexto.'
);
contextExamOwnershipAssert(
    str_contains($service, "\$contextData['prova_id'] = \$examId")
    && str_contains($service, "\$canonicalContext['provaId'] = \$examId")
    && str_contains($service, 'resolveQuestionGroupProvaId'),
    'Importacao e editor manual devem persistir contexto com prova canonica.'
);
contextExamOwnershipAssert(
    str_contains($validator, "'prova_id' => is_numeric"),
    'Validador precisa aceitar somente IDs numericos de prova.'
);

fwrite(STDOUT, "QuestionContextExamOwnershipWiringTest: PASS\n");
