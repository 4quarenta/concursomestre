<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/ingestion/providers/GranIngestionBoundary.php';

function granBoundaryAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$boundary = new GranIngestionBoundary();
$preview = $boundary->previewPayloads([
    [
        'schemaVersion' => 'question-import.v2',
        'questions' => [
            [
                'tempId' => 'gran_q_101',
                'source' => ['provider' => 'gran', 'externalId' => '101'],
                'content' => ['statement' => 'Questao sintetica 101'],
            ],
            [
                'tempId' => 'gran_q_102',
                'source' => ['provider' => 'gran', 'externalId' => '102'],
                'content' => ['statement' => 'Questao sintetica 102'],
            ],
        ],
    ],
], 'm20f05-boundary-run-000000000000000000000001');

granBoundaryAssert($preview['provider'] === 'gran', 'Provider Gran ausente no preview.');
granBoundaryAssert($preview['publicationGuard'] === 'REVIEW_REQUIRED', 'Preview nao pode liberar publicacao automatica.');
granBoundaryAssert($preview['metrics']['planned'] === 2, 'Itens validos devem ser planejados.');
granBoundaryAssert(count($preview['items']) === 2, 'Preview deve preservar os dois itens.');
granBoundaryAssert(
    !isset($preview['items'][0]['canonicalEntityId'])
    && !isset($preview['items'][0]['canonicalId']),
    'Preview nao pode aceitar ID canonico vindo do provider.'
);

$sameDuplicate = $boundary->previewPayloads([
    ['questions' => [
        ['source' => ['externalId' => 'same-1'], 'content' => ['statement' => 'Mesmo conteudo']],
        ['source' => ['externalId' => 'same-1'], 'content' => ['statement' => 'Mesmo conteudo']],
    ]],
], 'm20f05-boundary-run-000000000000000000000002');
granBoundaryAssert($sameDuplicate['metrics']['duplicates'] === 1, 'Replay da mesma identidade deve ser DUPLICATE.');
granBoundaryAssert($sameDuplicate['metrics']['reviewRequired'] === 0, 'Duplicata identica nao deve exigir revisao.');

$changedDuplicate = $boundary->previewPayloads([
    ['questions' => [
        ['source' => ['externalId' => 'changed-1'], 'content' => ['statement' => 'Versao um']],
        ['source' => ['externalId' => 'changed-1'], 'content' => ['statement' => 'Versao dois']],
    ]],
], 'm20f05-boundary-run-000000000000000000000003');
granBoundaryAssert($changedDuplicate['metrics']['reviewRequired'] === 1, 'Mudanca no mesmo ID externo deve exigir revisao.');
granBoundaryAssert(
    in_array('changed_duplicate_source_record', $changedDuplicate['items'][1]['reasonCodes'], true),
    'Motivo da mudanca de registro externo ausente.'
);

$invalid = $boundary->previewPayloads([
    ['questions' => [
        ['source' => ['externalId' => 'invalid-1'], 'content' => ['statement' => '']],
    ]],
], 'm20f05-boundary-run-000000000000000000000004');
granBoundaryAssert($invalid['metrics']['rejected'] === 1, 'Item sem conteudo deve ser rejeitado.');

$repeatA = $boundary->previewPayloads([
    ['questions' => [['source' => ['externalId' => 'det-1'], 'content' => ['statement' => 'Deterministico']]]],
], 'm20f05-boundary-run-000000000000000000000005');
$repeatB = $boundary->previewPayloads([
    ['questions' => [['source' => ['externalId' => 'det-1'], 'content' => ['statement' => 'Deterministico']]]],
], 'm20f05-boundary-run-000000000000000000000005');
granBoundaryAssert(
    $repeatA['items'][0]['idempotencyKey'] === $repeatB['items'][0]['idempotencyKey'],
    'A chave de idempotencia deve ser deterministica.'
);

fwrite(STDOUT, "GranIngestionBoundaryTest: PASS\n");
