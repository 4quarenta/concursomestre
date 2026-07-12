<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/questions/services/QuestionOutputPolicy.php';

function assertQuestionOutputPolicy(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
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
];

$public = $policy->forRead($fixture, false, false, false);
$publicJson = json_encode($public, JSON_THROW_ON_ERROR);
foreach (['answer', 'resposta', 'correctOptionIndex', 'resposta_correta_item_index', 'correctAlternativeTempIds', 'teacherComment', 'detailedComment', 'Comentario premium', 'Analise premium'] as $forbidden) {
    assertQuestionOutputPolicy(!str_contains($publicJson, $forbidden), 'DTO publico vazou campo protegido: ' . $forbidden);
}

$teacherOnly = $policy->forRead($fixture, false, true, false);
assertQuestionOutputPolicy(isset($teacherOnly['teacherComment']), 'Entitlement de comentario do professor deve manter o comentario.');
assertQuestionOutputPolicy(!isset($teacherOnly['detailedComment']), 'Analise detalhada nao pode vazar sem entitlement.');
assertQuestionOutputPolicy(count($teacherOnly['editorial'] ?? []) === 1, 'DTO premium parcial deve conter somente o editorial permitido.');
assertQuestionOutputPolicy(($teacherOnly['editorial'][0]['type'] ?? '') === 'teacher_comment', 'Editorial permitido incorreto.');

$admin = $policy->forRead($fixture, true, true, true);
assertQuestionOutputPolicy(($admin['answer']['correctAlternativeTempIds'] ?? []) === ['alt_a'], 'DTO administrativo deve manter o gabarito canonico.');
assertQuestionOutputPolicy(count($admin['editorial'] ?? []) === 2, 'DTO administrativo deve manter os editoriais permitidos.');

fwrite(STDOUT, "QuestionPublicOutputPolicyTest: PASS\n");
