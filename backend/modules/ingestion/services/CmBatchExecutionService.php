<?php
declare(strict_types=1);

require_once __DIR__ . '/CmBatchQueueService.php';
require_once __DIR__ . '/CmBatchImportService.php';
require_once __DIR__ . '/../domain/CmBatchTaxonomyPolicy.php';
require_once __DIR__ . '/../../questions/services/QuestionsService.php';
require_once __DIR__ . '/../../questions/services/QuestionsRewardService.php';
require_once __DIR__ . '/../../questions/repositories/QuestionsRepository.php';
require_once __DIR__ . '/../../questions/validators/QuestionsValidator.php';
require_once __DIR__ . '/../../../shared/storage/ObjectStorage.php';

/** Bounded executor for explicitly approved, private CM Batch drafts. */
final class CmBatchExecutionService
{
    private const MAX_ITEMS_PER_REQUEST = 10;

    private QuestionsService $questions;
    private QuestionsRepository $repository;

    public function __construct(private readonly PDO $db, private readonly string $actorId)
    {
        $this->repository = new QuestionsRepository($db);
        $this->questions = new QuestionsService(
            $this->repository,
            new QuestionsValidator(),
            new QuestionsRewardService($this->repository),
            $db
        );
    }

    public function approveAndStart(string $jobId, string $planHash, string $archiveHash, int $limit = 5): array
    {
        (new CmBatchQueueService($this->db, $this->actorId))->approve($jobId, $planHash, $archiveHash);
        return ['job' => (new CmBatchImportService($this->db, $this->actorId))->getJob($jobId), 'processed' => []];
    }

    public function process(string $jobId, int $limit = 5): array
    {
        $limit = max(1, min(self::MAX_ITEMS_PER_REQUEST, $limit));
        $queue = new CmBatchQueueService($this->db, $this->actorId);
        $processed = [];
        for ($i = 0; $i < $limit; $i++) {
            $result = $queue->processOne($jobId, fn(array $job, array $item, PDO $db): array => $this->executeItem($job, $item));
            $processed[] = $result;
            if (!in_array($result['status'] ?? '', ['running', 'item_failed'], true) || empty($result['itemId'])) break;
        }
        return ['job' => (new CmBatchImportService($this->db, $this->actorId))->getJob($jobId), 'processed' => $processed];
    }

    private function executeItem(array $job, array $item): array
    {
        $archivePath = (string) ($job['archive_path'] ?? '');
        if ($archivePath === '' || !is_file($archivePath) || is_link($archivePath)
            || !hash_equals((string) $job['archive_sha256'], (string) hash_file('sha256', $archivePath))) {
            throw new DomainException('O ZIP privado foi removido ou alterado desde a aprovação.');
        }
        $zip = new ZipArchive();
        if ($zip->open($archivePath, ZipArchive::RDONLY) !== true) throw new RuntimeException('Nao foi possivel abrir o arquivo aprovado.');
        try {
            $manifest = $this->decodeEntry($zip, 'manifest.json');
            $plan = json_decode((string) ($job['dry_run_json'] ?? ''), true, 512, JSON_THROW_ON_ERROR);
            $payload = json_decode((string) ($item['payload_json'] ?? ''), true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($manifest) || !is_array($plan) || !is_array($payload)) throw new DomainException('Dados do checkpoint CM Batch invalidos.');
            if (($item['entity_type'] ?? '') === 'exam') return $this->executeExam($zip, $manifest, $plan, $payload, $job, $item);
            if (($item['entity_type'] ?? '') !== 'question') throw new DomainException('Tipo de item nao suportado pelo executor.');
            return $this->executeQuestion($zip, $manifest, $plan, $payload, $job, $item);
        } finally {
            $zip->close();
        }
    }

    private function executeExam(ZipArchive $zip, array $manifest, array $plan, array $payload, array $job, array $item): array
    {
        $externalKey = (string) ($payload['externalKey'] ?? '');
        $entry = $this->manifestExam($manifest, $externalKey);
        $document = $this->decodeEntry($zip, rtrim((string) $entry['path'], '/') . '/metadados.json');
        $source = is_array($document['source'] ?? null) ? $document['source'] : [];
        $identity = is_array($document['identity'] ?? null) ? $document['identity'] : [];
        $metadata = is_array($document['metadata'] ?? null) ? $document['metadata'] : [];
        $provider = strtolower(trim((string) ($source['provider'] ?? '')));
        $externalId = trim((string) ($source['externalExamId'] ?? ''));
        $year = (int) ($identity['canonicalYear'] ?? $metadata['ano'] ?? $payload['correctYear'] ?? 0);
        if ($provider === '' || $externalId === '' || $year < 1900 || $year > 2100) throw new DomainException('Identidade ou ano oficial da prova incompleto.');
        $taxonomy = $this->taxonomyEntities($plan);
        $boardId = $this->taxonomyIdByKey($taxonomy, (string) ($identity['boardKey'] ?? ''));
        $organizationIds = $this->taxonomyIdsByKeys($taxonomy, is_array($identity['organizationKeys'] ?? null) ? $identity['organizationKeys'] : []);
        $roleIds = $this->taxonomyIdsByKeys($taxonomy, is_array($identity['roleKeys'] ?? null) ? $identity['roleKeys'] : []);
        $title = trim((string) ($metadata['examTitle'] ?? ''));
        if ($title === '' || $boardId === null) throw new DomainException('Titulo ou banca canonica da prova ausente.');
        $record = [
            'nome' => mb_substr($title, 0, 255),
            'slug' => $this->slug($title),
            'ano' => $year,
            'banca_id' => $boardId,
            'orgao_id' => $organizationIds[0] ?? null,
            'cargo_id' => $roleIds[0] ?? null,
            'nivel_id' => $this->firstTaxonomyIdByLabel($taxonomy, 'educationLevels', (string) ($metadata['nivel'] ?? '')),
            'tipo_prova_id' => null,
            'carreira_id' => null,
            'pdf_url' => '',
            'metadata_json' => json_encode([
                'source' => 'cm_batch', 'sourceProvider' => $provider, 'sourceExternalId' => $externalId,
                'identity' => $identity, 'metadata' => $metadata, 'review' => $document['review'] ?? [],
                'sourceDocument' => $document,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            'created_by_user_id' => $this->actorId,
            'updated_by_user_id' => $this->actorId,
        ];
        $id = $this->repository->saveCmBatchExam($record, $provider, $externalId, (string) ($identity['editionKey'] ?? ''), (string) $job['job_id']);
        return ['canonicalId' => $id, 'action' => 'exam_identity_resolved', 'year' => $year];
    }

    private function executeQuestion(ZipArchive $zip, array $manifest, array $plan, array $payload, array $job, array $item): array
    {
        $externalKey = (string) ($payload['examExternalKey'] ?? '');
        $entry = $this->manifestExam($manifest, $externalKey);
        $examMeta = $this->decodeEntry($zip, rtrim((string) $entry['path'], '/') . '/metadados.json');
        $questionDocument = $this->decodeEntry($zip, rtrim((string) $entry['path'], '/') . '/questoes.json');
        $enrichmentDocument = $this->decodeEntry($zip, rtrim((string) $entry['path'], '/') . '/enriquecimento.json');
        $tempId = (string) ($payload['tempId'] ?? '');
        $questions = array_values(array_filter($questionDocument['questions'] ?? [], static fn($row): bool => is_array($row) && (string) ($row['tempId'] ?? '') === $tempId));
        if (count($questions) !== 1) throw new DomainException('A questao do checkpoint esta ausente ou duplicada no ZIP.');
        $question = $questions[0];
        $contexts = is_array($questionDocument['contexts'] ?? null) ? $questionDocument['contexts'] : [];
        $examSource = is_array($examMeta['source'] ?? null) ? $examMeta['source'] : [];
        $examIdentity = is_array($examMeta['identity'] ?? null) ? $examMeta['identity'] : [];
        $examId = $this->findExamId(strtolower((string) ($examSource['provider'] ?? '')), (string) ($examSource['externalExamId'] ?? ''), (string) ($examIdentity['editionKey'] ?? ''), (string) $job['job_id']);
        $questionPlan = $this->questionPlanItem($plan, $externalKey, $tempId);
        if (!in_array((string) ($questionPlan['action'] ?? ''), ['create', 'link', 'unchanged', 'enrich'], true)) throw new DomainException('Acao de questao nao esta aprovada para execucao.');
        $assets = $this->materializeQuestionAssets($zip, $question, $contexts, (string) $entry['path'], $manifest);
        $question = $assets['question'];
        $contexts = $assets['contexts'];
        $questionId = trim((string) ($question['id'] ?? $question['source']['externalQuestionId'] ?? $payload['externalQuestionId'] ?? ''));
        $number = trim((string) ($question['source']['questionNumber'] ?? $payload['questionNumber'] ?? ''));
        if ($number === '') throw new DomainException('Numero da questao ausente na ocorrencia.');
        $enrichment = null;
        foreach (is_array($enrichmentDocument['questionEnrichments'] ?? null) ? $enrichmentDocument['questionEnrichments'] : [] as $proposal) {
            if (is_array($proposal) && (string) ($proposal['questionTempId'] ?? '') === $tempId) {
                $enrichment = $proposal;
                break;
            }
        }
        if ($enrichment !== null) $question = $this->mergeEditorialAnnotations($question, $enrichment);
        $taxonomy = $this->taxonomyEntities($plan);
        $filterIds = $this->resolveQuestionFilters(is_array($question['filters'] ?? null) ? $question['filters'] : [], $taxonomy);
        $metadata = is_array($examMeta['metadata'] ?? null) ? $examMeta['metadata'] : [];
        $occurrence = [
            'provider' => strtolower((string) ($examSource['provider'] ?? '')),
            'externalExamId' => (string) ($examSource['externalExamId'] ?? ''),
            'externalQuestionId' => $questionId,
            'questionNumber' => $number,
            'sourcePage' => $question['source']['sourcePage'] ?? null,
            'bookletKey' => trim((string) (($examIdentity['editionKey'] ?? '') ?: ($metadata['tipoCaderno'] ?? ''))),
            'version' => trim((string) ($metadata['corCaderno'] ?? '')),
            'bookletType' => $metadata['tipoCaderno'] ?? null,
            'bookletColor' => $metadata['corCaderno'] ?? null,
            'answerKey' => '',
            'answerStatus' => 'unverified',
            'evidence' => [],
        ];
        $plannedCanonicalId = isset($questionPlan['canonicalQuestionId']) ? (int) $questionPlan['canonicalQuestionId'] : null;
        $plannedUpdatedAt = isset($questionPlan['canonicalUpdatedAt']) ? (string) $questionPlan['canonicalUpdatedAt'] : null;
        $result = $this->questions->importCmBatchDraftQuestion($this->actorId, (string) $job['job_id'], $examId, $question, $contexts, $assets['hashes'], $filterIds, $occurrence, $plannedCanonicalId, $plannedUpdatedAt);
        $proposalId = $enrichment !== null
            ? $this->preserveEnrichmentProposal((string) $job['job_id'], (int) $result['canonicalId'], $enrichment)
            : null;
        return ['canonicalId' => (int) $result['canonicalId'], 'occurrenceId' => (int) $result['occurrenceId'], 'action' => (string) $result['action'], 'enrichmentProposalId' => $proposalId];
    }

    private function mergeEditorialAnnotations(array $question, array $enrichment): array
    {
        $annotations = $enrichment['editorialAnnotations'] ?? [];
        if (!is_array($annotations)) return $question;
        $entries = array_is_list($annotations) ? $annotations : array_map(
            static fn(string $type, mixed $value): array => is_array($value) ? array_merge(['type' => $type], $value) : ['type' => $type, 'body' => (string) $value],
            array_keys($annotations),
            array_values($annotations)
        );
        $editorial = is_array($question['editorial'] ?? null) ? $question['editorial'] : [];
        foreach ($entries as $entry) {
            if (!is_array($entry)) continue;
            $type = trim((string) ($entry['type'] ?? $entry['editorialType'] ?? ''));
            $body = (string) ($entry['body'] ?? $entry['content'] ?? $entry['text'] ?? '');
            if (!in_array($type, ['teacher_comment', 'detailed_analysis'], true) || trim($body) === '') continue;
            $editorial[] = [
                'type' => $type,
                'title' => (string) ($entry['title'] ?? ''),
                'body' => $body,
                'status' => 'draft',
                'generatedBy' => $entry['generatedBy'] ?? 'cm-batch-enrichment',
                'metadata' => is_array($entry['metadata'] ?? null) ? $entry['metadata'] : [],
            ];
        }
        $question['editorial'] = $editorial;
        return $question;
    }

    private function preserveEnrichmentProposal(string $jobId, int $questionId, array $enrichment): int
    {
        $after = json_encode($enrichment, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $find = $this->db->prepare("SELECT id FROM cm_batch_field_audit WHERE job_id=:job AND entity_type='question_enrichment' AND canonical_entity_id=:entity AND field_name='payload' AND after_json=:after AND status='proposed' LIMIT 1");
        $find->execute([':job'=>$jobId, ':entity'=>(string)$questionId, ':after'=>$after]);
        $existing = $find->fetchColumn();
        if ($existing !== false) return (int) $existing;
        $evidence = $enrichment['provenance'] ?? $enrichment['evidence'] ?? $enrichment['sourceMappings'] ?? [];
        $confidence = isset($enrichment['confidence']) && is_numeric($enrichment['confidence'])
            ? max(0, min(1, (float)$enrichment['confidence']))
            : null;
        $insert = $this->db->prepare("INSERT INTO cm_batch_field_audit (job_id,entity_type,canonical_entity_id,field_name,before_json,after_json,source_evidence_json,actor_user_id,confidence,merge_reason,status) VALUES (:job,'question_enrichment',:entity,'payload',NULL,:after,:evidence,:actor,:confidence,'preserved_for_manual_review','proposed')");
        $insert->execute([
            ':job'=>$jobId, ':entity'=>(string)$questionId, ':after'=>$after,
            ':evidence'=>json_encode($evidence,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR),
            ':actor'=>$this->actorId, ':confidence'=>$confidence,
        ]);
        return (int)$this->db->lastInsertId();
    }

    private function materializeQuestionAssets(ZipArchive $zip, array $question, array $contexts, string $examPath, array $manifest): array
    {
        $files = [];
        foreach (is_array($manifest['files'] ?? null) ? $manifest['files'] : [] as $file) {
            if (is_array($file) && str_starts_with((string) ($file['path'] ?? ''), rtrim($examPath, '/') . '/') && str_starts_with(strtolower((string) ($file['mimeType'] ?? '')), 'image/')) $files[] = $file;
        }
        $hashes = [];
        $urlToPublic = [];
        $storage = new ObjectStorage();
        $resolve = function (string $source) use (&$hashes, &$urlToPublic, $files, $zip, $storage): string {
            $source = html_entity_decode(trim($source), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if (isset($urlToPublic[$source])) return $urlToPublic[$source];
            $matches = [];
            foreach ($files as $file) {
                $path = (string) $file['path'];
                $base = basename($path);
                $urlPrefix = substr(hash('sha256', $source), 0, 20) . '.';
                if ($source === $path || $source === basename($path) || str_ends_with($path, '/' . ltrim($source, '/')) || str_starts_with(strtolower($base), strtolower($urlPrefix))) $matches[] = $file;
            }
            if (count($matches) !== 1) throw new DomainException('Imagem nao pode ser associada de forma inequivoca a um binario verificado do ZIP.');
            $file = $matches[0];
            $bytes = $zip->getFromName((string) $file['path']);
            $sha = strtolower((string) ($file['sha256'] ?? ''));
            if (!is_string($bytes) || !hash_equals($sha, hash('sha256', $bytes)) || strlen($bytes) !== (int) ($file['bytes'] ?? -1)) throw new DomainException('Imagem do ZIP falhou na verificacao de integridade.');
            $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
            if (strtolower((string) ($file['mimeType'] ?? '')) !== strtolower((string) $mime)) throw new DomainException('MIME declarado nao corresponde ao binario da imagem.');
            $extension = match ($mime) { 'image/png' => 'png', 'image/jpeg' => 'jpg', 'image/gif' => 'gif', 'image/webp' => 'webp', default => throw new DomainException('Formato de imagem nao suportado para materializacao.') };
            if (!getimagesizefromstring($bytes) || strlen($bytes) > 32 * 1024 * 1024) throw new DomainException('Imagem invalida ou acima do limite de materializacao.');
            $object = $storage->storeBytes($bytes, 'question-assets/cm-batch/' . $sha . '.' . $extension, (string) $mime);
            $urlToPublic[$source] = $object['url'];
            $hashes[$source] = $sha;
            $hashes[$object['url']] = $sha;
            return $object['url'];
        };
        $mapAsset = static function (array $asset) use ($resolve): array {
            $source = trim((string) ($asset['url'] ?? $asset['src'] ?? $asset['path'] ?? ''));
            if ($source === '') throw new DomainException('Referencia de imagem sem origem verificavel.');
            $asset['url'] = $resolve($source);
            unset($asset['src'], $asset['path'], $asset['base64']);
            return $asset;
        };
        $mapHtml = static function (string $html) use ($resolve): string {
            return (string) preg_replace_callback('/(<img\b[^>]*\bsrc\s*=\s*)(["\'])(.*?)\2/is', static function (array $match) use ($resolve): string {
                return $match[1] . $match[2] . htmlspecialchars($resolve($match[3]), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . $match[2];
            }, $html);
        };
        foreach (['statement', 'supportText', 'reference'] as $field) if (isset($question['content'][$field]) && is_string($question['content'][$field])) $question['content'][$field] = $mapHtml($question['content'][$field]);
        foreach (['assets'] as $field) $question[$field] = array_map($mapAsset, is_array($question[$field] ?? null) ? $question[$field] : []);
        foreach ($question['alternatives'] ?? [] as $index => $alternative) {
            if (!is_array($alternative)) continue;
            if (isset($alternative['text']) && is_string($alternative['text'])) $alternative['text'] = $mapHtml($alternative['text']);
            $alternative['assets'] = array_map($mapAsset, is_array($alternative['assets'] ?? null) ? $alternative['assets'] : []);
            $question['alternatives'][$index] = $alternative;
        }
        foreach ($question['editorial'] ?? [] as $index => $editorial) {
            if (is_array($editorial) && isset($editorial['body']) && is_string($editorial['body'])) { $editorial['body'] = $mapHtml($editorial['body']); $question['editorial'][$index] = $editorial; }
        }
        foreach ($contexts as $index => $context) {
            if (!is_array($context)) continue;
            if (isset($context['body']) && is_string($context['body'])) $context['body'] = $mapHtml($context['body']);
            $context['assets'] = array_map($mapAsset, is_array($context['assets'] ?? null) ? $context['assets'] : []);
            $contexts[$index] = $context;
        }
        return ['question' => $question, 'contexts' => $contexts, 'hashes' => $hashes];
    }

    private function resolveQuestionFilters(array $filters, array $entities): array
    {
        $map = ['subjects'=>'subjects','topics'=>'topics','subtopics'=>'subtopics','concepts'=>'concepts','examBoards'=>'examBoards','organizations'=>'organizations','roles'=>'roles','careers'=>'careers','years'=>'years','levels'=>'educationLevels','examTypes'=>'examTypes'];
        $resolved = [];
        $resolvedEntityKeys = [];
        foreach ($map as $filterCategory => $taxonomyCategory) {
            foreach (is_array($filters[$filterCategory] ?? null) ? $filters[$filterCategory] : [] as $filter) {
                if (!is_array($filter)) continue;
                $label = $this->normalize((string) ($filter['label'] ?? $filter['name'] ?? ''));
                $slug = $this->normalize((string) ($filter['slug'] ?? ''));
                $matches = array_values(array_filter($entities, fn(array $entity): bool => ($entity['category'] ?? '') === $taxonomyCategory && !empty($entity['canonicalId']) && ($this->normalize((string) ($entity['name'] ?? '')) === $label || ($slug !== '' && $this->normalize((string) ($entity['sourceEntity']['slug'] ?? '')) === $slug))));
                $parentCategories = match ($filterCategory) { 'topics' => ['subjects'], 'subtopics' => ['topics'], 'concepts' => ['subjects', 'topics', 'subtopics'], default => [] };
                if (count($matches) > 1 && $parentCategories !== []) {
                    $parentKeys = array_fill_keys(array_merge(...array_map(static fn(string $category): array => $resolvedEntityKeys[$category] ?? [], $parentCategories)), true);
                    $matches = array_values(array_filter($matches, static fn(array $entity): bool => isset($parentKeys[(string) ($entity['parentKey'] ?? '')])));
                }
                if (count($matches) !== 1) throw new DomainException('Filtro canonico ausente ou ambiguo: ' . $filterCategory . ' / ' . ($filter['label'] ?? $filter['slug'] ?? '?'));
                $resolved[$taxonomyCategory][] = (int) $matches[0]['canonicalId'];
                $resolvedEntityKeys[$filterCategory][] = (string) $matches[0]['key'];
            }
        }
        foreach ($resolved as $category => $ids) $resolved[$category] = array_values(array_unique($ids));
        return $resolved;
    }

    private function findExamId(string $provider, string $externalId, string $edition, string $jobId): int
    {
        $stmt = $this->db->prepare('SELECT exam_id FROM cm_batch_exam_source_identities WHERE source_provider=:provider AND source_external_id=:external AND edition_key=:edition LIMIT 1');
        $stmt->execute([':provider'=>$provider, ':external'=>$externalId, ':edition'=>$edition]);
        $id = $stmt->fetchColumn();
        if ($id === false && $edition === '') {
            $stmt = $this->db->prepare('SELECT exam_id FROM cm_batch_exam_source_identities WHERE source_provider=:provider AND source_external_id=:external ORDER BY exam_id LIMIT 2');
            $stmt->execute([':provider'=>$provider, ':external'=>$externalId]);
            $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
            if (count($ids) === 1) $id = $ids[0];
        }
        if ($id === false) throw new DomainException('Prova ainda nao foi materializada; o checkpoint da prova precisa concluir primeiro.');
        return (int) $id;
    }

    private function questionPlanItem(array $plan, string $examKey, string $tempId): array
    {
        foreach ($plan['questions']['items'] ?? [] as $item) if (($item['examExternalKey'] ?? '') === $examKey && ($item['tempId'] ?? '') === $tempId) return $item;
        throw new DomainException('Questao nao consta no plano aprovado.');
    }

    private function taxonomyEntities(array $plan): array
    {
        $entities = $plan['taxonomy']['entities'] ?? [];
        if (!is_array($entities)) throw new DomainException('Resolucao canonica de taxonomias ausente.');
        // Dependencies are checked by each item; unrelated pending taxonomies do not block the batch.
        return $entities;
    }

    private function taxonomyIdByKey(array $entities, string $key): ?int
    {
        foreach ($entities as $entity) if (($entity['key'] ?? '') === $key && !empty($entity['canonicalId'])) return (int) $entity['canonicalId'];
        return null;
    }

    private function taxonomyIdsByKeys(array $entities, array $keys): array
    {
        $ids = [];
        foreach ($keys as $key) { $id = $this->taxonomyIdByKey($entities, (string) $key); if ($id === null) throw new DomainException('Taxonomia referenciada pela prova nao foi resolvida: ' . $key); $ids[] = $id; }
        return $ids;
    }

    private function firstTaxonomyIdByLabel(array $entities, string $category, string $label): ?int
    {
        if (trim($label) === '') return null;
        $matches = array_values(array_filter($entities, fn(array $entity): bool => ($entity['category'] ?? '') === $category && !empty($entity['canonicalId']) && $this->normalize((string) ($entity['name'] ?? '')) === $this->normalize($label)));
        if (count($matches) > 1) throw new DomainException('Taxonomia ambigua para campo da prova: ' . $label);
        return $matches === [] ? null : (int) $matches[0]['canonicalId'];
    }

    private function manifestExam(array $manifest, string $externalKey): array
    {
        $matches = array_values(array_filter($manifest['exams'] ?? [], static fn($row): bool => is_array($row) && (string) ($row['externalKey'] ?? '') === $externalKey));
        if (count($matches) !== 1 || empty($matches[0]['path'])) throw new DomainException('Prova externa nao encontrada no manifesto.');
        return $matches[0];
    }

    private function decodeEntry(ZipArchive $zip, string $path): array
    {
        $raw = $zip->getFromName($path);
        $value = is_string($raw) ? json_decode($raw, true, 512, JSON_THROW_ON_ERROR) : null;
        if (!is_array($value)) throw new DomainException('Documento obrigatorio ausente no ZIP: ' . $path);
        return $value;
    }

    private function normalize(string $value): string
    {
        $value = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $value) ?? $value), 'UTF-8');
        if (class_exists(Normalizer::class)) { $normalized = Normalizer::normalize($value, Normalizer::FORM_D); if (is_string($normalized)) $value = preg_replace('/\p{Mn}/u', '', $normalized) ?? $value; }
        return $value;
    }

    private function slug(string $value): string
    {
        $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
        return trim(preg_replace('/[^a-z0-9]+/i', '-', strtolower($value)) ?? '', '-');
    }
}
