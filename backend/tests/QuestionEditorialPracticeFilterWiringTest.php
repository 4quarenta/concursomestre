<?php

declare(strict_types=1);

function editorialPracticeFilterRead(string $relativePath): string
{
    $content = file_get_contents(__DIR__ . '/../' . $relativePath);
    if (!is_string($content)) {
        throw new RuntimeException('Arquivo nao encontrado: ' . $relativePath);
    }
    return $content;
}

try {
    $repository = editorialPracticeFilterRead('modules/questions/repositories/QuestionsRepository.php');
    $service = editorialPracticeFilterRead('modules/questions/services/QuestionsService.php');
    $canonical = editorialPracticeFilterRead('modules/questions/repositories/QuestionCanonicalRepository.php');
    $validator = editorialPracticeFilterRead('modules/questions/validators/QuestionsValidator.php');
    $migration = editorialPracticeFilterRead('database/migrations/20260809_010000_question_editorial_filter_backfill.php');
    $repairMigration = editorialPracticeFilterRead('database/migrations/20260809_161000_repair_question_editorial_presence.php');

    if (!str_contains($repository, 'q.has_teacher_comment = 1') || !str_contains($repository, 'q.has_detailed_comment = 1')) {
        throw new RuntimeException('Os filtros publicos nao usam as flags indexadas de editoriais.');
    }
    if (!str_contains($service, "!empty(\$row['has_teacher_comment'])")
        || !str_contains($service, "!empty(\$row['has_detailed_comment'])")) {
        throw new RuntimeException('O DTO de listagem pode divergir do filtro indexado.');
    }
    if (!str_contains($canonical, 'normalizeEditorialEntries')
        || !str_contains($validator, 'normalizeCanonicalEditorialEntries')) {
        throw new RuntimeException('O contrato canonico nao materializa os editoriais antes de persistir.');
    }
    if (!str_contains($migration, 'question_editorials')
        || !str_contains($migration, 'editorialComments.teacherComment')
        || !str_contains($migration, 'editorialComments.detailedComment')) {
        throw new RuntimeException('Backfill nao cobre fontes canonicas e legadas de editoriais.');
    }
    if (!str_contains($repairMigration, 'question_editorials')
        || !str_contains($repairMigration, 'q.has_teacher_comment')
        || !str_contains($repairMigration, 'q.has_detailed_comment')) {
        throw new RuntimeException('Reparo idempotente das flags editoriais nao foi registrado.');
    }
    if (!str_contains($service, "'editorialAvailability' => \$editorialAvailability")
        || !str_contains($repository, "if (\$body === '')")) {
        throw new RuntimeException('DTO v2 nao preserva disponibilidade ou ainda deixa placeholder vazio ocultar editorial.');
    }
    if (!str_contains($service, 'preserveEditorialField')
        || !str_contains($service, "\$candidates[] = \$editorialValue")
        || !str_contains($canonical, 'loadQuestionEditorialBodies')) {
        throw new RuntimeException('Update parcial ainda pode substituir editorial real por placeholder vazio.');
    }

    fwrite(STDOUT, "QuestionEditorialPracticeFilterWiringTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'QuestionEditorialPracticeFilterWiringTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}
