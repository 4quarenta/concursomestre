<?php

declare(strict_types=1);

function bulkImportExamLinkAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$servicePath = dirname(__DIR__) . '/modules/questions/services/QuestionsService.php';
$service = file_get_contents($servicePath);
bulkImportExamLinkAssert(is_string($service), 'Servico de questoes indisponivel.');

foreach ([
    "\$question['provaId'] = \$examId;",
    "\$question['prova_id'] = \$examId;",
    'syncPrimaryQuestionProva(',
    'listQuestionProvasByIds($createdQuestionIds)',
    'A importacao nao conseguiu vincular todas as questoes a prova canonica.',
    "\$createdQuestionProvas[(string) \$questionId] ?? []",
] as $needle) {
    bulkImportExamLinkAssert(
        str_contains($service, $needle),
        "Garantia de vinculo prova-questao ausente: {$needle}"
    );
}

echo "QuestionBulkImportExamLinkWiringTest: PASS\n";
