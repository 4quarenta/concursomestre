<?php

declare(strict_types=1);

function questionContextParameterBindingAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$path = dirname(__DIR__) . '/modules/questions/repositories/QuestionCanonicalRepository.php';
$source = file_get_contents($path);
questionContextParameterBindingAssert(is_string($source), 'Repositorio canonico de questoes indisponivel.');

questionContextParameterBindingAssert(
    str_contains($source, ':created_by_actor, :updated_by_actor'),
    'O INSERT de contexto deve usar placeholders distintos para autoria e atualizacao.'
);
questionContextParameterBindingAssert(
    str_contains($source, "':created_by_actor' =>")
        && str_contains($source, "':updated_by_actor' =>"),
    'Os dois placeholders do contexto precisam ser vinculados.'
);
questionContextParameterBindingAssert(
    str_contains($source, "unset(\$updateParams[':created_by_actor']);"),
    'A atualizacao de contexto nao pode encaminhar o placeholder exclusivo do INSERT.'
);
questionContextParameterBindingAssert(
    !str_contains($source, ':metadata_json, :actor, :actor'),
    'O INSERT de contexto ainda reutiliza um placeholder PDO, o que causa HY093.'
);

echo "QuestionContextParameterBindingTest: PASS\n";
