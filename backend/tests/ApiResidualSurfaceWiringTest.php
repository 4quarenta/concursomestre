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

function assertContainsResidualSurface(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function assertApiRootFiles(array $expected): void
{
    $files = glob(dirname(__DIR__) . '/api/*');
    if ($files === false) {
        throw new RuntimeException('Não foi possível listar a raiz de api/.');
    }

    $actual = [];
    foreach ($files as $file) {
        if (is_file($file)) {
            $actual[] = basename($file);
        }
    }

    sort($actual);
    sort($expected);

    if ($actual !== $expected) {
        throw new RuntimeException('A raiz de api/ possui arquivos inesperados: ' . json_encode($actual, JSON_UNESCAPED_UNICODE));
    }
}

function assertNoOperationalArtifactsInApi(string $base): void
{
    $blockedExtensions = ['sql', 'log', 'txt', 'env', 'bak', 'backup', 'old', 'zip', 'rar', '7z', 'tar', 'gz'];
    $blockedNamePattern = '/(^|[._-])(dump|backup|debug|temp|tmp|trace|error-log|phpinfo)([._-]|$)/i';
    $blockedBasenames = ['check_schema.php', 'db_check.php', 'migrate_transactions.php'];

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($base . '/api', FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iterator as $fileInfo) {
        if (!$fileInfo->isFile()) {
            continue;
        }

        $extension = strtolower($fileInfo->getExtension());
        if (in_array($extension, $blockedExtensions, true)) {
            throw new RuntimeException('Artefato operacional não deve permanecer público em api/: ' . $fileInfo->getPathname());
        }

        if (in_array($fileInfo->getFilename(), $blockedBasenames, true)) {
            throw new RuntimeException('Script operacional legado não deve permanecer público em api/: ' . $fileInfo->getPathname());
        }
    }
}

$base = dirname(__DIR__) . '';

assertApiRootFiles([
    'settings.php',
    'upload.php',
]);

if (!is_file($base . '/api/.htaccess')) {
    throw new RuntimeException('api/.htaccess precisa permanecer na raiz pública da API.');
}

assertNoOperationalArtifactsInApi($base);

assertContainsResidualSurface(
    $base . '/api/settings.php',
    'handlePublicSettingsRoute($db);',
    'api/settings.php must stay as a legacy bridge to the public settings route'
);

assertContainsResidualSurface(
    $base . '/api/upload.php',
    'handleMaterialsUploadRoute($db);',
    'api/upload.php must stay as the legacy upload bridge to materials routes'
);

assertContainsResidualSurface(
    $base . '/api/cache/manage.php',
    "require_once __DIR__ . '/../admin/cache.php';",
    'api/cache/manage.php must delegate to the official admin cache endpoint'
);

assertContainsResidualSurface(
    $base . '/api/system/logs.php',
    "require_once __DIR__ . '/../admin/logs.php';",
    'api/system/logs.php must delegate to the official admin logs endpoint'
);

assertContainsResidualSurface(
    $base . '/api/tasks/ProcessRewards.php',
    'handleUsersProcessReferralRewardsCronRoute($db);',
    'api/tasks/ProcessRewards.php must delegate to the users module cron handler'
);

$expectedUtils = [
    'AdminSecurity.php' => "/../../shared/security/AdminSecurity.php",
    'AuthConfig.php' => "/../../shared/auth/AuthConfig.php",
    'AuthCookies.php' => "/../../shared/auth/AuthCookies.php",
    'AuthLogger.php' => "/../../shared/auth/AuthLogger.php",
    'AuthSession.php' => "/../../shared/auth/AuthSession.php",
    'cache_helpers.php' => "/../../shared/utils/cache_helpers.php",
    'GoogleAuthenticator.php' => "/../../shared/auth/GoogleAuthenticator.php",
    'JWTAuth.php' => "/../../shared/auth/JWTAuth.php",
    'Mailer.php' => "/../../shared/utils/Mailer.php",
    'payment_refund_helper.php' => "/../../modules/transactions/services/TransactionsRefundSupport.php",
    'recaptcha_helper.php' => "/../../shared/security/Recaptcha.php",
    'request_auth.php' => "/../../shared/auth/request_auth.php",
    'Response.php' => "/../../shared/responses/Response.php",
    'SimpleCache.php' => "/../../shared/utils/SimpleCache.php",
    'SQLSecurity.php' => "/../../shared/security/SQLSecurity.php",
    'Validator.php' => "/../../shared/security/Validator.php",
];

foreach ($expectedUtils as $fileName => $target) {
    assertContainsResidualSurface(
        $base . '/api/utils/' . $fileName,
        $target,
        'api/utils residual bridge must target the official shared/module implementation'
    );
}

fwrite(STDOUT, "API residual surface wiring assertions passed.\n");
