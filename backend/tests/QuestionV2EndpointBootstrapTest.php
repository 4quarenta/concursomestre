<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

function questionV2BootstrapAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    $endpoints = [
        'api/v2/questions/list.php',
        'api/v2/questions/show.php',
        'api/v2/questions/answer.php',
        'api/v2/admin/questions/show.php',
    ];

    foreach ($endpoints as $endpoint) {
        $content = file_get_contents(__DIR__ . '/../' . $endpoint);
        questionV2BootstrapAssert(is_string($content), 'Endpoint nao encontrado: ' . $endpoint);
        questionV2BootstrapAssert(
            str_contains($content, '$database = new Database();')
            && str_contains($content, '$db = $database->getConnection();'),
            'Endpoint v2 nao usa o bootstrap canonico de banco: ' . $endpoint
        );
        questionV2BootstrapAssert(
            !str_contains($content, 'getDatabaseConnection()'),
            'Endpoint v2 ainda chama helper inexistente: ' . $endpoint
        );
    }

    fwrite(STDOUT, "QuestionV2EndpointBootstrapTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'QuestionV2EndpointBootstrapTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}
