<?php

declare(strict_types=1);

final class IngestionOrchestrator
{
    private readonly IngestionWriterRegistry $writerRegistry;

    public function __construct(
        private readonly IngestionPersistencePort $persistence,
        private readonly IngestionContractRegistry $contracts = new IngestionContractRegistry(),
        private readonly AssetUrlPolicy $assetPolicy = new AssetUrlPolicy(),
        private readonly TaxonomyResolver $taxonomyResolver = new TaxonomyResolver(),
        ?IngestionWriterRegistry $writerRegistry = null,
    ) {
        $this->writerRegistry = $writerRegistry ?? new IngestionWriterRegistry([]);
    }

    /** @return array{runId:string,results:list<array<string,mixed>>,metrics:array<string,int>} */
    public function processBatch(array $items, bool $dryRun = true, ?string $runId = null): array
    {
        $runId ??= self::uuid();
        $metrics = array_fill_keys(['received', 'validated', 'created', 'updated', 'no_change', 'duplicates', 'rejected', 'review_required', 'retry', 'failed', 'assets_failed'], 0);
        $results = [];

        foreach ($items as $item) {
            if (!$item instanceof CanonicalIngestionItem) {
                $metrics['rejected']++;
                $results[] = ['action' => IngestionPlan::REJECT, 'reasonCodes' => ['invalid_item']];
                continue;
            }
            $metrics['received']++;
            $result = $this->processOne($item, $runId, $dryRun);
            $results[] = $result;
            $action = (string) ($result['action'] ?? '');
            if ($action === IngestionPlan::CREATE) $metrics['created']++;
            if ($action === IngestionPlan::UPDATE) $metrics['updated']++;
            if ($action === IngestionPlan::NO_CHANGE) $metrics['no_change']++;
            if ($action === IngestionPlan::DUPLICATE) $metrics['duplicates']++;
            if ($action === IngestionPlan::REJECT) $metrics['rejected']++;
            if ($action === IngestionPlan::REVIEW_REQUIRED) $metrics['review_required']++;
            if (($result['state'] ?? '') === IngestionStateMachine::VALIDATED) $metrics['validated']++;
        }

        return ['runId' => $runId, 'results' => $results, 'metrics' => $metrics];
    }

    /** @return array<string,mixed> */
    public function processOne(CanonicalIngestionItem $item, string $runId, bool $dryRun = true): array
    {
        $this->persistence->startRun($runId, $item->sourceProvider, $item->domain . '-ingestion.v1');
        if (!$this->writerRegistry->isAuthorized($item->sourceProvider)) {
            $plan = new IngestionPlan(IngestionPlan::REJECT, IngestionStateMachine::REJECTED, ['unknown_ingestion_writer']);
            $this->record($runId, $item, IngestionStateMachine::REJECTED, ['reasonCodes' => $plan->reasonCodes], $dryRun);
            return $this->result($item, $plan);
        }
        $errors = $this->contracts->validate($item);
        if ($errors !== []) {
            $plan = new IngestionPlan(IngestionPlan::REJECT, IngestionStateMachine::REJECTED, $errors);
            $this->record($runId, $item, IngestionStateMachine::REJECTED, ['reasonCodes' => $errors], $dryRun);
            return $this->result($item, $plan);
        }
        try {
            ContentSecurityPolicy::assertSafePayload($item->payload);
            $this->assetPolicy->validatePayloadAssets($item->payload);
        } catch (Throwable $exception) {
            $plan = new IngestionPlan(IngestionPlan::REJECT, IngestionStateMachine::REJECTED, ['unsafe_asset_url']);
            $this->record($runId, $item, IngestionStateMachine::REJECTED, ['reasonCodes' => ['unsafe_asset_url']], $dryRun);
            return $this->result($item, $plan);
        }

        $taxonomyReferences = is_array($item->payload['taxonomyReferences'] ?? null)
            ? array_values(array_filter($item->payload['taxonomyReferences'], 'is_array'))
            : [];
        foreach ($this->taxonomyResolver->resolveMany($taxonomyReferences) as $taxonomyResult) {
            if (in_array($taxonomyResult['decision'], [TaxonomyResolutionPolicy::REVIEW_REQUIRED, TaxonomyResolutionPolicy::REJECT], true)) {
                $action = $taxonomyResult['decision'] === TaxonomyResolutionPolicy::REJECT
                    ? IngestionPlan::REJECT
                    : IngestionPlan::REVIEW_REQUIRED;
                $state = $action === IngestionPlan::REJECT ? IngestionStateMachine::REJECTED : IngestionStateMachine::REVIEW_REQUIRED;
                $plan = new IngestionPlan($action, $state, [$taxonomyResult['reason'] ?? 'taxonomy_resolution_required']);
                $this->record($runId, $item, $state, ['reasonCodes' => $plan->reasonCodes], $dryRun);
                return $this->result($item, $plan);
            }
        }

        $existing = $this->persistence->findBySourceIdentity($item);
        $mergedPayload = $existing !== null && is_array($existing['payload'] ?? null)
            ? FieldOwnershipPolicy::merge($existing['payload'], $item->payload, $this->contracts->get($item->domain)->fieldOwnership())
            : $item->payload;
        $canonicalContentHash = CanonicalIngestionItem::payloadHash($mergedPayload);
        if ($existing !== null && ($existing['content_hash'] ?? null) === $canonicalContentHash) {
            $sameSourceVersion = ($existing['source_version'] ?? null) === $item->sourceVersion;
            $plan = new IngestionPlan(
                IngestionPlan::NO_CHANGE,
                IngestionStateMachine::COMPLETED,
                [$sameSourceVersion ? 'same_source_version' : 'same_content'],
                isset($existing['canonical_entity_id']) ? (string) $existing['canonical_entity_id'] : null,
                $mergedPayload,
            );
            if (!$dryRun && !$sameSourceVersion) {
                $applied = $this->persistence->apply($item, $plan, $runId);
                return $this->result($item, $plan, $applied['canonicalEntityId'], $applied['action'] ?? null);
            }
            IngestionObservability::event('item_state', ['runId' => $runId, 'domain' => $item->domain, 'state' => IngestionStateMachine::COMPLETED, 'action' => IngestionPlan::NO_CHANGE, 'dryRun' => $dryRun]);
            return $this->result($item, $plan);
        }

        $domainIdentityKey = $item->domainIdentityKey();
        if ($domainIdentityKey !== null) {
            $domainMatch = $this->persistence->findByDomainIdentity($domainIdentityKey);
            $sameSourceIdentity = $domainMatch !== null && (
                ($domainMatch['source_identity_key'] ?? null) === $item->sourceIdentityKey()
                || (
                    ($domainMatch['source_provider'] ?? null) === $item->sourceProvider
                    && ($domainMatch['source_entity_type'] ?? null) === $item->sourceEntityType
                    && ($domainMatch['source_entity_id'] ?? null) === $item->sourceEntityId
                )
            );
            if ($domainMatch !== null && !$sameSourceIdentity) {
                $sameContent = ($domainMatch['content_hash'] ?? null) === $item->contentHash();
                $plan = $sameContent
                    ? new IngestionPlan(IngestionPlan::DUPLICATE, IngestionStateMachine::COMPLETED, ['domain_exact_duplicate'], (string) ($domainMatch['canonical_entity_id'] ?? ''))
                    : new IngestionPlan(IngestionPlan::REVIEW_REQUIRED, IngestionStateMachine::REVIEW_REQUIRED, ['possible_semantic_duplicate']);
                if (!$dryRun && $plan->action === IngestionPlan::DUPLICATE) {
                    $applied = $this->persistence->apply($item, $plan, $runId);
                    return $this->result($item, $plan, $applied['canonicalEntityId']);
                }
                $this->record($runId, $item, $plan->state, ['action' => $plan->action], $dryRun);
                return $this->result($item, $plan);
            }
        }

        $action = $existing === null ? IngestionPlan::CREATE : IngestionPlan::UPDATE;
        $plan = new IngestionPlan($action, $dryRun ? IngestionStateMachine::PLANNED : IngestionStateMachine::COMPLETED, [], isset($existing['canonical_entity_id']) ? (string) $existing['canonical_entity_id'] : null, $mergedPayload);
        if ($dryRun) {
            $this->record($runId, $item, IngestionStateMachine::PLANNED, ['action' => $action], true);
            return $this->result($item, $plan);
        }
        $applied = $this->persistence->apply($item, $plan, $runId);
        return $this->result($item, $plan, $applied['canonicalEntityId'], $applied['action'] ?? null);
    }

    /** @return array<string,mixed> */
    private function result(CanonicalIngestionItem $item, IngestionPlan $plan, ?string $canonicalId = null, ?string $action = null): array
    {
        return [
            'itemId' => $item->idempotencyKey(),
            'domain' => $item->domain,
            'action' => $action ?? $plan->action,
            'state' => $plan->state,
            'reasonCodes' => $plan->reasonCodes,
            'canonicalEntityId' => $canonicalId ?? $plan->canonicalEntityId,
        ];
    }

    private function record(string $runId, CanonicalIngestionItem $item, string $state, array $details, bool $dryRun): void
    {
        if (!$dryRun) {
            $this->persistence->recordEvent($runId, $item, $state, $details);
        }
        IngestionObservability::event('item_state', ['runId' => $runId, 'domain' => $item->domain, 'state' => $state, 'dryRun' => $dryRun]);
    }

    private static function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
