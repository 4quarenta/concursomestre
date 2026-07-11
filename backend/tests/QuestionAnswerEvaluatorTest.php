<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/questions/services/QuestionAnswerEvaluator.php';

function questionAnswerEvaluatorAssertSame(mixed $actual, mixed $expected, string $message): void
{
    if ($actual !== $expected) {
        throw new RuntimeException($message . ' Expected ' . var_export($expected, true) . ', got ' . var_export($actual, true) . '.');
    }
}

try {
    $evaluator = new QuestionAnswerEvaluator();
    $baseQuestion = [
        'resposta_correta_item_index' => 1,
        'data_json' => json_encode([
            'itens' => [
                ['id' => 10, 'rotulo' => 'A', 'corpo' => 'Primeira'],
                ['id' => 20, 'rotulo' => 'B', 'corpo' => 'Segunda'],
                ['id' => 30, 'rotulo' => 'C', 'corpo' => 'Terceira'],
            ],
        ]),
    ];

    $canonical = $evaluator->evaluate($baseQuestion, 1);
    questionAnswerEvaluatorAssertSame($canonical['isCorrect'], true, 'Server-side DB answer key must decide correctness.');
    questionAnswerEvaluatorAssertSame($canonical['correctOptionIndex'], 1, 'Stored zero-based answer index must be preserved.');

    $legacyOneBased = $evaluator->evaluate([
        'data_json' => json_encode([
            'resposta' => 2,
            'itens' => [
                ['id' => 10, 'rotulo' => 'A', 'corpo' => 'Primeira'],
                ['id' => 20, 'rotulo' => 'B', 'corpo' => 'Segunda'],
            ],
        ]),
    ], 1);
    questionAnswerEvaluatorAssertSame($legacyOneBased['isCorrect'], true, 'Legacy one-based resposta must not be treated as zero-based.');

    $legacyLabel = $evaluator->evaluate([
        'data_json' => json_encode([
            'resposta' => 'C',
            'itens' => [
                ['id' => 1, 'rotulo' => 'A', 'corpo' => 'Primeira'],
                ['id' => 2, 'rotulo' => 'B', 'corpo' => 'Segunda'],
                ['id' => 3, 'rotulo' => 'C', 'corpo' => 'Terceira'],
            ],
        ]),
    ], 2);
    questionAnswerEvaluatorAssertSame($legacyLabel['isCorrect'], true, 'Letter answer keys must resolve against canonical alternatives.');

    fwrite(STDOUT, "QuestionAnswerEvaluatorTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'QuestionAnswerEvaluatorTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}
