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

function assertContainsAiDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsAiDelegate(
    $base . '/api/ai/generate.php',
    'handleAiGenerateRoute',
    'AI generate endpoint must delegate to ai module routes'
);

assertContainsAiDelegate(
    $base . '/modules/ai/routes.php',
    'function handleAiGenerateRoute',
    'AI routes must expose the generate handler'
);

assertContainsAiDelegate(
    $base . '/modules/ai/validators/AiValidator.php',
    'requestTimeoutSeconds',
    'AI validator must accept bounded per-request timeout for long editorial generations'
);

assertContainsAiDelegate(
    $base . '/modules/ai/services/AiService.php',
    '@set_time_limit(max(120, $timeoutSeconds + 45))',
    'AI provider calls must reset PHP execution limit per network attempt'
);

assertContainsAiDelegate(
    $base . '/modules/ai/services/AiService.php',
    'curl_setopt($curl, CURLOPT_TIMEOUT, $timeoutSeconds)',
    'AI provider calls must use the resolved timeout instead of a fixed cURL timeout'
);

fwrite(STDOUT, "AI module wiring assertions passed.\n");
