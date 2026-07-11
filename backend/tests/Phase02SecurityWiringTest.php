<?php

declare(strict_types=1);

function phase02SecurityAssertContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

try {
    $base = dirname(__DIR__);

    phase02SecurityAssertContains(
        $base . '/modules/questions/validators/QuestionsValidator.php',
        "'selected_option'",
        'Question answer validator must require only the selected option.'
    );
    phase02SecurityAssertContains(
        $base . '/modules/questions/services/QuestionsService.php',
        'new QuestionAnswerEvaluator',
        'Question answers must be evaluated from the canonical server record.'
    );
    phase02SecurityAssertContains(
        $base . '/modules/questions/services/QuestionsService.php',
        'bool $includeAnswerKey = false',
        'Public question normalization must default to hiding the answer key.'
    );
    phase02SecurityAssertContains(
        $base . '/modules/transactions/routes.php',
        'verifyAuthenticatedUserPayload(true)',
        'Transaction listing must require an authenticated user.'
    );
    phase02SecurityAssertContains(
        $base . '/scripts/importers/questions/gran/index.php',
        'http_response_code(410)',
        'The legacy Gran crawler entrypoint must remain retired.'
    );
    phase02SecurityAssertContains(
        $base . '/.htaccess',
        'RewriteRule ^scripts/ - [F,L,NC]',
        'Operational scripts must be denied at the web server boundary.'
    );

    fwrite(STDOUT, "Phase02SecurityWiringTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'Phase02SecurityWiringTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}
