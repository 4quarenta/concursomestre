<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/questions/validators/QuestionsValidator.php';
require_once __DIR__ . '/../modules/questions/services/QuestionAnswerEvaluator.php';

function assertQuestionAnswerTrustBoundary(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assertQuestionAnswerPayloadRejected(QuestionsValidator $validator, array $payload, string $field): void
{
    try {
        $validator->validateAnswerPayload($payload);
    } catch (InvalidArgumentException $exception) {
        assertQuestionAnswerTrustBoundary(
            str_contains($exception->getMessage(), 'calculado exclusivamente pelo servidor'),
            'Campo ' . $field . ' deve falhar pela fronteira de veredito.'
        );
        return;
    }

    throw new RuntimeException('Campo de veredito aceito indevidamente: ' . $field);
}

$validator = new QuestionsValidator();
$valid = $validator->validateAnswerPayload([
    'question_id' => 42,
    'selected_option' => 1,
    'time_taken' => 12,
]);
assertQuestionAnswerTrustBoundary(
    array_keys($valid) === ['requestedUserId', 'questionId', 'selectedOption', 'timeTaken', 'simulationId'],
    'O payload normalizado de resposta deve conter somente dados operacionais.'
);

foreach ([
    'is_correct' => true,
    'isCorrect' => true,
    'correct' => true,
    'answerCorrect' => true,
    'correctOptionIndex' => 1,
    'correctAlternativeId' => 'alt_b',
    'correctAlternativeTempIds' => ['alt_b'],
    'resposta' => 2,
    'resposta_correta_item_index' => 1,
    'nested' => ['is_correct' => true],
] as $field => $value) {
    $payload = [
        'question_id' => 42,
        'selected_option' => 0,
        $field => $value,
    ];
    assertQuestionAnswerPayloadRejected($validator, $payload, $field);
}

$evaluator = new QuestionAnswerEvaluator();
$question = [
    'resposta_correta_item_index' => 1,
    'data_json' => json_encode([
        'itens' => [
            ['rotulo' => 'A', 'corpo' => 'Primeira'],
            ['rotulo' => 'B', 'corpo' => 'Segunda'],
        ],
    ], JSON_THROW_ON_ERROR),
];
$evaluation = $evaluator->evaluate($question, $valid['selectedOption']);
assertQuestionAnswerTrustBoundary($evaluation['isCorrect'] === true, 'A avaliacao deve usar o gabarito canônico persistido.');

$serviceSource = file_get_contents(__DIR__ . '/../modules/questions/services/QuestionsService.php');
assertQuestionAnswerTrustBoundary(
    is_string($serviceSource) && str_contains($serviceSource, "\$this->answerEvaluator->evaluate(\$question, \$data['selectedOption'])"),
    'QuestionsService deve calcular o resultado com a alternativa normalizada e a questão persistida.'
);
assertQuestionAnswerTrustBoundary(
    is_string($serviceSource) && str_contains($serviceSource, "'is_correct' => \$isCorrect ? 1 : 0"),
    'A persistencia de user_answers deve usar somente o resultado calculado pelo servidor.'
);
assertQuestionAnswerTrustBoundary(
    is_string($serviceSource)
        && str_contains($serviceSource, "'question.answer.recorded'")
        && str_contains($serviceSource, "'isCorrect' => \$isCorrect"),
    'O evento assincrono de XP e gamificacao deve receber somente o resultado calculado pelo servidor.'
);

$simulationsSource = file_get_contents(__DIR__ . '/../modules/simulations/services/SimulationsService.php');
assertQuestionAnswerTrustBoundary(
    is_string($simulationsSource) && str_contains($simulationsSource, "\$this->answerEvaluator->evaluate(\$question, (int) \$normalizedAnswer['selected_option_index'])"),
    'Simulados tambem devem calcular o resultado com o gabarito da questão persistida.'
);

fwrite(STDOUT, "QuestionAnswerPayloadTrustBoundaryTest: PASS\n");
