<?php

declare(strict_types=1);

function importedPublicationStatusAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$base = dirname(__DIR__);
$service = file_get_contents($base . '/modules/questions/services/QuestionsService.php');
$repository = file_get_contents($base . '/modules/questions/repositories/QuestionsRepository.php');

foreach ([$service, $repository] as $source) {
    importedPublicationStatusAssert(is_string($source), 'Arquivo obrigatorio da publicacao importada indisponivel.');
}

foreach ([
    [$service, 'forceImportedQuestionPublication($question)'],
    [$service, "'status' => 'published'"],
    [$service, "'visibility' => 'public'"],
    [$service, "'status_editorial' => \$publicationStatus"],
    [$repository, 'status_editorial = :status_editorial'],
    [$repository, 'visibility_status = :visibility_status'],
    [$repository, 'updateImportedExamPublication'],
    [$repository, 'status_editorial,'],
] as [$source, $needle]) {
    importedPublicationStatusAssert(
        str_contains($source, $needle),
        "Protecao de publicacao importada ausente: {$needle}"
    );
}

echo "ImportedPublicationStatusWiringTest: PASS\n";
