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

    public function import(string $actorId, string $jobId, int $examId, array $question, array $contexts, array $verifiedAssetHashes, array $resolvedFilterIds, array $occurrence): array
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
            if ($sourceMatch && (!hash_equals((string) $sourceMatch['import_fingerprint'], $fingerprint) || ($existing && (int) $existing['id'] !== (int) $sourceMatch['id']))) {
                throw new DomainException('Identidade externa diverge do conteudo canonico.');
            }
            $existing = $sourceMatch ?: $existing;
        }
        [$filters, $allIds] = $this->resolveFilters($resolvedFilterIds);
        if ($existing) {
            $questionId = (int) $existing['id'];
            $action = 'link_existing_question';
        } else {
            $mediaUrls = $this->validateMediaAndContent($question, $contexts);
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
            if (!preg_match('~^/api/admin/cm_batch_media\.php\?sha=[a-f0-9]{64}$~', $url)) throw new DomainException('Midia precisa estar no storage privado controlado.');
            $mediaUrls[] = $url;
        }
        foreach (['statement', 'supportText', 'reference'] as $field) CmBatchHtmlPolicy::assertSafe((string) ($question['content'][$field] ?? ''), $mediaUrls);
        foreach ($question['alternatives'] ?? [] as $alternative) CmBatchHtmlPolicy::assertSafe((string) ($alternative['text'] ?? ''), $mediaUrls);
        foreach ($question['editorial'] ?? [] as $editorial) CmBatchHtmlPolicy::assertSafe((string) ($editorial['body'] ?? ''), $mediaUrls);
        return $mediaUrls;
    }

    private function persistContext(array $question, array $contexts, array $mediaUrls, int $examId, string $fingerprint, string $actorId): ?int
    {
        $contextKey = (string) ($question['source']['contextTempId'] ?? '');
        if ($contextKey === '') return null;
        $matches = array_values(array_filter($contexts, static fn(array $context): bool => ($context['tempId'] ?? '') === $contextKey));
        if (count($matches) !== 1) throw new DomainException('Contexto ausente ou ambiguo.');
        $context = $matches[0];
        CmBatchHtmlPolicy::assertSafe((string) ($context['body'] ?? ''), $mediaUrls);
        if (!empty($context['assets'])) throw new DomainException('Assets do contexto precisam de materializacao propria.');
        $context['tempId'] = 'cm_' . hash('sha256', $examId . ':' . $fingerprint . ':' . $contextKey);
        $context['provaId'] = $examId;
        $context['source'] = [];
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
