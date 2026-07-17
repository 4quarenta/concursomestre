<?php

declare(strict_types=1);

function importTraceAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$base = dirname(__DIR__);
$repository = file_get_contents($base . '/modules/questions/repositories/QuestionsRepository.php');
$service = file_get_contents($base . '/modules/questions/services/QuestionsService.php');

importTraceAssert(is_string($repository), 'QuestionsRepository indisponivel.');
importTraceAssert(is_string($service), 'QuestionsService indisponivel.');

foreach ([
    'beginExamQuestionImportTrace',
    'attachExamQuestionImportTraceToExam',
    'recordExamQuestionImportTraceItem',
    'finishExamQuestionImportTrace',
    'INSERT INTO prova_extracoes',
    'INSERT INTO prova_extracao_itens',
    'createSavepoint',
    'rollbackToSavepoint',
    'releaseSavepoint',
] as $needle) {
    importTraceAssert(
        str_contains($repository, $needle),
        "Infraestrutura de rastreabilidade ausente: {$needle}"
    );
}

foreach ([
    'beginExamQuestionImportTrace',
    'recordExamQuestionImportTraceItem',
    'finishExamQuestionImportTrace',
    'createSavepoint($savepoint)',
    'rollbackToSavepoint($savepoint)',
    "'status' => 'created'",
    "'status' => 'duplicate'",
    "'status' => 'failed'",
    'buildSanitizedBulkImportDiagnostic',
    "'importTraceId' => \$importTraceId",
] as $needle) {
    importTraceAssert(
        str_contains($service, $needle),
        "Loop de importacao sem rastreabilidade esperada: {$needle}"
    );
}

$recordMethodStart = strpos($repository, 'public function recordExamQuestionImportTraceItem');
$recordMethodEnd = strpos($repository, 'public function finishExamQuestionImportTrace', $recordMethodStart ?: 0);
importTraceAssert($recordMethodStart !== false && $recordMethodEnd !== false, 'Metodo de item nao pode ser inspecionado.');
$recordMethod = substr($repository, $recordMethodStart, $recordMethodEnd - $recordMethodStart);

foreach (['enunciado', 'alternativas', 'teacherComment', 'detailedComment'] as $forbiddenField) {
    importTraceAssert(
        !str_contains($recordMethod, $forbiddenField),
        "Conteudo editorial proibido encontrado na trilha: {$forbiddenField}"
    );
}

foreach (["\$item['itens']", "\$item['items']", "\$item['statement']"] as $forbiddenPayloadAccess) {
    importTraceAssert(
        !str_contains($recordMethod, $forbiddenPayloadAccess),
        "Conteudo editorial proibido encontrado na trilha: {$forbiddenPayloadAccess}"
    );
}

echo "QuestionBulkImportTraceWiringTest: PASS\n";
