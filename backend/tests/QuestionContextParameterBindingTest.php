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
questionContextParameterBindingAssert(
    str_contains($source, 'SELECT id, prova_id, source_provider, source_external_id FROM question_contexts')
        && str_contains($source, 'WHERE external_key = :external_key'),
    'A reconciliacao de contexto precisa conseguir recuperar registros legados pela external_key.'
);
questionContextParameterBindingAssert(
    str_contains($source, 'SET prova_id = :prova_id,')
        && str_contains($source, 'source_provider = :source_provider')
        && str_contains($source, 'source_external_id = :source_external_id'),
    'A reconciliacao de contexto precisa anexar a identidade externa sem recriar a linha canonica.'
);
questionContextParameterBindingAssert(
    str_contains($source, 'O contexto canonico ja possui outra identidade externa.'),
    'Identidades externas conflitantes devem ser rejeitadas explicitamente.'
);

echo "QuestionContextParameterBindingTest: PASS\n";
