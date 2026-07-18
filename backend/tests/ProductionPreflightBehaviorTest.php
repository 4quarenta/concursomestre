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

require_once __DIR__ . '/../config/production_preflight.php';

$cronHealthFixturePath = sys_get_temp_dir() . '/concursomestre-subscriptions-cron-health-' . bin2hex(random_bytes(6)) . '.json';
file_put_contents($cronHealthFixturePath, json_encode([
    'last_run_at' => gmdate(DATE_ATOM),
    'status' => 'ok',
    'success' => true,
    'checked' => 1,
    'issues' => 0,
], JSON_UNESCAPED_SLASHES));

$webhookHealthFixturePath = sys_get_temp_dir() . '/concursomestre-stripe-webhook-health-' . bin2hex(random_bytes(6)) . '.json';
file_put_contents($webhookHealthFixturePath, json_encode([
    'last_event_at' => gmdate(DATE_ATOM),
    'status' => 'processed',
    'success' => true,
    'event_id' => 'evt_test_ready',
    'event_type' => 'invoice.paid',
    'object_id' => 'in_test_ready',
], JSON_UNESCAPED_SLASHES));

$backupFixturePath = sys_get_temp_dir() . '/concursomestre-backup-' . bin2hex(random_bytes(6)) . '.sql';
$backupChecksumFixturePath = $backupFixturePath . '.sha256';
$backupHealthFixturePath = sys_get_temp_dir() . '/concursomestre-mysql-backup-health-' . bin2hex(random_bytes(6)) . '.json';
file_put_contents($backupFixturePath, "-- MySQL dump\nCREATE TABLE test_ready (id int);\n");
file_put_contents($backupChecksumFixturePath, hash_file('sha256', $backupFixturePath) . '  ' . basename($backupFixturePath) . PHP_EOL);
file_put_contents($backupHealthFixturePath, json_encode([
    'last_run_at' => gmdate(DATE_ATOM),
    'status' => 'ok',
    'success' => true,
    'backup_file' => $backupFixturePath,
    'checksum_file' => $backupChecksumFixturePath,
    'size_bytes' => filesize($backupFixturePath),
], JSON_UNESCAPED_SLASHES));

$logMaintenanceHealthFixturePath = sys_get_temp_dir() . '/concursomestre-log-maintenance-health-' . bin2hex(random_bytes(6)) . '.json';
file_put_contents($logMaintenanceHealthFixturePath, json_encode([
    'last_run_at' => gmdate(DATE_ATOM),
    'status' => 'ok',
    'success' => true,
    'files_checked' => 2,
    'rotated_count' => 1,
    'removed_old_archives' => 1,
], JSON_UNESCAPED_SLASHES));

$legacyPaymentFixtureRoot = sys_get_temp_dir() . '/concursomestre-legacy-payment-sdk-' . bin2hex(random_bytes(6));
mkdir($legacyPaymentFixtureRoot . '/vendor/composer', 0775, true);
mkdir($legacyPaymentFixtureRoot . '/vendor/mercadopago', 0775, true);
file_put_contents(
    $legacyPaymentFixtureRoot . '/vendor/composer/autoload_psr4.php',
    "<?php\nreturn ['MercadoPago\\\\' => [__DIR__ . '/../mercadopago/dx-php/src/MercadoPago']];\n"
);

$publicBackupFixturePath = __DIR__ . '/fixtures/public-backups-' . bin2hex(random_bytes(6));
mkdir($publicBackupFixturePath, 0775, true);

function setPreflightEnv(array $values): void
{
    foreach ($values as $key => $value) {
        $_ENV[$key] = (string) $value;
        $_SERVER[$key] = (string) $value;
        putenv($key . '=' . $value);
    }
}

function getPreflightCheckStatus(array $result, string $key): string
{
    foreach (($result['checks'] ?? []) as $check) {
        if (($check['key'] ?? '') === $key) {
            return (string) ($check['status'] ?? '');
        }
    }

    throw new RuntimeException('Check nao encontrado: ' . $key);
}

function assertPreflightStatus(array $result, string $key, string $expected): void
{
    $actual = getPreflightCheckStatus($result, $key);
    if ($actual !== $expected) {
        throw new RuntimeException("Check {$key} esperado {$expected}, obtido {$actual}.");
    }
}

$validEnv = [
    'APP_ENV' => 'production',
    'APP_URL' => 'https://app.concursomestre.com',
    'APP_DEBUG' => 'false',
    'BACKUP_DIR' => sys_get_temp_dir(),
    'MYSQLDUMP_PATH' => PHP_BINARY,
    'MYSQL_PATH' => PHP_BINARY,
    'DB_HOST' => '127.0.0.1',
    'DB_NAME' => 'concursomestre',
    'DB_USER' => 'concursomestre_user',
    'DB_PASSWORD' => 'strong-db-password',
    'DB_TIMEOUT_SECONDS' => '5',
    'DB_PERSISTENT' => 'false',
    'JWT_SECRET' => 'jwt-secret-with-more-than-twenty-four-characters',
    'API_KEY' => 'api-key-with-more-than-twenty-four-characters',
    'CRON_SECRET' => 'cron-secret-with-more-than-twenty-four-characters',
    'CORS_ALLOWED_ORIGINS' => 'https://app.concursomestre.com,https://www.concursomestre.com',
    'GOOGLE_CLIENT_ID' => '123456789012-abcdefghi.apps.googleusercontent.com',
    'STRIPE_PUBLISHABLE_KEY' => 'pk_test_abcdefghijklmnopqrstuvwxyz',
    'STRIPE_SECRET_KEY' => 'sk_test_abcdefghijklmnopqrstuvwxyz',
    'STRIPE_WEBHOOK_SECRET' => 'whsec_abcdefghijklmnopqrstuvwxyz',
    'ADMIN_DATABASE_RESET_ENABLED' => 'false',
    'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_PATH' => $cronHealthFixturePath,
    'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_MAX_AGE_MINUTES' => '30',
    'MYSQL_BACKUP_HEALTH_PATH' => $backupHealthFixturePath,
    'MYSQL_BACKUP_HEALTH_MAX_AGE_MINUTES' => '1560',
    'LOG_MAINTENANCE_HEALTH_PATH' => $logMaintenanceHealthFixturePath,
    'LOG_MAINTENANCE_HEALTH_MAX_AGE_MINUTES' => '1560',
    'STRIPE_WEBHOOK_HEALTH_PATH' => $webhookHealthFixturePath,
    'STRIPE_WEBHOOK_HEALTH_MAX_AGE_MINUTES' => '1440',
    'MAIL_CONFIGURATION_ALLOW_DATABASE' => 'false',
    'EMAIL_TEMPLATES_ALLOW_DATABASE' => 'false',
    'SMTP_HOST' => 'smtp.concursomestre.com',
    'SMTP_USER' => 'mailer@concursomestre.com',
    'SMTP_PASS' => 'smtp-secret-with-more-than-twenty-four-characters',
    'SMTP_PORT' => '587',
    'SMTP_SECURE' => 'tls',
    'MAIL_FROM_ADDRESS' => 'no-reply@concursomestre.com',
    'MAIL_FROM_NAME' => 'ConcursoMestre',
    'PAYMENT_LEGACY_SDK_SCAN_ROOT' => dirname(__DIR__),
];

setPreflightEnv($validEnv);
$validResult = runProductionPreflight();

foreach ([
    'APP_ENV_PRODUCTION',
    'APP_URL_HTTPS',
    'APP_URL_NOT_LOCALHOST',
    'DB_USER_NOT_ROOT',
    'DB_PERSISTENT_DISABLED',
    'DB_TIMEOUT_BOUNDED',
    'ADMIN_DATABASE_RESET_DISABLED',
    'CORS_ORIGINS_VALID',
    'CORS_ORIGINS_HTTPS',
    'CORS_NO_WILDCARD',
    'CORS_NO_LOCALHOST',
    'BACKEND_ROOT_ARTIFACTS_CLEAN',
    'BACKUP_DIR_OUTSIDE_PUBLIC_ROOT',
    'MYSQLDUMP_AVAILABLE',
    'MYSQL_RESTORE_CLIENT_AVAILABLE',
    'LEGACY_CODE_BACKUPS_OUTSIDE_PUBLIC_ROOT',
    'BACKEND_DEV_SCRIPT_ARTIFACTS_CLEAN',
    'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_RECENT',
    'MYSQL_BACKUP_HEALTH_RECENT',
    'LOG_MAINTENANCE_HEALTH_RECENT',
    'STRIPE_WEBHOOK_HEALTH_RECENT',
    'SMTP_CONFIGURED_FOR_PRODUCTION',
    'MAIL_SENDER_CONFIGURED',
    'ESSENTIAL_EMAIL_TEMPLATES_ENABLED',
    'PAYMENT_LEGACY_MERCADOPAGO_SDK_REMOVED',
    'SHARED_RUNTIME_STORE_READY',
] as $key) {
    assertPreflightStatus($validResult, $key, 'pass');
}

setPreflightEnv(array_merge($validEnv, [
    'PAYMENT_LEGACY_SDK_SCAN_ROOT' => $legacyPaymentFixtureRoot,
]));
$legacyPaymentResult = runProductionPreflight();
assertPreflightStatus($legacyPaymentResult, 'PAYMENT_LEGACY_MERCADOPAGO_SDK_REMOVED', 'fail');

setPreflightEnv(array_merge($validEnv, [
    'BACKUP_DIR' => $publicBackupFixturePath,
]));
$publicBackupDirResult = runProductionPreflight();
assertPreflightStatus($publicBackupDirResult, 'BACKUP_DIR_OUTSIDE_PUBLIC_ROOT', 'fail');

setPreflightEnv(array_merge($validEnv, [
    'MYSQLDUMP_PATH' => sys_get_temp_dir() . '/concursomestre-missing-mysqldump',
]));
$missingMysqlDumpResult = runProductionPreflight();
assertPreflightStatus($missingMysqlDumpResult, 'MYSQLDUMP_AVAILABLE', 'fail');

setPreflightEnv(array_merge($validEnv, [
    'MYSQL_PATH' => sys_get_temp_dir() . '/concursomestre-missing-mysql',
]));
$missingMysqlClientResult = runProductionPreflight();
assertPreflightStatus($missingMysqlClientResult, 'MYSQL_RESTORE_CLIENT_AVAILABLE', 'fail');

$staleBackupHealthFixturePath = sys_get_temp_dir() . '/concursomestre-mysql-backup-health-stale-' . bin2hex(random_bytes(6)) . '.json';
file_put_contents($staleBackupHealthFixturePath, json_encode([
    'last_run_at' => gmdate(DATE_ATOM, time() - 172800),
    'status' => 'ok',
    'success' => true,
    'backup_file' => $backupFixturePath,
    'checksum_file' => $backupChecksumFixturePath,
], JSON_UNESCAPED_SLASHES));

setPreflightEnv(array_merge($validEnv, [
    'MYSQL_BACKUP_HEALTH_PATH' => $staleBackupHealthFixturePath,
    'MYSQL_BACKUP_HEALTH_MAX_AGE_MINUTES' => '1560',
]));
$staleBackupResult = runProductionPreflight();
assertPreflightStatus($staleBackupResult, 'MYSQL_BACKUP_HEALTH_RECENT', 'fail');

$missingBackupFileHealthFixturePath = sys_get_temp_dir() . '/concursomestre-mysql-backup-health-missing-file-' . bin2hex(random_bytes(6)) . '.json';
file_put_contents($missingBackupFileHealthFixturePath, json_encode([
    'last_run_at' => gmdate(DATE_ATOM),
    'status' => 'ok',
    'success' => true,
    'backup_file' => sys_get_temp_dir() . '/concursomestre-missing-backup.sql',
    'checksum_file' => $backupChecksumFixturePath,
], JSON_UNESCAPED_SLASHES));

setPreflightEnv(array_merge($validEnv, [
    'MYSQL_BACKUP_HEALTH_PATH' => $missingBackupFileHealthFixturePath,
]));
$missingBackupFileResult = runProductionPreflight();
assertPreflightStatus($missingBackupFileResult, 'MYSQL_BACKUP_HEALTH_RECENT', 'fail');

$staleLogMaintenanceHealthFixturePath = sys_get_temp_dir() . '/concursomestre-log-maintenance-health-stale-' . bin2hex(random_bytes(6)) . '.json';
file_put_contents($staleLogMaintenanceHealthFixturePath, json_encode([
    'last_run_at' => gmdate(DATE_ATOM, time() - 172800),
    'status' => 'ok',
    'success' => true,
    'files_checked' => 2,
], JSON_UNESCAPED_SLASHES));

setPreflightEnv(array_merge($validEnv, [
    'LOG_MAINTENANCE_HEALTH_PATH' => $staleLogMaintenanceHealthFixturePath,
    'LOG_MAINTENANCE_HEALTH_MAX_AGE_MINUTES' => '1560',
]));
$staleLogMaintenanceResult = runProductionPreflight();
assertPreflightStatus($staleLogMaintenanceResult, 'LOG_MAINTENANCE_HEALTH_RECENT', 'fail');

$dryRunLogMaintenanceHealthFixturePath = sys_get_temp_dir() . '/concursomestre-log-maintenance-health-dry-run-' . bin2hex(random_bytes(6)) . '.json';
file_put_contents($dryRunLogMaintenanceHealthFixturePath, json_encode([
    'last_run_at' => gmdate(DATE_ATOM),
    'status' => 'ok',
    'success' => true,
    'dry_run' => true,
    'files_checked' => 2,
], JSON_UNESCAPED_SLASHES));

setPreflightEnv(array_merge($validEnv, [
    'LOG_MAINTENANCE_HEALTH_PATH' => $dryRunLogMaintenanceHealthFixturePath,
]));
$dryRunLogMaintenanceResult = runProductionPreflight();
assertPreflightStatus($dryRunLogMaintenanceResult, 'LOG_MAINTENANCE_HEALTH_RECENT', 'fail');

$staleCronHealthFixturePath = sys_get_temp_dir() . '/concursomestre-subscriptions-cron-health-stale-' . bin2hex(random_bytes(6)) . '.json';
file_put_contents($staleCronHealthFixturePath, json_encode([
    'last_run_at' => gmdate(DATE_ATOM, time() - 3600),
    'status' => 'ok',
    'success' => true,
    'checked' => 1,
    'issues' => 0,
], JSON_UNESCAPED_SLASHES));

setPreflightEnv(array_merge($validEnv, [
    'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_PATH' => $staleCronHealthFixturePath,
    'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_MAX_AGE_MINUTES' => '30',
]));
$staleCronResult = runProductionPreflight();
assertPreflightStatus($staleCronResult, 'SUBSCRIPTIONS_STRIPE_CRON_HEALTH_RECENT', 'fail');

$staleWebhookHealthFixturePath = sys_get_temp_dir() . '/concursomestre-stripe-webhook-health-stale-' . bin2hex(random_bytes(6)) . '.json';
file_put_contents($staleWebhookHealthFixturePath, json_encode([
    'last_event_at' => gmdate(DATE_ATOM, time() - 172800),
    'status' => 'processed',
    'success' => true,
    'event_id' => 'evt_test_stale',
    'event_type' => 'invoice.paid',
    'object_id' => 'in_test_stale',
], JSON_UNESCAPED_SLASHES));

setPreflightEnv(array_merge($validEnv, [
    'STRIPE_WEBHOOK_HEALTH_PATH' => $staleWebhookHealthFixturePath,
    'STRIPE_WEBHOOK_HEALTH_MAX_AGE_MINUTES' => '1440',
]));
$staleWebhookResult = runProductionPreflight();
assertPreflightStatus($staleWebhookResult, 'STRIPE_WEBHOOK_HEALTH_RECENT', 'fail');

setPreflightEnv(array_merge($validEnv, [
    'SMTP_HOST' => '',
    'SMTP_USER' => '',
    'SMTP_PASS' => '',
]));
$missingSmtpResult = runProductionPreflight();
assertPreflightStatus($missingSmtpResult, 'SMTP_CONFIGURED_FOR_PRODUCTION', 'fail');

setPreflightEnv(array_merge($validEnv, [
    'MAIL_FROM_ADDRESS' => 'invalid-mail-from',
]));
$invalidSenderResult = runProductionPreflight();
assertPreflightStatus($invalidSenderResult, 'MAIL_SENDER_CONFIGURED', 'fail');

setPreflightEnv(array_merge($validEnv, [
    'APP_ENV' => 'development',
    'APP_URL' => 'https://localhost',
    'DB_USER' => 'root',
    'DB_PERSISTENT' => 'true',
    'DB_TIMEOUT_SECONDS' => '60',
    'ADMIN_DATABASE_RESET_ENABLED' => 'true',
    'CORS_ALLOWED_ORIGINS' => 'http://localhost:3000,*,notaurl',
]));
$invalidResult = runProductionPreflight();

foreach ([
    'APP_ENV_PRODUCTION',
    'APP_URL_NOT_LOCALHOST',
    'DB_USER_NOT_ROOT',
    'DB_PERSISTENT_DISABLED',
    'DB_TIMEOUT_BOUNDED',
    'ADMIN_DATABASE_RESET_DISABLED',
    'CORS_ORIGINS_VALID',
    'CORS_ORIGINS_HTTPS',
    'CORS_NO_WILDCARD',
    'CORS_NO_LOCALHOST',
] as $key) {
    assertPreflightStatus($invalidResult, $key, 'fail');
}

setPreflightEnv(array_merge($validEnv, [
    'APP_INSTANCE_COUNT' => '2',
    'REDIS_ENABLED' => 'false',
    'REDIS_REQUIRED' => 'false',
]));
$missingSharedRuntimeResult = runProductionPreflight();
assertPreflightStatus($missingSharedRuntimeResult, 'SHARED_RUNTIME_STORE_READY', 'fail');

@unlink($cronHealthFixturePath);
@unlink($staleCronHealthFixturePath);
@unlink($webhookHealthFixturePath);
@unlink($staleWebhookHealthFixturePath);
@unlink($backupHealthFixturePath);
@unlink($staleBackupHealthFixturePath);
@unlink($missingBackupFileHealthFixturePath);
@unlink($logMaintenanceHealthFixturePath);
@unlink($staleLogMaintenanceHealthFixturePath);
@unlink($dryRunLogMaintenanceHealthFixturePath);
@unlink($backupChecksumFixturePath);
@unlink($backupFixturePath);
@unlink($legacyPaymentFixtureRoot . '/vendor/composer/autoload_psr4.php');
@rmdir($legacyPaymentFixtureRoot . '/vendor/composer');
@rmdir($legacyPaymentFixtureRoot . '/vendor/mercadopago');
@rmdir($legacyPaymentFixtureRoot . '/vendor');
@rmdir($legacyPaymentFixtureRoot);
@rmdir($publicBackupFixturePath);

fwrite(STDOUT, "Production preflight behavior assertions passed.\n");
