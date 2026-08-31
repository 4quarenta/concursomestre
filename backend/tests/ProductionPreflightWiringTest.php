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

function assertContainsProductionPreflight(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';

assertContainsProductionPreflight(
    $base . '/config/cors.php',
    'isProductionEnv()',
    'CORS must branch production behavior explicitly'
);

assertContainsProductionPreflight(
    $base . '/config/cors.php',
    '!isLocalOrigin($origin)',
    'Production CORS must remove localhost origins'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'runProductionPreflight',
    'Production preflight helper must expose the validation entrypoint'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'CORS_NO_LOCALHOST',
    'Production preflight must reject localhost CORS'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'APP_ENV_PRODUCTION',
    'Production preflight must require APP_ENV=production'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'APP_URL_NOT_LOCALHOST',
    'Production preflight must reject localhost APP_URL'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'ADMIN_DATABASE_RESET_DISABLED',
    'Production preflight must fail when destructive admin database reset is enabled'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'CORS_ORIGINS_VALID',
    'Production preflight must reject malformed CORS origins'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'CORS_ORIGINS_HTTPS',
    'Production preflight must require HTTPS CORS origins'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'CORS_NO_WILDCARD',
    'Production preflight must reject wildcard CORS origins'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'GOOGLE_CLIENT_ID_FORMAT',
    'Production preflight must reject malformed Google Client IDs'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'STRIPE_SECRET_KEY_FORMAT',
    'Production preflight must reject malformed Stripe secret keys'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'STRIPE_PUBLISHABLE_KEY_FORMAT',
    'Production preflight must reject malformed Stripe publishable keys'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'STRIPE_WEBHOOK_SECRET_FORMAT',
    'Production preflight must reject malformed Stripe webhook secrets'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'STRIPE_KEY_MODE_MATCH',
    'Production preflight must reject mixed Stripe test/live key modes'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'PAYMENT_LEGACY_MERCADOPAGO_SDK_REMOVED',
    'Production preflight must reject stale Mercado Pago SDK/autoload artifacts'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'PAYMENT_LEGACY_SDK_SCAN_ROOT',
    'Production preflight must allow isolated legacy SDK scan fixtures'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'DB_USER_NOT_ROOT',
    'Production preflight must reject root database user'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'DB_PERSISTENT_DISABLED',
    'Production preflight must reject persistent PHP/MySQL connections'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'DB_TIMEOUT_BOUNDED',
    'Production preflight must enforce bounded database connection timeout'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'SECURITY_HEADERS_CONFIGURED',
    'Production preflight must check API security headers'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'RATE_LIMIT_RUNTIME_WRITABLE',
    'Production preflight must check rate limit runtime storage'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'API_PUBLIC_ARTIFACTS_CLEAN',
    'Production preflight must reject public operational artifacts in api/'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'BACKEND_ROOT_ARTIFACTS_CLEAN',
    'Production preflight must reject public backups/logs/dumps in the backend root'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'BACKUP_DIR_OUTSIDE_PUBLIC_ROOT',
    'Production preflight must require database backups outside the public backend root'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'MYSQLDUMP_AVAILABLE',
    'Production preflight must verify mysqldump availability for database backups'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'MYSQL_RESTORE_CLIENT_AVAILABLE',
    'Production preflight must verify mysql client availability for restore rehearsals'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'MYSQL_BACKUP_HEALTH_RECENT',
    'Production preflight must verify the latest MySQL backup heartbeat'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'MYSQL_BACKUP_HEALTH_PATH',
    'Production preflight must allow overriding the MySQL backup heartbeat path'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'LOG_MAINTENANCE_HEALTH_RECENT',
    'Production preflight must verify the operational log maintenance heartbeat'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'LOG_MAINTENANCE_HEALTH_PATH',
    'Production preflight must allow overriding the log maintenance heartbeat path'
);

assertContainsProductionPreflight(
    $base . '/scripts/tasks/operational_log_maintenance.php',
    'LOG_RETENTION_DAYS',
    'Operational log maintenance must support retention configuration'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'buildBackupExecutablePreflightCheck',
    'Production preflight must centralize backup binary validation'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'LEGACY_CODE_BACKUPS_OUTSIDE_PUBLIC_ROOT',
    'Production preflight must reject legacy code backups under storage/backups'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'BACKEND_DEV_SCRIPT_ARTIFACTS_CLEAN',
    'Production preflight must reject public debug/manual/setup scripts under scripts/'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_RECENT',
    'Production preflight must verify the Stripe reconciliation cron heartbeat'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'subscription_cron_health.json',
    'Production preflight must read the private Stripe cron heartbeat file'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_PATH',
    'Production preflight must allow overriding the cron heartbeat path for tests and staging checks'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'STRIPE_WEBHOOK_HEALTH_RECENT',
    'Production preflight must verify a recent Stripe webhook heartbeat'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'stripe_webhook_health.json',
    'Production preflight must read the private Stripe webhook heartbeat file'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'STRIPE_WEBHOOK_HEALTH_PATH',
    'Production preflight must allow overriding the webhook heartbeat path for tests and staging checks'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'SMTP_CONFIGURED_FOR_PRODUCTION',
    'Production preflight must verify transactional SMTP configuration'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'MAIL_SENDER_CONFIGURED',
    'Production preflight must verify a valid transactional sender'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'ESSENTIAL_EMAIL_TEMPLATES_ENABLED',
    'Production preflight must verify essential email templates'
);

assertContainsProductionPreflight(
    $base . '/config/production_preflight.php',
    'EMAIL_TEMPLATES_ALLOW_DATABASE',
    'Production preflight must allow isolated template checks in local tests'
);

assertContainsProductionPreflight(
    $base . '/shared/utils/MailConfiguration.php',
    'resolveMailConfiguration',
    'Mail configuration must be centralized for real sends and preflight checks'
);

assertContainsProductionPreflight(
    $base . '/shared/utils/Mailer.php',
    'resolveMailConfiguration()',
    'Mailer must use the centralized mail configuration resolver'
);

assertContainsProductionPreflight(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    'webhook_health',
    'Automation helper payload must expose the private Stripe webhook heartbeat to admins'
);

assertContainsProductionPreflight(
    $base . '/modules/subscriptions/services/SubscriptionsService.php',
    'writeStripeWebhookHeartbeat',
    'Stripe webhook processing must persist a private heartbeat after valid events'
);

assertContainsProductionPreflight(
    $base . '/scripts/tasks/production_preflight.php',
    'exit($result[\'success\'] ? 0 : 2)',
    'Production preflight CLI must fail non-zero when checks fail'
);

fwrite(STDOUT, "Production preflight wiring assertions passed.\n");
