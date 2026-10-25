<?php

declare(strict_types=1);

require_once __DIR__ . '/../domain/CmBatchTaxonomyPolicy.php';

/** Decisions only change the private review plan; canonical writes happen at execution. */
final class CmBatchTaxonomyReviewService
{
    public function __construct(private readonly PDO $db, private readonly string $actorId) {}

    public function candidates(string $jobId, string $category, string $key, string $search): array
    {
        $job = $this->job($jobId);
        $plan = json_decode($job['dry_run_json'], true, 512, JSON_THROW_ON_ERROR);
        $entity = $this->entity($plan, $category, $key);
        [$type, $level] = CmBatchTaxonomyPolicy::definition($category);
        $parentId = CmBatchTaxonomyPolicy::parentId($entity, $plan['taxonomy']['entities']);
        $search = trim($search);
        if (mb_strlen($search) > 150) throw new InvalidArgumentException('Pesquisa limitada a 150 caracteres.');
        $where = 'type = :type AND ' . ($parentId === null ? 'parent_id IS NULL' : 'parent_id = :parent');
        $params = [':type' => $type];
        if ($parentId !== null) $params[':parent'] = $parentId;
        if ($level !== null) { $where .= ' AND taxonomy_level = :level'; $params[':level'] = $level; }
        if ($search !== '') {
            $where .= ' AND (LOCATE(:name, name) > 0 OR LOCATE(:slug, slug) > 0)';
            $params[':name'] = $search;
            $params[':slug'] = $search;
        }
        $query = $this->db->prepare('SELECT id, name, slug, type, parent_id, taxonomy_level FROM filters WHERE ' . $where . ' ORDER BY name, id LIMIT 50');
        $query->execute($params);
        return $query->fetchAll(PDO::FETCH_ASSOC);
    }

    public function decide(array $input): void
    {
        $reason = trim((string) ($input['reason'] ?? ''));
        if (mb_strlen($reason) < 8 || mb_strlen($reason) > 255) {
            throw new InvalidArgumentException('Informe uma justificativa entre 8 e 255 caracteres.');
        }
        $operation = $input['operation'] ?? '';
        if (!in_array($operation, ['link', 'propose_create'], true)) throw new InvalidArgumentException('Decisao invalida.');
        $this->db->beginTransaction();
        try {
            $job = $this->job((string) ($input['jobId'] ?? ''), true);
            if ($job['status'] !== 'needs_review') throw new DomainException('O lote nao esta disponivel para revisao.');
            if (!hash_equals(hash('sha256', $job['dry_run_json']), (string) ($input['planHash'] ?? ''))) {
                throw new DomainException('A previa foi alterada. Atualize antes de confirmar sua decisao.');
            }
            $plan = json_decode($job['dry_run_json'], true, 512, JSON_THROW_ON_ERROR);
            $category = (string) ($input['category'] ?? '');
            $key = (string) ($input['key'] ?? '');
            $before = $this->entity($plan, $category, $key);
            $canonicalId = null;
            if ($operation === 'link') {
                $query = $this->db->prepare('SELECT id, type, parent_id, taxonomy_level FROM filters WHERE id = :id FOR UPDATE');
                $query->execute([':id' => (int) ($input['canonicalId'] ?? 0)]);
                $candidate = $query->fetch(PDO::FETCH_ASSOC);
                if (!$candidate) throw new InvalidArgumentException('Cadastro canonico inexistente.');
                CmBatchTaxonomyPolicy::assertCandidate($before, $plan['taxonomy']['entities'], $candidate);
                $canonicalId = (int) $candidate['id'];
                $this->persistVerifiedSourceMappings($before, $canonicalId);
            } else {
                CmBatchTaxonomyPolicy::definition($category);
                // A creation proposal is pending, never permission to bypass candidate review.
                CmBatchTaxonomyPolicy::parentId($before, $plan['taxonomy']['entities']);
            }
            foreach ($plan['taxonomy']['entities'] as &$entity) {
                if ($entity['category'] !== $category || $entity['key'] !== $key) continue;
                $entity['canonicalId'] = $canonicalId;
                $entity['status'] = $operation === 'link' ? 'matched_existing' : 'creation_proposed';
                $entity['action'] = $operation === 'link' ? 'link' : 'needs_review';
                $entity['reason'] = $operation === 'link' ? 'administrator_verified_identity' : 'administrator_creation_proposal';
                $entity['decision'] = ['actor' => $this->actorId, 'reason' => $reason, 'at' => gmdate('c')];
                $after = $entity;
            }
            unset($entity);
            if (($before['canonicalId'] ?? null) !== $canonicalId) {
                $plan['taxonomy']['entities'] = CmBatchTaxonomyPolicy::invalidateDescendants($plan['taxonomy']['entities'], $key);
            }
            $plan['taxonomy']['matchedExisting'] = count(array_filter($plan['taxonomy']['entities'], static fn (array $row): bool => $row['status'] === 'matched_existing'));
            $plan['taxonomy']['needsReview'] = count($plan['taxonomy']['entities']) - $plan['taxonomy']['matchedExisting'];
            $plan['taxonomy']['ambiguous'] = count(array_filter($plan['taxonomy']['entities'], static fn (array $row): bool => $row['status'] === 'ambiguous'));
            $update = $this->db->prepare('UPDATE cm_batch_taxonomy_resolutions SET canonical_filter_id = :canonical, resolution_status = :status, matched_by = :matched, match_reason = :reason, decision_by_user_id = :actor, decided_at = CURRENT_TIMESTAMP WHERE job_id = :job AND taxonomy_type = :category AND external_key = :key');
            foreach ($plan['taxonomy']['entities'] as $entity) {
                $isDecision = $entity['category'] === $category && $entity['key'] === $key;
                if (!$isDecision && $entity['reason'] !== 'parent_resolution_changed') continue;
                $update->execute([':canonical' => $entity['canonicalId'], ':status' => $entity['status'], ':matched' => $entity['reason'], ':reason' => $isDecision ? $reason : 'Parent changed; review required', ':actor' => $this->actorId, ':job' => $job['job_id'], ':category' => $entity['category'], ':key' => $entity['key']]);
            }
            $audit = $this->db->prepare("INSERT INTO cm_batch_field_audit (job_id, entity_type, canonical_entity_id, field_name, before_json, after_json, actor_user_id, merge_reason, status) VALUES (:job, 'taxonomy_resolution', :key, 'decision', :before, :after, :actor, 'manual_taxonomy_review', 'applied')");
            $audit->execute([':job' => $job['job_id'], ':key' => $category . ':' . $key, ':before' => json_encode($before, JSON_THROW_ON_ERROR), ':after' => json_encode($after, JSON_THROW_ON_ERROR), ':actor' => $this->actorId]);
            $save = $this->db->prepare('UPDATE cm_batch_import_jobs SET dry_run_json = :plan, approved_by_user_id = NULL, approved_at = NULL WHERE job_id = :job');
            $save->execute([':plan' => json_encode($plan, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), ':job' => $job['job_id']]);
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    private function job(string $id, bool $lock = false): array
    {
        if (preg_match('/^[a-f0-9-]{36}$/i', $id) !== 1) throw new InvalidArgumentException('Identificador de lote invalido.');
        $query = $this->db->prepare('SELECT job_id, status, dry_run_json FROM cm_batch_import_jobs WHERE job_id = :id' . ($lock ? ' FOR UPDATE' : ''));
        $query->execute([':id' => $id]);
        $job = $query->fetch(PDO::FETCH_ASSOC);
        if (!$job) throw new OutOfBoundsException('Lote nao encontrado.');
        return $job;
    }

    private function entity(array $plan, string $category, string $key): array
    {
        $matches = array_values(array_filter($plan['taxonomy']['entities'], static fn (array $row): bool => $row['category'] === $category && $row['key'] === $key));
        if (count($matches) !== 1) throw new InvalidArgumentException('Identidade taxonomica inexistente ou ambigua.');
        return $matches[0];
    }

    private function persistVerifiedSourceMappings(array $entity, int $filterId): void
    {
        [$filterType, $sourceType] = CmBatchTaxonomyPolicy::definition((string) $entity['category']);
        $sourceEntity = is_array($entity['sourceEntity'] ?? null) ? $entity['sourceEntity'] : [];
        foreach (is_array($entity['sourceMappings'] ?? null) ? $entity['sourceMappings'] : [] as $mapping) {
            if (!is_array($mapping)) continue;
            $provider = strtolower(trim((string) ($mapping['provider'] ?? '')));
            $externalId = trim((string) ($mapping['externalId'] ?? ''));
            if ($provider === '' || $externalId === '') continue;
            if (mb_strlen($provider) > 40 || mb_strlen($externalId) > 120) {
                throw new InvalidArgumentException('Identidade de taxonomia excede os limites do cadastro de origem.');
            }
            $find = $this->db->prepare('SELECT filter_id FROM filter_source_identities WHERE filter_type=:type AND source_provider=:provider AND source_entity_type=:entity_type AND source_external_id=:external_id FOR UPDATE');
            $find->execute([':type'=>$filterType, ':provider'=>$provider, ':entity_type'=>$sourceType, ':external_id'=>$externalId]);
            $existing = $find->fetchColumn();
            if ($existing !== false && (int) $existing !== $filterId) {
                throw new DomainException('A identidade externa da taxonomia ja esta vinculada a outro cadastro canonico.');
            }
            $parentExternalId = $sourceEntity['parentExternalId'] ?? null;
            $rootExternalId = $sourceEntity['rootExternalId'] ?? null;
            $insert = $this->db->prepare('INSERT INTO filter_source_identities (filter_id,filter_type,source_provider,source_entity_type,source_external_id,source_parent_external_id,source_root_external_id) VALUES (:filter_id,:type,:provider,:entity_type,:external_id,:parent_id,:root_id) ON DUPLICATE KEY UPDATE filter_id=filter_id');
            $insert->execute([
                ':filter_id'=>$filterId, ':type'=>$filterType, ':provider'=>$provider, ':entity_type'=>$sourceType,
                ':external_id'=>$externalId,
                ':parent_id'=>$parentExternalId !== null ? substr((string) $parentExternalId,0,120) : null,
                ':root_id'=>$rootExternalId !== null ? substr((string) $rootExternalId,0,120) : null,
            ]);
        }
    }
}
