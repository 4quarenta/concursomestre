<?php

declare(strict_types=1);

interface IngestionPersistencePort
{
    public function startRun(string $runId, string $sourceProvider, string $contractVersion): void;

    public function checkpointRun(string $runId, string $cursor): void;

    public function completeRun(string $runId): void;

    public function failRun(string $runId, string $failureClass): void;

    public function findBySourceIdentity(CanonicalIngestionItem $item): ?array;

    public function findByIdempotencyKey(string $key): ?array;

    public function findByDomainIdentity(string $domainIdentityKey): ?array;

    /** @return array{canonicalEntityId:string,action:string} */
    public function apply(CanonicalIngestionItem $item, IngestionPlan $plan, string $runId): array;

    public function recordProvenance(CanonicalIngestionItem $item, string $runId, string $canonicalEntityId): void;

    /** @param array<string,mixed> $details */
    public function recordEvent(string $runId, CanonicalIngestionItem $item, string $state, array $details = []): void;

    public function acquireLease(string $sourceKey, string $leaseId, int $ttlSeconds): bool;

    public function releaseLease(string $sourceKey, string $leaseId): void;
}
