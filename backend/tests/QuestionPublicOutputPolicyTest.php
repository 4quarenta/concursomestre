<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/questions/services/QuestionOutputPolicy.php';

function assertQuestionOutputPolicy(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

/**
 * @param array<string, true> $forbiddenKeys
 */
function assertQuestionOutputPolicyHasNoForbiddenKeys(mixed $value, array $forbiddenKeys, string $path = '$'): void
{
    if (!is_array($value)) {
        return;
    }

    foreach ($value as $key => $item) {
        $itemPath = $path . '[' . (is_int($key) ? $key : "'{$key}'") . ']';
        if (is_string($key) && isset($forbiddenKeys[strtolower($key)])) {
            throw new RuntimeException('DTO publico vazou chave protegida em ' . $itemPath);
        }

        assertQuestionOutputPolicyHasNoForbiddenKeys($item, $forbiddenKeys, $itemPath);
    }
}

$policy = new QuestionOutputPolicy();
$fixture = [
    'id' => 42,
    'alternatives' => [
        ['tempId' => 'alt_a', 'label' => 'A', 'text' => 'Alternativa A'],
    ],
    'answer' => [
        'mode' => 'single',
        'raw' => 'A',
        'correctAlternativeTempIds' => ['alt_a'],
    ],
    'resposta' => 1,
    'correctOptionIndex' => 0,
    'resposta_correta_item_index' => 0,
    'teacherComment' => 'Comentario premium',
    'detailedComment' => 'Analise premium',
    'editorial' => [
        ['type' => 'teacher_comment', 'body' => 'Comentario premium'],
        ['type' => 'detailed_analysis', 'body' => 'Analise premium'],
    ],
    'questionEditorials' => [
        ['type' => 'teacher_comment', 'body' => 'Editorial legado'],
    ],
    'data_json' => json_encode([
        'answer' => ['correctAlternativeTempIds' => ['alt_a']],
        'teacherComment' => 'Comentario escondido no JSON bruto',
    ], JSON_THROW_ON_ERROR),
    'raw_json' => json_encode([
        'resposta' => 1,
        'detailedComment' => 'Analise escondida no JSON bruto',
    ], JSON_THROW_ON_ERROR),
    'nested' => [
        'answerCorrect' => true,
        'correctAlternativeId' => 'alt_a',
        'payload' => [
            'isCorrect' => true,
            'is_correct' => true,
            'teacherComment' => 'Comentario aninhado',
            'detailedComment' => 'Analise aninhada',
            'editorial' => [
                ['type' => 'teacher_comment', 'body' => 'Editorial aninhado'],
            ],
            'dataJson' => ['answer' => ['raw' => 'A']],
            'rawJson' => ['resposta_correta_item_index' => 0],
        ],
    ],
];

$public = $policy->forRead($fixture, false, false, false);
$publicJson = json_encode($public, JSON_THROW_ON_ERROR);
foreach (['answer', 'resposta', 'correct', 'correctOptionIndex', 'correctAlternativeId', 'correctAlternativeTempIds', 'resposta_correta_item_index', 'isCorrect', 'is_correct', 'teacherComment', 'detailedComment', 'editorial', 'questionEditorials', 'data_json', 'raw_json', 'Comentario premium', 'Analise premium', 'Comentario escondido no JSON bruto', 'Analise escondida no JSON bruto'] as $forbidden) {
    assertQuestionOutputPolicy(!str_contains($publicJson, $forbidden), 'DTO publico vazou campo protegido: ' . $forbidden);
}

$forbiddenKeys = array_fill_keys(array_map('strtolower', [
    'answer',
    'resposta',
    'correct',
    'answerCorrect',
    'correctOptionIndex',
    'correctAlternativeId',
    'correctAlternativeTempIds',
    'resposta_correta_item_index',
    'isCorrect',
    'is_correct',
    'teacherComment',
    'detailedComment',
    'editorial',
    'questionEditorials',
    'data_json',
    'raw_json',
    'dataJson',
    'rawJson',
]), true);
assertQuestionOutputPolicyHasNoForbiddenKeys($public, $forbiddenKeys);

$accessMatrix = [
    'anonimo' => [false, false, false, false],
    'gratuito' => [false, false, false, false],
    'assinante_sem_entitlement' => [false, false, false, false],
    'assinante_com_entitlement' => [false, true, true, false],
    'staff' => [true, true, true, true],
    'admin' => [true, true, true, true],
];

foreach ($accessMatrix as $viewer => [$includeAnswer, $teacherAllowed, $detailedAllowed, $expectsAnswer]) {
    $dto = $policy->forRead($fixture, $includeAnswer, $teacherAllowed, $detailedAllowed);
    assertQuestionOutputPolicy(isset($dto['answer']) === $expectsAnswer, $viewer . ': exposicao de gabarito incorreta.');
    assertQuestionOutputPolicy(isset($dto['teacherComment']) === $teacherAllowed, $viewer . ': acesso ao comentario do professor incorreto.');
    assertQuestionOutputPolicy(isset($dto['detailedComment']) === $detailedAllowed, $viewer . ': acesso a analise detalhada incorreto.');
    assertQuestionOutputPolicy(!isset($dto['data_json']) && !isset($dto['raw_json']), $viewer . ': JSON interno nao pode ser serializado.');
}

$teacherOnly = $policy->forRead($fixture, false, true, false);
assertQuestionOutputPolicy(count($teacherOnly['editorial'] ?? []) === 1, 'DTO premium parcial deve conter somente o editorial permitido.');
assertQuestionOutputPolicy(($teacherOnly['editorial'][0]['type'] ?? '') === 'teacher_comment', 'Editorial permitido incorreto.');

$admin = $policy->forRead($fixture, true, true, true);
assertQuestionOutputPolicy(($admin['answer']['correctAlternativeTempIds'] ?? []) === ['alt_a'], 'DTO administrativo deve manter o gabarito canonico.');
assertQuestionOutputPolicy(count($admin['editorial'] ?? []) === 2, 'DTO administrativo deve manter os editoriais permitidos.');

$servicePath = __DIR__ . '/../modules/questions/services/QuestionsService.php';
$serviceSource = file_get_contents($servicePath);
assertQuestionOutputPolicy(
    is_string($serviceSource) && str_contains($serviceSource, 'return $this->outputPolicy->forRead('),
    'DTO v2 deve passar pela politica de saida antes da serializacao publica.'
);

$routesSource = file_get_contents(__DIR__ . '/../modules/questions/routes.php');
assertQuestionOutputPolicy(
    is_string($routesSource) && str_contains($routesSource, "['admin', 'staff']"),
    'A autorizacao editorial deve reconhecer admin e staff no backend.'
);
assertQuestionOutputPolicy(
    is_string($routesSource) && str_contains($routesSource, 'userCanViewQuestionTeacherComment($db, $authenticatedUserId, $role)'),
    'A serializacao publica deve receber a decisao editorial calculada a partir do papel autenticado.'
);

fwrite(STDOUT, "QuestionPublicOutputPolicyTest: PASS\n");
