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

require_once __DIR__ . '/env.php';
require_once __DIR__ . '/stripe.php';
require_once __DIR__ . '/../shared/utils/MailConfiguration.php';
require_once __DIR__ . '/../shared/utils/EmailTemplateResolver.php';

function runProductionPreflight(): array
{
    $checks = [];

    $required = [
        'APP_URL',
        'DB_HOST',
        'DB_NAME',
        'DB_USER',
        'DB_PASSWORD',
        'JWT_SECRET',
        'CRON_SECRET',
        'CORS_ALLOWED_ORIGINS',
        'GOOGLE_CLIENT_ID',
        'STRIPE_PUBLISHABLE_KEY',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
    ];

    foreach ($required as $key) {
        $value = getEnvString($key);
        $checks[] = [
            'key' => $key,
            'status' => $value !== '' ? 'pass' : 'fail',
            'message' => $value !== '' ? 'Configurado.' : 'Obrigatorio em producao.',
        ];
    }

    $appEnv = getAppEnv();
    $checks[] = [
        'key' => 'APP_ENV_PRODUCTION',
        'status' => $appEnv === 'production' ? 'pass' : 'fail',
        'message' => $appEnv === 'production' ? 'Ambiente de producao ativo.' : 'APP_ENV deve ser production no deploy publico.',
    ];

    $placeholderPatterns = [
        'change-this',
        'your-',
        'secret-here',
        'api-key-here',
    ];

    foreach (['JWT_SECRET', 'API_KEY', 'CRON_SECRET'] as $key) {
        $value = strtolower(getEnvString($key));
        $isPlaceholder = $value === '' || strlen($value) < 24;

        foreach ($placeholderPatterns as $pattern) {
            if (str_contains($value, $pattern)) {
                $isPlaceholder = true;
                break;
            }
        }

        $checks[] = [
            'key' => $key . '_STRENGTH',
            'status' => !$isPlaceholder ? 'pass' : 'fail',
            'message' => !$isPlaceholder ? 'Segredo parece forte.' : 'Use segredo longo, unico e sem placeholder.',
        ];
    }

    $appUrl = getEnvString('APP_URL');
    $checks[] = [
        'key' => 'APP_URL_HTTPS',
        'status' => str_starts_with($appUrl, 'https://') ? 'pass' : 'fail',
        'message' => str_starts_with($appUrl, 'https://') ? 'HTTPS configurado.' : 'APP_URL deve usar HTTPS em producao.',
    ];

    $appUrlHost = parse_url($appUrl, PHP_URL_HOST);
    $appUrlIsLocal = is_string($appUrlHost) && in_array(strtolower($appUrlHost), ['localhost', '127.0.0.1', '::1'], true);
    $checks[] = [
        'key' => 'APP_URL_NOT_LOCALHOST',
        'status' => is_string($appUrlHost) && $appUrlHost !== '' && !$appUrlIsLocal ? 'pass' : 'fail',
        'message' => is_string($appUrlHost) && $appUrlHost !== '' && !$appUrlIsLocal ? 'Dominio publico configurado.' : 'APP_URL nao pode apontar para localhost em producao.',
    ];

    $googleClientId = getEnvString('GOOGLE_CLIENT_ID');
    $googleClientIdValid = preg_match('/^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i', $googleClientId) === 1;
    $checks[] = [
        'key' => 'GOOGLE_CLIENT_ID_FORMAT',
        'status' => $googleClientIdValid ? 'pass' : 'fail',
        'message' => $googleClientIdValid ? 'Client ID Google valido.' : 'Use o Web Client ID real do Google Cloud.',
    ];

    $stripePublishableKey = getEnvString('STRIPE_PUBLISHABLE_KEY');
    $stripeSecretKey = getEnvString('STRIPE_SECRET_KEY');
    $stripeWebhookSecret = getEnvString('STRIPE_WEBHOOK_SECRET');
    $stripePublishableMode = resolveStripeKeyMode($stripePublishableKey);
    $stripeSecretMode = resolveStripeKeyMode($stripeSecretKey);

    $checks[] = [
        'key' => 'STRIPE_PUBLISHABLE_KEY_FORMAT',
        'status' => isValidStripePublishableKey($stripePublishableKey) ? 'pass' : 'fail',
        'message' => isValidStripePublishableKey($stripePublishableKey) ? 'Publishable key Stripe valida.' : 'Use chave publica Stripe real no formato pk_test_* ou pk_live_*.',
    ];

    $checks[] = [
        'key' => 'STRIPE_SECRET_KEY_FORMAT',
        'status' => isValidStripeSecretKey($stripeSecretKey) ? 'pass' : 'fail',
        'message' => isValidStripeSecretKey($stripeSecretKey) ? 'Secret key Stripe valida.' : 'Use secret key Stripe real no formato sk_test_* ou sk_live_*.',
    ];

    $checks[] = [
        'key' => 'STRIPE_WEBHOOK_SECRET_FORMAT',
        'status' => isValidStripeWebhookSecret($stripeWebhookSecret) ? 'pass' : 'fail',
        'message' => isValidStripeWebhookSecret($stripeWebhookSecret) ? 'Webhook secret Stripe valido.' : 'Use webhook secret real no formato whsec_*.',
    ];

    $stripeModesMatch = $stripePublishableMode !== ''
        && $stripeSecretMode !== ''
        && $stripePublishableMode === $stripeSecretMode;
    $checks[] = [
        'key' => 'STRIPE_KEY_MODE_MATCH',
        'status' => $stripeModesMatch ? 'pass' : 'fail',
        'message' => $stripeModesMatch ? 'Chaves Stripe usam o mesmo modo.' : 'Nao misture pk_test/sk_live ou pk_live/sk_test.',
    ];

    $checks[] = buildLegacyPaymentSdkPreflightCheck(
        getEnvString('PAYMENT_LEGACY_SDK_SCAN_ROOT', dirname(__DIR__))
    );

    $corsOrigins = array_values(array_filter(array_map('trim', explode(',', getEnvString('CORS_ALLOWED_ORIGINS')))));
    $hasLocalCors = false;
    $hasWildcardCors = false;
    $corsOriginsValid = count($corsOrigins) > 0;
    $corsOriginsHttps = count($corsOrigins) > 0;
    foreach ($corsOrigins as $origin) {
        $scheme = parse_url($origin, PHP_URL_SCHEME);
        $host = parse_url($origin, PHP_URL_HOST);
        if (!is_string($scheme) || !is_string($host) || $host === '' || !in_array(strtolower($scheme), ['http', 'https'], true)) {
            $corsOriginsValid = false;
        }

        if (strtolower((string) $scheme) !== 'https') {
            $corsOriginsHttps = false;
        }

        if (str_contains($origin, '*')) {
            $hasWildcardCors = true;
        }

        if (isLocalOrigin($origin)) {
            $hasLocalCors = true;
        }
    }
    $checks[] = [
        'key' => 'CORS_ORIGINS_VALID',
        'status' => $corsOriginsValid ? 'pass' : 'fail',
        'message' => $corsOriginsValid ? 'Origens CORS validas.' : 'Informe origens CORS absolutas e validas.',
    ];
    $checks[] = [
        'key' => 'CORS_ORIGINS_HTTPS',
        'status' => $corsOriginsHttps ? 'pass' : 'fail',
        'message' => $corsOriginsHttps ? 'Origens CORS usam HTTPS.' : 'CORS_ALLOWED_ORIGINS deve usar HTTPS em producao.',
    ];
    $checks[] = [
        'key' => 'CORS_NO_WILDCARD',
        'status' => !$hasWildcardCors ? 'pass' : 'fail',
        'message' => !$hasWildcardCors ? 'Sem wildcard em CORS.' : 'Nao use wildcard em CORS com credenciais.',
    ];
    $checks[] = [
        'key' => 'CORS_NO_LOCALHOST',
        'status' => !$hasLocalCors && count($corsOrigins) > 0 ? 'pass' : 'fail',
        'message' => !$hasLocalCors && count($corsOrigins) > 0 ? 'Sem origem local.' : 'Remova localhost/127.0.0.1 e informe dominio real.',
    ];

    $debugValue = strtolower(getEnvString('APP_DEBUG', 'false'));
    $checks[] = [
        'key' => 'APP_DEBUG_FALSE',
        'status' => in_array($debugValue, ['false', '0', 'no', 'off'], true) ? 'pass' : 'fail',
        'message' => in_array($debugValue, ['false', '0', 'no', 'off'], true) ? 'Debug desligado.' : 'APP_DEBUG deve ser false em producao.',
    ];

    $adminResetEnabled = in_array(strtolower(getEnvString('ADMIN_DATABASE_RESET_ENABLED', 'false')), ['1', 'true', 'yes', 'on'], true);
    $checks[] = [
        'key' => 'ADMIN_DATABASE_RESET_DISABLED',
        'status' => !$adminResetEnabled ? 'pass' : 'fail',
        'message' => !$adminResetEnabled ? 'Reset administrativo de banco desativado.' : 'ADMIN_DATABASE_RESET_ENABLED deve ficar false durante release/producao publica.',
    ];

    $dbUser = strtolower(getEnvString('DB_USER'));
    $checks[] = [
        'key' => 'DB_USER_NOT_ROOT',
        'status' => $dbUser !== '' && $dbUser !== 'root' ? 'pass' : 'fail',
        'message' => $dbUser !== '' && $dbUser !== 'root' ? 'Usuario de banco dedicado.' : 'Use usuario dedicado, sem root.',
    ];

    $dbPersistent = filter_var(getEnvString('DB_PERSISTENT', 'false'), FILTER_VALIDATE_BOOLEAN);
    $checks[] = [
        'key' => 'DB_PERSISTENT_DISABLED',
        'status' => !$dbPersistent ? 'pass' : 'fail',
        'message' => !$dbPersistent ? 'Conexoes persistentes desativadas.' : 'DB_PERSISTENT deve ser false para evitar acumulo de conexoes PHP/MySQL.',
    ];

    $dbTimeoutSeconds = (int) getEnvString('DB_TIMEOUT_SECONDS', '5');
    $dbTimeoutBounded = $dbTimeoutSeconds >= 1 && $dbTimeoutSeconds <= 10;
    $checks[] = [
        'key' => 'DB_TIMEOUT_BOUNDED',
        'status' => $dbTimeoutBounded ? 'pass' : 'fail',
        'message' => $dbTimeoutBounded ? 'Timeout de banco dentro da janela operacional.' : 'DB_TIMEOUT_SECONDS deve ficar entre 1 e 10 segundos em producao.',
    ];

    $securityHeadersPath = __DIR__ . '/security_headers.php';
    $securityHeadersContent = is_file($securityHeadersPath) ? (string) file_get_contents($securityHeadersPath) : '';
    $hasSecurityHeaders = str_contains($securityHeadersContent, 'Content-Security-Policy')
        && str_contains($securityHeadersContent, 'X-Frame-Options: DENY')
        && str_contains($securityHeadersContent, 'X-Content-Type-Options: nosniff');
    $checks[] = [
        'key' => 'SECURITY_HEADERS_CONFIGURED',
        'status' => $hasSecurityHeaders ? 'pass' : 'fail',
        'message' => $hasSecurityHeaders ? 'Headers de seguranca configurados.' : 'Configure CSP, X-Frame-Options e nosniff na API.',
    ];

    $rateLimitDir = getEnvString('RATE_LIMIT_DIR', dirname(__DIR__) . '/storage/runtime/rate_limits');
    if (!is_dir($rateLimitDir)) {
        @mkdir($rateLimitDir, 0775, true);
    }
    $checks[] = [
        'key' => 'RATE_LIMIT_RUNTIME_WRITABLE',
        'status' => is_dir($rateLimitDir) && is_writable($rateLimitDir) ? 'pass' : 'fail',
        'message' => is_dir($rateLimitDir) && is_writable($rateLimitDir) ? 'Runtime de rate limit gravavel.' : 'RATE_LIMIT_DIR precisa existir e ser gravavel.',
    ];

    $apiRoot = dirname(__DIR__) . '/api';
    $publicArtifacts = [];
    if (is_dir($apiRoot)) {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($apiRoot, FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $fileInfo) {
            if (!$fileInfo->isFile()) {
                continue;
            }

            $extension = strtolower($fileInfo->getExtension());
            $filename = strtolower($fileInfo->getFilename());
            $blockedExtensions = ['log', 'sql', 'txt', 'env', 'bak', 'backup', 'old', 'zip', 'rar', '7z', 'tar', 'gz'];
            $blockedNamePattern = '/(^|[._-])(dump|backup|debug|temp|tmp|trace|error-log|phpinfo)([._-]|$)/i';

            if (!in_array($extension, $blockedExtensions, true) && preg_match($blockedNamePattern, $filename) !== 1) {
                continue;
            }

            $publicArtifacts[] = str_replace('\\', '/', substr($fileInfo->getPathname(), strlen($apiRoot) + 1));
        }
    }
    $checks[] = [
        'key' => 'API_PUBLIC_ARTIFACTS_CLEAN',
        'status' => count($publicArtifacts) === 0 ? 'pass' : 'fail',
        'message' => count($publicArtifacts) === 0
            ? 'Sem logs/dumps/textos operacionais publicados em api/.'
            : 'Remova artefatos publicos em api/: ' . implode(', ', array_slice($publicArtifacts, 0, 5)),
    ];

    $backendRoot = dirname(__DIR__);
    $rootArtifacts = [];
    $blockedRootExtensions = ['log', 'sql', 'bak', 'backup', 'old', 'zip', 'rar', '7z', 'tar', 'gz'];
    foreach (new DirectoryIterator($backendRoot) as $fileInfo) {
        if (!$fileInfo->isFile()) {
            continue;
        }

        $extension = strtolower($fileInfo->getExtension());
        $filename = strtolower($fileInfo->getFilename());
        $isBlockedByExtension = in_array($extension, $blockedRootExtensions, true);
        $isBlockedByName = preg_match('/(^|[._-])(dump|backup|debug|temp|tmp|trace|error-log|phpinfo)([._-]|$)/i', $filename) === 1;

        if ($isBlockedByExtension || $isBlockedByName) {
            $rootArtifacts[] = $fileInfo->getFilename();
        }
    }
    $checks[] = [
        'key' => 'BACKEND_ROOT_ARTIFACTS_CLEAN',
        'status' => count($rootArtifacts) === 0 ? 'pass' : 'fail',
        'message' => count($rootArtifacts) === 0
            ? 'Sem backups/logs/dumps publicados na raiz do backend.'
            : 'Remova artefatos publicos na raiz do backend: ' . implode(', ', array_slice($rootArtifacts, 0, 5)),
    ];

    $checks[] = buildBackupDirectoryPreflightCheck(
        getEnvString('BACKUP_DIR'),
        $backendRoot,
        $appEnv === 'production'
    );
    $checks[] = buildBackupExecutablePreflightCheck(
        getEnvString('MYSQLDUMP_PATH', 'mysqldump'),
        'MYSQLDUMP_AVAILABLE',
        'mysqldump',
        $appEnv === 'production'
    );
    $checks[] = buildBackupExecutablePreflightCheck(
        getEnvString('MYSQL_PATH', 'mysql'),
        'MYSQL_RESTORE_CLIENT_AVAILABLE',
        'mysql',
        $appEnv === 'production'
    );
    $checks[] = buildLegacyCodeBackupsPreflightCheck($backendRoot);

    $scriptsRoot = $backendRoot . '/scripts';
    $devScriptArtifacts = [];
    foreach (['debug', 'manual-tests', 'setup', 'maintenance', 'seed', 'seeds'] as $devDir) {
        if (is_dir($scriptsRoot . '/' . $devDir)) {
            $devScriptArtifacts[] = 'scripts/' . $devDir . '/';
        }
    }

    $checksRoot = $scriptsRoot . '/checks';
    if (is_dir($checksRoot)) {
        foreach (new DirectoryIterator($checksRoot) as $fileInfo) {
            if (!$fileInfo->isFile()) {
                continue;
            }

            $filename = strtolower($fileInfo->getFilename());
            if (preg_match('/^(?:temp|tmp|debug|test)[._-].*\.php$/i', $filename) === 1) {
                $devScriptArtifacts[] = 'scripts/checks/' . $fileInfo->getFilename();
            }
        }
    }

    $migrationsRoot = $scriptsRoot . '/migrations';
    $allowedScriptMigrations = ['migrate_marketplace_schema_compatibility.php'];
    if (is_dir($migrationsRoot)) {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($migrationsRoot, FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $fileInfo) {
            if (!$fileInfo->isFile() || strtolower($fileInfo->getExtension()) !== 'php') {
                continue;
            }

            $relativePath = str_replace('\\', '/', substr($fileInfo->getPathname(), strlen($migrationsRoot) + 1));
            if (!in_array($relativePath, $allowedScriptMigrations, true)) {
                $devScriptArtifacts[] = 'scripts/migrations/' . $relativePath;
            }
        }
    }

    $checks[] = [
        'key' => 'BACKEND_DEV_SCRIPT_ARTIFACTS_CLEAN',
        'status' => count($devScriptArtifacts) === 0 ? 'pass' : 'fail',
        'message' => count($devScriptArtifacts) === 0
            ? 'Sem instaladores ou scripts manuais/debug na arvore publica.'
            : 'Mova artefatos de desenvolvimento para fora de htdocs: ' . implode(', ', array_slice($devScriptArtifacts, 0, 5)),
    ];

    $cronHealthPath = getEnvString(
        'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_PATH',
        dirname(__DIR__) . '/storage/logs/subscriptions/subscription_cron_health.json'
    );
    $cronHealthMaxAgeMinutes = max(5, (int) getEnvString('SUBSCRIPTIONS_STRIPE_CRON_HEALTH_MAX_AGE_MINUTES', '30'));
    $cronHealthCheck = buildStripeCronHealthPreflightCheck(
        $cronHealthPath,
        $cronHealthMaxAgeMinutes,
        $appEnv === 'production'
    );
    $checks[] = $cronHealthCheck;

    $mysqlBackupHealthPath = getEnvString(
        'MYSQL_BACKUP_HEALTH_PATH',
        dirname(__DIR__) . '/storage/logs/backups/mysql_backup_health.json'
    );
    $mysqlBackupHealthMaxAgeMinutes = max(60, (int) getEnvString('MYSQL_BACKUP_HEALTH_MAX_AGE_MINUTES', '1560'));
    $checks[] = buildMysqlBackupHealthPreflightCheck(
        $mysqlBackupHealthPath,
        $mysqlBackupHealthMaxAgeMinutes,
        $appEnv === 'production'
    );

    $logMaintenanceHealthPath = getEnvString(
        'LOG_MAINTENANCE_HEALTH_PATH',
        dirname(__DIR__) . '/storage/logs/operations/log_maintenance_health.json'
    );
    $logMaintenanceHealthMaxAgeMinutes = max(60, (int) getEnvString('LOG_MAINTENANCE_HEALTH_MAX_AGE_MINUTES', '1560'));
    $checks[] = buildLogMaintenanceHealthPreflightCheck(
        $logMaintenanceHealthPath,
        $logMaintenanceHealthMaxAgeMinutes,
        $appEnv === 'production'
    );

    $webhookHealthPath = getEnvString(
        'STRIPE_WEBHOOK_HEALTH_PATH',
        dirname(__DIR__) . '/storage/logs/subscriptions/stripe_webhook_health.json'
    );
    $webhookHealthMaxAgeMinutes = max(15, (int) getEnvString('STRIPE_WEBHOOK_HEALTH_MAX_AGE_MINUTES', '1440'));
    $checks[] = buildStripeWebhookHealthPreflightCheck(
        $webhookHealthPath,
        $webhookHealthMaxAgeMinutes,
        $appEnv === 'production'
    );

    $allowMailSettingsDatabase = !in_array(
        strtolower(getEnvString('MAIL_CONFIGURATION_ALLOW_DATABASE', 'true')),
        ['0', 'false', 'no', 'off'],
        true
    );
    $mailConfiguration = resolveMailConfiguration(null, $allowMailSettingsDatabase);
    $checks[] = buildMailTransportPreflightCheck($mailConfiguration, $appEnv === 'production');
    $checks[] = buildMailSenderPreflightCheck($mailConfiguration, $appEnv === 'production');
    $checks[] = buildEssentialEmailTemplatesPreflightCheck(
        getRequiredProductionEmailTemplateKeys(),
        $appEnv === 'production'
    );

    $failed = array_values(array_filter($checks, static fn (array $check): bool => $check['status'] !== 'pass'));

    return [
        'success' => count($failed) === 0,
        'environment' => getAppEnv(),
        'checked_at' => gmdate(DATE_ATOM),
        'checks' => $checks,
        'failed' => $failed,
    ];
}

function normalizeExistingPathForPreflight(string $path): string
{
    $realPath = realpath($path);
    if (!is_string($realPath) || $realPath === '') {
        return '';
    }

    return rtrim(str_replace('\\', '/', $realPath), '/');
}

function isPreflightPathInsideDirectory(string $path, string $directory): bool
{
    $path = normalizeExistingPathForPreflight($path);
    $directory = normalizeExistingPathForPreflight($directory);

    if ($path === '' || $directory === '') {
        return false;
    }

    $pathLower = strtolower($path);
    $directoryLower = strtolower($directory);

    return $pathLower === $directoryLower || str_starts_with($pathLower, $directoryLower . '/');
}

function buildBackupDirectoryPreflightCheck(string $backupDir, string $backendRoot, bool $required): array
{
    $backupDir = trim($backupDir);
    if ($backupDir === '') {
        return [
            'key' => 'BACKUP_DIR_OUTSIDE_PUBLIC_ROOT',
            'status' => $required ? 'fail' : 'pass',
            'message' => $required
                ? 'Configure BACKUP_DIR fora da raiz publica antes do deploy.'
                : 'BACKUP_DIR nao e obrigatorio fora de producao.',
        ];
    }

    $backupDirExists = is_dir($backupDir);
    $backupDirWritable = $backupDirExists && is_writable($backupDir);
    $insidePublicRoot = $backupDirExists && isPreflightPathInsideDirectory($backupDir, $backendRoot);
    $status = $backupDirExists && $backupDirWritable && !$insidePublicRoot;

    return [
        'key' => 'BACKUP_DIR_OUTSIDE_PUBLIC_ROOT',
        'status' => $status ? 'pass' : 'fail',
        'message' => $status
            ? 'Diretorio de backup existe, e gravavel e fica fora da raiz publica.'
            : 'BACKUP_DIR deve existir, ser gravavel e ficar fora da raiz publica do backend.',
    ];
}

function buildBackupExecutablePreflightCheck(string $binaryPath, string $key, string $binaryLabel, bool $required): array
{
    $binaryPath = trim($binaryPath);
    if (!$required) {
        return [
            'key' => $key,
            'status' => 'pass',
            'message' => $binaryLabel . ' sera validado como obrigatorio em producao.',
        ];
    }

    if ($binaryPath === '') {
        return [
            'key' => $key,
            'status' => 'fail',
            'message' => 'Configure ' . $binaryLabel . ' para validar backup/restore antes do deploy.',
        ];
    }

    $isPath = str_contains($binaryPath, '/') || str_contains($binaryPath, '\\');
    $isAvailable = $isPath
        ? is_file($binaryPath) && is_executable($binaryPath)
        : preflightCommandExists($binaryPath);

    return [
        'key' => $key,
        'status' => $isAvailable ? 'pass' : 'fail',
        'message' => $isAvailable
            ? $binaryLabel . ' disponivel para rotinas de backup/restore.'
            : $binaryLabel . ' nao encontrado. Configure ' . ($binaryLabel === 'mysqldump' ? 'MYSQLDUMP_PATH' : 'MYSQL_PATH') . ' com o caminho absoluto do binario.',
    ];
}

function preflightCommandExists(string $command): bool
{
    if (preg_match('/^[A-Za-z0-9_.-]+$/', $command) !== 1) {
        return false;
    }

    $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
    $locator = $isWindows
        ? 'where ' . escapeshellarg($command)
        : 'command -v ' . escapeshellarg($command);
    $stderrTarget = $isWindows ? 'NUL' : '/dev/null';
    $output = [];
    $exitCode = 1;
    exec($locator . ' 2>' . $stderrTarget, $output, $exitCode);

    return $exitCode === 0 && count($output) > 0;
}

function buildLegacyCodeBackupsPreflightCheck(string $backendRoot): array
{
    $legacyCodeBackupDir = rtrim(str_replace('\\', '/', $backendRoot), '/') . '/storage/backups/legacy-code';

    return [
        'key' => 'LEGACY_CODE_BACKUPS_OUTSIDE_PUBLIC_ROOT',
        'status' => is_dir($legacyCodeBackupDir) ? 'fail' : 'pass',
        'message' => is_dir($legacyCodeBackupDir)
            ? 'Arquive storage/backups/legacy-code fora de htdocs antes do deploy.'
            : 'Backups historicos de codigo nao estao publicados em storage/backups.',
    ];
}

function buildLegacyPaymentSdkPreflightCheck(string $backendRoot): array
{
    $backendRoot = rtrim(str_replace('\\', '/', $backendRoot), '/');
    $findings = [];

    $legacySdkDir = $backendRoot . '/vendor/mercadopago';
    if (is_dir($legacySdkDir)) {
        $findings[] = 'vendor/mercadopago';
    }

    $scanFiles = [
        'composer.json',
        'composer.lock',
        'vendor/composer/autoload_psr4.php',
        'vendor/composer/autoload_static.php',
        'vendor/composer/installed.php',
        'vendor/composer/installed.json',
    ];
    $legacyNeedles = [
        'mercadopago/dx-php',
        'MercadoPago\\\\',
        'MercadoPago\\',
        'vendor/mercadopago',
    ];

    foreach ($scanFiles as $relativePath) {
        $path = $backendRoot . '/' . $relativePath;
        if (!is_file($path)) {
            continue;
        }

        $content = @file_get_contents($path);
        if (!is_string($content)) {
            continue;
        }

        foreach ($legacyNeedles as $needle) {
            if (str_contains($content, $needle)) {
                $findings[] = $relativePath . ' contem ' . $needle;
                break;
            }
        }
    }

    return [
        'key' => 'PAYMENT_LEGACY_MERCADOPAGO_SDK_REMOVED',
        'status' => count($findings) === 0 ? 'pass' : 'fail',
        'message' => count($findings) === 0
            ? 'SDK legado do Mercado Pago ausente; backend esta Stripe-only.'
            : 'Remova SDK/autoload legado do Mercado Pago antes do deploy: ' . implode(', ', array_slice($findings, 0, 5)),
    ];
}

function buildStripeCronHealthPreflightCheck(string $path, int $maxAgeMinutes, bool $required): array
{
    if (!$required) {
        return [
            'key' => 'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_RECENT',
            'status' => 'pass',
            'message' => 'Heartbeat do cron Stripe nao e obrigatorio fora de producao.',
        ];
    }

    if (!is_file($path)) {
        return [
            'key' => 'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Heartbeat do cron Stripe nao encontrado. Execute a reconciliacao antes do go live.',
        ];
    }

    $raw = @file_get_contents($path);
    $payload = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($payload)) {
        return [
            'key' => 'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Heartbeat do cron Stripe invalido.',
        ];
    }

    $status = strtolower(trim((string) ($payload['status'] ?? 'unknown')));
    if (!in_array($status, ['ok', 'warning'], true)) {
        return [
            'key' => 'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Cron Stripe em estado operacional invalido: ' . ($status !== '' ? $status : 'unknown') . '.',
        ];
    }

    $lastRunTimestamp = !empty($payload['last_run_at'])
        ? strtotime((string) $payload['last_run_at'])
        : false;
    if ($lastRunTimestamp === false) {
        return [
            'key' => 'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Heartbeat do cron Stripe sem data valida de ultima execucao.',
        ];
    }

    $ageSeconds = time() - $lastRunTimestamp;
    if ($ageSeconds < 0) {
        $ageSeconds = 0;
    }

    if ($ageSeconds > ($maxAgeMinutes * 60)) {
        return [
            'key' => 'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'A reconciliacao Stripe esta antiga demais para producao: ' . (int) floor($ageSeconds / 60) . ' minuto(s).',
        ];
    }

    return [
        'key' => 'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_RECENT',
        'status' => 'pass',
        'message' => 'Heartbeat recente do cron Stripe confirmado.',
    ];
}

function buildStripeWebhookHealthPreflightCheck(string $path, int $maxAgeMinutes, bool $required): array
{
    if (!$required) {
        return [
            'key' => 'STRIPE_WEBHOOK_HEALTH_RECENT',
            'status' => 'pass',
            'message' => 'Heartbeat do webhook Stripe nao e obrigatorio fora de producao.',
        ];
    }

    if (!is_file($path)) {
        return [
            'key' => 'STRIPE_WEBHOOK_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Heartbeat do webhook Stripe nao encontrado. Envie um evento real de teste pela Stripe antes do go live.',
        ];
    }

    $raw = @file_get_contents($path);
    $payload = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($payload)) {
        return [
            'key' => 'STRIPE_WEBHOOK_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Heartbeat do webhook Stripe invalido.',
        ];
    }

    $status = strtolower(trim((string) ($payload['status'] ?? 'unknown')));
    if (!in_array($status, ['processed', 'ignored', 'duplicate'], true)) {
        return [
            'key' => 'STRIPE_WEBHOOK_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Webhook Stripe em estado invalido para producao: ' . ($status !== '' ? $status : 'unknown') . '.',
        ];
    }

    $lastEventTimestamp = !empty($payload['last_event_at'])
        ? strtotime((string) $payload['last_event_at'])
        : false;
    if ($lastEventTimestamp === false) {
        return [
            'key' => 'STRIPE_WEBHOOK_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Heartbeat do webhook Stripe sem data valida do ultimo evento.',
        ];
    }

    $ageSeconds = time() - $lastEventTimestamp;
    if ($ageSeconds < 0) {
        $ageSeconds = 0;
    }

    if ($ageSeconds > ($maxAgeMinutes * 60)) {
        return [
            'key' => 'STRIPE_WEBHOOK_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Webhook Stripe sem evento recente: ' . (int) floor($ageSeconds / 60) . ' minuto(s).',
        ];
    }

    $eventType = trim((string) ($payload['event_type'] ?? ''));
    return [
        'key' => 'STRIPE_WEBHOOK_HEALTH_RECENT',
        'status' => 'pass',
        'message' => 'Webhook Stripe recente confirmado' . ($eventType !== '' ? ': ' . $eventType . '.' : '.'),
    ];
}

function buildMysqlBackupHealthPreflightCheck(string $path, int $maxAgeMinutes, bool $required): array
{
    if (!$required) {
        return [
            'key' => 'MYSQL_BACKUP_HEALTH_RECENT',
            'status' => 'pass',
            'message' => 'Heartbeat do backup MySQL nao e obrigatorio fora de producao.',
        ];
    }

    if (!is_file($path)) {
        return [
            'key' => 'MYSQL_BACKUP_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Heartbeat do backup MySQL nao encontrado. Execute backup_mysql.php antes do go live.',
        ];
    }

    $raw = @file_get_contents($path);
    $payload = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($payload)) {
        return [
            'key' => 'MYSQL_BACKUP_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Heartbeat do backup MySQL invalido.',
        ];
    }

    $status = strtolower(trim((string) ($payload['status'] ?? 'unknown')));
    if ($status !== 'ok' || !filter_var($payload['success'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
        return [
            'key' => 'MYSQL_BACKUP_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Ultimo backup MySQL nao terminou com sucesso: ' . ($status !== '' ? $status : 'unknown') . '.',
        ];
    }

    $lastRunTimestamp = !empty($payload['last_run_at'])
        ? strtotime((string) $payload['last_run_at'])
        : (!empty($payload['created_at']) ? strtotime((string) $payload['created_at']) : false);
    if ($lastRunTimestamp === false) {
        return [
            'key' => 'MYSQL_BACKUP_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Heartbeat do backup MySQL sem data valida.',
        ];
    }

    $ageSeconds = time() - $lastRunTimestamp;
    if ($ageSeconds < 0) {
        $ageSeconds = 0;
    }

    if ($ageSeconds > ($maxAgeMinutes * 60)) {
        return [
            'key' => 'MYSQL_BACKUP_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Backup MySQL antigo demais para go-live: ' . (int) floor($ageSeconds / 60) . ' minuto(s).',
        ];
    }

    $backupFile = (string) ($payload['backup_file'] ?? '');
    $checksumFile = (string) ($payload['checksum_file'] ?? '');
    $backupFileValid = $backupFile !== '' && is_file($backupFile) && filesize($backupFile) > 0;
    $checksumFileValid = $checksumFile !== '' && is_file($checksumFile) && filesize($checksumFile) > 0;

    if (!$backupFileValid || !$checksumFileValid) {
        return [
            'key' => 'MYSQL_BACKUP_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Heartbeat do backup MySQL aponta para dump/checksum ausente ou vazio.',
        ];
    }

    return [
        'key' => 'MYSQL_BACKUP_HEALTH_RECENT',
        'status' => 'pass',
        'message' => 'Backup MySQL recente confirmado com dump e checksum presentes.',
    ];
}

function buildLogMaintenanceHealthPreflightCheck(string $path, int $maxAgeMinutes, bool $required): array
{
    if (!$required) {
        return [
            'key' => 'LOG_MAINTENANCE_HEALTH_RECENT',
            'status' => 'pass',
            'message' => 'Heartbeat da manutencao de logs nao e obrigatorio fora de producao.',
        ];
    }

    if (!is_file($path)) {
        return [
            'key' => 'LOG_MAINTENANCE_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Heartbeat da manutencao de logs nao encontrado. Execute operational_log_maintenance.php antes do go live.',
        ];
    }

    $raw = @file_get_contents($path);
    $payload = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($payload)) {
        return [
            'key' => 'LOG_MAINTENANCE_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Heartbeat da manutencao de logs invalido.',
        ];
    }

    $status = strtolower(trim((string) ($payload['status'] ?? 'unknown')));
    if ($status !== 'ok' || !filter_var($payload['success'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
        return [
            'key' => 'LOG_MAINTENANCE_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Ultima manutencao de logs nao terminou com sucesso: ' . ($status !== '' ? $status : 'unknown') . '.',
        ];
    }

    if (filter_var($payload['dry_run'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
        return [
            'key' => 'LOG_MAINTENANCE_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Ultima manutencao de logs foi dry-run; execute sem dry-run antes do go-live.',
        ];
    }

    $lastRunTimestamp = !empty($payload['last_run_at'])
        ? strtotime((string) $payload['last_run_at'])
        : (!empty($payload['created_at']) ? strtotime((string) $payload['created_at']) : false);
    if ($lastRunTimestamp === false) {
        return [
            'key' => 'LOG_MAINTENANCE_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Heartbeat da manutencao de logs sem data valida.',
        ];
    }

    $ageSeconds = time() - $lastRunTimestamp;
    if ($ageSeconds < 0) {
        $ageSeconds = 0;
    }

    if ($ageSeconds > ($maxAgeMinutes * 60)) {
        return [
            'key' => 'LOG_MAINTENANCE_HEALTH_RECENT',
            'status' => 'fail',
            'message' => 'Manutencao de logs antiga demais para go-live: ' . (int) floor($ageSeconds / 60) . ' minuto(s).',
        ];
    }

    $rotatedCount = (int) ($payload['rotated_count'] ?? 0);
    $removedCount = (int) ($payload['removed_old_archives'] ?? 0);

    return [
        'key' => 'LOG_MAINTENANCE_HEALTH_RECENT',
        'status' => 'pass',
        'message' => 'Manutencao de logs recente confirmada; rotacionados=' . $rotatedCount . ', removidos=' . $removedCount . '.',
    ];
}

/**
 * @param array<string, mixed> $config
 */
function buildMailTransportPreflightCheck(array $config, bool $required): array
{
    if (!$required) {
        return [
            'key' => 'SMTP_CONFIGURED_FOR_PRODUCTION',
            'status' => 'pass',
            'message' => 'SMTP transacional nao e obrigatorio fora de producao.',
        ];
    }

    $missing = [];
    foreach (['smtpHost' => 'host', 'smtpUser' => 'usuario', 'smtpPass' => 'senha'] as $key => $label) {
        if (trim((string) ($config[$key] ?? '')) === '') {
            $missing[] = $label;
        }
    }

    $port = (int) ($config['smtpPort'] ?? 0);
    if ($port < 1 || $port > 65535) {
        $missing[] = 'porta valida';
    }

    $secure = strtolower(trim((string) ($config['smtpSecure'] ?? '')));
    if (!in_array($secure, ['tls', 'ssl'], true)) {
        $missing[] = 'seguranca tls/ssl';
    }

    return [
        'key' => 'SMTP_CONFIGURED_FOR_PRODUCTION',
        'status' => $missing === [] ? 'pass' : 'fail',
        'message' => $missing === []
            ? 'SMTP transacional configurado para producao.'
            : 'Configure SMTP transacional antes do go live: ' . implode(', ', $missing) . '.',
    ];
}

/**
 * @param array<string, mixed> $config
 */
function buildMailSenderPreflightCheck(array $config, bool $required): array
{
    if (!$required) {
        return [
            'key' => 'MAIL_SENDER_CONFIGURED',
            'status' => 'pass',
            'message' => 'Remetente de e-mail nao e obrigatorio fora de producao.',
        ];
    }

    $mailFromAddress = trim((string) ($config['mailFromAddress'] ?? ''));
    $mailFromName = trim((string) ($config['mailFromName'] ?? ''));
    $valid = $mailFromAddress !== ''
        && filter_var($mailFromAddress, FILTER_VALIDATE_EMAIL) !== false
        && $mailFromName !== '';

    return [
        'key' => 'MAIL_SENDER_CONFIGURED',
        'status' => $valid ? 'pass' : 'fail',
        'message' => $valid
            ? 'Remetente transacional valido.'
            : 'Configure MAIL_FROM_ADDRESS valido e MAIL_FROM_NAME antes do go live.',
    ];
}

/**
 * @return array<int, string>
 */
function getRequiredProductionEmailTemplateKeys(): array
{
    return [
        'auth_email_confirmation',
        'auth_password_reset',
        'auth_welcome',
        'subscription_welcome',
        'subscription_payment_receipt',
        'subscription_payment_failed',
        'subscription_renewal_reminder',
        'subscription_renewal_tomorrow',
        'subscription_refund_processed',
        'subscription_cancellation_outcome',
        'transaction_refund_completed',
        'transaction_refund_request_admin',
        'support_feedback_reply',
        'support_report_decision',
    ];
}

/**
 * @param array<int, string> $requiredTemplateKeys
 */
function buildEssentialEmailTemplatesPreflightCheck(array $requiredTemplateKeys, bool $required): array
{
    if (!$required) {
        return [
            'key' => 'ESSENTIAL_EMAIL_TEMPLATES_ENABLED',
            'status' => 'pass',
            'message' => 'Templates transacionais nao sao obrigatorios fora de producao.',
        ];
    }

    $allowTemplateDatabase = !in_array(
        strtolower(getEnvString('EMAIL_TEMPLATES_ALLOW_DATABASE', 'true')),
        ['0', 'false', 'no', 'off'],
        true
    );
    $templatesByKey = [];
    $templates = $allowTemplateDatabase
        ? loadSystemEmailTemplatesFromSettings()
        : getSystemEmailTemplateDefaults();

    foreach ($templates as $template) {
        if (!is_array($template)) {
            continue;
        }

        $key = trim((string) ($template['key'] ?? ''));
        if ($key !== '') {
            $templatesByKey[$key] = $template;
        }
    }

    $issues = [];
    foreach ($requiredTemplateKeys as $templateKey) {
        $template = $templatesByKey[$templateKey] ?? null;
        if (!is_array($template)) {
            $issues[] = $templateKey . ' ausente';
            continue;
        }

        $subject = trim((string) ($template['subject'] ?? ''));
        $htmlBody = trim((string) ($template['htmlBody'] ?? ''));
        $textBody = trim((string) ($template['textBody'] ?? ''));
        if (empty($template['enabled'])) {
            $issues[] = $templateKey . ' desativado';
        } elseif ($subject === '' || ($htmlBody === '' && $textBody === '')) {
            $issues[] = $templateKey . ' incompleto';
        }
    }

    return [
        'key' => 'ESSENTIAL_EMAIL_TEMPLATES_ENABLED',
        'status' => $issues === [] ? 'pass' : 'fail',
        'message' => $issues === []
            ? 'Templates transacionais essenciais ativos.'
            : 'Corrija modelos de e-mail antes do go live: ' . implode('; ', array_slice($issues, 0, 8)) . '.',
    ];
}
?>
