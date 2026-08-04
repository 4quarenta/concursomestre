<?php

require_once __DIR__ . '/../modules/questions/services/QuestionsService.php';
require_once __DIR__ . '/../modules/questions/validators/QuestionsValidator.php';

function assertImportedContext(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$serviceReflection = new ReflectionClass(QuestionsService::class);
$service = $serviceReflection->newInstanceWithoutConstructor();
$resolveText = $serviceReflection->getMethod('resolveImportedContextText');
$scopeExternalId = $serviceReflection->getMethod('scopeImportedContextExternalId');

$canonicalBody = '<p>Texto compartilhado pelas questoes 1 e 2.</p>';
assertImportedContext(
    $resolveText->invoke($service, ['body' => $canonicalBody]) === $canonicalBody,
    'O importador deve ler o campo canonico contexts[].body.'
);

assertImportedContext(
    $resolveText->invoke($service, ['richText' => '<strong>Rico</strong>', 'body' => 'Plano']) === '<strong>Rico</strong>',
    'richText deve prevalecer em lotes legados quando estiver preenchido.'
);

$validator = new QuestionsValidator();
$imageOnlyContext = $validator->validateQuestionGroupPayload([
    'body' => '',
    'assets' => [[
        'id' => 'ctx_img_1',
        'url' => 'https://cdn.example.test/contexto.webp',
        'alt' => 'Grafico compartilhado.',
    ]],
]);
assertImportedContext(
    count($imageOnlyContext['assets']) === 1,
    'Um contexto visual sem texto deve continuar valido.'
);

$firstExamIdentity = $scopeExternalId->invoke($service, 101, '60434');
$secondExamIdentity = $scopeExternalId->invoke($service, 202, '60434');
assertImportedContext(
    $firstExamIdentity !== $secondExamIdentity,
    'O mesmo ID de grupo externo em provas diferentes nao pode colidir.'
);
assertImportedContext(
    strlen((string) $scopeExternalId->invoke($service, 101, str_repeat('x', 200))) <= 120,
    'A identidade externa escopada deve respeitar o limite do banco.'
);

$serviceSource = file_get_contents(__DIR__ . '/../modules/questions/services/QuestionsService.php');
assertImportedContext(
    is_string($serviceSource) && str_contains($serviceSource, 'referencia um contexto que nao existe neste lote'),
    'Referencias de contexto orfas devem produzir diagnostico explicito.'
);

fwrite(STDOUT, "Imported context contract assertions passed.\n");
