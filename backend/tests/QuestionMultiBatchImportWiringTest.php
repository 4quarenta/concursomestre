<?php

declare(strict_types=1);

function multiBatchImportAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$base = dirname(__DIR__);
$router = file_get_contents($base . '/router.php');
$routes = file_get_contents($base . '/modules/questions/routes.php');
$service = file_get_contents($base . '/modules/questions/services/QuestionsService.php');
$controller = file_get_contents($base . '/modules/questions/controllers/QuestionsController.php');

foreach ([$router, $routes, $service, $controller] as $source) multiBatchImportAssert(is_string($source), 'Arquivo de importacao em lote indisponivel.');
foreach ([
    [$router, "'questionsMultiBatchImport' => 'api/questions/multi_batch_import.php'"],
    [$routes, 'function handleQuestionsMultiBatchImportRoute'],
    [$routes, 'bulkImportQuestionBatches('],
    [$controller, 'public function bulkImportQuestionBatches'],
    [$service, 'public function bulkImportQuestionBatches'],
    [$service, "'batches' => \$results"],
    [$service, 'bulkImportQuestions($authenticatedUserId, $isAdmin, $batchPayload)'],
] as [$source, $needle]) multiBatchImportAssert(str_contains($source, $needle), "Contrato de lote unico ausente: {$needle}");

echo "QuestionMultiBatchImportWiringTest: PASS\n";
