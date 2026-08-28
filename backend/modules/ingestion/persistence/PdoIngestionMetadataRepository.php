<?php

declare(strict_types=1);

require_once __DIR__ . '/../contracts/CanonicalIngestionItem.php';
require_once __DIR__ . '/../domain/IngestionPlan.php';
require_once __DIR__ . '/../domain/IngestionStateMachine.php';
require_once __DIR__ . '/../observability/IngestionObservability.php';

/**
 * Persists only ingestion control-plane metadata. Domain repositories remain
 * responsible for writing their own canonical aggregates inside this boundary.
 */
final class PdoIngestionMetadataRepository implements IngestionPersistencePort
{
    public function __construct(
        private readonly PDO $db,
        private readonly ?CanonicalEntityPersistencePort $canonicalPersistence = null,
    ) {
    }

    public function startRun(string $runId, string $sourceProvider, string $contractVersion): void
    {
        $stmt = $this->db->prepare(
            'INSERT IGNORE INTO ingestion_runs (run_id, source_provider, contract_version, status)
             VALUES (:run_id, :provider, :contract_version, :status)'
        );
        $stmt->execute([
            ':run_id' => $runId,
            ':provider' => $sourceProvider,
            ':contract_version' => $contractVersion,
            ':status' => IngestionStateMachine::RECEIVED,
        ]);
    }

    public function checkpointRun(string $runId, string $cursor): void
    {
        $stmt = $this->db->prepare(
            'UPDATE ingestion_runs SET cursor_value = :cursor, status = :status WHERE run_id = :run_id'
        );
        $stmt->execute([':cursor' => $cursor, ':status' => IngestionStateMachine::PERSISTED, ':run_id' => $runId]);
    }

    public function completeRun(string $runId): void
    {
        $stmt = $this->db->prepare(
            'UPDATE ingestion_runs SET status = :status, completed_at = UTC_TIMESTAMP() WHERE run_id = :run_id'
        );
        $stmt->execute([':status' => IngestionStateMachine::COMPLETED, ':run_id' => $runId]);
    }

    public function failRun(string $runId, string $failureClass): void
    {
        $status = $failureClass === IngestionFailureClassifier::TRANSIENT
            ? IngestionStateMachine::RETRYABLE_FAILED
            : IngestionStateMachine::REVIEW_REQUIRED;
        $stmt = $this->db->prepare(
            'UPDATE ingestion_runs SET status = :status, last_error_class = :error_class WHERE run_id = :run_id'
        );
        $stmt->execute([':status' => $status, ':error_class' => $failureClass, ':run_id' => $runId]);
    }

    public function findBySourceIdentity(CanonicalIngestionItem $item): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id, source_version, content_hash, canonical_domain, canonical_entity_id, action, status
             FROM ingestion_items
             WHERE source_provider = :provider
               AND source_entity_type = :entity_type
               AND source_entity_id = :entity_id
             ORDER BY id DESC LIMIT 1'
        );
        $stmt->execute([
            ':provider' => $item->sourceProvider,
            ':entity_type' => $item->sourceEntityType,
            ':entity_id' => $item->sourceEntityId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $this->withCanonicalPayload($row) : null;
    }

    public function findByIdempotencyKey(string $key): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM ingestion_items WHERE idempotency_key = :key LIMIT 1');
        $stmt->execute([':key' => $key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function findByDomainIdentity(string $domainIdentityKey): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM ingestion_items WHERE domain_identity_key = :key ORDER BY id DESC LIMIT 1');
        $stmt->execute([':key' => $domainIdentityKey]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function apply(CanonicalIngestionItem $item, IngestionPlan $plan, string $runId): array
    {
        $canonicalId = $plan->canonicalEntityId ?? $item->domain . ':' . $item->sourceIdentityKey();
        $mutatesCanonical = in_array($plan->action, [IngestionPlan::CREATE, IngestionPlan::UPDATE, IngestionPlan::DEPRECATE], true);
        if ($mutatesCanonical && $this->canonicalPersistence === null) {
            throw new LogicException('Persistencia canonica obrigatoria para mutacao de ingestao.');
        }
        $startedTransaction = !$this->db->inTransaction();
        if ($startedTransaction) {
            $this->db->beginTransaction();
        }
        try {
            $this->startRun($runId, $item->sourceProvider, $this->contractVersion($item));
            if ($mutatesCanonical) {
                $canonicalResult = $this->canonicalPersistence->persist($item, $plan, $canonicalId);
                $canonicalId = $canonicalResult['canonicalEntityId'];
            }
            $stmt = $this->db->prepare(
                'INSERT INTO ingestion_items
                 (run_id, idempotency_key, source_provider, source_entity_type,
                 source_entity_id, source_version, content_hash, domain_identity_key, canonical_domain,
                  canonical_entity_id, status, action, attempt_count)
                 VALUES (:run_id, :idempotency_key, :provider, :entity_type,
                         :entity_id, :source_version, :content_hash, :domain_identity_key, :domain,
                         :canonical_entity_id, :status, :action, 1)
                 ON DUPLICATE KEY UPDATE
                    run_id = VALUES(run_id), idempotency_key = VALUES(idempotency_key),
                    content_hash = VALUES(content_hash), domain_identity_key = VALUES(domain_identity_key),
                    canonical_domain = VALUES(canonical_domain), canonical_entity_id = VALUES(canonical_entity_id),
                    status = VALUES(status), action = VALUES(action),
                    attempt_count = attempt_count + 1, updated_at = UTC_TIMESTAMP()'
            );
            $stmt->execute([
                ':run_id' => $runId,
                ':idempotency_key' => $item->idempotencyKey(),
                ':provider' => $item->sourceProvider,
                ':entity_type' => $item->sourceEntityType,
                ':entity_id' => $item->sourceEntityId,
                ':source_version' => $item->sourceVersion,
                ':content_hash' => CanonicalIngestionItem::payloadHash(
                    $plan->mergedPayload !== [] ? $plan->mergedPayload : $item->payload
                ),
                ':domain_identity_key' => $item->domainIdentityKey(),
                ':domain' => $item->domain,
                ':canonical_entity_id' => $canonicalId,
                ':status' => IngestionStateMachine::COMPLETED,
                ':action' => $plan->action,
            ]);
            $this->recordProvenance($item, $runId, $canonicalId);
            $this->recordEvent($runId, $item, IngestionStateMachine::COMPLETED, ['action' => $plan->action]);
            if ($startedTransaction) {
                $this->db->commit();
            }
            IngestionObservability::event('persisted', [
                'runId' => $runId,
                'domain' => $item->domain,
                'sourceProvider' => $item->sourceProvider,
                'action' => $plan->action,
            ]);
            return ['canonicalEntityId' => $canonicalId, 'action' => $plan->action];
        } catch (Throwable $exception) {
            if ($startedTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    public function recordProvenance(CanonicalIngestionItem $item, string $runId, string $canonicalEntityId): void
    {
        $stmt = $this->db->prepare(
            'INSERT INTO ingestion_provenance
             (item_idempotency_key, run_id, domain, canonical_entity_id,
              source_provider, source_entity_type, source_entity_id, source_version,
              source_reference, first_seen_at, last_seen_at)
             VALUES (:item_key, :run_id, :domain, :canonical_id, :provider,
                     :entity_type, :entity_id, :source_version, :source_reference,
                     UTC_TIMESTAMP(), UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE last_seen_at = UTC_TIMESTAMP(),
                canonical_entity_id = VALUES(canonical_entity_id)'
        );
        $reference = isset($item->sourceMetadata['reference'])
            ? substr((string) $item->sourceMetadata['reference'], 0, 1000)
            : null;
        $stmt->execute([
            ':item_key' => $item->idempotencyKey(),
            ':run_id' => $runId,
            ':domain' => $item->domain,
            ':canonical_id' => $canonicalEntityId,
            ':provider' => $item->sourceProvider,
            ':entity_type' => $item->sourceEntityType,
            ':entity_id' => $item->sourceEntityId,
            ':source_version' => $item->sourceVersion,
            ':source_reference' => $reference,
        ]);
    }

    public function recordEvent(string $runId, CanonicalIngestionItem $item, string $state, array $details = []): void
    {
        $safe = [];
        foreach ($details as $key => $value) {
            if (preg_match('/payload|content|body|token|secret|password|cookie/i', (string) $key) === 1) continue;
            if (is_scalar($value) || $value === null) $safe[(string) $key] = $value;
        }
        $stmt = $this->db->prepare(
            'INSERT INTO ingestion_item_events
             (run_id, item_idempotency_key, state, details_json)
             VALUES (:run_id, :item_key, :state, :details)'
        );
        $stmt->execute([
            ':run_id' => $runId,
            ':item_key' => $item->idempotencyKey(),
            ':state' => $state,
            ':details' => json_encode($safe, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
        ]);
    }

    public function acquireLease(string $sourceKey, string $leaseId, int $ttlSeconds): bool
    {
        $ttlSeconds = max(1, min(3600, $ttlSeconds));
        $stmt = $this->db->prepare(
            'INSERT INTO ingestion_leases (source_key, lease_id, expires_at)
             VALUES (:source_key, :lease_id, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ' . $ttlSeconds . ' SECOND))
             ON DUPLICATE KEY UPDATE
                lease_id = IF(expires_at <= UTC_TIMESTAMP() OR lease_id = VALUES(lease_id), VALUES(lease_id), lease_id),
                expires_at = IF(lease_id = VALUES(lease_id), VALUES(expires_at), expires_at)'
        );
        $stmt->bindValue(':source_key', $sourceKey);
        $stmt->bindValue(':lease_id', $leaseId);
        $stmt->execute();
        $check = $this->db->prepare('SELECT lease_id FROM ingestion_leases WHERE source_key = :source_key LIMIT 1');
        $check->execute([':source_key' => $sourceKey]);
        return hash_equals($leaseId, (string) $check->fetchColumn());
    }

    public function releaseLease(string $sourceKey, string $leaseId): void
    {
        $stmt = $this->db->prepare('DELETE FROM ingestion_leases WHERE source_key = :source_key AND lease_id = :lease_id');
        $stmt->execute([':source_key' => $sourceKey, ':lease_id' => $leaseId]);
    }

    private function contractVersion(CanonicalIngestionItem $item): string
    {
        return $item->domain . '-ingestion.v1';
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private function withCanonicalPayload(array $row): array
    {
        $canonicalId = trim((string) ($row['canonical_entity_id'] ?? ''));
        $domain = trim((string) ($row['canonical_domain'] ?? ''));
        if ($this->canonicalPersistence !== null && $canonicalId !== '' && $domain !== '') {
            $payload = $this->canonicalPersistence->loadPayload($domain, $canonicalId);
            if ($payload !== null) {
                $row['payload'] = $payload;
            }
        }
        return $row;
    }
}
