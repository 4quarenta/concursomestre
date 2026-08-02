<?php

declare(strict_types=1);

function adminQuestionListRead(string $relativePath): string
{
    $content = file_get_contents(__DIR__ . '/../' . $relativePath);
    if (!is_string($content)) {
        throw new RuntimeException('Arquivo nao encontrado: ' . $relativePath);
    }
    return $content;
}

function adminQuestionListAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    $service = adminQuestionListRead('modules/questions/services/QuestionsService.php');
    $repository = adminQuestionListRead('modules/questions/repositories/QuestionsRepository.php');
    $canonicalRepository = adminQuestionListRead('modules/questions/repositories/QuestionCanonicalRepository.php');

    $filterStart = strpos($service, 'public function filterQuestions');
    $filterEnd = strpos($service, 'public function getQuestionStats', $filterStart ?: 0);
    $filterMethod = $filterStart !== false && $filterEnd !== false
        ? substr($service, $filterStart, $filterEnd - $filterStart)
        : '';
    adminQuestionListAssert(
        str_contains($filterMethod, 'normalizeAdminQuestionListRows'),
        'A rota administrativa nao usa o DTO leve de listagem.'
    );
    adminQuestionListAssert(
        !str_contains($filterMethod, 'normalizeQuestionRows'),
        'A listagem administrativa ainda monta o agregado completo.'
    );

    $listStart = strpos($repository, 'public function listFilteredQuestionRows');
    $listEnd = strpos($repository, 'public function countFilteredQuestions', $listStart ?: 0);
    $listMethod = $listStart !== false && $listEnd !== false
        ? substr($repository, $listStart, $listEnd - $listStart)
        : '';
    adminQuestionListAssert(!str_contains($listMethod, 'SELECT q.*'), 'A listagem ainda usa SELECT q.*.');
    adminQuestionListAssert(!str_contains($listMethod, 'GROUP_CONCAT'), 'A listagem ainda serializa filtros em subconsulta por linha.');
    adminQuestionListAssert(!str_contains($listMethod, 'data_json'), 'A listagem ainda carrega o snapshot JSON completo.');
    adminQuestionListAssert(!str_contains($listMethod, 'ensurePublicationColumns'), 'A leitura ainda inspeciona o schema a cada request.');

    $examStart = strpos($repository, 'public function listQuestionProvasByIds');
    $examEnd = strpos($repository, 'public function listLatestUserAnswersMap', $examStart ?: 0);
    $examMethod = $examStart !== false && $examEnd !== false
        ? substr($repository, $examStart, $examEnd - $examStart)
        : '';
    adminQuestionListAssert(
        !str_contains($examMethod, 'ensureImportedExamInfrastructure'),
        'O carregamento em lote de provas ainda inspeciona o schema no caminho de leitura.'
    );
    adminQuestionListAssert(
        str_contains($canonicalRepository, 'public function listQuestionEditorialFlags'),
        'A presenca de editoriais nao e carregada em lote.'
    );
    adminQuestionListAssert(
        str_contains($service, "'content' => [")
        && str_contains($service, "'publication' => [")
        && str_contains($service, "'editorial' => ["),
        'O DTO administrativo nao expoe os blocos canonicos esperados.'
    );

    fwrite(STDOUT, "AdminQuestionListContractTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'AdminQuestionListContractTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}
