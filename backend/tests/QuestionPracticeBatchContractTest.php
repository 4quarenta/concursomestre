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
        && str_contains($service, 'loadCanonicalAggregatesForRead($ids)'),
        'O DTO de pratica nao carrega conteudo em lote.'
    );
    practiceBatchAssert(
        str_contains($service, "false,\n                    false"),
        'O DTO de pratica pode expor gabarito ou editoriais.'
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
