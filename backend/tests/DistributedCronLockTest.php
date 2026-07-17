<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/cron_lock.php';

final class DistributedCronLockStore implements RuntimeStoreInterface
{
    /** @var array<string, string> */
    private array $locks = [];

    public function isShared(): bool { return true; }
    public function get(string $key): ?string { return null; }
    public function set(string $key, string $value, int $ttlSeconds): bool { return true; }
    public function delete(string $key): bool { return true; }
    public function increment(string $key, int $ttlSeconds = 0): int { return 1; }
    public function consumeFixedWindow(string $key, int $maxRequests, int $windowSeconds): array
    {
        return ['allowed' => true, 'count' => 1, 'retryAfter' => $windowSeconds];
    }
    public function acquireLock(string $key, string $token, int $ttlSeconds): bool
    {
        if (isset($this->locks[$key])) {
            return false;
        }
        $this->locks[$key] = $token;
        return true;
    }
    public function releaseLock(string $key, string $token): bool
    {
        if (($this->locks[$key] ?? null) !== $token) {
            return false;
        }
        unset($this->locks[$key]);
        return true;
    }
}

function distributedCronAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$store = new DistributedCronLockStore();
RuntimeStoreFactory::setForTests($store);

try {
    $first = acquireCronLockOrThrow('reconciliation', 30);
    $duplicateBlocked = false;
    try {
        acquireCronLockOrThrow('reconciliation', 30);
    } catch (RuntimeException) {
        $duplicateBlocked = true;
    }
    distributedCronAssert($duplicateBlocked, 'Lock distribuido duplicado nao foi bloqueado.');

    $first->release();
    $second = acquireCronLockOrThrow('reconciliation', 30);
    distributedCronAssert($second instanceof CronLockHandle, 'Lock nao foi liberado pelo token proprietario.');
    $second->release();

    fwrite(STDOUT, "DistributedCronLockTest: PASS\n");
} finally {
    RuntimeStoreFactory::resetForTests();
}
