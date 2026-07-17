<?php

declare(strict_types=1);

function assertPublicationOwnershipContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        fwrite(STDERR, $message . ' [' . $path . ']' . PHP_EOL);
        exit(1);
    }
}

$base = dirname(__DIR__) . '';
$questionsRoutes = $base . '/modules/questions/routes.php';
$questionsRepository = $base . '/modules/questions/repositories/QuestionsRepository.php';
$questionsService = $base . '/modules/questions/services/QuestionsService.php';
$legalRoutes = $base . '/modules/legal_commentary/routes.php';
$legalRepository = $base . '/modules/legal_commentary/repositories/LegalCommentaryRepository.php';

assertPublicationOwnershipContains(
    $questionsRoutes,
    "['admin', 'staff']",
    'Question admin routes must allow staff into admin publication flows'
);

foreach (['created_by_user_id', 'updated_by_user_id', 'published_by_user_id'] as $column) {
    assertPublicationOwnershipContains(
        $questionsRepository,
        $column,
        'Questions and imported exams must persist publication ownership columns'
    );
    assertPublicationOwnershipContains(
        $legalRepository,
        $column,
        'Legal commentary laws must persist publication ownership columns'
    );
}

assertPublicationOwnershipContains(
    $questionsService,
    'Staff so pode excluir questoes publicadas por ele.',
    'Staff must not delete questions published by other users'
);

assertPublicationOwnershipContains(
    $questionsService,
    'Staff so pode excluir contextos publicados por ele.',
    'Staff must not delete question contexts published by other users'
);

assertPublicationOwnershipContains(
    $legalRepository,
    'Staff so pode excluir leis criadas por ele.',
    'Staff must not delete legal commentary laws published by other users'
);

assertPublicationOwnershipContains(
    $legalRoutes,
    'Response::forbidden($e->getMessage())',
    'Legal commentary ownership denial must return HTTP forbidden'
);

fwrite(STDOUT, "Admin publication ownership wiring assertions passed.\n");
