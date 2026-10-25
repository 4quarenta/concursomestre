<?php
declare(strict_types=1);

require_once __DIR__ . '/../domain/CmBatchFieldMerge.php';

/** Scoped metadata merges. Never accepts arbitrary table names or SQL identifiers. */
final class CmBatchFieldAuditService
{
    private const FIELDS = ['description', 'website'];

    public function __construct(private readonly PDO $db, private readonly string $actorId) {}

    public function enrichTaxonomy(string $jobId, int $filterId, string $field, ?string $incoming, array $verifiedEvidence): array
    {
        $this->assertTransaction();
        $this->assertField($field);
        if ($incoming !== null && mb_strlen($incoming) > ($field === 'website' ? 500 : 20000)) {
            throw new InvalidArgumentException('Valor de enriquecimento acima do limite.');
        }
        if ($field === 'website' && $incoming !== null && $incoming !== ''
            && (!filter_var($incoming, FILTER_VALIDATE_URL) || !in_array(strtolower((string)parse_url($incoming, PHP_URL_SCHEME)), ['http','https'], true))) {
            throw new InvalidArgumentException('Website deve ser uma URL HTTP ou HTTPS valida.');
        }
        $find = $this->db->prepare('SELECT `' . $field . '` FROM filters WHERE id = :id FOR UPDATE');
        $find->execute([':id' => $filterId]);
        $row = $find->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new OutOfBoundsException('Taxonomia inexistente.');
        $before = $row[$field];
        $decision = CmBatchFieldMerge::decide($before, $incoming, $verifiedEvidence !== []);
        $status = $decision['action'] === 'enrich' ? 'applied' : ($decision['action'] === 'needs_review' ? 'proposed' : 'unchanged');
        $after = $status === 'applied' ? $decision['value'] : $incoming;
        // Replays preserve the original before value needed by selective undo.
        $prior = $this->db->prepare("SELECT id FROM cm_batch_field_audit WHERE job_id=:job AND entity_type='filter' AND canonical_entity_id=:entity AND field_name=:field AND after_json=:after AND status IN ('applied','proposed','unchanged') LIMIT 1");
        $afterJson = json_encode($after, JSON_THROW_ON_ERROR);
        $prior->execute([':job'=>$jobId, ':entity'=>(string)$filterId, ':field'=>$field, ':after'=>$afterJson]);
        $priorId = $prior->fetchColumn();
        if ($priorId !== false) return ['auditId'=>(int)$priorId, 'action'=>'unchanged', 'reason'=>'idempotent_replay'];
        if ($status === 'applied') {
            $write = $this->db->prepare('UPDATE filters SET `' . $field . '`=:value WHERE id=:id');
            $write->execute([':value'=>$decision['value'], ':id'=>$filterId]);
        }
        $audit = $this->db->prepare("INSERT INTO cm_batch_field_audit (job_id,entity_type,canonical_entity_id,field_name,before_json,after_json,source_evidence_json,actor_user_id,merge_reason,status) VALUES (:job,'filter',:entity,:field,:before,:after,:evidence,:actor,:reason,:status)");
        $audit->execute([':job'=>$jobId, ':entity'=>(string)$filterId, ':field'=>$field, ':before'=>json_encode($before,JSON_THROW_ON_ERROR), ':after'=>$afterJson, ':evidence'=>json_encode($verifiedEvidence,JSON_THROW_ON_ERROR), ':actor'=>$this->actorId, ':reason'=>$decision['reason'], ':status'=>$status]);
        return ['auditId'=>(int)$this->db->lastInsertId(), 'action'=>$decision['action'], 'reason'=>$decision['reason']];
    }

    public function undo(int $auditId, string $jobId): array
    {
        $this->assertTransaction();
        $find = $this->db->prepare('SELECT * FROM cm_batch_field_audit WHERE id=:id AND job_id=:job FOR UPDATE');
        $find->execute([':id'=>$auditId, ':job'=>$jobId]);
        $audit = $find->fetch(PDO::FETCH_ASSOC);
        if (!$audit || $audit['entity_type'] !== 'filter') throw new InvalidArgumentException('Auditoria nao suporta reversao deste campo.');
        if ($audit['status'] === 'rolled_back') return ['status'=>'rolled_back'];
        if ($audit['status'] !== 'applied') throw new DomainException('Somente alteracoes aplicadas podem ser revertidas.');
        $field = $audit['field_name'];
        $this->assertField($field);
        $find = $this->db->prepare('SELECT `' . $field . '` FROM filters WHERE id=:id FOR UPDATE');
        $find->execute([':id'=>$audit['canonical_entity_id']]);
        $current = $find->fetch(PDO::FETCH_ASSOC);
        $after = json_decode($audit['after_json'],true,512,JSON_THROW_ON_ERROR);
        $later = $this->db->prepare("SELECT COUNT(*) FROM cm_batch_field_audit WHERE entity_type='filter' AND canonical_entity_id=:entity AND field_name=:field AND id>:id AND status='applied'");
        $later->execute([':entity'=>$audit['canonical_entity_id'], ':field'=>$field, ':id'=>$auditId]);
        if (!$current || $current[$field] !== $after || (int)$later->fetchColumn() > 0) {
            throw new DomainException('Reversao bloqueada: o campo foi alterado posteriormente.');
        }
        $before = json_decode($audit['before_json'],true,512,JSON_THROW_ON_ERROR);
        $write = $this->db->prepare('UPDATE filters SET `' . $field . '`=:value WHERE id=:id');
        $write->execute([':value'=>$before, ':id'=>$audit['canonical_entity_id']]);
        $write = $this->db->prepare("UPDATE cm_batch_field_audit SET status='rolled_back',rolled_back_at=CURRENT_TIMESTAMP WHERE id=:id");
        $write->execute([':id'=>$auditId]);
        return ['status'=>'rolled_back'];
    }

    private function assertField(string $field): void
    {
        if (!in_array($field,self::FIELDS,true)) throw new InvalidArgumentException('Campo nao permitido para enriquecimento.');
    }

    private function assertTransaction(): void
    {
        if (!$this->db->inTransaction()) throw new LogicException('Enriquecimento exige transacao ativa.');
    }
}
