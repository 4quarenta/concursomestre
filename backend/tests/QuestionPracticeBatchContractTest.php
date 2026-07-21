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

function practiceBatchRead(string $relativePath): string
{
    $contents = file_get_contents(__DIR__ . '/../' . $relativePath);
    if (!is_string($contents)) {
        throw new RuntimeException('Arquivo nao encontrado: ' . $relativePath);
    }
    return $contents;
}

function practiceBatchAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    $validator = practiceBatchRead('modules/questions/validators/QuestionsValidator.php');
    $service = practiceBatchRead('modules/questions/services/QuestionsService.php');
    $repository = practiceBatchRead('modules/questions/repositories/QuestionsRepository.php');
    $canonicalRepository = practiceBatchRead('modules/questions/repositories/QuestionCanonicalRepository.php');

    practiceBatchAssert(
        str_contains($validator, "['list', 'practice']"),
        'O escopo publico de pratica nao e validado.'
    );
    practiceBatchAssert(
        str_contains($service, 'listQuestionContractRowsByIds($ids)')
        && str_contains($service, 'loadCanonicalAggregatesForRead($ids)')
        && str_contains($service, 'listQuestionProvasByIds($ids)')
        && str_contains($service, 'listQuestionCommentCounts($ids)'),
        'O DTO de pratica nao carrega conteudo em lote.'
    );
    practiceBatchAssert(
        str_contains($service, "'examSummary' => array_map")
        && str_contains($service, "'engagement' => [")
        && str_contains($service, "'commentsCount' => max(0, \$commentsCount)"),
        'O DTO de pratica nao preserva prova e engajamento do card.'
    );
    practiceBatchAssert(
        str_contains($service, "false,\n                    \$canViewTeacherComments,\n                    \$canViewDetailedAnalysis"),
        'O DTO de pratica deve ocultar o gabarito e aplicar separadamente os entitlements editoriais.'
    );
    practiceBatchAssert(
        str_contains($repository, 'public function listQuestionContractRowsByIds'),
        'As linhas base ainda dependem de uma consulta por questao.'
    );
    practiceBatchAssert(
        str_contains($canonicalRepository, 'public function loadQuestionAggregates'),
        'Alternativas e contextos ainda dependem de N+1.'
    );

    fwrite(STDOUT, "QuestionPracticeBatchContractTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'QuestionPracticeBatchContractTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}
