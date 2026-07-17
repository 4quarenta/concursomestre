<?php

declare(strict_types=1);

require_once __DIR__ . '/RuntimeStoreInterface.php';
require_once __DIR__ . '/NullRuntimeStore.php';
require_once __DIR__ . '/RedisRuntimeStore.php';

final class RuntimeStoreFactory
{
    private static ?RuntimeStoreInterface $shared = null;

    public static function shared(): RuntimeStoreInterface
    {
        return self::$shared ??= self::buildRedisStore() ?? new NullRuntimeStore();
    }

    public static function resetForTests(): void
    {
        self::$shared = null;
    }

    public static function setForTests(RuntimeStoreInterface $store): void
    {
        self::$shared = $store;
    }

    public static function reset(): void
    {
        self::$shared = null;
    }

    private static function buildRedisStore(): ?RuntimeStoreInterface
    {
        if (!filter_var((string) (getenv('REDIS_ENABLED') ?: 'false'), FILTER_VALIDATE_BOOLEAN)
            || !class_exists('Redis')) {
            return null;
        }

        try {
            $redis = new Redis();
            $host = trim((string) (getenv('REDIS_HOST') ?: '127.0.0.1'));
            $port = max(1, (int) (getenv('REDIS_PORT') ?: 6379));
            $timeout = max(0.1, (float) (getenv('REDIS_CONNECT_TIMEOUT') ?: 1.5));
            if (!$redis->connect($host, $port, $timeout)) {
                return null;
            }
            $readTimeout = max(0.1, (float) (getenv('REDIS_READ_TIMEOUT') ?: 1.5));
            if (defined('Redis::OPT_READ_TIMEOUT')) {
                $redis->setOption(Redis::OPT_READ_TIMEOUT, $readTimeout);
            }
            $password = (string) (getenv('REDIS_PASSWORD') ?: '');
            if ($password !== '' && !$redis->auth($password)) {
                return null;
            }
            $database = max(0, (int) (getenv('REDIS_DATABASE') ?: 0));
            if ($database > 0 && !$redis->select($database)) {
                return null;
            }
            $redis->setOption(Redis::OPT_SERIALIZER, Redis::SERIALIZER_NONE);
            $ping = $redis->ping();
            if ($ping !== true && $ping !== '+PONG' && $ping !== 'PONG') {
                return null;
            }
            $environment = strtolower(trim((string) (getenv('APP_ENV') ?: 'development')));
            $safeEnvironment = preg_replace('/[^a-z0-9_.-]+/', '-', $environment) ?: 'development';
            return new RedisRuntimeStore(
                $redis,
                (string) (getenv('REDIS_PREFIX') ?: 'concursomestre:' . $safeEnvironment . ':')
            );
        } catch (Throwable) {
            return null;
        }
    }
}
