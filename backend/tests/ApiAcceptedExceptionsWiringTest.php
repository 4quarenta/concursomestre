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

function assertExactPhpFiles(string $directory, array $expectedFiles, string $message): void
{
    $files = glob($directory . '/*.php');
    if ($files === false) {
        throw new RuntimeException('Não foi possível listar o diretorio: ' . $directory);
    }

    $actual = array_map('basename', $files);
    sort($actual);
    sort($expectedFiles);

    if ($actual !== $expectedFiles) {
        throw new RuntimeException(
            $message . ' ' . json_encode(
                ['expected' => $expectedFiles, 'actual' => $actual],
                JSON_UNESCAPED_UNICODE
            )
        );
    }
}

function assertFileContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';

assertExactPhpFiles(
    $base . '/api/cache',
    ['manage.php'],
    'api/cache deve conter apenas o bridge legado oficialmente aceito.'
);

assertExactPhpFiles(
    $base . '/api/middleware',
    ['Auth.php', 'RateLimiter.php', 'Security.php'],
    'api/middleware deve conter apenas bridges residuais para shared/middleware.'
);

assertExactPhpFiles(
    $base . '/api/system',
    ['logs.php'],
    'api/system deve conter apenas o bridge legado oficialmente aceito.'
);

assertExactPhpFiles(
    $base . '/api/tasks',
    ['ProcessRewards.php'],
    'api/tasks deve conter apenas o cron bridge oficialmente aceito.'
);

assertExactPhpFiles(
    $base . '/api/utils',
    [
        'AdminSecurity.php',
        'AuthConfig.php',
        'AuthCookies.php',
        'AuthLogger.php',
        'AuthSession.php',
        'cache_helpers.php',
        'GoogleAuthenticator.php',
        'JWTAuth.php',
        'Mailer.php',
        'payment_refund_helper.php',
        'recaptcha_helper.php',
        'request_auth.php',
        'Response.php',
        'SimpleCache.php',
        'SQLSecurity.php',
        'Validator.php',
    ],
    'api/utils deve conter apenas bridges residuais para shared/modules.'
);

assertFileContains(
    $base . '/api/cache/manage.php',
    "require_once __DIR__ . '/../admin/cache.php';",
    'api/cache/manage.php deve delegar para o endpoint oficial de cache admin.'
);

assertFileContains(
    $base . '/api/middleware/Auth.php',
    "/../../shared/middleware/AuthMiddleware.php",
    'api/middleware/Auth.php deve delegar para o middleware oficial compartilhado.'
);

assertFileContains(
    $base . '/api/middleware/RateLimiter.php',
    "/../../shared/middleware/RateLimiter.php",
    'api/middleware/RateLimiter.php deve delegar para o middleware oficial compartilhado.'
);

assertFileContains(
    $base . '/api/middleware/Security.php',
    "/../../shared/middleware/SecurityMiddleware.php",
    'api/middleware/Security.php deve delegar para o middleware oficial compartilhado.'
);

assertFileContains(
    $base . '/api/system/logs.php',
    "require_once __DIR__ . '/../admin/logs.php';",
    'api/system/logs.php deve delegar para o endpoint oficial de logs admin.'
);

assertFileContains(
    $base . '/api/tasks/ProcessRewards.php',
    'handleUsersProcessReferralRewardsCronRoute($db);',
    'api/tasks/ProcessRewards.php deve delegar para o handler oficial do modulo users.'
);

fwrite(STDOUT, "API accepted exceptions wiring assertions passed.\n");
