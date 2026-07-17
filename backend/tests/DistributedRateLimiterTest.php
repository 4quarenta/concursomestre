<?php

declare(strict_types=1);

require_once __DIR__ . '/../shared/middleware/RateLimiter.php';

final class DistributedRateLimitStore implements RuntimeStoreInterface
{
    /** @var array<string, int> */
    private array $counts = [];

    public function isShared(): bool { return true; }
    public function get(string $key): ?string { return null; }
    public function set(string $key, string $value, int $ttlSeconds): bool { return true; }
    public function delete(string $key): bool { return true; }
    public function increment(string $key, int $ttlSeconds = 0): int { return 1; }
    public function consumeFixedWindow(string $key, int $maxRequests, int $windowSeconds): array
    {
        $count = ($this->counts[$key] ?? 0) + 1;
        $this->counts[$key] = $count;
        return [
            'allowed' => $count <= $maxRequests,
            'count' => $count,
            'retryAfter' => $windowSeconds,
        ];
    }
    public function acquireLock(string $key, string $token, int $ttlSeconds): bool { return true; }
    public function releaseLock(string $key, string $token): bool { return true; }
}

function distributedRateLimitAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$previousEnvironment = getenv('APP_ENV');
$previousInstanceCount = getenv('APP_INSTANCE_COUNT');
$previousRedisRequired = getenv('REDIS_REQUIRED');

try {
    putenv('APP_ENV=development');
    putenv('APP_INSTANCE_COUNT=2');
    putenv('REDIS_REQUIRED=true');

    $store = new DistributedRateLimitStore();
    $firstInstance = new RateLimiter(2, 60, $store);
    $secondInstance = new RateLimiter(2, 60, $store);

    distributedRateLimitAssert($firstInstance->check('same-client'), 'Primeira requisicao distribuida foi bloqueada.');
    distributedRateLimitAssert($secondInstance->check('same-client'), 'Segunda requisicao distribuida foi bloqueada.');
    $retryAfter = 0;
    distributedRateLimitAssert(!$firstInstance->check('same-client', $retryAfter), 'Terceira requisicao compartilhada deveria ser bloqueada.');
    distributedRateLimitAssert($retryAfter === 60, 'Retry-After distribuido incorreto.');

    $failedClosed = false;
    try {
        (new RateLimiter(2, 60, new NullRuntimeStore()))->check('same-client');
    } catch (RuntimeException) {
        $failedClosed = true;
    }
    distributedRateLimitAssert($failedClosed, 'Duas instancias sem Redis devem falhar de forma fechada.');

    fwrite(STDOUT, "DistributedRateLimiterTest: PASS\n");
} finally {
    putenv($previousEnvironment === false ? 'APP_ENV' : 'APP_ENV=' . $previousEnvironment);
    putenv($previousInstanceCount === false ? 'APP_INSTANCE_COUNT' : 'APP_INSTANCE_COUNT=' . $previousInstanceCount);
    putenv($previousRedisRequired === false ? 'REDIS_REQUIRED' : 'REDIS_REQUIRED=' . $previousRedisRequired);
}
