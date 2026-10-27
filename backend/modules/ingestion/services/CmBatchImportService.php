<?php

declare(strict_types=1);

require_once __DIR__ . '/CmBatchZipValidator.php';
require_once __DIR__ . '/../domain/CmBatchQuestionIdentity.php';

/** Private staging and control-plane operations for cm-batch.v1. */
final class CmBatchImportService
{
    private const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

    public function __construct(private readonly PDO $db, private readonly string $actorUserId)
    {
    }

    public function previewUpload(array $upload, bool $persist = true): array
    {
        if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new InvalidArgumentException('Falha ao receber o ZIP (codigo ' . (int) ($upload['error'] ?? -1) . ').');
        }
        $temporaryPath = (string) ($upload['tmp_name'] ?? '');
        $size = (int) ($upload['size'] ?? 0);
        $name = basename((string) ($upload['name'] ?? ''));
        if ($size < 1 || $size > self::MAX_UPLOAD_BYTES || !is_uploaded_file($temporaryPath)) {
            throw new InvalidArgumentException('O arquivo enviado nao e um upload valido ou excede 100 MB.');
        }
        if (strtolower(pathinfo($name, PATHINFO_EXTENSION)) !== 'zip') {
            throw new InvalidArgumentException('Envie um arquivo com extensao .zip.');
        }
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($temporaryPath);
        if (!in_array($mime, ['application/zip', 'application/x-zip', 'application/x-zip-compressed'], true)) {
            throw new InvalidArgumentException('O conteudo enviado nao foi identificado como ZIP.');
        }

        $summary = (new CmBatchZipValidator())->validate($temporaryPath);
        if (!$persist) {
            return [
                'jobId' => null,
                'batchId' => $summary['batchId'],
                'archiveSha256' => $summary['archiveSha256'],
                'datasetLabel' => $summary['datasetLabel'],
                'status' => 'validated_only',
                'planHash' => null,
                'manifest' => $this->readManifest($temporaryPath),
                'plan' => $this->buildConservativePreview($temporaryPath, $summary),
                'progress' => null,
            ];
        }
        $existing = $this->db->prepare('SELECT job_id, status FROM cm_batch_import_jobs WHERE archive_sha256 = :sha LIMIT 1');
        $existing->execute([':sha' => $summary['archiveSha256']]);
        $prior = $existing->fetch(PDO::FETCH_ASSOC);
        if (is_array($prior)) {
            return $this->getJob((string) $prior['job_id']);
        }

        $storageDirectory = $this->privateStorageDirectory();
        $jobId = $this->uuidV4();
        $storedPath = $storageDirectory . DIRECTORY_SEPARATOR . $jobId . '.zip';
        if (!move_uploaded_file($temporaryPath, $storedPath)) {
            throw new RuntimeException('Nao foi possivel mover o ZIP para o armazenamento privado.');
        }
        @chmod($storedPath, 0600);
        try {
            $manifest = $this->readManifest($storedPath);
            $plan = $this->buildConservativePreview($storedPath, $summary);
            $insert = $this->db->prepare(
                "INSERT INTO cm_batch_import_jobs
                    (job_id, batch_id, archive_sha256, source_provider, dataset_label, archive_path,
                     status, manifest_json, dry_run_json, progress_json, actor_user_id)
                 VALUES (:job_id, :batch_id, :sha, :provider, :label, :path,
                         'needs_review', :manifest, :plan, :progress, :actor)"
            );
            $this->db->beginTransaction();
            $insert->execute([
                ':job_id' => $jobId,
                ':batch_id' => $summary['batchId'],
                ':sha' => $summary['archiveSha256'],
                ':provider' => (string) ($manifest['sourceProviders'][0] ?? 'unknown'),
                ':label' => (string) $summary['datasetLabel'],
                ':path' => $storedPath,
                ':manifest' => json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                ':plan' => json_encode($plan, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                ':progress' => json_encode(['completedExams' => 0, 'completedQuestions' => 0, 'totalExams' => count($summary['exams']), 'totalQuestions' => (int) $summary['questionCount']], JSON_THROW_ON_ERROR),
                ':actor' => $this->actorUserId,
            ]);
            $this->persistDryRunEntities($jobId, $plan);
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            if (is_file($storedPath)) {
                @unlink($storedPath);
            }
            if ($error instanceof PDOException && (string) $error->getCode() === '23000') {
                $winner = $this->db->prepare('SELECT job_id FROM cm_batch_import_jobs WHERE archive_sha256 = :sha LIMIT 1');
                $winner->execute([':sha' => $summary['archiveSha256']]);
                $existingJobId = $winner->fetchColumn();
                if ($existingJobId !== false) {
                    return $this->getJob((string) $existingJobId);
                }
            }
            throw $error;
        }

        return $this->getJob($jobId);
    }

    public function getJob(string $jobId): array
    {
        if (preg_match('/^[a-f0-9-]{36}$/i', $jobId) !== 1) {
            throw new InvalidArgumentException('Identificador de importacao invalido.');
        }
        $stmt = $this->db->prepare(
            'SELECT job_id, batch_id, archive_sha256, dataset_label, status, manifest_json,
                    dry_run_json, progress_json, last_error, created_at, updated_at
             FROM cm_batch_import_jobs WHERE job_id = :job_id LIMIT 1'
        );
        $stmt->execute([':job_id' => $jobId]);
        $job = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($job)) {
            throw new OutOfBoundsException('Importacao nao encontrada.');
        }
        $items = $this->db->prepare(
            'SELECT id, entity_type, external_key, action, status, canonical_entity_id,
                    attempt_count, diagnostics_json, updated_at
             FROM cm_batch_import_items WHERE job_id=:job ORDER BY id'
        );
        $items->execute([':job' => $jobId]);
        $itemRows = array_map(static function (array $item): array {
            return [
                'id' => (int) $item['id'],
                'entityType' => (string) $item['entity_type'],
                'externalKey' => (string) $item['external_key'],
                'action' => (string) $item['action'],
                'status' => (string) $item['status'],
                'canonicalId' => $item['canonical_entity_id'] !== null ? (string) $item['canonical_entity_id'] : null,
                'attempts' => (int) $item['attempt_count'],
                'diagnostics' => json_decode((string) ($item['diagnostics_json'] ?? ''), true) ?: [],
                'updatedAt' => (string) $item['updated_at'],
            ];
        }, $items->fetchAll(PDO::FETCH_ASSOC) ?: []);
        return [
            'jobId' => (string) $job['job_id'],
            'batchId' => (string) $job['batch_id'],
            'archiveSha256' => (string) $job['archive_sha256'],
            'datasetLabel' => (string) $job['dataset_label'],
            'status' => (string) $job['status'],
            'planHash' => hash('sha256', (string) $job['dry_run_json']),
            'manifest' => json_decode((string) $job['manifest_json'], true) ?: [],
            'plan' => json_decode((string) ($job['dry_run_json'] ?? ''), true) ?: [],
            'progress' => json_decode((string) ($job['progress_json'] ?? ''), true) ?: [],
            'items' => $itemRows,
            'lastError' => $job['last_error'] !== null ? (string) $job['last_error'] : null,
            'createdAt' => (string) $job['created_at'],
            'updatedAt' => (string) $job['updated_at'],
        ];
    }

    private function buildConservativePreview(string $archivePath, array $summary): array
    {
        $zip = new ZipArchive();
        if ($zip->open($archivePath, ZipArchive::RDONLY) !== true) {
            throw new RuntimeException('Nao foi possivel abrir o lote validado para montar o dry-run.');
        }
        try {
            $taxonomyDocument = json_decode((string) $zip->getFromName('taxonomias-global.json'), true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($taxonomyDocument)) {
                throw new RuntimeException('Contrato taxonomico ausente durante o dry-run.');
            }
            $taxonomyPlan = $this->resolveTaxonomiesConservatively($taxonomyDocument);
            $questionPlan = $this->planQuestions($zip, $summary, $taxonomyDocument, $taxonomyPlan);
        } finally {
            $zip->close();
        }
        $reviewQuestions = 0;
        foreach ($summary['exams'] as $exam) {
            $reviewQuestions += (int) ($exam['needsReview'] ?? 0);
        }
        return [
            'mode' => 'dry-run',
            'canonicalWrites' => 0,
            'questionWrites' => 0,
            'taxonomy' => [
                'declared' => count($taxonomyPlan['entities']),
                'matchedExisting' => $taxonomyPlan['counts']['matched_existing'],
                'created' => 0,
                'ambiguous' => $taxonomyPlan['counts']['ambiguous'],
                'needsReview' => $taxonomyPlan['counts']['needs_review'],
                'entities' => $taxonomyPlan['entities'],
            ],
            'exams' => $this->planExams($summary['exams']),
            'questions' => [
                'total' => (int) $summary['questionCount'],
                'needsReview' => $reviewQuestions,
                'pendingPublication' => (int) $summary['questionCount'],
                'publishable' => 0,
                'actions' => $questionPlan['counts'],
                'items' => $questionPlan['items'],
            ],
            'mediaCount' => (int) $summary['mediaCount'],
            'warnings' => $summary['warnings'],
            'blockers' => [
                'Taxonomias precisam ser resolvidas para IDs canonicos locais antes da importacao.',
                'Nenhum item pendente sera publicado automaticamente.',
                'A execucao efetiva permanece bloqueada ate a revisao das identidades e ocorrencias.',
            ],
        ];
    }

    private function persistDryRunEntities(string $jobId, array $plan): void
    {
        $examInsert = $this->db->prepare(
            'INSERT INTO cm_batch_import_items
                (job_id, entity_type, external_key, content_hash, action, status, canonical_entity_id, payload_json, diagnostics_json)
             VALUES (:job_id, \'exam\', :external_key, :content_hash, :action, \'planned\', :canonical_id, :payload, :diagnostics)'
        );
        foreach ($plan['exams'] as $exam) {
            $examInsert->execute([
                ':job_id' => $jobId,
                ':external_key' => substr((string) $exam['externalKey'], 0, 190),
                ':content_hash' => hash('sha256', json_encode([
                    $exam['correctYear'], $exam['metadata'], $exam['provenance'] ?? [],
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)),
                ':action' => $exam['action'],
                ':canonical_id' => isset($exam['canonicalExamId']) ? (string) $exam['canonicalExamId'] : null,
                ':payload' => json_encode([
                    'externalKey' => $exam['externalKey'],
                    'correctYear' => $exam['correctYear'],
                    'questionCount' => $exam['questionCount'],
                    'metadata' => $exam['metadata'],
                    'provenance' => $exam['provenance'] ?? [],
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                ':diagnostics' => json_encode(['reason' => $exam['reason']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            ]);
        }

        $taxonomyInsert = $this->db->prepare(
            'INSERT INTO cm_batch_taxonomy_resolutions
                (job_id, taxonomy_type, provider, external_id, external_key, parent_external_key,
                 canonical_filter_id, resolution_status, matched_by, match_reason)
             VALUES (:job_id, :type, :provider, :external_id, :external_key, :parent_key,
                     :canonical_id, :status, :matched_by, :reason)'
        );
        foreach ($plan['taxonomy']['entities'] as $entity) {
            $mapping = is_array($entity['sourceMappings'][0] ?? null) ? $entity['sourceMappings'][0] : [];
            $externalId = trim((string) ($mapping['externalId'] ?? $entity['key']));
            $taxonomyInsert->execute([
                ':job_id' => $jobId,
                ':type' => substr((string) $entity['category'], 0, 40),
                ':provider' => substr(strtolower((string) ($mapping['provider'] ?? 'unknown')), 0, 80),
                ':external_id' => substr($externalId !== '' ? $externalId : (string) $entity['key'], 0, 120),
                ':external_key' => substr((string) $entity['key'], 0, 190),
                ':parent_key' => isset($entity['parentKey']) ? substr((string) $entity['parentKey'], 0, 190) : null,
                ':canonical_id' => $entity['canonicalId'],
                ':status' => $entity['status'],
                ':matched_by' => $entity['reason'],
                ':reason' => $entity['reason'],
            ]);
        }

        $questionInsert = $this->db->prepare(
            'INSERT INTO cm_batch_import_items
                (job_id, entity_type, external_key, content_hash, action, status, canonical_entity_id, payload_json, diagnostics_json)
             VALUES (:job_id, \'question\', :external_key, :content_hash, :action, \'planned\', :canonical_id, :payload, :diagnostics)'
        );
        foreach ($plan['questions']['items'] as $question) {
            $externalKey = (string) $question['examExternalKey'] . ':' . (string) $question['tempId'];
            $questionInsert->execute([
                ':job_id' => $jobId,
                ':external_key' => substr($externalKey, 0, 190),
                ':content_hash' => $question['fingerprint'],
                ':action' => $question['action'],
                ':canonical_id' => isset($question['canonicalQuestionId']) ? (string) $question['canonicalQuestionId'] : null,
                ':payload' => json_encode([
                    'examExternalKey' => $question['examExternalKey'],
                    'tempId' => $question['tempId'],
                    'questionNumber' => $question['questionNumber'],
                    'externalQuestionId' => $question['externalQuestionId'] ?? null,
                    'canonicalQuestionId' => $question['canonicalQuestionId'] ?? null,
                    'canonicalUpdatedAt' => $question['canonicalUpdatedAt'] ?? null,
                    'publication' => $question['publication'],
                    'answerStatus' => $question['answerStatus'],
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                ':diagnostics' => json_encode(['reason' => $question['reason']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            ]);
        }
    }

    /** @param list<array<string,mixed>> $exams @return list<array<string,mixed>> */
    private function planExams(array $exams): array
    {
        $ids = [];
        foreach ($exams as $exam) {
            $source = is_array($exam['provenance']['source'] ?? null) ? $exam['provenance']['source'] : [];
            $externalId = trim((string) ($source['externalExamId'] ?? ''));
            $provider = strtolower(trim((string) ($source['provider'] ?? '')));
            if ($externalId !== '' && $provider !== '') {
                $ids[$externalId] = true;
            }
        }
        $matches = [];
        foreach (array_chunk(array_keys($ids), 400) as $chunkIndex => $chunk) {
            $bindings = [];
            $holders = [];
            foreach ($chunk as $index => $externalId) {
                $placeholder = ':exam_external_' . $chunkIndex . '_' . $index;
                $holders[] = $placeholder;
                $bindings[$placeholder] = $externalId;
            }
            $stmt = $this->db->prepare(
                'SELECT source_provider, source_external_id, edition_key, exam_id
                 FROM cm_batch_exam_source_identities WHERE source_external_id IN (' . implode(', ', $holders) . ')'
            );
            $stmt->execute($bindings);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                $key = strtolower((string) $row['source_provider']) . '|' . (string) $row['source_external_id'] . '|' . (string) $row['edition_key'];
                $matches[$key][] = (int) $row['exam_id'];
            }
        }

        $planned = [];
        foreach ($exams as $exam) {
            $source = is_array($exam['provenance']['source'] ?? null) ? $exam['provenance']['source'] : [];
            $identity = is_array($exam['provenance']['identity'] ?? null) ? $exam['provenance']['identity'] : [];
            $provider = strtolower(trim((string) ($source['provider'] ?? '')));
            $externalId = trim((string) ($source['externalExamId'] ?? ''));
            $edition = trim((string) ($identity['editionKey'] ?? ''));
            $candidates = $matches[$provider . '|' . $externalId . '|' . $edition] ?? [];
            $action = 'create';
            $reason = 'new_exam_identity_as_draft';
            $canonicalId = null;
            if (count($candidates) === 1) {
                $action = 'link';
                $reason = 'verified_external_exam_identity';
                $canonicalId = $candidates[0];
            } elseif (count($candidates) > 1) {
                $action = 'conflict';
                $reason = 'duplicate_external_exam_identity';
            }
            $planned[] = array_merge($exam, [
                'provider' => $provider,
                'sourceExternalId' => $externalId,
                'editionKey' => $edition,
                'action' => $action,
                'reason' => $reason,
                'canonicalExamId' => $canonicalId,
            ]);
        }
        return $planned;
    }

    /** @return array{counts:array<string,int>,entities:list<array<string,mixed>>} */
    private function resolveTaxonomiesConservatively(array $document): array
    {
        $definitions = [
            'examBoards' => ['type' => 'banca', 'sourceType' => 'banca'],
            'organizations' => ['type' => 'orgao', 'sourceType' => 'orgao'],
            'roles' => ['type' => 'cargo', 'sourceType' => 'cargo'],
            'careers' => ['type' => 'carreira', 'sourceType' => 'area'],
            'professionalAreas' => ['type' => 'area', 'sourceType' => 'area'],
            'focusAreas' => ['type' => 'area', 'sourceType' => 'area'],
            'specializations' => ['type' => 'especialidade', 'sourceType' => 'especialidade'],
            'subjects' => ['type' => 'assunto', 'sourceType' => 'assunto', 'level' => 'materia'],
            'topics' => ['type' => 'assunto', 'sourceType' => 'assunto', 'level' => 'topico'],
            'subtopics' => ['type' => 'assunto', 'sourceType' => 'assunto', 'level' => 'subtopico'],
            'concepts' => ['type' => 'assunto', 'sourceType' => 'assunto', 'level' => 'assunto'],
            'skills' => ['type' => 'habilidade', 'sourceType' => 'habilidade'],
            'resolutionTechniques' => ['type' => 'tecnica_resolucao', 'sourceType' => 'tecnica_resolucao'],
            'questionTraps' => ['type' => 'pegadinha', 'sourceType' => 'pegadinha'],
            'normativeReferences' => ['type' => 'norma', 'sourceType' => 'norma'],
            'educationLevels' => ['type' => 'nivel', 'sourceType' => 'nivel'],
            'years' => ['type' => 'ano', 'sourceType' => 'ano'],
            'geographies' => ['type' => 'geografia', 'sourceType' => 'geografia'],
            'examTypes' => ['type' => 'tipo_prova', 'sourceType' => 'tipo_prova'],
            'questionTypes' => ['type' => 'tipo_questao', 'sourceType' => 'tipo_questao'],
            'examStages' => ['type' => 'etapa_prova', 'sourceType' => 'etapa_prova'],
        ];
        $filterColumns = [];
        foreach ($this->db->query('SHOW COLUMNS FROM filters')->fetchAll(PDO::FETCH_ASSOC) ?: [] as $column) {
            $filterColumns[(string) ($column['Field'] ?? '')] = true;
        }
        $filterFields = ['id', 'type', 'name', 'slug', 'parent_id', 'taxonomy_level'];
        foreach (['source_provider', 'source_entity_type', 'source_external_id', 'source_parent_external_id', 'source_root_external_id'] as $field) {
            $filterFields[] = isset($filterColumns[$field]) ? $field : 'NULL AS ' . $field;
        }
        $filters = $this->db->query('SELECT ' . implode(', ', $filterFields) . ' FROM filters')->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $byTypeName = [];
        foreach ($filters as $filter) {
            $key = strtolower((string) $filter['type']) . '|' . $this->normalizeMatchText((string) $filter['name']);
            $byTypeName[$key][] = $filter;
            $slugKey = strtolower((string) $filter['type']) . '|slug|' . $this->normalizeMatchText((string) $filter['slug']);
            $byTypeName[$slugKey][] = $filter;
        }

        $externalIds = [];
        foreach ($document['taxonomies'] as $categoryItems) {
            foreach (is_array($categoryItems) ? $categoryItems : [] as $entity) {
                foreach (is_array($entity['sourceMappings'] ?? null) ? $entity['sourceMappings'] : [] as $mapping) {
                    if (is_array($mapping) && trim((string) ($mapping['externalId'] ?? '')) !== '') {
                        $externalIds[trim((string) ($mapping['externalId'] ?? ''))] = true;
                    }
                }
            }
        }
        $identityCandidates = [];
        foreach ($filters as $filter) {
            $provider = strtolower(trim((string) ($filter['source_provider'] ?? '')));
            $entityType = strtolower(trim((string) ($filter['source_entity_type'] ?? '')));
            $externalId = trim((string) ($filter['source_external_id'] ?? ''));
            if ($provider === '' || $entityType === '' || $externalId === '') continue;
            $identityKey = $provider . '|' . $entityType . '|' . $externalId;
            $identityCandidates[$identityKey][(int) $filter['id']] = [
                'type' => (string) $filter['type'],
                'id' => (int) $filter['id'],
                'parentId' => $filter['parent_id'] !== null ? (int) $filter['parent_id'] : null,
                'level' => $filter['taxonomy_level'],
            ];
        }
        foreach (array_chunk(array_keys($externalIds), 500) as $chunkIndex => $chunk) {
            $parameters = [];
            $placeholders = [];
            foreach ($chunk as $index => $externalId) {
                $placeholder = ':external_' . $chunkIndex . '_' . $index;
                $placeholders[] = $placeholder;
                $parameters[$placeholder] = $externalId;
            }
            if (!$this->tableExists('filter_source_identities')) continue;
            $stmt = $this->db->prepare(
                'SELECT i.filter_type, i.source_provider, i.source_entity_type, i.source_external_id,
                        i.filter_id, f.parent_id, f.taxonomy_level
                 FROM filter_source_identities i INNER JOIN filters f ON f.id = i.filter_id
                 WHERE i.source_external_id IN (' . implode(', ', $placeholders) . ')'
            );
            $stmt->execute($parameters);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                $identityKey = strtolower((string) $row['source_provider']) . '|'
                    . strtolower((string) $row['source_entity_type']) . '|'
                    . (string) $row['source_external_id'];
                $identityCandidates[$identityKey][(int) $row['filter_id']] = [
                    'type' => (string) $row['filter_type'],
                    'id' => (int) $row['filter_id'],
                    'parentId' => $row['parent_id'] !== null ? (int) $row['parent_id'] : null,
                    'level' => $row['taxonomy_level'],
                ];
            }
        }

        $counts = ['matched_existing' => 0, 'ambiguous' => 0, 'needs_review' => 0];
        $resolvedByKey = [];
        $entities = [];
        foreach (is_array($document['taxonomies'] ?? null) ? $document['taxonomies'] : [] as $category => $items) {
            if (!isset($definitions[$category]) || !is_array($items)) {
                continue;
            }
            $definition = $definitions[$category];
            foreach ($items as $entity) {
                if (!is_array($entity)) {
                    continue;
                }
                $key = trim((string) ($entity['key'] ?? ''));
                $name = trim((string) ($entity['name'] ?? ''));
                $parentKey = trim((string) ($entity['parentKey'] ?? ''));
                $parentId = $parentKey !== '' ? ($resolvedByKey[$parentKey] ?? null) : null;
                $status = 'needs_review';
                $reason = 'no_verified_local_match';
                $candidateIds = [];
                foreach (is_array($entity['sourceMappings'] ?? null) ? $entity['sourceMappings'] : [] as $mapping) {
                    if (!is_array($mapping)) {
                        continue;
                    }
                    $provider = strtolower(trim((string) ($mapping['provider'] ?? '')));
                    $externalId = trim((string) ($mapping['externalId'] ?? ''));
                    if ($provider === '' || $externalId === '') {
                        continue;
                    }
                    $identityKey = $provider . '|' . strtolower($definition['sourceType']) . '|' . $externalId;
                    foreach ($identityCandidates[$identityKey] ?? [] as $row) {
                        if ($row['type'] === $definition['type'] && (!isset($definition['level']) || $row['level'] === $definition['level'])) {
                            $candidateIds[$row['id']] = $row['parentId'];
                        }
                    }
                }
                if (count($candidateIds) === 1) {
                    $candidateId = (int) array_key_first($candidateIds);
                    $candidateParent = $candidateIds[$candidateId];
                    if (($parentKey === '' && $candidateParent === null) || ($parentId !== null && $candidateParent === $parentId)) {
                        $status = 'matched_existing';
                        $reason = 'source_identity_and_parent';
                        $resolvedByKey[$key] = $candidateId;
                    } else {
                        $candidateIds = [];
                        $reason = 'source_identity_parent_unresolved_or_mismatched';
                    }
                } elseif (count($candidateIds) > 1) {
                    $status = 'ambiguous';
                    $reason = 'multiple_source_identity_matches';
                } else {
                    $nameKey = strtolower($definition['type']) . '|' . $this->normalizeMatchText($name);
                    $nameMatches = $byTypeName[$nameKey] ?? [];
                    if ($nameMatches === []) {
                        $slug = trim((string) ($entity['slug'] ?? ''));
                        if ($slug !== '') {
                            $nameMatches = $byTypeName[strtolower($definition['type']) . '|slug|' . $this->normalizeMatchText($slug)] ?? [];
                        }
                    }
                    $compatible = array_values(array_filter($nameMatches, static function (array $candidate) use ($definition, $parentKey, $parentId): bool {
                        if (!empty($definition['level']) && strtolower((string) ($candidate['taxonomy_level'] ?? '')) !== $definition['level']) {
                            return false;
                        }
                        if ($parentKey !== '') {
                            return $parentId !== null && (int) ($candidate['parent_id'] ?? 0) === $parentId;
                        }
                        return $candidate['parent_id'] === null;
                    }));
                    if (count($compatible) === 1) {
                        $candidateId = (int) $compatible[0]['id'];
                        $status = 'matched_existing';
                        $reason = 'exact_name_and_parent';
                        $resolvedByKey[$key] = $candidateId;
                        $candidateIds[$candidateId] = $compatible[0]['parent_id'] !== null ? (int) $compatible[0]['parent_id'] : null;
                    } elseif (count($compatible) > 1) {
                        $status = 'ambiguous';
                        $reason = 'multiple_exact_name_matches_in_scope';
                        foreach ($compatible as $candidate) {
                            $candidateIds[(int) $candidate['id']] = $candidate['parent_id'] !== null ? (int) $candidate['parent_id'] : null;
                        }
                    }
                }
                $counts[$status === 'matched_existing' ? 'matched_existing' : ($status === 'ambiguous' ? 'ambiguous' : 'needs_review')]++;
                $entities[] = [
                    'category' => $category,
                    'key' => $key,
                    'name' => $name,
                    'parentKey' => $parentKey !== '' ? $parentKey : null,
                    'status' => $status,
                    'action' => $status === 'matched_existing' ? 'link' : $status,
                    'canonicalId' => $resolvedByKey[$key] ?? null,
                    'candidateIds' => array_map('intval', array_keys($candidateIds)),
                    'reason' => $reason,
                    'sourceMappings' => $entity['sourceMappings'] ?? [],
                    'sourceEntity' => $entity,
                    'extensions' => array_diff_key($entity, array_flip([
                        'key', 'name', 'slug', 'aliases', 'description', 'acronym', 'fullName', 'website',
                        'parentKey', 'sourceMappings', 'evidence', 'reviewRequired',
                    ])),
                ];
            }
        }
        return ['counts' => $counts, 'entities' => $entities];
    }

    /** @return array{counts:array<string,int>,items:list<array<string,mixed>>} */
    private function planQuestions(ZipArchive $zip, array $summary, array $taxonomyDocument, ?array $taxonomyPlan = null): array
    {
        $taxonomyPlan ??= $this->resolveTaxonomiesConservatively($taxonomyDocument);
        $assetHashes = [];
        $manifestRaw = $zip->getFromName('manifest.json');
        $manifest = is_string($manifestRaw) ? json_decode($manifestRaw, true) : [];
        foreach (is_array($manifest['files'] ?? null) ? $manifest['files'] : [] as $file) {
            if (is_array($file) && isset($file['path'], $file['sha256'])) {
                $assetHashes[(string) $file['path']] = strtolower((string) $file['sha256']);
            }
        }
        $records = [];
        $fingerprints = [];
        $externalIds = [];
        foreach ($summary['exams'] as $exam) {
            $path = (string) $exam['path'] . '/questoes.json';
            $raw = $zip->getFromName($path);
            $document = is_string($raw) ? json_decode($raw, true, 512, JSON_THROW_ON_ERROR) : null;
            if (!is_array($document)) {
                throw new RuntimeException('Documento de questoes ausente no planejamento do dry-run: ' . $path);
            }
            $examAssetHashes = $assetHashes;
            $examPrefix = rtrim((string) $exam['path'], '/') . '/';
            foreach ($assetHashes as $assetPath => $sha256) {
                if (str_starts_with($assetPath, $examPrefix)) {
                    $relativePath = substr($assetPath, strlen($examPrefix));
                    $examAssetHashes[$relativePath] = $sha256;
                    $examAssetHashes['/' . $relativePath] = $sha256;
                }
            }
            $enrichmentRaw=$zip->getFromName(rtrim((string)$exam['path'],'/').'/enriquecimento.json');
            $enrichmentDocument=is_string($enrichmentRaw)?json_decode($enrichmentRaw,true,512,JSON_THROW_ON_ERROR):[];
            $enrichmentByQuestion=[];
            foreach(is_array($enrichmentDocument['questionEnrichments']??null)?$enrichmentDocument['questionEnrichments']:[] as $enrichment) {
                if(!is_array($enrichment))continue;
                $enrichmentByQuestion[(string)($enrichment['questionTempId']??'')]=$enrichment;
            }
            foreach ($document['questions'] as $question) {
                $identityError = null;
                $fingerprint = null;
                try {
                    $this->mapSourceImageUrlsToVerifiedArchiveAssets(
                        $question,
                        $document['contexts'] ?? [],
                        $examPrefix,
                        $manifest['files'] ?? [],
                        $examAssetHashes
                    );
                    $fingerprint = CmBatchQuestionIdentity::fingerprint($question, $document['contexts'] ?? [], $examAssetHashes);
                } catch (InvalidArgumentException $error) {
                    $identityError = $error->getMessage();
                }
                $source = is_array($question['source'] ?? null) ? $question['source'] : [];
                $tempId = trim((string) ($question['tempId'] ?? ''));
                $externalId = trim((string) ($question['id'] ?? $source['externalQuestionId'] ?? $source['externalId'] ?? ''));
                $enrichment=$enrichmentByQuestion[$tempId]??[];
                $sourceMappingIds=[];
                foreach(is_array($enrichment['sourceMappings']??null)?$enrichment['sourceMappings']:[] as $mapping) {
                    if(!is_array($mapping)||strtolower(trim((string)($mapping['provider']??'')))!==strtolower((string)($manifest['sourceProviders'][0]??'gran')))continue;
                    $mappedId=trim((string)($mapping['externalId']??''));
                    if($mappedId!=='')$sourceMappingIds[$mappedId]=true;
                }
                if($externalId==='') {
                    if(count($sourceMappingIds)===1)$externalId=(string)array_key_first($sourceMappingIds);
                    elseif(count($sourceMappingIds)>1)$identityError='multiple_external_ids_for_question';
                } elseif(isset($sourceMappingIds[$externalId])===false && $sourceMappingIds!==[]) {
                    $identityError='question_id_disagrees_with_enrichment_source_mapping';
                }
                if ($fingerprint !== null) $fingerprints[$fingerprint] = true;
                if ($externalId !== '') $externalIds[$externalId] = true;
                $records[] = [
                    'examExternalKey' => (string) $exam['externalKey'],
                    'tempId' => $tempId,
                    'externalQuestionId' => $externalId !== '' ? $externalId : null,
                    'enrichment' => $enrichment,
                    'questionNumber' => $source['questionNumber'] ?? null,
                    'fingerprint' => $fingerprint,
                    'identityError' => $identityError,
                    'reviewRequired' => (bool) ($question['review']['required'] ?? true),
                    'answerRaw' => (string) ($question['answer']['raw'] ?? ''),
                    'answerStatus' => 'unverified',
                    'publication' => 'draft',
                    '_question' => $question,
                    '_contexts' => $document['contexts'] ?? [],
                    '_assetHashes' => $examAssetHashes,
                ];
            }
        }
        $fingerprintRows = $this->fetchByValues(
            'SELECT id, import_fingerprint FROM questions WHERE import_fingerprint IN (%s)',
            array_keys($fingerprints),
            'fingerprint'
        );
        $questionIdsByFingerprint = [];
        foreach ($fingerprintRows as $row) {
            $questionIdsByFingerprint[strtolower((string) $row['import_fingerprint'])][] = (int) $row['id'];
        }
        $manifestProvider = strtolower((string) ($manifest['sourceProviders'][0] ?? 'gran'));
        $sourceRows = [];
        foreach (array_chunk(array_keys($externalIds), 400) as $chunkIndex => $chunk) {
            $bindings = [':provider' => $manifestProvider];
            $placeholders = [];
            foreach ($chunk as $index => $externalId) {
                $placeholder = ':external_' . $chunkIndex . '_' . $index;
                $placeholders[] = $placeholder;
                $bindings[$placeholder] = $externalId;
            }
            $query = $this->db->prepare(
                'SELECT source.source_external_id, source.question_id, question.import_fingerprint
                 FROM question_source_identities source
                 INNER JOIN questions question ON question.id = source.question_id
                 WHERE source.source_provider = :provider AND source.source_external_id IN (' . implode(', ', $placeholders) . ')'
            );
            $query->execute($bindings);
            foreach ($query->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                $sourceRows[(string) $row['source_external_id']][(int)$row['question_id']] = $row;
            }
            // Gran legacy records keep their external question ID directly on questions.
            $legacy = $this->db->prepare(
                'SELECT id AS question_id, source_external_id, import_fingerprint
                 FROM questions WHERE source_external_id IN (' . implode(', ', $placeholders) . ')
                   AND (source_provider = :provider OR source_provider IS NULL OR TRIM(source_provider) = \'\')'
            );
            $legacy->execute($bindings);
            foreach ($legacy->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                $sourceRows[(string)$row['source_external_id']][(int)$row['question_id']] = $row;
            }
        }

        // Reconcile against stored content instead of treating the fingerprint
        // column as an authority. Legacy Gran rows may have a different version
        // of that hash while their canonical content is identical.
        $contentRows = $this->loadQuestionContentRows();
        $contentById = [];
        $contentByStatement = [];
        foreach ($contentRows as $row) {
            $contentById[(int) $row['id']] = $row;
            $statementKey = $this->normalizeQuestionText((string) ($row['enunciado'] ?? ''));
            if ($statementKey !== '') $contentByStatement[$statementKey][] = $row;
        }
        $candidateIds = [];
        foreach ($sourceRows as $matches) foreach (array_keys($matches) as $id) $candidateIds[(int) $id] = true;
        foreach ($records as $record) {
            if ($record['externalQuestionId'] !== null && isset($sourceRows[(string) $record['externalQuestionId']])) continue;
            $statementKey = $this->normalizeQuestionText((string) ($record['_question']['content']['statement'] ?? $record['_question']['content']['statementClean'] ?? ''));
            foreach ($contentByStatement[$statementKey] ?? [] as $candidate) $candidateIds[(int) $candidate['id']] = true;
            foreach ($questionIdsByFingerprint[$record['fingerprint']] ?? [] as $id) $candidateIds[(int) $id] = true;
        }
        $relations = $this->loadQuestionRelations(array_keys($candidateIds));
        foreach ($contentById as $id => &$row) $row['_relations'] = $relations[$id] ?? ['contexts' => [], 'assets' => [], 'options' => [], 'contextAssets' => [], 'editorials' => []];
        unset($row);
        $questionFilterIds = $this->loadQuestionFilterIds(array_keys($candidateIds));
        $taxonomyFilterLookup = $this->loadTaxonomyFilterLookup();
        $contentByStatement = [];
        foreach ($contentById as $row) {
            $statementKey = $this->normalizeQuestionText((string) ($row['enunciado'] ?? ''));
            if ($statementKey !== '') $contentByStatement[$statementKey][] = $row;
        }

        $items = [];
        $counts = ['create' => 0, 'link_existing' => 0, 'enrich_existing' => 0, 'unchanged' => 0, 'conflict' => 0, 'blocked_media' => 0];
        $seen = [];
        foreach ($records as $record) {
            $publicRecord = $record;
            unset($publicRecord['_question'], $publicRecord['_contexts']);
            if ($record['identityError'] !== null) {
                $counts['blocked_media']++;
                $items[] = array_merge($publicRecord, [
                    'action' => 'blocked', 'reconciliation' => 'blocked_media',
                    'canonicalQuestionId' => null, 'reason' => 'unresolved_identity_dependency',
                ]);
                continue;
            }

            $externalId = (string) ($record['externalQuestionId'] ?? '');
            $sourceMatches = $externalId !== '' ? array_values($sourceRows[$externalId] ?? []) : [];
            $candidateRows = [];
            if ($sourceMatches !== []) {
                foreach ($sourceMatches as $sourceMatch) {
                    $id = (int) $sourceMatch['question_id'];
                    if (isset($contentById[$id])) $candidateRows[$id] = $contentById[$id];
                }
            } else {
                $statement = (string) ($record['_question']['content']['statement'] ?? $record['_question']['content']['statementClean'] ?? '');
                $statementKey = $this->normalizeQuestionText($statement);
                foreach ($contentByStatement[$statementKey] ?? [] as $candidate) $candidateRows[(int) $candidate['id']] = $candidate;
                foreach ($questionIdsByFingerprint[$record['fingerprint']] ?? [] as $id) {
                    if (isset($contentById[(int) $id])) $candidateRows[(int) $id] = $contentById[(int) $id];
                }
            }

            $comparisons = [];
            foreach ($candidateRows as $id => $candidate) {
                $comparisons[$id] = $this->compareQuestionContent($record, $candidate);
                $comparisons[$id]['canonicalUpdatedAt'] = (string) ($candidate['updated_at'] ?? '');
            }
            $exactIds = array_keys(array_filter($comparisons, static fn (array $item): bool => $item['status'] === 'exact'));
            $mediaIds = array_keys(array_filter($comparisons, static fn (array $item): bool => $item['status'] === 'media_unverified'));
            $statementOnlyIds = array_keys(array_filter($comparisons, static fn (array $item): bool => $item['status'] === 'statement_only'));
            $contextEnrichmentIds = array_keys(array_filter($comparisons, static fn (array $item): bool => $item['status'] === 'context_missing_existing'));

            $reconciliation = 'create';
            $action = 'create';
            $canonicalId = null;
            $reason = 'no_existing_identity_or_full_content_candidate';
            $missingEditorialTypes = [];
            if (count($sourceMatches) > 1) {
                $reconciliation = 'conflict'; $action = 'conflict';
                $reason = 'gran_external_id_maps_to_multiple_canonical_questions';
            } elseif ($candidateRows !== [] && count($exactIds) === 1) {
                $canonicalId = (int) $exactIds[0];
                // source_exam_key is provenance, not proof that the question is
                // already linked to this exam/caderno occurrence. A single
                // full-content match remains decisive when other same-statement
                // candidates have different ordered alternatives.
                $reconciliation = 'link_existing';
                $action = 'link';
                $reason = $sourceMatches !== []
                    ? 'gran_external_id_and_verified_canonical_content_match_occurrence_link_required'
                    : 'unique_full_content_match_among_statement_candidates';
                $missingEditorialTypes = $this->missingEditorialTypes($record['_question'], $contentById[$canonicalId], $record['enrichment'] ?? []);
                if ($missingEditorialTypes !== []) {
                    $reconciliation = 'enrich_existing';
                    $action = 'enrich';
                    $reason = 'existing_question_missing_editorial_fields';
                }
            } elseif ($candidateRows !== [] && count($contextEnrichmentIds) === 1 && count($comparisons) === 1) {
                $canonicalId = (int) $contextEnrichmentIds[0];
                $reconciliation = 'enrich_existing';
                $action = 'enrich';
                $reason = 'existing_question_missing_verified_context';
                $missingEditorialTypes = $this->missingEditorialTypes($record['_question'], $contentById[$canonicalId], $record['enrichment'] ?? []);
            } elseif ($candidateRows !== [] && $mediaIds !== [] && count($mediaIds) === count($comparisons)) {
                $reconciliation = 'blocked_media'; $action = 'blocked';
                $reason = 'candidate_matches_text_but_media_bytes_or_placement_are_unverified';
            } elseif ($candidateRows !== [] && $statementOnlyIds !== [] && count($statementOnlyIds) === count($comparisons)) {
                $reconciliation = 'conflict'; $action = 'conflict';
                $reason = 'statement_matches_but_ordered_alternatives_differ';
            } elseif ($candidateRows !== []) {
                $reconciliation = 'conflict'; $action = 'conflict';
                $reason = $sourceMatches !== [] ? 'gran_external_id_content_conflict' : 'ambiguous_or_non_equivalent_content_candidates';
            } elseif ($externalId !== '' && isset($sourceRows[$externalId])) {
                $reconciliation = 'conflict'; $action = 'conflict';
                $reason = 'external_identity_exists_but_row_is_missing_from_content_snapshot';
            } elseif (isset($seen[$record['fingerprint']])) {
                $reconciliation = 'link_existing'; $action = 'link';
                $canonicalId = $seen[$record['fingerprint']];
                $reason = 'same_verified_content_repeated_within_batch';
            }

            $taxonomyReconciliation = null;
            if ($canonicalId !== null && in_array($reconciliation, ['link_existing', 'unchanged', 'enrich_existing'], true)) {
                $taxonomyReconciliation = $this->planQuestionTaxonomyLinks(
                    $record['_question'],
                    $taxonomyPlan,
                    $questionFilterIds[$canonicalId] ?? [],
                    $taxonomyFilterLookup
                );
                if ($taxonomyReconciliation['missingCanonicalFilterIds'] !== []) {
                    $reconciliation = 'enrich_existing';
                    $action = 'enrich';
                    $reason = 'existing_question_missing_resolved_canonical_taxonomy_links';
                }
            }

            if ($reconciliation === 'create' && $record['reviewRequired']) $reason = 'create_as_private_draft_review_required';
            if (in_array($reconciliation, ['create', 'link_existing'], true)) $seen[$record['fingerprint']] = $canonicalId;
            $counts[$reconciliation]++;
            $items[] = array_merge($publicRecord, [
                'action' => $action,
                'reconciliation' => $reconciliation,
                'canonicalQuestionId' => $canonicalId,
                'canonicalUpdatedAt' => $canonicalId !== null ? (string) ($comparisons[$canonicalId]['canonicalUpdatedAt'] ?? '') : null,
                'matchedByExternalId' => $sourceMatches !== [],
                'externalIdentityQuestionIds' => array_values(array_map(static fn (array $match): int => (int) $match['question_id'], $sourceMatches)),
                'candidateQuestionIds' => array_values(array_map('intval', array_keys($candidateRows))),
                'candidateComparisons' => $comparisons,
                'taxonomyReconciliation' => $taxonomyReconciliation,
                'missingEditorialTypes' => $missingEditorialTypes,
                'reason' => $reason,
            ]);
        }
        return ['counts' => $counts, 'items' => $items];
    }

    /** @return list<array<string,mixed>> */
    private function loadQuestionContentRows(): array
    {
        $questionColumns = [];
        foreach ($this->db->query('SHOW COLUMNS FROM questions')->fetchAll(PDO::FETCH_ASSOC) ?: [] as $column) {
            $questionColumns[(string) $column['Field']] = true;
        }
        $hasGroups = (bool) $this->db->query(
            "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'questions_groups' LIMIT 1"
        )->fetchColumn();
        $groupJoin = $hasGroups && isset($questionColumns['grupo_questao_id'])
            ? 'LEFT JOIN questions_groups g ON g.id = q.grupo_questao_id'
            : 'LEFT JOIN (SELECT NULL AS id, NULL AS enunciado, NULL AS texto, NULL AS image_url, NULL AS assets_json) g ON 1=0';
        $fields = ['source_provider', 'source_external_id', 'source_exam_key', 'tipo', 'enunciado', 'intro_text', 'reference_text', 'data_json', 'import_fingerprint', 'grupo_questao_id', 'support_context_key', 'has_image', 'updated_at'];
        $selectFields = ['q.id'];
        foreach ($fields as $field) $selectFields[] = isset($questionColumns[$field]) ? 'q.' . $field : 'NULL AS ' . $field;
        $stmt = $this->db->query(
            'SELECT ' . implode(', ', $selectFields) . ',
                    g.enunciado AS group_enunciado, g.texto AS group_text, g.image_url AS group_image_url,
                    g.assets_json AS group_assets_json
             FROM questions q ' . $groupJoin . ' ORDER BY q.id'
        );
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /** @param list<int> $questionIds @return array<int,array<string,mixed>> */
    private function loadQuestionRelations(array $questionIds): array
    {
        $questionIds = array_values(array_unique(array_filter(array_map('intval', $questionIds), static fn (int $id): bool => $id > 0)));
        $relations = [];
        foreach ($questionIds as $id) $relations[$id] = ['contexts' => [], 'assets' => [], 'options' => [], 'contextAssets' => [], 'editorials' => []];
        foreach (array_chunk($questionIds, 400) as $chunkIndex => $chunk) {
            if ($chunk === []) continue;
            $holders = [];
            $bindings = [];
            foreach ($chunk as $index => $id) {
                $key = ':question_' . $chunkIndex . '_' . $index;
                $holders[] = $key;
                $bindings[$key] = $id;
            }
            $in = implode(', ', $holders);
            if ($this->tableExists('question_options')) {
                $stmt = $this->db->prepare('SELECT id,question_id,external_key,display_order,label,body,body_clean,metadata_json FROM question_options WHERE question_id IN (' . $in . ') ORDER BY question_id,display_order,id');
                $stmt->execute($bindings);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $option) $relations[(int) $option['question_id']]['options'][] = $option;
            }
            if ($this->tableExists('question_editorials')) {
                $stmt = $this->db->prepare('SELECT question_id,editorial_type,body,status FROM question_editorials WHERE question_id IN (' . $in . ') ORDER BY id');
                $stmt->execute($bindings);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $editorial) $relations[(int) $editorial['question_id']]['editorials'][] = $editorial;
            }
            if ($this->tableExists('question_context_questions') && $this->tableExists('question_contexts')) {
                $stmt = $this->db->prepare('SELECT rel.question_id,c.id AS context_id,c.external_key,c.context_type,c.body,c.body_clean,c.reference_text,c.metadata_json FROM question_context_questions rel INNER JOIN question_contexts c ON c.id=rel.context_id WHERE rel.question_id IN (' . $in . ') ORDER BY rel.question_id,c.id');
                $stmt->execute($bindings);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $context) $relations[(int) $context['question_id']]['contexts'][] = $context;
            }
            if ($this->tableExists('question_assets')) {
                $stmt = $this->db->prepare('SELECT id,question_id,context_id,option_id,external_key,asset_type,usage_type,storage_path,public_url,display_order,metadata_json FROM question_assets WHERE question_id IN (' . $in . ') ORDER BY question_id,context_id,option_id,display_order,id');
                $stmt->execute($bindings);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $asset) {
                    $asset['verifiedSha256'] = $this->verifiedStoredAssetHash((string) ($asset['storage_path'] ?? ''), (string) ($asset['public_url'] ?? ''));
                    $questionId = (int) ($asset['question_id'] ?? 0);
                    $optionId = (int) ($asset['option_id'] ?? 0);
                    $contextId = (int) ($asset['context_id'] ?? 0);
                    if ($optionId > 0) $relations[$questionId]['optionAssets'][$optionId][] = $asset;
                    elseif ($contextId > 0) $relations[$questionId]['contextAssets'][$contextId][] = $asset;
                    elseif ($questionId > 0) $relations[$questionId]['assets'][] = $asset;
                }
                $contextToQuestions = [];
                $optionToQuestion = [];
                foreach ($relations as $questionId => $relation) {
                    foreach ($relation['contexts'] as $context) $contextToQuestions[(int) $context['context_id']][] = (int) $questionId;
                    foreach ($relation['options'] as $option) $optionToQuestion[(int) $option['id']] = (int) $questionId;
                }
                $relatedIds = array_values(array_unique(array_merge(array_keys($contextToQuestions), array_keys($optionToQuestion))));
                foreach (array_chunk($relatedIds, 400) as $relatedChunkIndex => $relatedChunk) {
                    if ($relatedChunk === []) continue;
                    $contextHolders = [];
                    $optionHolders = [];
                    $relatedBindings = [];
                    foreach ($relatedChunk as $relatedIndex => $relatedId) {
                        $contextKey = ':related_context_' . $chunkIndex . '_' . $relatedChunkIndex . '_' . $relatedIndex;
                        $optionKey = ':related_option_' . $chunkIndex . '_' . $relatedChunkIndex . '_' . $relatedIndex;
                        $contextHolders[] = $contextKey;
                        $optionHolders[] = $optionKey;
                        $relatedBindings[$contextKey] = $relatedId;
                        $relatedBindings[$optionKey] = $relatedId;
                    }
                    $contextIn = implode(', ', $contextHolders);
                    $optionIn = implode(', ', $optionHolders);
                    $relatedStmt = $this->db->prepare('SELECT id,question_id,context_id,option_id,external_key,asset_type,usage_type,storage_path,public_url,display_order,metadata_json FROM question_assets WHERE context_id IN (' . $contextIn . ') OR option_id IN (' . $optionIn . ') ORDER BY context_id,option_id,display_order,id');
                    $relatedStmt->execute($relatedBindings);
                    foreach ($relatedStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $asset) {
                        $asset['verifiedSha256'] = $this->verifiedStoredAssetHash((string) ($asset['storage_path'] ?? ''), (string) ($asset['public_url'] ?? ''));
                        $contextId = (int) ($asset['context_id'] ?? 0);
                        $optionId = (int) ($asset['option_id'] ?? 0);
                        if ($contextId > 0) foreach ($contextToQuestions[$contextId] ?? [] as $questionId) {
                            $known = array_column($relations[$questionId]['contextAssets'][$contextId] ?? [], 'id');
                            if (!in_array($asset['id'], $known, true)) $relations[$questionId]['contextAssets'][$contextId][] = $asset;
                        }
                        elseif ($optionId > 0 && isset($optionToQuestion[$optionId])) {
                            $questionId = $optionToQuestion[$optionId];
                            $known = array_column($relations[$questionId]['optionAssets'][$optionId] ?? [], 'id');
                            if (!in_array($asset['id'], $known, true)) $relations[$questionId]['optionAssets'][$optionId][] = $asset;
                        }
                    }
                }
            }
        }
        return $relations;
    }

    /** @return list<string> */
    private function missingEditorialTypes(array $question, array $stored, array $enrichment = []): array
    {
        $incoming = [];
        foreach (is_array($question['editorial'] ?? null) ? $question['editorial'] : [] as $entry) {
            if (!is_array($entry) || trim((string) ($entry['body'] ?? '')) === '') continue;
            $type = (string) ($entry['type'] ?? '');
            if (in_array($type, ['teacher_comment', 'detailed_analysis'], true)) $incoming[$type] = true;
        }
        $annotations = $enrichment['editorialAnnotations'] ?? [];
        if (is_array($annotations)) {
            foreach ($annotations as $key => $entry) {
                if (!is_array($entry)) $entry = ['type' => (string) $key, 'body' => $entry];
                $type = (string) ($entry['type'] ?? $entry['editorialType'] ?? '');
                $body = (string) ($entry['body'] ?? $entry['content'] ?? $entry['text'] ?? '');
                if (trim($body) !== '' && in_array($type, ['teacher_comment', 'detailed_analysis'], true)) $incoming[$type] = true;
            }
        }
        $existing = [];
        foreach ($stored['_relations']['editorials'] ?? [] as $entry) {
            if (trim((string) ($entry['body'] ?? '')) !== '') $existing[(string) ($entry['editorial_type'] ?? '')] = true;
        }
        $data = json_decode((string) ($stored['data_json'] ?? ''), true);
        $data = is_array($data) ? $data : [];
        foreach ([
            'teacher_comment' => $data['teacherComment'] ?? $data['editorialComments']['teacherComment'] ?? null,
            'detailed_analysis' => $data['detailedComment'] ?? $data['editorialComments']['detailedComment'] ?? null,
        ] as $type => $body) {
            if (trim((string) $body) !== '') $existing[$type] = true;
        }
        return array_values(array_diff(array_keys($incoming), array_keys($existing)));
    }

    /** @param list<int> $questionIds @return array<int,list<int>> */
    private function loadQuestionFilterIds(array $questionIds): array
    {
        if (!$questionIds || !$this->tableExists('question_filters')) return [];
        $rows = $this->fetchByValues(
            'SELECT question_id, filter_id FROM question_filters WHERE question_id IN (%s)',
            array_map('intval', $questionIds),
            'taxonomy_question'
        );
        $result = [];
        foreach ($rows as $row) $result[(int) $row['question_id']][] = (int) $row['filter_id'];
        return $result;
    }

    /** @return array<string,list<array<string,mixed>>> */
    private function loadTaxonomyFilterLookup(): array
    {
        if (!$this->tableExists('filters')) return [];
        $rows = $this->db->query('SELECT id,type,name,slug,parent_id,taxonomy_level FROM filters')->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $lookup = [];
        foreach ($rows as $row) {
            foreach (['name' => (string) ($row['name'] ?? ''), 'slug' => (string) ($row['slug'] ?? '')] as $field => $value) {
                if ($value === '') continue;
                $lookup[strtolower((string) $row['type']) . '|' . $field . '|' . $this->normalizeMatchText($value)][] = $row;
            }
        }
        return $lookup;
    }

    /**
     * Resolve incoming question-filter labels only through the batch taxonomy
     * plan. Name matches remain category-scoped, and child taxonomies are
     * restricted to the resolved parent represented on the question.
     *
     * @param array<string,mixed> $question
     * @param array<string,mixed> $taxonomyPlan
     * @param list<int> $existingFilterIds
     * @return array<string,mixed>
     */
    private function planQuestionTaxonomyLinks(array $question, array $taxonomyPlan, array $existingFilterIds, array $filterLookup = []): array
    {
        $categoryMap = [
            'subjects' => 'subjects', 'topics' => 'topics', 'subtopics' => 'subtopics',
            'examBoards' => 'examBoards', 'organizations' => 'organizations', 'roles' => 'roles',
            'careers' => 'careers', 'years' => 'years', 'levels' => 'educationLevels', 'examTypes' => 'examTypes',
        ];
        $entities = [];
        foreach ($taxonomyPlan['entities'] ?? [] as $entity) {
            if (!is_array($entity) || !isset($entity['category'], $entity['key'])) continue;
            $entities[(string) $entity['key']] = $entity;
        }
        $incoming = is_array($question['filters'] ?? null) ? $question['filters'] : [];
        $filterTypes = [
            'subjects' => ['assunto', 'materia'], 'topics' => ['assunto', 'topico'], 'subtopics' => ['assunto', 'subtopico'],
            'examBoards' => ['banca', null], 'organizations' => ['orgao', null], 'roles' => ['cargo', null],
            'careers' => ['carreira', null], 'years' => ['ano', null], 'levels' => ['nivel', null], 'examTypes' => ['tipo_prova', null],
        ];
        $resolvedByFilterCategory = [];
        $expected = [];
        $unresolved = [];
        $linked = array_fill_keys(array_map('intval', $existingFilterIds), true);
        foreach ($categoryMap as $filterCategory => $taxonomyCategory) {
            $items = is_array($incoming[$filterCategory] ?? null) ? $incoming[$filterCategory] : [];
            foreach ($items as $filter) {
                if (!is_array($filter)) continue;
                $label = trim((string) ($filter['label'] ?? $filter['name'] ?? ''));
                $slug = trim((string) ($filter['slug'] ?? ''));
                $matches = [];
                foreach ($entities as $key => $entity) {
                    if (($entity['category'] ?? null) !== $taxonomyCategory) continue;
                    $source = is_array($entity['sourceEntity'] ?? null) ? $entity['sourceEntity'] : [];
                    $nameMatches = $label !== '' && $this->normalizeMatchText($label) === $this->normalizeMatchText((string) ($entity['name'] ?? ''));
                    $slugMatches = $slug !== '' && $this->normalizeMatchText($slug) === $this->normalizeMatchText((string) ($source['slug'] ?? ''));
                    if (!$nameMatches && !$slugMatches) continue;
                    $matches[$key] = $entity;
                }
                $parentCategory = match ($filterCategory) {
                    'topics' => 'subjects',
                    'subtopics' => 'topics',
                    default => null,
                };
                if (count($matches) > 1 && $parentCategory !== null) {
                    $parentIds = array_fill_keys($resolvedByFilterCategory[$parentCategory] ?? [], true);
                    $matches = array_filter($matches, static function (array $entity) use ($entities, $parentIds): bool {
                        $parentKey = (string) ($entity['parentKey'] ?? '');
                        return $parentKey !== '' && isset($entities[$parentKey]['canonicalId'])
                            && isset($parentIds[(int) $entities[$parentKey]['canonicalId']]);
                    });
                }
                if ($matches === [] && isset($filterTypes[$filterCategory])) {
                    [$dbType, $taxonomyLevel] = $filterTypes[$filterCategory];
                    $localCandidates = [];
                    foreach ([
                        'name' => $label,
                        'slug' => $slug,
                    ] as $field => $value) {
                        if ($value === '') continue;
                        foreach ($filterLookup[strtolower($dbType) . '|' . $field . '|' . $this->normalizeMatchText($value)] ?? [] as $candidate) {
                            $localCandidates[(int) $candidate['id']] = $candidate;
                        }
                    }
                    $localCandidates = array_filter($localCandidates, static function (array $candidate) use ($dbType, $taxonomyLevel, $filterCategory, $resolvedByFilterCategory): bool {
                        if (strtolower((string) ($candidate['type'] ?? '')) !== $dbType) return false;
                        if ($taxonomyLevel !== null && strtolower((string) ($candidate['taxonomy_level'] ?? '')) !== $taxonomyLevel) return false;
                        if (in_array($filterCategory, ['subjects', 'examBoards', 'organizations', 'careers', 'years', 'levels', 'examTypes'], true)) return ($candidate['parent_id'] ?? null) === null;
                        $parentCategory = $filterCategory === 'topics' ? 'subjects' : 'topics';
                        $parentIds = array_fill_keys($resolvedByFilterCategory[$parentCategory] ?? [], true);
                        return $parentIds !== [] && isset($parentIds[(int) ($candidate['parent_id'] ?? 0)]);
                    });
                    if (count($localCandidates) === 1) {
                        $candidate = reset($localCandidates);
                        $expected[(int) $candidate['id']] = ['id' => (int) $candidate['id'], 'category' => $filterCategory, 'label' => $label, 'taxonomyKey' => null, 'match' => 'exact_local_name_or_slug'];
                        $resolvedByFilterCategory[$filterCategory][] = (int) $candidate['id'];
                        continue;
                    }
                    if (count($localCandidates) > 1) {
                        $unresolved[] = ['category' => $filterCategory, 'label' => $label, 'reason' => 'multiple_exact_local_candidates_in_scope'];
                        continue;
                    }
                }
                if (count($matches) !== 1) {
                    $unresolved[] = ['category' => $filterCategory, 'label' => $label, 'reason' => count($matches) > 1 ? 'ambiguous_taxonomy_candidate' : 'no_resolved_canonical_taxonomy'];
                    continue;
                }
                $key = (string) array_key_first($matches);
                $entity = $matches[$key];
                $canonicalId = (int) ($entity['canonicalId'] ?? 0);
                if (($entity['status'] ?? '') !== 'matched_existing' || $canonicalId < 1) {
                    $unresolved[] = ['category' => $filterCategory, 'label' => $label, 'taxonomyKey' => $key, 'reason' => (string) ($entity['reason'] ?? 'taxonomy_requires_review')];
                    continue;
                }
                $resolvedByFilterCategory[$filterCategory][] = $canonicalId;
                $expected[$canonicalId] = ['id' => $canonicalId, 'category' => $filterCategory, 'label' => $label, 'taxonomyKey' => $key];
            }
        }
        $missing = array_values(array_filter($expected, static fn(array $item): bool => !isset($linked[(int) $item['id']])));
        return [
            'status' => $unresolved !== [] ? 'needs_review' : ($missing !== [] ? 'enrich_existing' : 'unchanged'),
            'expectedCanonicalFilters' => array_values($expected),
            'existingCanonicalFilterIds' => array_values(array_map('intval', array_keys($linked))),
            'missingCanonicalFilters' => $missing,
            'missingCanonicalFilterIds' => array_values(array_map(static fn(array $item): int => (int) $item['id'], $missing)),
            'unresolved' => $unresolved,
        ];
    }

    private function tableExists(string $table): bool
    {
        $stmt = $this->db->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=:table LIMIT 1');
        $stmt->execute([':table' => $table]);
        return (bool) $stmt->fetchColumn();
    }

    private function verifiedStoredAssetHash(string $storagePath, string $publicUrl): ?string
    {
        $key = trim($storagePath);
        if ($key === '' && $publicUrl !== '') {
            $path = (string) (parse_url($publicUrl, PHP_URL_PATH) ?? '');
            $position = strpos($path, '/uploads/');
            if ($position !== false) $key = rawurldecode(substr($path, $position + strlen('/uploads/')));
        }
        $key = ltrim(str_replace('\\', '/', $key), '/');
        if ($key === '' || preg_match('~(^|/)\.\.?(/|$)|^[a-z]+:~i', $key)) return null;
        if (str_starts_with($key, 'uploads/')) $key = substr($key, strlen('uploads/'));
        $root = trim((string) getenv('OBJECT_STORAGE_LOCAL_ROOT'));
        if ($root === '') $root = dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'uploads';
        $realRoot = realpath($root);
        if ($realRoot === false) return null;
        $candidate = realpath($realRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $key));
        if ($candidate === false || is_link($realRoot . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $key))
            || !str_starts_with($candidate, $realRoot . DIRECTORY_SEPARATOR) || !is_file($candidate)) return null;
        $hash = hash_file('sha256', $candidate);
        return is_string($hash) ? strtolower($hash) : null;
    }

    /** @return array{status:string,reason:string} */
    private function compareQuestionContent(array $record, array $row): array
    {
        $question = $record['_question'];
        $data = json_decode((string) ($row['data_json'] ?? ''), true);
        $data = is_array($data) ? $data : [];
        try {
            $storedFingerprint = $this->storedQuestionFingerprint($row, $data);
        } catch (Throwable) {
            $storedFingerprint = null;
        }
        if ($storedFingerprint !== null && hash_equals(strtolower((string) $record['fingerprint']), $storedFingerprint)) {
            return ['status' => 'exact', 'reason' => 'canonical_fingerprint_recomputed_from_verified_server_assets_and_context'];
        }
        if ($this->canonicalQuestionType((string) ($question['type'] ?? '')) !== $this->canonicalQuestionType((string) ($row['tipo'] ?? $data['questionType'] ?? ''))) {
            return ['status' => 'different', 'reason' => 'question_type_differs'];
        }
        $incomingStatement = $this->normalizeQuestionText((string) ($question['content']['statement'] ?? $question['content']['statementClean'] ?? ''));
        $storedStatement = $this->normalizeQuestionText((string) ($row['enunciado'] ?? ''));
        if ($incomingStatement === '' || $incomingStatement !== $storedStatement) return ['status' => 'different', 'reason' => 'statement_differs'];

        $incomingAlternatives = $this->incomingAlternativesForComparison($question);
        $storedAlternatives = $this->storedAlternativesForComparison($data);
        $sameAlternatives = $incomingAlternatives === $storedAlternatives;

        $contextKey = trim((string) ($question['source']['contextTempId'] ?? ''));
        $incomingContext = $this->findBatchContext($record['_contexts'], $contextKey);
        $incomingContextBody = $this->normalizeQuestionText((string) ($incomingContext['body'] ?? $incomingContext['texto'] ?? $incomingContext['text'] ?? ''));
        $storedContextBody = $this->normalizeQuestionText((string) (($row['group_enunciado'] ?? '') ?: ($row['group_text'] ?? '') ?: ($data['supportContextText'] ?? '')));
        $storedHasContext = (int) ($row['grupo_questao_id'] ?? 0) > 0 || trim((string) ($row['support_context_key'] ?? $data['supportContextKey'] ?? '')) !== '';
        $incomingHasContext = $contextKey !== '' && $incomingContextBody !== '';
        $contextNeedsEnrichment = $incomingHasContext && !$storedHasContext;
        if ($incomingHasContext && $storedHasContext && $incomingContextBody !== $storedContextBody) return ['status' => 'different', 'reason' => 'shared_context_differs'];
        if (!$incomingHasContext && !$storedHasContext && $contextKey !== '') return ['status' => 'context_unverified', 'reason' => 'incoming_shared_context_not_resolved'];

        if ($this->incomingContainsMedia($question, $record['_contexts']) || $this->storedContainsMedia($row, $data)) {
            if ($storedFingerprint === null) return ['status' => 'media_unverified', 'reason' => 'source_binary_or_stored_asset_placement_not_verified'];
            return ['status' => 'different', 'reason' => 'verified_media_content_or_placement_differs'];
        }
        if (!$sameAlternatives) return ['status' => 'statement_only', 'reason' => 'alternatives_or_order_differ'];
        if ($this->normalizeQuestionText((string) ($question['content']['supportText'] ?? '')) !== $this->normalizeQuestionText((string) ($row['intro_text'] ?? ''))
            || $this->normalizeQuestionText((string) ($question['content']['reference'] ?? '')) !== $this->normalizeQuestionText((string) ($row['reference_text'] ?? $data['referenceText'] ?? ''))) {
            return ['status' => 'different', 'reason' => 'support_or_reference_differs'];
        }
        if ($contextNeedsEnrichment) return ['status' => 'context_missing_existing', 'reason' => 'incoming_context_adds_to_existing_question'];
        return ['status' => 'exact', 'reason' => 'statement_alternatives_context_support_and_reference_match'];
    }

    private function storedQuestionFingerprint(array $row, array $data): ?string
    {
        $relations = is_array($row['_relations'] ?? null) ? $row['_relations'] : [];
        $contexts = is_array($relations['contexts'] ?? null) ? $relations['contexts'] : [];
        if (count($contexts) > 1) return null;
        $context = null;
        if ($contexts !== []) {
            $storedContext = $contexts[0];
            $contextId = (int) ($storedContext['context_id'] ?? 0);
            $context = [
                'tempId' => 'stored-context-' . $contextId,
                'body' => (string) ($storedContext['body'] ?? $storedContext['body_clean'] ?? ''),
                'assets' => $this->assetsForIdentity($relations['contextAssets'][$contextId] ?? []),
            ];
        } elseif ((int) ($row['grupo_questao_id'] ?? 0) > 0) {
            $groupBody = (string) (($row['group_enunciado'] ?? '') ?: ($row['group_text'] ?? ''));
            if ($groupBody === '') return null;
            $groupAssets = [];
            if (trim((string) ($row['group_image_url'] ?? '')) !== '') {
                $asset = $this->assetForIdentity(['public_url' => (string) $row['group_image_url'], 'external_key' => 'stored-group-image']);
                if ($asset === null) return null;
                $groupAssets[] = $asset;
            }
            $declaredGroupAssets = json_decode((string) ($row['group_assets_json'] ?? ''), true);
            foreach (is_array($declaredGroupAssets) ? $declaredGroupAssets : [] as $declaredAsset) {
                if (!is_array($declaredAsset)) continue;
                $asset = $this->assetForIdentity($declaredAsset);
                if ($asset === null) return null;
                $groupAssets[] = $asset;
            }
            $context = ['tempId' => 'stored-group-' . (int) $row['grupo_questao_id'], 'body' => $groupBody, 'assets' => $groupAssets];
        } elseif (trim((string) ($row['support_context_key'] ?? $data['supportContextKey'] ?? '')) !== '') {
            return null;
        }

        $questionAssets = $this->assetsForIdentity($relations['assets'] ?? []);
        $imageUrl = trim((string) ($data['imageUrl'] ?? ''));
        if ($imageUrl !== '' && !$this->assetListContainsPath($questionAssets, $imageUrl)) {
            $asset = $this->assetForIdentity(['public_url' => $imageUrl, 'external_key' => 'stored-main-image']);
            if ($asset === null) return null;
            $questionAssets[] = $asset;
        }
        $alternatives = [];
        $optionRows = is_array($relations['options'] ?? null) ? $relations['options'] : [];
        if ($optionRows !== []) {
            foreach ($optionRows as $option) {
                $optionId = (int) ($option['id'] ?? 0);
                $alternatives[] = [
                    'order' => (int) ($option['display_order'] ?? count($alternatives) + 1),
                    'label' => (string) ($option['label'] ?? ''),
                    'text' => (string) ($option['body'] ?? $option['body_clean'] ?? ''),
                    'assets' => $this->assetsForIdentity($relations['optionAssets'][$optionId] ?? []),
                ];
            }
        } else {
            foreach ($data['itens'] ?? [] as $index => $option) {
                if (!is_array($option)) continue;
                $alternatives[] = [
                    'order' => (int) ($option['ordem'] ?? $index + 1),
                    'label' => (string) ($option['rotulo'] ?? ''),
                    'text' => (string) ($option['corpo'] ?? $option['corpo_clean'] ?? ''),
                ];
            }
        }
        $incomingShape = [
            'type' => $this->canonicalQuestionType((string) ($row['tipo'] ?? $data['questionType'] ?? '')),
            'source' => ['contextTempId' => $context['tempId'] ?? ''],
            'content' => [
                'statement' => (string) ($row['enunciado'] ?? ''),
                'supportText' => (string) ($row['intro_text'] ?? ''),
                'reference' => (string) ($row['reference_text'] ?? $data['referenceText'] ?? ''),
            ],
            'assets' => $questionAssets,
            'alternatives' => $alternatives,
        ];
        if ((int) ($row['has_image'] ?? 0) === 1 && $questionAssets === [] && !$this->storedContainsMedia($row, $data)) return null;
        try {
            return CmBatchQuestionIdentity::fingerprint($incomingShape, $context !== null ? [$context] : [], $this->storedAssetHashMap($questionAssets, $alternatives, $context));
        } catch (Throwable) {
            return null;
        }
    }

    private function storedAssetHashMap(array $questionAssets, array $alternatives, ?array $context): array
    {
        $assets = $questionAssets;
        foreach ($alternatives as $alternative) if (is_array($alternative)) $assets = array_merge($assets, $alternative['assets'] ?? []);
        if ($context !== null) $assets = array_merge($assets, $context['assets'] ?? []);
        $map = [];
        foreach ($assets as $asset) {
            if (!is_array($asset)) continue;
            $path = trim((string) ($asset['path'] ?? ''));
            $hash = strtolower((string) ($asset['sha256'] ?? ''));
            if ($path !== '' && preg_match('/^[a-f0-9]{64}$/', $hash) === 1) $map[$path] = $hash;
        }
        return $map;
    }

    private function assetsForIdentity(mixed $assets): array
    {
        if (!is_array($assets)) return [];
        $result = [];
        foreach ($assets as $assetRow) {
            if (!is_array($assetRow)) continue;
            $asset = $this->assetForIdentity($assetRow);
            if ($asset === null) throw new RuntimeException('Server asset is not backed by verified local bytes.');
            $result[] = $asset;
        }
        return $result;
    }

    private function assetForIdentity(array $assetRow): ?array
    {
        $path = trim((string) ($assetRow['storage_path'] ?? $assetRow['storagePath'] ?? $assetRow['path'] ?? ''));
        $url = trim((string) ($assetRow['public_url'] ?? $assetRow['publicUrl'] ?? $assetRow['url'] ?? ''));
        $hash = strtolower((string) ($assetRow['verifiedSha256'] ?? $this->verifiedStoredAssetHash($path, $url) ?? ''));
        if ($hash === '' || preg_match('/^[a-f0-9]{64}$/', $hash) !== 1) return null;
        $identityPath = $path !== '' ? $path : $url;
        if ($identityPath === '') return null;
        return ['tempId' => (string) ($assetRow['external_key'] ?? $assetRow['externalKey'] ?? 'stored-' . $hash), 'path' => $identityPath, 'sha256' => $hash];
    }

    private function assetListContainsPath(array $assets, string $path): bool
    {
        $hash = $this->verifiedStoredAssetHash('', $path);
        foreach ($assets as $asset) {
            if (!is_array($asset)) continue;
            if (in_array($path, [$asset['path'] ?? '', $asset['url'] ?? ''], true)) return true;
            if ($hash !== null && hash_equals(strtolower((string) ($asset['sha256'] ?? '')), $hash)) return true;
        }
        return false;
    }

    private function canonicalQuestionType(string $type): string
    {
        return match (strtolower(trim($type))) {
            'multipla_escolha', 'multiple_choice', 'single_choice' => 'single_choice',
            'certo_errado', 'true_false' => 'true_false',
            default => strtolower(trim($type)),
        };
    }

    private function incomingAlternativesForComparison(array $question): array
    {
        $result = [];
        foreach (array_values(is_array($question['alternatives'] ?? null) ? $question['alternatives'] : []) as $index => $alternative) {
            if (!is_array($alternative)) continue;
            $result[] = [(int) ($alternative['order'] ?? $index + 1), strtoupper(trim((string) ($alternative['label'] ?? ''))), $this->normalizeQuestionText((string) ($alternative['text'] ?? $alternative['textClean'] ?? ''))];
        }
        usort($result, static fn (array $a, array $b): int => $a[0] <=> $b[0]);
        return array_map(static fn (array $item): array => [$item[1], $item[2]], $result);
    }

    private function storedAlternativesForComparison(array $data): array
    {
        $result = [];
        foreach (array_values(is_array($data['itens'] ?? null) ? $data['itens'] : []) as $index => $alternative) {
            if (!is_array($alternative)) continue;
            $result[] = [(int) ($alternative['ordem'] ?? $index + 1), strtoupper(trim((string) ($alternative['rotulo'] ?? ''))), $this->normalizeQuestionText((string) ($alternative['corpo'] ?? $alternative['corpo_clean'] ?? ''))];
        }
        usort($result, static fn (array $a, array $b): int => $a[0] <=> $b[0]);
        return array_map(static fn (array $item): array => [$item[1], $item[2]], $result);
    }

    private function findBatchContext(array $contexts, string $key): ?array
    {
        if ($key === '') return null;
        foreach ($contexts as $context) if (is_array($context) && (string) ($context['tempId'] ?? $context['id'] ?? '') === $key) return $context;
        return null;
    }

    private function incomingContainsMedia(array $question, array $contexts = []): bool
    {
        $scan = static function (mixed $value, string $key = '') use (&$scan): bool {
            if (is_array($value)) {
                if ($key === 'assets' && $value !== []) return true;
                foreach ($value as $childKey => $child) if ($scan($child, (string) $childKey)) return true;
                return false;
            }
            return is_string($value) && (preg_match('/\[image:[^\]]+\]/i', $value) === 1 || preg_match('/<img\b/i', $value) === 1);
        };
        if ($scan($question)) return true;
        $contextKey = trim((string) ($question['source']['contextTempId'] ?? ''));
        if ($contextKey !== '') {
            foreach ($contexts as $context) {
                if (is_array($context) && (string) ($context['tempId'] ?? $context['id'] ?? '') === $contextKey) {
                    return $scan($context);
                }
            }
        }
        return false;
    }

    private function storedContainsMedia(array $row, array $data): bool
    {
        $relations = is_array($row['_relations'] ?? null) ? $row['_relations'] : [];
        if (($relations['assets'] ?? []) !== [] || ($relations['optionAssets'] ?? []) !== [] || ($relations['contextAssets'] ?? []) !== []) return true;
        if ((int) ($row['has_image'] ?? 0) === 1 || trim((string) ($data['imageUrl'] ?? '')) !== '' || trim((string) ($row['group_image_url'] ?? '')) !== '') return true;
        foreach ([(string) ($row['enunciado'] ?? ''), (string) ($row['intro_text'] ?? ''), (string) ($row['reference_text'] ?? '')] as $value) {
            if (preg_match('/\[image:[^\]]+\]/i', $value) === 1 || preg_match('/<img\b/i', $value) === 1) return true;
        }
        foreach ($data['itens'] ?? [] as $alternative) if (is_array($alternative) && preg_match('/\[image:[^\]]+\]|<img\b/i', (string) ($alternative['corpo'] ?? '')) === 1) return true;
        $groupAssets = json_decode((string) ($row['group_assets_json'] ?? ''), true);
        return is_array($groupAssets) && $groupAssets !== [];
    }

    private function normalizeQuestionText(string $value): string
    {
        $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $value = preg_replace('~<(script|style|svg|iframe|object|embed)\b[^>]*>.*?</\1\s*>~is', ' ', $value) ?? $value;
        $value = strip_tags($value);
        $value = str_replace(["\r\n", "\r", "\n", "\t", "\u{00A0}"], ' ', $value);
        if (class_exists(Normalizer::class)) {
            $normalized = Normalizer::normalize($value, Normalizer::FORM_C);
            if (is_string($normalized)) $value = $normalized;
        }
        return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $value) ?? $value), 'UTF-8');
    }

    /**
     * Gran image filenames in this batch are keyed by the first 20 hex chars
     * of SHA-256(source URL). Resolve that source locator only to a manifest
     * entry in the same exam directory; the ZIP validator has already checked
     * the entry bytes against the manifest SHA-256.
     *
     * @param list<array<string,mixed>> $contexts
     * @param list<array<string,mixed>> $manifestFiles
     * @param array<string,string> $verifiedHashes
     */
    private function mapSourceImageUrlsToVerifiedArchiveAssets(
        array $question,
        array $contexts,
        string $examPrefix,
        array $manifestFiles,
        array &$verifiedHashes
    ): void {
        $assets = is_array($question['assets'] ?? null) ? $question['assets'] : [];
        foreach (is_array($question['alternatives'] ?? null) ? $question['alternatives'] : [] as $alternative) {
            if (is_array($alternative) && is_array($alternative['assets'] ?? null)) $assets = array_merge($assets, $alternative['assets']);
        }
        $source = is_array($question['source'] ?? null) ? $question['source'] : [];
        $contextKey = trim((string) ($source['contextTempId'] ?? ''));
        if ($contextKey !== '') {
            foreach ($contexts as $context) {
                if (!is_array($context) || trim((string) ($context['tempId'] ?? '')) !== $contextKey) continue;
                if (is_array($context['assets'] ?? null)) $assets = array_merge($assets, $context['assets']);
                break;
            }
        }
        foreach ($assets as $asset) {
            if (!is_array($asset)) continue;
            $url = trim((string) ($asset['url'] ?? $asset['src'] ?? ''));
            if ($url === '' || isset($verifiedHashes[$url])) continue;
            $urlDigest = hash('sha256', $url);
            $prefix = substr($urlDigest, 0, 20) . '.';
            $matches = [];
            foreach ($manifestFiles as $file) {
                if (!is_array($file) || !isset($file['path'], $file['sha256'])) continue;
                $archivePath = (string) $file['path'];
                if (!str_starts_with($archivePath, $examPrefix)) continue;
                $basename = basename($archivePath);
                if (str_starts_with(strtolower($basename), strtolower($prefix))) $matches[] = $file;
            }
            if (count($matches) !== 1) continue;
            $file = $matches[0];
            $hash = strtolower((string) $file['sha256']);
            if (preg_match('/^[a-f0-9]{64}$/', $hash) !== 1) continue;
            $verifiedHashes[$url] = $hash;
            $relative = substr((string) $file['path'], strlen($examPrefix));
            $verifiedHashes[$relative] = $hash;
            $verifiedHashes['/' . $relative] = $hash;
        }
    }

    /** @param list<string> $values @return list<array<string,mixed>> */
    private function fetchByValues(string $queryTemplate, array $values, string $prefix): array
    {
        $rows = [];
        foreach (array_chunk(array_values(array_unique($values)), 400) as $chunkIndex => $chunk) {
            if ($chunk === []) continue;
            $bindings = [];
            $placeholders = [];
            foreach ($chunk as $index => $value) {
                $placeholder = ':' . $prefix . '_' . $chunkIndex . '_' . $index;
                $placeholders[] = $placeholder;
                $bindings[$placeholder] = $value;
            }
            $stmt = $this->db->prepare(sprintf($queryTemplate, implode(', ', $placeholders)));
            $stmt->execute($bindings);
            array_push($rows, ...($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []));
        }
        return $rows;
    }

    private function normalizeMatchText(string $value): string
    {
        $value = trim(preg_replace('/\s+/u', ' ', $value) ?? $value);
        if (class_exists(Normalizer::class)) {
            $normalized = Normalizer::normalize($value, Normalizer::FORM_D);
            if (is_string($normalized)) {
                $value = preg_replace('/\p{Mn}/u', '', $normalized) ?? $normalized;
            }
        }
        return mb_strtolower($value, 'UTF-8');
    }

    private function readManifest(string $path): array
    {
        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::RDONLY) !== true) {
            throw new RuntimeException('Nao foi possivel reabrir o ZIP validado.');
        }
        try {
            $raw = $zip->getFromName('manifest.json');
            $manifest = is_string($raw) ? json_decode($raw, true) : null;
            if (!is_array($manifest)) {
                throw new RuntimeException('Manifesto validado nao pode ser lido.');
            }
            return $manifest;
        } finally {
            $zip->close();
        }
    }

    private function privateStorageDirectory(): string
    {
        $configured = trim((string) getenv('CM_BATCH_STORAGE_ROOT'));
        $environment = strtolower(trim((string) (getenv('APP_ENV') ?: getenv('APP_ENVIRONMENT') ?: '')));
        if ($configured === '' && in_array($environment, ['prod', 'production'], true)) {
            throw new RuntimeException('Configure CM_BATCH_STORAGE_ROOT em volume privado persistente antes de receber lotes em producao.');
        }
        $directory = $configured !== ''
            ? $configured
            : dirname(__DIR__, 3) . '/storage/cm-batch-private';
        $isAbsolute = DIRECTORY_SEPARATOR === '\\'
            ? preg_match('/^[a-z]:[\\\\\/]/i', $directory) === 1
            : str_starts_with($directory, '/');
        if (!$isAbsolute) {
            throw new RuntimeException('CM_BATCH_STORAGE_ROOT deve ser um caminho absoluto.');
        }
        if (is_link($directory)) {
            throw new RuntimeException('O caminho de armazenamento privado nao pode conter links simbolicos.');
        }
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('Nao foi possivel criar o armazenamento privado do lote.');
        }
        $realDirectory = realpath($directory);
        if (!is_string($realDirectory) || !is_dir($realDirectory) || !is_writable($realDirectory)) {
            throw new RuntimeException('O armazenamento privado configurado nao esta acessivel para escrita.');
        }
        @chmod($directory, 0700);
        return $realDirectory;
    }

    private function uuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);
        return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4)
            . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
    }
}
