<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/questions/services/QuestionsService.php';

function assertEditorialBody(array $payload, string $type, string $expected): void
{
    foreach ($payload['editorial'] ?? [] as $editorial) {
        if (is_array($editorial) && ($editorial['type'] ?? '') === $type) {
            if (($editorial['body'] ?? null) !== $expected) {
                throw new RuntimeException("Corpo inesperado para {$type}.");
            }
            return;
        }
    }

    throw new RuntimeException("Editorial {$type} nao foi materializado.");
}

try {
    $reflection = new ReflectionClass(QuestionsService::class);
    $service = $reflection->newInstanceWithoutConstructor();
    $method = $reflection->getMethod('preserveEditorialField');

    $generated = $method->invoke($service, [
        'teacherComment' => 'Comentario gerado e revisado.',
        'editorial' => [[
            'type' => 'teacher_comment',
            'body' => '',
            'status' => 'draft',
        ]],
    ], 'teacher_comment', 'teacherComment', ['teacher_comment'], '');
    assertEditorialBody($generated, 'teacher_comment', 'Comentario gerado e revisado.');

    $partial = $method->invoke($service, [
        'editorial' => [[
            'type' => 'detailed_analysis',
            'body' => '',
            'status' => 'draft',
        ]],
    ], 'detailed_analysis', 'detailedComment', ['detailed_comment'], 'Analise existente.');
    assertEditorialBody($partial, 'detailed_analysis', 'Analise existente.');

    $removed = $method->invoke($service, [
        'editorial' => [[
            'type' => 'teacher_comment',
            'body' => '',
            'remove' => true,
        ]],
    ], 'teacher_comment', 'teacherComment', ['teacher_comment'], 'Comentario existente.');
    assertEditorialBody($removed, 'teacher_comment', '');

    fwrite(STDOUT, "QuestionEditorialPersistenceTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'QuestionEditorialPersistenceTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}
