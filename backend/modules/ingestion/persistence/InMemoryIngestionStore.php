<?php

declare(strict_types=1);

/** Deterministic disposable store used by synthetic integration tests. */
final class InMemoryIngestionStore implements IngestionPersistencePort
{
    /** @var array<string,array<string,mixed>> */
    private array $items = [];
    /** @var array<string,string> */
    private array $sourceIdentityIndex = [];
    /** @var array<string,string> */
    private array $domainIdentityIndex = [];
    /** @var array<string,array<string,mixed>> */
    private array $canonical = [];
    /** @var array<string,array<string,mixed>> */
    private array $provenance = [];
    /** @var array<string,string> */
    private array $leases = [];
    /** @var list<array<string,mixed>> */
    private array $events = [];
    /** @var array<string,array<string,mixed>> */
    private array $runs = [];

    public function startRun(string $runId, string $sourceProvider, string $contractVersion): void
    {
        $this->runs[$runId] ??= [
            'runId' => $runId,
            'sourceProvider' => $sourceProvider,
            'contractVersion' => $contractVersion,
            'status' => IngestionStateMachine::RECEIVED,
            'cursor' => null,
        ];
    }

    public function checkpointRun(string $runId, string $cursor): void
    {
        $this->runs[$runId]['cursor'] = $cursor;
        $this->runs[$runId]['status'] = IngestionStateMachine::PERSISTED;
    }

    public function completeRun(string $runId): void
    {
        $this->runs[$runId]['status'] = IngestionStateMachine::COMPLETED;
    }

    public function failRun(string $runId, string $failureClass): void
    {
        $this->runs[$runId]['status'] = $failureClass === IngestionFailureClassifier::TRANSIENT
            ? IngestionStateMachine::RETRYABLE_FAILED
            : IngestionStateMachine::REVIEW_REQUIRED;
        $this->runs[$runId]['lastErrorClass'] = $failureClass;
    }

    public function findBySourceIdentity(CanonicalIngestionItem $item): ?array
    {
        $itemKey = $this->sourceIdentityIndex[$item->sourceIdentityKey()] ?? null;
        return is_string($itemKey) ? ($this->items[$itemKey] ?? null) : null;
    }

    public function findByIdempotencyKey(string $key): ?array
    {
        return $this->items[$key] ?? null;
    }

    public function findByDomainIdentity(string $domainIdentityKey): ?array
    {
        $itemKey = $this->domainIdentityIndex[$domainIdentityKey] ?? null;
        return is_string($itemKey) ? ($this->items[$itemKey] ?? null) : null;
    }

    public function apply(CanonicalIngestionItem $item, IngestionPlan $plan, string $runId): array
    {
        $existing = $this->findBySourceIdentity($item);
        $canonicalId = (string) ($existing['canonical_entity_id'] ?? $this->nextCanonicalId($item));
        if (!in_array($plan->action, [IngestionPlan::DUPLICATE, IngestionPlan::NO_CHANGE], true)) {
            $this->canonical[$canonicalId] = [
                'id' => $canonicalId,
                'domain' => $item->domain,
                'payload' => $plan->mergedPayload !== [] ? $plan->mergedPayload : $item->payload,
            ];
        }
        $record = [
            'idempotency_key' => $item->idempotencyKey(),
            'source_identity_key' => $item->sourceIdentityKey(),
            'source_version' => $item->sourceVersion,
            'content_hash' => CanonicalIngestionItem::payloadHash(
                $plan->mergedPayload !== [] ? $plan->mergedPayload : $item->payload
            ),
            'domain_identity_key' => $item->domainIdentityKey(),
            'canonical_entity_id' => $canonicalId,
            'payload' => $plan->mergedPayload !== [] ? $plan->mergedPayload : $item->payload,
            'action' => $plan->action,
            'status' => IngestionStateMachine::COMPLETED,
            'run_id' => $runId,
        ];
        $this->items[$item->idempotencyKey()] = $record;
        $this->sourceIdentityIndex[$item->sourceIdentityKey()] = $item->idempotencyKey();
        $domainIdentityKey = $item->domainIdentityKey();
        if ($domainIdentityKey !== null) {
            $this->domainIdentityIndex[$domainIdentityKey] = $item->idempotencyKey();
        }
        $this->recordProvenance($item, $runId, $canonicalId);
        $this->recordEvent($runId, $item, IngestionStateMachine::COMPLETED, ['action' => $plan->action]);
        return ['canonicalEntityId' => $canonicalId, 'action' => $plan->action];
    }

    public function recordProvenance(CanonicalIngestionItem $item, string $runId, string $canonicalEntityId): void
    {
        $this->provenance[$item->idempotencyKey()] = [
            'runId' => $runId,
            'source' => $item->sourceProvider,
            'sourceEntityId' => $item->sourceEntityId,
            'sourceVersion' => $item->sourceVersion,
            'canonicalEntityId' => $canonicalEntityId,
        ];
    }

    public function recordEvent(string $runId, CanonicalIngestionItem $item, string $state, array $details = []): void
    {
        $this->events[] = ['runId' => $runId, 'item' => $item->idempotencyKey(), 'state' => $state, 'details' => $details];
    }

    public function acquireLease(string $sourceKey, string $leaseId, int $ttlSeconds): bool
    {
        $current = $this->leases[$sourceKey] ?? null;
        if ($current !== null && $current !== $leaseId) {
            return false;
        }
        $this->leases[$sourceKey] = $leaseId;
        return true;
    }

    public function releaseLease(string $sourceKey, string $leaseId): void
    {
        if (($this->leases[$sourceKey] ?? null) === $leaseId) {
            unset($this->leases[$sourceKey]);
        }
    }

    public function canonicalCount(): int
    {
        return count($this->canonical);
    }

    public function provenanceCount(): int
    {
        return count($this->provenance);
    }

    /** @return list<array<string,mixed>> */
    public function events(): array
    {
        return $this->events;
    }

    /** @return null|array<string,mixed> */
    public function run(string $runId): ?array
    {
        return $this->runs[$runId] ?? null;
    }

    private function nextCanonicalId(CanonicalIngestionItem $item): string
    {
        return $item->domain . ':' . substr($item->sourceIdentityKey(), 0, 24);
    }
}
