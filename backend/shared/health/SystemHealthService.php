<?php

declare(strict_types=1);

require_once __DIR__ . '/ReleaseMetadata.php';
require_once __DIR__ . '/../database/SchemaMigrationRunner.php';
require_once __DIR__ . '/../runtime/RuntimeStoreFactory.php';

/** Liveness e readiness separados para orquestradores e operacao. */
final class SystemHealthService
{
    public static function liveness(): array
    {
        return [
            'status' => 'ok',
            'service' => 'concursomestre-api',
            'release' => ReleaseMetadata::read(),
            'timestamp' => gmdate(DATE_ATOM),
        ];
    }

    public static function readiness(PDO $db): array
    {
        $checks = [
            'database' => self::databaseCheck($db),
            'migrations' => self::migrationsCheck($db),
            'storage' => self::storageCheck(),
            'runtimeStore' => self::runtimeStoreCheck(),
            'workers' => self::workersCheck($db),
        ];
        $ready = !in_array(false, array_column($checks, 'ok'), true);

        return [
            'status' => $ready ? 'ready' : 'not_ready',
            'ready' => $ready,
            'service' => 'concursomestre-api',
            'release' => ReleaseMetadata::read(),
            'checks' => $checks,
            'timestamp' => gmdate(DATE_ATOM),
        ];
    }

    private static function databaseCheck(PDO $db): array
    {
        try {
            $startedAt = microtime(true);
            $value = $db->query('SELECT 1')->fetchColumn();
            return [
                'ok' => (int) $value === 1,
                'durationMs' => (int) round((microtime(true) - $startedAt) * 1000),
            ];
        } catch (Throwable) {
            return ['ok' => false];
        }
    }

    private static function migrationsCheck(PDO $db): array
    {
        try {
            $runner = new SchemaMigrationRunner($db, dirname(__DIR__, 2) . '/database/migrations', 'readiness');
            $status = $runner->status();
            $pending = array_values(array_filter($status, static fn (array $item): bool => !($item['applied'] ?? false)));
            $drift = array_values(array_filter($status, static fn (array $item): bool => !($item['checksum_matches'] ?? true)));
            return [
                'ok' => $pending === [] && $drift === [],
                'pending' => count($pending),
                'checksumDrift' => count($drift),
            ];
        } catch (Throwable) {
            return ['ok' => false, 'pending' => null, 'checksumDrift' => null];
        }
    }

    private static function storageCheck(): array
    {
        $paths = [
            dirname(__DIR__, 2) . '/storage/logs',
            dirname(__DIR__, 2) . '/storage/cache',
            dirname(__DIR__, 2) . '/uploads',
        ];
        $unwritable = [];
        foreach ($paths as $path) {
            if (!is_dir($path)) {
                $unwritable[] = basename($path);
                continue;
            }
            if (!is_writable($path)) {
                $unwritable[] = basename($path);
            }
        }
        return ['ok' => $unwritable === [], 'unwritable' => $unwritable];
    }

    private static function runtimeStoreCheck(): array
    {
        $instances = max(1, (int) (getenv('APP_INSTANCE_COUNT') ?: 1));
        $redisRequired = $instances > 1
            || filter_var((string) (getenv('REDIS_REQUIRED') ?: 'false'), FILTER_VALIDATE_BOOLEAN);
        $shared = RuntimeStoreFactory::shared()->isShared();
        return ['ok' => !$redisRequired || $shared, 'shared' => $shared, 'required' => $redisRequired];
    }

    private static function workersCheck(PDO $db): array
    {
        $stripeWorkerRequired = filter_var(
            (string) (getenv('STRIPE_WEBHOOK_ASYNC_ENABLED') ?: 'true'),
            FILTER_VALIDATE_BOOLEAN
        );
        if (!$stripeWorkerRequired) {
            return ['ok' => true, 'stripeWebhookWorkerRequired' => false, 'staleDueJobs' => 0];
        }

        try {
            $table = $db->query(
                "SELECT COUNT(*) FROM information_schema.TABLES "
                . "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'provider_webhook_events'"
            );
            if ((int) $table->fetchColumn() === 0) {
                return ['ok' => false, 'stripeWebhookWorkerRequired' => true, 'staleDueJobs' => null];
            }

            $stmt = $db->query(
                "SELECT COUNT(*) FROM provider_webhook_events "
                . "WHERE provider = 'stripe' "
                . "AND payload_json IS NOT NULL AND payload_json <> '' "
                . "AND status IN ('pending', 'queued', 'processing', 'failed') "
                . "AND COALESCE(next_retry_at, queued_at, created_at) <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)"
            );
            $stale = (int) $stmt->fetchColumn();
            return ['ok' => $stale === 0, 'stripeWebhookWorkerRequired' => true, 'staleDueJobs' => $stale];
        } catch (Throwable) {
            return ['ok' => false, 'stripeWebhookWorkerRequired' => true, 'staleDueJobs' => null];
        }
    }
}
