<?php

declare(strict_types=1);

require_once __DIR__ . '/RuntimeStoreInterface.php';

final class RedisRuntimeStore implements RuntimeStoreInterface
{
    private const FIXED_WINDOW_SCRIPT = <<<'LUA'
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
    ttl = tonumber(ARGV[1])
end
return {current, ttl}
LUA;

    private const RELEASE_LOCK_SCRIPT = <<<'LUA'
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
end
return 0
LUA;

    public function __construct(
        private readonly Redis $redis,
        private readonly string $prefix = 'concursomestre:'
    ) {
    }

    public function isShared(): bool { return true; }

    public function get(string $key): ?string
    {
        $value = $this->redis->get($this->key($key));
        return is_string($value) ? $value : null;
    }

    public function set(string $key, string $value, int $ttlSeconds): bool
    {
        return (bool) $this->redis->setex($this->key($key), max(1, $ttlSeconds), $value);
    }

    public function delete(string $key): bool
    {
        return (int) $this->redis->del($this->key($key)) > 0;
    }

    public function increment(string $key, int $ttlSeconds = 0): int
    {
        $redisKey = $this->key($key);
        $value = (int) $this->redis->incr($redisKey);
        if ($value === 1 && $ttlSeconds > 0) {
            $this->redis->expire($redisKey, max(1, $ttlSeconds));
        }
        return $value;
    }

    public function consumeFixedWindow(string $key, int $maxRequests, int $windowSeconds): array
    {
        $window = max(1, $windowSeconds);
        $result = $this->redis->eval(
            self::FIXED_WINDOW_SCRIPT,
            [$this->key($key), (string) $window],
            1
        );
        $count = is_array($result) ? (int) ($result[0] ?? 0) : 0;
        $retryAfter = is_array($result) ? max(1, (int) ($result[1] ?? $window)) : $window;

        return [
            'allowed' => $count <= max(1, $maxRequests),
            'count' => $count,
            'retryAfter' => $retryAfter,
        ];
    }

    public function acquireLock(string $key, string $token, int $ttlSeconds): bool
    {
        return (bool) $this->redis->set(
            $this->key($key),
            $token,
            ['nx', 'ex' => max(1, $ttlSeconds)]
        );
    }

    public function releaseLock(string $key, string $token): bool
    {
        return (int) $this->redis->eval(
            self::RELEASE_LOCK_SCRIPT,
            [$this->key($key), $token],
            1
        ) > 0;
    }

    private function key(string $key): string
    {
        return $this->prefix . ltrim($key, ':');
    }
}
