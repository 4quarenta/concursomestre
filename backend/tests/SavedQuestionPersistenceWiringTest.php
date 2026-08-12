<?php

declare(strict_types=1);

function savedQuestionAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function savedQuestionRead(string $relativePath): string
{
    $content = file_get_contents(__DIR__ . '/../' . $relativePath);
    if (!is_string($content)) {
        throw new RuntimeException('Arquivo nao encontrado: ' . $relativePath);
    }

    return $content;
}

try {
    $schema = savedQuestionRead('database/schema.sql');
    $validator = savedQuestionRead('modules/questions/validators/QuestionsValidator.php');
    $service = savedQuestionRead('modules/questions/services/QuestionsService.php');

    savedQuestionAssert(
        str_contains($schema, 'CREATE TABLE IF NOT EXISTS user_saved_questions')
        && str_contains($schema, 'PRIMARY KEY (user_id, question_id)'),
        'Questoes salvas nao possuem persistencia canonica e unicidade no banco.'
    );
    savedQuestionAssert(
        str_contains($validator, "['is_saved', 'isSaved', 'desired_state', 'desiredState']")
        && str_contains($validator, "'desiredSavedState' => \$desiredSavedState"),
        'O contrato nao aceita um estado desejado explicito.'
    );
    savedQuestionAssert(
        str_contains($service, "\$desiredSavedState = \$data['desiredSavedState'] ?? !\$currentlySaved")
        && str_contains($service, 'if (!$desiredSavedState)')
        && str_contains($service, 'if ($currentlySaved)'),
        'A mutacao de salvos ainda depende exclusivamente de toggle cego.'
    );
    savedQuestionAssert(
        str_contains($service, "!empty(\$data['filters']['onlySaved'])")
        && str_contains($service, "'total' => 0"),
        'O filtro de salvos sem usuario autenticado ainda pode retornar o catalogo publico.'
    );

    fwrite(STDOUT, "SavedQuestionPersistenceWiringTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'SavedQuestionPersistenceWiringTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}
