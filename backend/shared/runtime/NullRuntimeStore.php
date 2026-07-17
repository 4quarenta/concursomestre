<?php

declare(strict_types=1);

require_once __DIR__ . '/RuntimeStoreInterface.php';

final class NullRuntimeStore implements RuntimeStoreInterface
{
    public function isShared(): bool { return false; }
    public function get(string $key): ?string { return null; }
    public function set(string $key, string $value, int $ttlSeconds): bool { return false; }
    public function delete(string $key): bool { return false; }
    public function increment(string $key, int $ttlSeconds = 0): int { return 0; }
    public function consumeFixedWindow(string $key, int $maxRequests, int $windowSeconds): array
    {
        return ['allowed' => true, 'count' => 0, 'retryAfter' => 0];
    }
    public function acquireLock(string $key, string $token, int $ttlSeconds): bool { return false; }
    public function releaseLock(string $key, string $token): bool { return false; }
}
