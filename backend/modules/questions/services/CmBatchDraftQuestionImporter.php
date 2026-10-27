<?php

require_once __DIR__ . '/../repositories/QuestionCanonicalRepository.php';
require_once __DIR__ . '/../../ingestion/domain/CmBatchQuestionIdentity.php';
require_once __DIR__ . '/../../ingestion/domain/CmBatchTaxonomyPolicy.php';
require_once __DIR__ . '/../../ingestion/domain/CmBatchHtmlPolicy.php';

final class CmBatchDraftQuestionImporter
{
    public function __construct(
        private readonly QuestionsRepository $repository,
        private readonly QuestionsValidator $validator,
        private readonly PDO $db,
        private readonly QuestionCanonicalRepository $canonicalRepository,
        private readonly Closure $persistQuestion
    ) {
    }

    public function import(string $actorId, string $jobId, int $examId, array $question, array $contexts, array $verifiedAssetHashes, array $resolvedFilterIds, array $occurrence, ?int $canonicalQuestionId = null, ?string $canonicalUpdatedAt = null): array
    {
        if (!$this->db->inTransaction()) throw new LogicException('Importacao CM Batch exige transacao ativa.');
        $fingerprint = CmBatchQuestionIdentity::fingerprint($question, $contexts, $verifiedAssetHashes);
        $lock = $this->db->prepare('INSERT IGNORE INTO cm_batch_identity_locks (identity_key) VALUES (:key)');
        $lock->execute([':key' => $fingerprint]);
        $lock = $this->db->prepare('SELECT identity_key FROM cm_batch_identity_locks WHERE identity_key=:key FOR UPDATE');
        $lock->execute([':key' => $fingerprint]);
        $this->canonicalRepository->assertSchemaReady();
        $lookup = $this->db->prepare('SELECT id,import_fingerprint FROM questions WHERE import_fingerprint=:fingerprint FOR UPDATE');
        $lookup->execute([':fingerprint' => $fingerprint]);
        $existing = $lookup->fetch(PDO::FETCH_ASSOC);
        if ($canonicalQuestionId !== null) {
            $planned = $this->db->prepare('SELECT id,import_fingerprint,updated_at FROM questions WHERE id=:id FOR UPDATE');
            $planned->execute([':id' => $canonicalQuestionId]);
            $plannedRow = $planned->fetch(PDO::FETCH_ASSOC);
            if (!$plannedRow) throw new DomainException('Questao canonica da previa nao existe mais; gere uma nova previa.');
            if ($existing && (int) $existing['id'] !== $canonicalQuestionId) throw new DomainException('ID Gran e previa apontam para questoes canonicas diferentes.');
            $currentUpdatedAt = trim((string) ($plannedRow['updated_at'] ?? ''));
            $plannedUpdatedAt = trim((string) ($canonicalUpdatedAt ?? ''));
            $sameVersion = $plannedUpdatedAt !== '' && hash_equals($plannedUpdatedAt, $currentUpdatedAt);
            $sameFingerprint = hash_equals(strtolower((string) ($plannedRow['import_fingerprint'] ?? '')), strtolower($fingerprint));
            if (($plannedUpdatedAt !== '' || $currentUpdatedAt !== '') ? !$sameVersion : !$sameFingerprint) {
                throw new DomainException('A questao existente mudou apos a previa; revise novamente antes de vincular.');
            }
            if ($existing && (int) $existing['id'] !== $canonicalQuestionId) throw new DomainException('A identidade da questao mudou apos a previa.');
            $existing = $plannedRow;
        }
        $provider = strtolower(trim((string) ($occurrence['provider'] ?? '')));
        $externalId = trim((string) ($occurrence['externalQuestionId'] ?? ''));
        if ($externalId !== '') {
            $lookup = $this->db->prepare('SELECT q.id,q.import_fingerprint FROM question_source_identities s JOIN questions q ON q.id=s.question_id WHERE s.source_provider=:provider AND s.source_external_id=:external FOR UPDATE');
            $lookup->execute([':provider' => $provider, ':external' => $externalId]);
            $sourceMatch = $lookup->fetch(PDO::FETCH_ASSOC);
            if ($provider === 'gran') {
                $legacyLookup = $this->db->prepare("SELECT id,import_fingerprint FROM questions WHERE source_external_id=:external AND (source_provider='gran' OR source_provider IS NULL OR TRIM(source_provider)='') FOR UPDATE");
                $legacyLookup->execute([':external' => $externalId]);
                $legacyRows = $legacyLookup->fetchAll(PDO::FETCH_ASSOC);
                if (count($legacyRows) > 1) throw new DomainException('O ID Gran aponta para mais de uma questao legada.');
                $legacyMatch = $legacyRows[0] ?? null;
                if ($legacyMatch && $sourceMatch && (int) $legacyMatch['id'] !== (int) $sourceMatch['id']) throw new DomainException('O ID Gran aponta para questoes canonicas divergentes.');
                $sourceMatch = $legacyMatch ?: $sourceMatch;
            }
            if ($sourceMatch && (($canonicalQuestionId === null && !hash_equals((string) $sourceMatch['import_fingerprint'], $fingerprint)) || ($canonicalQuestionId !== null && (int) $sourceMatch['id'] !== $canonicalQuestionId) || ($existing && (int) $existing['id'] !== (int) $sourceMatch['id']))) {
                throw new DomainException('Identidade externa diverge do conteudo canonico.');
            }
            $existing = $sourceMatch ?: $existing;
        }
        [$filters, $allIds] = $this->resolveFilters($resolvedFilterIds);
        $mediaUrls = $this->validateMediaAndContent($question, $contexts);
        if ($existing) {
            $questionId = (int) $existing['id'];
            $this->mergeMissingContext($questionId, $question, $contexts, $mediaUrls, $examId, $fingerprint, $actorId);
            $addedEditorial = $this->mergeMissingEditorial($questionId, $question, $actorId, $jobId, $mediaUrls);
            $action = $addedEditorial ? 'enrich_existing_question' : 'link_existing_question';
        } else {
            $contextId = $this->persistContext($question, $contexts, $mediaUrls, $examId, $fingerprint, $actorId);
            $question['id'] = null;
            $question['source'] = ['origin' => 'exam', 'examId' => $examId, 'questionNumber' => (int) $occurrence['questionNumber'], 'sourcePage' => $occurrence['sourcePage'] ?? null];
            $question['filters'] = $filters;
            $question['canonicalContextId'] = $contextId;
            $question = self::forceDraftQuestion($question);
            foreach ($question['editorial'] ?? [] as $index => $entry) $question['editorial'][$index]['status'] = 'draft';
            $question['answer'] = ['mode' => 'single', 'raw' => '', 'correctAlternativeTempIds' => []];
            $validated = $this->validator->validateSavePayload($question);
            $validated['id'] = null;
            $validated['taxonomies'] = [];
            $validated['import_fingerprint'] = $fingerprint;
            $validated['source_provider'] = $provider === 'gran' && $externalId !== '' ? 'gran' : null;
            $validated['source_external_id'] = $provider === 'gran' && $externalId !== '' ? $externalId : null;
            $validated['source_exam_key'] = null;
            $validated['source_question_number'] = (string) $occurrence['questionNumber'];
            $validated['cm_batch_unverified_answer'] = true;
            [$questionId] = ($this->persistQuestion)($validated, $actorId);
            $questionId = (int) $questionId;
            $action = 'create_question';
        }
        foreach (array_keys($allIds) as $id) $this->repository->linkQuestionFilter($questionId, $id);
        $this->repository->syncQuestionSourceIdentity($questionId, $provider, $externalId, (string) ($occurrence['version'] ?? ''), $jobId);
        $occurrence['answerStatus'] = 'unverified';
        $occurrenceId = $this->repository->syncCmBatchQuestionOccurrence($questionId, $examId, $occurrence, $jobId);
        return ['canonicalId' => $questionId, 'occurrenceId' => $occurrenceId, 'action' => $action];
    }

    private function mergeMissingEditorial(int $questionId, array $question, string $actorId, string $jobId, array $mediaUrls): bool
    {
        $editorials = array_values(array_filter($question['editorial'] ?? [], static fn($entry): bool =>
            is_array($entry)
            && in_array(($entry['type'] ?? ''), ['teacher_comment', 'detailed_analysis'], true)
            && trim((string) ($entry['body'] ?? '')) !== ''
        ));
        if ($editorials === []) return false;

        $find = $this->db->prepare('SELECT id,title,body,status,generated_by,metadata_json FROM question_editorials WHERE question_id=:question AND editorial_type=:type ORDER BY id FOR UPDATE');
        $insert = $this->db->prepare("INSERT INTO question_editorials (question_id,editorial_type,title,body,status,generated_by,metadata_json) VALUES (:question,:type,:title,:body,'draft',:generated,:metadata)");
        $fill = $this->db->prepare("UPDATE question_editorials SET title=COALESCE(title,:title),body=:body,status='draft',generated_by=COALESCE(generated_by,:generated),metadata_json=:metadata WHERE id=:id AND TRIM(COALESCE(body,''))=''");
        $audit = $this->db->prepare("INSERT INTO cm_batch_field_audit (job_id,entity_type,canonical_entity_id,field_name,before_json,after_json,source_evidence_json,actor_user_id,merge_reason,status) VALUES (:job,'question',:entity,:field,:before,:after,:evidence,:actor,'fill_missing_editorial_only','applied')");
        $added = [];
        foreach ($editorials as $editorial) {
            CmBatchHtmlPolicy::assertSafe((string) $editorial['body'], $mediaUrls);
            $type = (string) $editorial['type'];
            $find->execute([':question' => $questionId, ':type' => $type]);
            $existingRows = $find->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $hasExistingBody = false;
            foreach ($existingRows as $row) if (trim((string) ($row['body'] ?? '')) !== '') $hasExistingBody = true;
            if ($hasExistingBody) continue;
            $existing = $existingRows[0] ?? null;
            if ($existing && strtolower((string) ($existing['status'] ?? '')) === 'approved') continue;

            $metadata = json_encode(is_array($editorial['metadata'] ?? null) ? $editorial['metadata'] : [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            $before = $existing ? ['title' => $existing['title'], 'body' => $existing['body'], 'status' => $existing['status'], 'metadata' => $existing['metadata_json']] : null;
            $after = ['type' => $type, 'title' => trim((string) ($editorial['title'] ?? '')) ?: null, 'body' => (string) $editorial['body'], 'status' => 'draft', 'metadata' => json_decode($metadata, true)];
            if ($existing) {
                $fill->execute([':title' => $after['title'], ':body' => $after['body'], ':generated' => trim((string) ($editorial['generatedBy'] ?? '')) ?: null, ':metadata' => $metadata, ':id' => (int) $existing['id']]);
                if ($fill->rowCount() < 1) continue;
            } else {
                $insert->execute([':question' => $questionId, ':type' => $type, ':title' => $after['title'], ':body' => $after['body'], ':generated' => trim((string) ($editorial['generatedBy'] ?? '')) ?: null, ':metadata' => $metadata]);
            }
            $audit->execute([
                ':job' => $jobId,
                ':entity' => (string) $questionId,
                ':field' => $type,
                ':before' => $before === null ? null : json_encode($before, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                ':after' => json_encode($after, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                ':evidence' => json_encode(['source' => 'cm-batch.v1', 'jobId' => $jobId], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                ':actor' => $actorId,
            ]);
            $added[] = $type;
        }
        if ($added !== []) {
            $set = [];
            $params = [':id' => $questionId];
            foreach ($added as $type) {
                $column = $type === 'teacher_comment' ? 'has_teacher_comment' : 'has_detailed_comment';
                $set[] = "$column = 1";
            }
            $this->db->prepare('UPDATE questions SET ' . implode(', ', array_unique($set)) . ' WHERE id=:id')->execute($params);
        }
        return $added !== [];
    }

    private function mergeMissingContext(int $questionId, array $question, array $contexts, array $mediaUrls, int $examId, string $fingerprint, string $actorId): void
    {
        $contextKey = trim((string) ($question['source']['contextTempId'] ?? ''));
        if ($contextKey === '') return;
        $links = $this->db->prepare('SELECT c.id,c.body FROM question_context_questions rel INNER JOIN question_contexts c ON c.id=rel.context_id WHERE rel.question_id=:question ORDER BY c.id FOR UPDATE');
        $links->execute([':question' => $questionId]);
        $existingContexts = $links->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $incoming = $this->findContext($contexts, $contextKey);
        if ($existingContexts !== []) {
            if (count($existingContexts) !== 1 || $this->normalizeContextBody((string) ($existingContexts[0]['body'] ?? '')) !== $this->normalizeContextBody((string) ($incoming['body'] ?? ''))) {
                throw new DomainException('O contexto canonico mudou apos a previa; revise antes de enriquecer.');
            }
            return;
        }
        $contextId = $this->persistContext($question, $contexts, $mediaUrls, $examId, $fingerprint, $actorId);
        if ($contextId !== null) $this->canonicalRepository->linkQuestionContext($contextId, $questionId, 'shared');
    }

    private function findContext(array $contexts, string $contextKey): array
    {
        $matches = array_values(array_filter($contexts, static fn($context): bool => is_array($context) && (string) ($context['tempId'] ?? '') === $contextKey));
        if (count($matches) !== 1) throw new DomainException('Contexto ausente ou ambiguo.');
        return $matches[0];
    }

    private function normalizeContextBody(string $body): string
    {
        $decoded = html_entity_decode($body, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return preg_replace('/\s+/u', ' ', trim($decoded)) ?? trim($decoded);
    }

    private function resolveFilters(array $resolvedFilterIds): array
    {
        $filters = $allIds = [];
        $readFilter = $this->db->prepare('SELECT id,type,name,slug,parent_id,taxonomy_level FROM filters WHERE id=:id');
        foreach ($resolvedFilterIds as $category => $ids) {
            [$type, $level] = CmBatchTaxonomyPolicy::definition($category === 'levels' ? 'educationLevels' : $category);
            foreach ($ids as $id) {
                if (!is_int($id) || $id < 1) throw new InvalidArgumentException('ID canonico de taxonomia invalido.');
                $readFilter->execute([':id' => $id]);
                $filter = $readFilter->fetch(PDO::FETCH_ASSOC);
                if (!$filter || $filter['type'] !== $type || ($level !== null && $filter['taxonomy_level'] !== $level)) throw new DomainException('Categoria canonica divergente.');
                $filters[$category][] = ['id' => $id, 'name' => $filter['name'], 'label' => $filter['name'], 'slug' => $filter['slug'], 'parentId' => $filter['parent_id'], 'taxonomyLevel' => $filter['taxonomy_level']];
                $allIds[$id] = true;
            }
        }
        return [$filters, $allIds];
    }

    private function validateMediaAndContent(array $question, array $contexts): array
    {
        $mediaUrls = [];
        foreach ($question['assets'] ?? [] as $asset) {
            $url = (string) ($asset['url'] ?? '');
            $path = (string) (parse_url($url, PHP_URL_PATH) ?? '');
            if (!preg_match('~^/api/admin/cm_batch_media\.php\?sha=[a-f0-9]{64}$~', $url) && !str_contains($path, '/question-assets/cm-batch/')) throw new DomainException('Midia precisa estar no storage verificado do CM Batch.');
            $mediaUrls[] = $url;
        }
        $contextKey = (string) ($question['source']['contextTempId'] ?? '');
        foreach ($contexts as $context) {
            if (!is_array($context) || ($context['tempId'] ?? '') !== $contextKey) continue;
            foreach ($context['assets'] ?? [] as $asset) {
                $url = (string) ($asset['url'] ?? '');
                if (!filter_var($url, FILTER_VALIDATE_URL) && !str_starts_with($url, '/uploads/')) throw new DomainException('Midia de contexto precisa estar materializada no storage controlado.');
                $mediaUrls[] = $url;
            }
            $contextBody = (string) ($context['body'] ?? '');
            if (preg_match_all('/<img\b[^>]*\bsrc\s*=\s*(["\'])(.*?)\1/is', $contextBody, $matches) > 0) {
                foreach ($matches[2] as $url) {
                    $path = (string) (parse_url(html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8'), PHP_URL_PATH) ?? '');
                    if (!str_contains($path, '/question-assets/cm-batch/')) throw new DomainException('Imagem de contexto sem materializacao verificada.');
                    $mediaUrls[] = html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                }
            }
        }
        foreach (['statement', 'supportText', 'reference'] as $field) {
            $html = (string) ($question['content'][$field] ?? '');
            if (preg_match_all('/<img\b[^>]*\bsrc\s*=\s*(["\'])(.*?)\1/is', $html, $matches) > 0) {
                foreach ($matches[2] as $url) {
                    $url = html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    $path = (string) (parse_url($url, PHP_URL_PATH) ?? '');
                    if (!str_contains($path, '/question-assets/cm-batch/')) throw new DomainException('Imagem do enunciado sem materializacao verificada.');
                    $mediaUrls[] = $url;
                }
            }
        }
        foreach ($question['alternatives'] ?? [] as $alternative) {
            $html = (string) ($alternative['text'] ?? '');
            if (preg_match_all('/<img\b[^>]*\bsrc\s*=\s*(["\'])(.*?)\1/is', $html, $matches) > 0) {
                foreach ($matches[2] as $url) {
                    $url = html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    $path = (string) (parse_url($url, PHP_URL_PATH) ?? '');
                    if (!str_contains($path, '/question-assets/cm-batch/')) throw new DomainException('Imagem da alternativa sem materializacao verificada.');
                    $mediaUrls[] = $url;
                }
            }
            CmBatchHtmlPolicy::assertSafe($html, $mediaUrls);
        }
        foreach ($question['editorial'] ?? [] as $editorial) CmBatchHtmlPolicy::assertSafe((string) ($editorial['body'] ?? ''), $mediaUrls);
        return $mediaUrls;
    }

    private function persistContext(array $question, array $contexts, array $mediaUrls, int $examId, string $fingerprint, string $actorId): ?int
    {
        $contextKey = (string) ($question['source']['contextTempId'] ?? '');
        if ($contextKey === '') return null;
        $context = $this->findContext($contexts, $contextKey);
        CmBatchHtmlPolicy::assertSafe((string) ($context['body'] ?? ''), $mediaUrls);
        $context['tempId'] = 'cm_' . hash('sha256', $examId . ':' . $contextKey);
        $context['provaId'] = $examId;
        $context['source'] = [];
        $existing = $this->db->prepare('SELECT id,body FROM question_contexts WHERE external_key=:key FOR UPDATE');
        $existing->execute([':key' => $context['tempId']]);
        $contextRow = $existing->fetch(PDO::FETCH_ASSOC);
        if ($contextRow) {
            if ($this->normalizeContextBody((string) $contextRow['body']) !== $this->normalizeContextBody((string) ($context['body'] ?? ''))) {
                throw new DomainException('A identidade do contexto ja existe com conteudo divergente.');
            }
            return (int) $contextRow['id'];
        }
        return $this->canonicalRepository->saveContext($context, $actorId);
    }

    public static function forceDraftQuestion(array $question): array
    {
        $publication = is_array($question['publication'] ?? null) ? $question['publication'] : [];
        $question['publication'] = array_merge($publication, ['status' => 'draft', 'visibility' => 'private', 'scheduledAt' => null]);
        $question['publishStatus'] = $question['publish_status'] = 'draft';
        $question['visibilityStatus'] = $question['visibility_status'] = 'private';
        $question['scheduledAt'] = $question['scheduled_at'] = null;
        $review = is_array($question['review'] ?? null) ? $question['review'] : [];
        $review['required'] = true;
        if (!in_array(strtolower(trim((string) ($review['status'] ?? ''))), ['approved'], true)) $review['status'] = 'pending';
        $question['review'] = $review;
        return $question;
    }
}
