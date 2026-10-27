<?php
declare(strict_types=1);
require_once __DIR__ . '/../domain/CmBatchTaxonomyPolicy.php';

/** Each executor runs inside the item transaction and must never commit it. */
final class CmBatchQueueService
{
    public function __construct(private readonly PDO $db, private readonly string $actorId) {}

    public function approve(string $jobId, string $planHash, string $archiveHash): void
    {
        $this->db->beginTransaction();
        try {
            $job = $this->lockJob($jobId);
            if ($job['status'] !== 'needs_review') throw new DomainException('Lote indisponivel para aprovacao.');
            if (!hash_equals(hash('sha256',$job['dry_run_json']),$planHash) || !hash_equals($job['archive_sha256'],$archiveHash)) {
                throw new DomainException('Arquivo ou plano alterado; revise a previa atual.');
            }
            $plan = json_decode($job['dry_run_json'],true,512,JSON_THROW_ON_ERROR);
            $this->materializeApprovedTaxonomyProposals($plan, $jobId);
            foreach ($plan['taxonomy']['entities'] ?? [] as $entity) {
                if ($entity['status'] !== 'matched_existing' || empty($entity['canonicalId'])) throw new DomainException('Resolva todas as taxonomias antes de aprovar.');
            }
            $savePlan = $this->db->prepare('UPDATE cm_batch_import_jobs SET dry_run_json=:plan WHERE job_id=:job');
            $savePlan->execute([':plan'=>json_encode($plan,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR),':job'=>$jobId]);
            $skippedExamKeys = [];
            foreach ($plan['exams'] ?? [] as $item) {
                if (!in_array(($item['action'] ?? ''), ['blocked', 'conflict', 'needs_review', 'create', 'link'], true)) {
                    throw new DomainException('O plano contém uma ação de prova não suportada.');
                }
                if (in_array(($item['action'] ?? ''), ['blocked', 'conflict', 'needs_review'], true)) $skippedExamKeys[(string) ($item['externalKey'] ?? '')] = true;
            }
            foreach ($plan['questions']['items'] ?? [] as $item) {
                if (!in_array(($item['action'] ?? ''), ['blocked', 'conflict', 'needs_review', 'create', 'link', 'unchanged', 'enrich'], true)) {
                    throw new DomainException('O plano contém uma ação de questão não suportada.');
                }
            }
            $this->assertArchive($job);
            $skip = $this->db->prepare("UPDATE cm_batch_import_items SET action='blocked',status='blocked',diagnostics_json=COALESCE(diagnostics_json, JSON_OBJECT('reason','blocked_by_dry_run')) WHERE job_id=:id AND action IN ('blocked','conflict','needs_review') AND status='planned'");
            $skip->execute([':id'=>$jobId]);
            $skippedQuestionKeys = [];
            foreach ($plan['questions']['items'] ?? [] as $item) {
                $examKey = (string) ($item['examExternalKey'] ?? '');
                if (isset($skippedExamKeys[$examKey]) || in_array(($item['action'] ?? ''), ['blocked','conflict','needs_review'], true)) {
                    $skippedQuestionKeys[] = substr($examKey . ':' . (string) ($item['tempId'] ?? ''), 0, 190);
                }
            }
            foreach (array_chunk(array_values(array_unique($skippedQuestionKeys)), 300) as $chunkIndex => $chunk) {
                if ($chunk === []) continue;
                $holders = [];
                $params = [':id' => $jobId];
                foreach ($chunk as $index => $externalKey) {
                    $placeholder = ':question_' . $chunkIndex . '_' . $index;
                    $holders[] = $placeholder;
                    $params[$placeholder] = $externalKey;
                }
                $skipQuestions = $this->db->prepare("UPDATE cm_batch_import_items SET action='blocked',status='blocked',diagnostics_json=JSON_OBJECT('reason','question_excluded_by_dry_run') WHERE job_id=:id AND entity_type='question' AND external_key IN (" . implode(',', $holders) . ") AND status='planned'");
                $skipQuestions->execute($params);
            }
            $stmt = $this->db->prepare("UPDATE cm_batch_import_jobs SET status='queued', approved_by_user_id=:actor, approved_at=CURRENT_TIMESTAMP WHERE job_id=:id");
            $stmt->execute([':actor'=>$this->actorId,':id'=>$jobId]);
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    public function transition(string $jobId, string $operation): void
    {
        $this->db->beginTransaction();
        try {
            $job = $this->lockJob($jobId);
            $target = match ($operation) {
                'pause' => in_array($job['status'],['queued','running'],true) ? 'paused' : null,
                'resume' => $job['status']==='paused' ? 'queued' : null,
                'cancel' => in_array($job['status'],['needs_review','queued','running','paused','failed'],true) ? 'cancelled' : null,
                'retry' => $job['status']==='failed' ? 'queued' : null,
                default => null,
            };
            if ($target===null) throw new DomainException('Transicao de fila invalida.');
            if ($operation==='retry') {
                $this->assertArchive($job);
                $stmt=$this->db->prepare("UPDATE cm_batch_import_items SET status='planned',attempt_count=0,next_attempt_at=NULL WHERE job_id=:id AND status='failed'");
                $stmt->execute([':id'=>$jobId]);
            }
            $stmt=$this->db->prepare('UPDATE cm_batch_import_jobs SET status=:status WHERE job_id=:id');
            $stmt->execute([':status'=>$target,':id'=>$jobId]);
            $this->db->commit();
        } catch(Throwable $error) {
            if($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }

    /** @param callable(array,array,PDO):array $execute */
    public function processOne(string $jobId, callable $execute): array
    {
        $item=null;
        $job=null;
        $this->db->beginTransaction();
        try {
            $job=$this->lockJob($jobId);
            if (!in_array($job['status'],['queued','running'],true)) {
                $this->db->rollBack();
                return ['status'=>$job['status']];
            }
            if (empty($job['approved_by_user_id']) || empty($job['approved_at'])) throw new DomainException('Lote sem aprovacao administrativa.');
            $this->assertArchive($job);
            $find=$this->db->prepare("SELECT * FROM cm_batch_import_items WHERE job_id=:job AND status IN ('planned','retry') AND (next_attempt_at IS NULL OR next_attempt_at<=UTC_TIMESTAMP()) ORDER BY CASE entity_type WHEN 'exam' THEN 0 ELSE 1 END,id LIMIT 1 FOR UPDATE");
            $find->execute([':job'=>$jobId]);
            $item=$find->fetch(PDO::FETCH_ASSOC);
            if (!$item) {
                $status=$this->refreshProgress($jobId);
                $this->db->commit();
                return ['status'=>$status];
            }
            $result=$execute($job,$item,$this->db);
            if (!$this->db->inTransaction()) throw new LogicException('O executor encerrou a transacao do checkpoint.');
            if (!isset($result['canonicalId']) || (string)$result['canonicalId']==='') throw new LogicException('Executor nao retornou identidade canonica.');
            $save=$this->db->prepare("UPDATE cm_batch_import_items SET status='done',canonical_entity_id=:id,attempt_count=attempt_count+1,diagnostics_json=:result,next_attempt_at=NULL WHERE id=:item");
            $save->execute([':id'=>(string)$result['canonicalId'],':result'=>json_encode($result,JSON_THROW_ON_ERROR),':item'=>$item['id']]);
            $status=$this->refreshProgress($jobId);
            $this->db->commit();
            return ['status'=>$status,'itemId'=>(int)$item['id'],'result'=>$result];
        } catch(Throwable $error) {
            if($this->db->inTransaction()) $this->db->rollBack();
            if (!$item || !$job) throw $error;
            $this->recordFailure($jobId,(int)$item['id'],$error);
            return ['status'=>'item_failed','itemId'=>(int)$item['id']];
        }
    }

    private function recordFailure(string $jobId,int $itemId,Throwable $error): void
    {
        $this->db->beginTransaction();
        try {
            $job=$this->lockJob($jobId);
            $find=$this->db->prepare('SELECT status,attempt_count FROM cm_batch_import_items WHERE id=:id AND job_id=:job FOR UPDATE');
            $find->execute([':id'=>$itemId,':job'=>$jobId]);
            $item=$find->fetch(PDO::FETCH_ASSOC);
            if (!$item || $item['status']==='done') { $this->db->commit(); return; }
            $attempt=(int)$item['attempt_count']+1;
            $retryable=$error instanceof PDOException && in_array((string)$error->getCode(),['40001','HY000'],true);
            $status=$retryable && $attempt<5 ? 'retry' : 'failed';
            $delay=min(300,2 ** min($attempt,8));
            $diagnostic=['code'=>$retryable?'database_retry':'item_rejected','exceptionType'=>get_class($error),'message'=>mb_substr(trim(preg_replace('/[\r\n\t]+/u',' ',$error->getMessage())??''),0,500),'attempt'=>$attempt];
            $stmt=$this->db->prepare("UPDATE cm_batch_import_items SET status=:status,attempt_count=:attempt,diagnostics_json=:diagnostic,next_attempt_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL $delay SECOND) WHERE id=:id");
            $stmt->execute([':status'=>$status,':attempt'=>$attempt,':diagnostic'=>json_encode($diagnostic,JSON_THROW_ON_ERROR),':id'=>$itemId]);
            if (in_array($job['status'],['queued','running'],true)) $this->refreshProgress($jobId);
            $this->db->commit();
        } catch(Throwable $failure) {
            if($this->db->inTransaction()) $this->db->rollBack();
            throw $failure;
        }
    }

    private function refreshProgress(string $jobId): string
    {
        $stmt=$this->db->prepare('SELECT entity_type,status,COUNT(*) AS total FROM cm_batch_import_items WHERE job_id=:job GROUP BY entity_type,status');
        $stmt->execute([':job'=>$jobId]);
        $progress=['completedExams'=>0,'completedQuestions'=>0,'failed'=>0,'blocked'=>0,'pending'=>0];
        foreach($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if($row['status']==='done') {
                $key=$row['entity_type']==='exam'?'completedExams':'completedQuestions';
                $progress[$key]+=(int)$row['total'];
            } elseif($row['status']==='failed') $progress['failed']+=(int)$row['total'];
            elseif($row['status']==='blocked') $progress['blocked']+=(int)$row['total'];
            else $progress['pending']+=(int)$row['total'];
        }
        $status=$progress['failed']>0?'failed':($progress['pending']>0?'running':'completed');
        $stmt=$this->db->prepare('UPDATE cm_batch_import_jobs SET status=:status,progress_json=:progress WHERE job_id=:job');
        $stmt->execute([':status'=>$status,':progress'=>json_encode($progress,JSON_THROW_ON_ERROR),':job'=>$jobId]);
        return $status;
    }

    private function assertArchive(array $job): void
    {
        $path=$job['archive_path'];
        if(!is_file($path) || is_link($path) || !hash_equals($job['archive_sha256'],(string)hash_file('sha256',$path))) {
            throw new DomainException('Arquivo privado ausente ou alterado. Reenvie o lote para validacao.');
        }
    }

    private function materializeApprovedTaxonomyProposals(array &$plan, string $jobId): void
    {
        $entities = &$plan['taxonomy']['entities'];
        if (!is_array($entities ?? null)) return;
        $createdCount=0;
        $pending = [];
        foreach ($entities as $index => $entity) if (($entity['status'] ?? '') === 'creation_proposed') $pending[] = $index;
        while ($pending !== []) {
            $progress = false;
            foreach ($pending as $position => $index) {
                $entity = $entities[$index];
                try { $parentId = CmBatchTaxonomyPolicy::parentId($entity, $entities); }
                catch (DomainException) { continue; }
                [$type,$level] = CmBatchTaxonomyPolicy::definition((string)$entity['category']);
                $name=trim((string)($entity['name']??''));
                $slug=trim((string)($entity['sourceEntity']['slug']??''));
                if ($name==='' || mb_strlen($name)>255) throw new DomainException('Nome de nova taxonomia invalido.');
                if ($slug==='') {
                    $slug=mb_strtolower($name,'UTF-8');
                    $slug=iconv('UTF-8','ASCII//TRANSLIT//IGNORE',$slug)?:$slug;
                    $slug=preg_replace('/[^a-z0-9]+/','-',$slug)??'';
                    $slug=trim($slug,'-');
                }
                if ($slug==='' || mb_strlen($slug)>255) throw new DomainException('Slug de nova taxonomia invalido.');
                $identity=hash('sha256',json_encode(['taxonomy',$type,$parentId,$slug],JSON_THROW_ON_ERROR));
                $lock=$this->db->prepare('INSERT IGNORE INTO cm_batch_identity_locks (identity_key) VALUES (:key)');
                $lock->execute([':key'=>$identity]);
                $lock=$this->db->prepare('SELECT identity_key FROM cm_batch_identity_locks WHERE identity_key=:key FOR UPDATE');
                $lock->execute([':key'=>$identity]);
                $find=$this->db->prepare('SELECT id FROM filters WHERE type=:type AND (name=:name OR slug=:slug) AND ((:parent_null IS NULL AND parent_id IS NULL) OR parent_id=:parent_id) LIMIT 1 FOR UPDATE');
                $find->bindValue(':type',$type);
                $find->bindValue(':name',$name);
                $find->bindValue(':slug',$slug);
                $find->bindValue(':parent_null',$parentId,$parentId===null?PDO::PARAM_NULL:PDO::PARAM_INT);
                $find->bindValue(':parent_id',$parentId,$parentId===null?PDO::PARAM_NULL:PDO::PARAM_INT);
                $find->execute();
                if ($find->fetchColumn()!==false) throw new DomainException('Surgiu uma taxonomia equivalente desde a previa. Resolva o cadastro existente antes de aprovar.');
                $levelValue=$level;
                $insert=$this->db->prepare('INSERT INTO filters (type,name,slug,parent_id,meta_materia,meta_carreira,taxonomy_level) VALUES (:type,:name,:slug,:parent,:subject,:career,:level)');
                $insert->execute([':type'=>$type,':name'=>$name,':slug'=>$slug,':parent'=>$parentId,':subject'=>$entity['category']==='subjects'?1:0,':career'=>$entity['category']==='careers'?1:0,':level'=>$levelValue]);
                $canonicalId=(int)$this->db->lastInsertId();
                $createdCount++;
                $this->persistApprovedTaxonomySources($entity,$canonicalId,$type,(string)$jobId);
                $before=$entity;
                $entities[$index]['canonicalId']=$canonicalId;
                $entities[$index]['status']='matched_existing';
                $entities[$index]['action']='link';
                $entities[$index]['reason']='created_on_explicit_batch_approval';
                $entities[$index]['decision']=['actor'=>$this->actorId,'reason'=>'approved_batch_taxonomy_creation','at'=>gmdate('c')];
                $audit=$this->db->prepare("INSERT INTO cm_batch_field_audit (job_id,entity_type,canonical_entity_id,field_name,before_json,after_json,actor_user_id,merge_reason,status) VALUES (:job,'taxonomy',:id,'creation',:before,:after,:actor,'explicit_batch_approval','applied')");
                $audit->execute([':job'=>$jobId,':id'=>(string)$canonicalId,':before'=>json_encode($before,JSON_THROW_ON_ERROR),':after'=>json_encode($entities[$index],JSON_THROW_ON_ERROR),':actor'=>$this->actorId]);
                $resolution=$this->db->prepare("UPDATE cm_batch_taxonomy_resolutions SET canonical_filter_id=:id,resolution_status='matched_existing',matched_by='approved_creation',match_reason='created_on_explicit_batch_approval',decision_by_user_id=:actor,decided_at=CURRENT_TIMESTAMP WHERE job_id=:job AND taxonomy_type=:category AND external_key=:key");
                $resolution->execute([':id'=>$canonicalId,':actor'=>$this->actorId,':job'=>$jobId,':category'=>$entity['category'],':key'=>$entity['key']]);
                unset($pending[$position]);
                $progress=true;
            }
            if (!$progress) throw new DomainException('Ha propostas de taxonomia sem pai resolvido ou com hierarquia circular.');
            $pending=array_values($pending);
        }
        $plan['taxonomy']['matchedExisting']=count(array_filter($entities,static fn(array $row):bool=>($row['status']??'')==='matched_existing'));
        $plan['taxonomy']['created']=$createdCount;
        $plan['taxonomy']['needsReview']=count($entities)-$plan['taxonomy']['matchedExisting'];
    }

    private function persistApprovedTaxonomySources(array $entity,int $filterId,string $filterType,string $jobId): void
    {
        $sourceEntity=is_array($entity['sourceEntity']??null)?$entity['sourceEntity']:[];
        foreach(is_array($entity['sourceMappings']??null)?$entity['sourceMappings']:[] as $mapping) {
            if(!is_array($mapping))continue;
            $provider=strtolower(trim((string)($mapping['provider']??'')));
            $externalId=trim((string)($mapping['externalId']??''));
            if($provider===''||$externalId==='')continue;
            if(mb_strlen($provider)>40||mb_strlen($externalId)>120)throw new DomainException('Identidade externa excede os limites do cadastro.');
            $check=$this->db->prepare('SELECT filter_id FROM filter_source_identities WHERE filter_type=:type AND source_provider=:provider AND source_entity_type=:entity_type AND source_external_id=:external FOR UPDATE');
            $check->execute([':type'=>$filterType,':provider'=>$provider,':entity_type'=>CmBatchTaxonomyPolicy::definition((string)$entity['category'])[1],':external'=>$externalId]);
            $existing=$check->fetchColumn();
            if($existing!==false&&(int)$existing!==$filterId)throw new DomainException('Identidade externa ja vinculada a outro filtro canonico.');
            $insert=$this->db->prepare('INSERT INTO filter_source_identities (filter_id,filter_type,source_provider,source_entity_type,source_external_id,source_parent_external_id,source_root_external_id) VALUES (:id,:type,:provider,:entity_type,:external,:parent,:root) ON DUPLICATE KEY UPDATE filter_id=filter_id');
            $insert->execute([':id'=>$filterId,':type'=>$filterType,':provider'=>$provider,':entity_type'=>CmBatchTaxonomyPolicy::definition((string)$entity['category'])[1],':external'=>$externalId,':parent'=>isset($sourceEntity['parentExternalId'])?substr((string)$sourceEntity['parentExternalId'],0,120):null,':root'=>isset($sourceEntity['rootExternalId'])?substr((string)$sourceEntity['rootExternalId'],0,120):null]);
        }
    }

    private function lockJob(string $id): array
    {
        $stmt=$this->db->prepare('SELECT * FROM cm_batch_import_jobs WHERE job_id=:id FOR UPDATE');
        $stmt->execute([':id'=>$id]);
        $job=$stmt->fetch(PDO::FETCH_ASSOC);
        if(!$job) throw new OutOfBoundsException('Lote inexistente.');
        return $job;
    }
}
