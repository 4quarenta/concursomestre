<?php

declare(strict_types=1);

interface RuntimeStoreInterface
{
    public function isShared(): bool;
    public function get(string $key): ?string;
    public function set(string $key, string $value, int $ttlSeconds): bool;
    public function delete(string $key): bool;
    public function increment(string $key, int $ttlSeconds = 0): int;

    /**
     * @return array{allowed: bool, count: int, retryAfter: int}
     */
    public function consumeFixedWindow(string $key, int $maxRequests, int $windowSeconds): array;

    public function acquireLock(string $key, string $token, int $ttlSeconds): bool;

    public function releaseLock(string $key, string $token): bool;
}
