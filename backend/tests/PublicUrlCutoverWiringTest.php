<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/seo/routes/PublicRouteBuilder.php';

function publicUrlCutoverAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    $builder = new PublicRouteBuilder();
    publicUrlCutoverAssert(
        $builder->questionsIndex(['questionId' => 42]) === '/questoes?questionId=42',
        'Builder PHP default nao emite a rota canonica de questoes.'
    );

    $backend = dirname(__DIR__);
    $publicLinkProducers = [
        'modules/comments/services/CommentsService.php',
        'modules/comments/repositories/CommentsRepository.php',
        'modules/admin/repositories/AdminCommentsModerationRepository.php',
        'modules/legal_commentary/services/LegalCommentaryService.php',
        'modules/questions/services/QuestionsService.php',
    ];

    foreach ($publicLinkProducers as $relativePath) {
        $source = (string) file_get_contents($backend . '/' . $relativePath);
        publicUrlCutoverAssert(
            str_contains($source, 'PublicRouteBuilder'),
            $relativePath . ' nao usa o PublicRouteBuilder.'
        );
        publicUrlCutoverAssert(
            !preg_match("~['\"]/(?:practice|questions)(?:[?/'\"]|$)|['\"]/question/|['\"]/blog/provas~", $source),
            $relativePath . ' ainda emite URL publica legada.'
        );
    }

    echo "PublicUrlCutoverWiringTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, "PublicUrlCutoverWiringTest: FAIL - " . $error->getMessage() . "\n");
    exit(1);
}
