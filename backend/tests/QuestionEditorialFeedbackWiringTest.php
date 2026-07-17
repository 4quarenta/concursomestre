<?php

declare(strict_types=1);

function assertQuestionEditorialFeedback(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$root = dirname(__DIR__);
$bridge = (string) file_get_contents($root . '/api/questions/editorial-feedback.php');
$module = (string) file_get_contents($root . '/modules/questions/editorial_feedback_routes.php');
$migration = (string) file_get_contents(
    $root . '/database/migrations/20260716_020000_question_editorial_feedback.php'
);

assertQuestionEditorialFeedback(
    str_contains($bridge, 'handleQuestionEditorialFeedbackRoute($db)'),
    'O bridge de feedback editorial deve delegar para o modulo.'
);
assertQuestionEditorialFeedback(
    !str_contains($bridge, 'CREATE TABLE') && !str_contains($module, 'CREATE TABLE'),
    'Feedback editorial nao pode executar DDL durante a requisicao.'
);
assertQuestionEditorialFeedback(
    str_contains($migration, 'CREATE TABLE IF NOT EXISTS question_editorial_feedback'),
    'A tabela de feedback editorial deve ser criada por migration.'
);

fwrite(STDOUT, "Question editorial feedback wiring assertions passed.\n");
