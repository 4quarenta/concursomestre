<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

require_once __DIR__ . '/../../../shared/pagination/SignedKeysetCursor.php';
require_once __DIR__ . '/../../../shared/storage/ObjectStorage.php';
require_once __DIR__ . '/ExamLocationClassifier.php';
require_once __DIR__ . '/../../seo/services/PublicSeoEnvelopeService.php';
require_once __DIR__ . '/../../seo/taxonomy/PublicTaxonomyExposurePolicy.php';
require_once __DIR__ . '/../../seo/routes/PublicRouteBuilder.php';
require_once __DIR__ . '/../../filters/professional/ProfessionalTaxonomyReadinessValidator.php';

class ExamsService
{
    private ExamsRepository $repository;
    private ExamsValidator $validator;
    private PDO $db;
    private PublicSeoEnvelopeService $publicSeoEnvelope;

    public function __construct(ExamsRepository $repository, ExamsValidator $validator, PDO $db)
    {
        $this->repository = $repository;
        $this->validator = $validator;
        $this->db = $db;
        $this->publicSeoEnvelope = new PublicSeoEnvelopeService();
    }

    public function list(array $query = []): array
    {
        $limit = max(1, min(100, (int) ($query['limit'] ?? 30)));
        $search = trim((string) ($query['search'] ?? ''));
        $includeArchived = filter_var($query['include_archived'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $fingerprint = hash('sha256', json_encode([
            'search' => mb_strtolower($search, 'UTF-8'),
            'includeArchived' => $includeArchived,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $cursor = SignedKeysetCursor::decodePayload(
            isset($query['cursor']) ? (string) $query['cursor'] : null,
            'exams.admin'
        );
        if ($cursor !== null && !hash_equals($fingerprint, (string) ($cursor['fingerprint'] ?? ''))) {
            throw new InvalidArgumentException('Cursor de paginacao invalido para estes filtros.');
        }

        $rows = $this->repository->list([
            'search' => $search,
            'include_archived' => $includeArchived,
            'cursor_data' => $cursor,
            'limit' => $limit + 1,
        ]);
        $hasMore = count($rows) > $limit;
        if ($hasMore) {
            $rows = array_slice($rows, 0, $limit);
        }
        $last = $rows ? $rows[array_key_last($rows)] : null;
        $nextCursor = $hasMore && is_array($last)
            ? SignedKeysetCursor::encodePayload([
                'year' => (int) ($last['ano'] ?? $last['year'] ?? 0),
                'name' => (string) ($last['nome'] ?? $last['name'] ?? ''),
                'id' => (int) ($last['id'] ?? 0),
                'fingerprint' => $fingerprint,
            ], 'exams.admin')
            : null;

        return [
            'items' => $rows,
            'pageInfo' => [
                'limit' => $limit,
                'hasMore' => $hasMore,
                'nextCursor' => $nextCursor,
            ],
        ];
    }

    public function listPublicDirectory(array $query = []): array
    {
        $limit = max(1, min(48, (int) ($query['limit'] ?? 12)));
        $page = max(1, (int) ($query['page'] ?? 1));
        $year = preg_match('/^\d{4}$/', (string) ($query['year'] ?? '')) === 1
            ? (int) $query['year']
            : 0;
        $state = strtoupper(trim((string) ($query['state'] ?? '')));
        $state = preg_match('/^[A-Z]{2}$/', $state) === 1 ? $state : '';
        $region = trim((string) ($query['region'] ?? ''));
        $stateCodes = $state !== '' ? [$state] : ExamLocationClassifier::stateCodesForRegion($region);
        $result = $this->repository->listPublicDirectory([
            'limit' => $limit,
            'offset' => ($page - 1) * $limit,
            'year' => $year,
            'state_codes' => $stateCodes,
        ]);
        $rows = is_array($result['rows'] ?? null) ? $result['rows'] : [];

        $items = array_map(fn (array $row): array => $this->publicDirectoryItemFromRow($row), $rows);

        $total = (int) ($result['total'] ?? 0);
        $totalPages = max(1, (int) ceil($total / $limit));
        $states = array_values(array_filter(array_map(static function (string $stateCode): ?array {
            return ExamLocationClassifier::locationForStateCode($stateCode);
        }, is_array($result['states'] ?? null) ? $result['states'] : [])));
        usort($states, static fn (array $left, array $right): int => strcmp(
            (string) ($left['stateName'] ?? ''),
            (string) ($right['stateName'] ?? '')
        ));
        $regions = array_values(array_unique(array_column($states, 'region')));
        sort($regions, SORT_STRING);

        return [
            'items' => $items,
            'pageInfo' => [
                'page' => min($page, $totalPages),
                'limit' => $limit,
                'totalItems' => $total,
                'totalPages' => $totalPages,
                'hasPrevious' => $page > 1,
                'hasNext' => $page < $totalPages,
            ],
            'facets' => [
                'years' => is_array($result['years'] ?? null) ? $result['years'] : [],
                'regions' => $regions,
                'states' => array_map(static fn (array $location): array => [
                    'code' => $location['stateCode'],
                    'name' => $location['stateName'],
                ], $states),
            ],
        ];
    }

    public function showPublic(string $slug): ?array
    {
        $slug = trim($slug);
        if ($slug === '' || strlen($slug) > 190 || preg_match('/^[a-z0-9-]+$/', $slug) !== 1) {
            return null;
        }

        $exam = $this->repository->findPublicBySlug($slug);
        if (!$exam) {
            return null;
        }

        $taxonomies = is_array($exam['taxonomies'] ?? null) ? $exam['taxonomies'] : [];
        $organizations = $this->publicOrganizationList($taxonomies['orgao'] ?? []);
        $boards = $this->publicTaxonomyList($taxonomies['banca'] ?? []);
        $location = ExamLocationClassifier::classify([
            $exam['nome'] ?? '',
            ...array_column($organizations, 'name'),
        ], $this->firstTaxonomyMetadataValue($taxonomies['orgao'] ?? [], 'metaUf'));
        $files = array_values(array_filter(array_map(static function (array $file): ?array {
            if (($file['visibilityStatus'] ?? 'public') !== 'public') {
                return null;
            }
            return [
                'id' => (int) ($file['id'] ?? 0),
                'kind' => (string) ($file['kind'] ?? 'outro'),
                'label' => (string) ($file['label'] ?? 'Arquivo'),
                'name' => (string) ($file['name'] ?? 'Arquivo'),
                'url' => (string) ($file['url'] ?? ''),
                'mimeType' => (string) ($file['mimeType'] ?? ''),
                'size' => isset($file['size']) ? (int) $file['size'] : null,
            ];
        }, is_array($exam['files'] ?? null) ? $exam['files'] : [])));
        $relatedTaxonomyIds = array_map(
            'intval',
            array_column(array_merge(
                $taxonomies['banca'] ?? [],
                $taxonomies['orgao'] ?? [],
                $taxonomies['cargo'] ?? [],
                $taxonomies['carreira'] ?? [],
                $taxonomies['area'] ?? [],
                $taxonomies['foco'] ?? [],
                $taxonomies['materia'] ?? []
            ), 'id')
        );
        $relatedExams = array_map(
            fn (array $row): array => $this->publicDirectoryItemFromRow($row),
            $this->repository->listRelatedPublic(
                (int) $exam['id'],
                (int) ($exam['ano'] ?? 0),
                $relatedTaxonomyIds,
                6
            )
        );

        $payload = [
            'id' => (int) $exam['id'],
            'title' => (string) $exam['nome'],
            'officialTitle' => trim((string) ($exam['tituloOficial'] ?? '')) ?: null,
            'shortTitle' => trim((string) ($exam['nomeCurto'] ?? '')) ?: null,
            'slug' => (string) $exam['slug'],
            'noticeNumber' => trim((string) ($exam['editalNumero'] ?? '')) ?: null,
            'year' => (int) ($exam['ano'] ?? 0),
            'level' => trim((string) ($exam['nivel'] ?? '')) ?: null,
            'questionCount' => (int) ($exam['questionCount'] ?? 0),
            'registrationStart' => $exam['inscricoesInicio'] ?? null,
            'registrationEnd' => $exam['inscricoesFim'] ?? null,
            'examDate' => $exam['dataProva'] ?? null,
            'resultDate' => $exam['resultadoData'] ?? null,
            'vacancies' => $exam['vagasTotal'] ?? null,
            'reserveVacancies' => $exam['cadastroReservaTotal'] ?? null,
            'officialUrl' => trim((string) ($exam['urlOficial'] ?? '')) ?: null,
            'board' => $boards[0] ?? null,
            'organizations' => $organizations,
            'roles' => $this->publicProfessionalTaxonomyList($taxonomies['cargo'] ?? [], 'position'),
            'careers' => $this->publicProfessionalTaxonomyList($taxonomies['carreira'] ?? [], 'career'),
            'areas' => $this->publicTaxonomyList(array_merge($taxonomies['area'] ?? [], $taxonomies['foco'] ?? [])),
            'subjects' => $this->publicTaxonomyList($taxonomies['materia'] ?? []),
            'examTypes' => $this->publicTaxonomyList($taxonomies['tipo_prova'] ?? []),
            'files' => $files,
            'relatedExams' => $relatedExams,
            'contest' => $this->publicContest($this->repository->findPublicContestForExam((int) $exam['id'])),
            ...$location,
        ];

        return $this->publicSeoEnvelope->attachExam($payload);
    }

    private function publicDirectoryItemFromRow(array $row): array
    {
        $organizations = array_values(array_filter(explode('||', (string) ($row['organization_names'] ?? ''))));
        $acronyms = array_values(array_filter(explode('||', (string) ($row['organization_acronyms'] ?? ''))));
        $location = ExamLocationClassifier::classify([
            $row['nome'] ?? '',
            ...$organizations,
            ...$acronyms,
        ], $row['state_code'] ?? null);

        return [
            'id' => (int) $row['id'],
            'title' => (string) $row['nome'],
            'slug' => (string) $row['slug'],
            'year' => (int) ($row['ano'] ?? 0),
            'board' => trim((string) ($row['board_name'] ?? '')) ?: null,
            'boardSlug' => trim((string) ($row['board_slug'] ?? '')) ?: null,
            'organizations' => $organizations,
            'questionCount' => (int) ($row['question_count'] ?? 0),
            'proofUrl' => trim((string) ($row['proof_url'] ?? '')) ?: null,
            'answerKeyUrl' => trim((string) ($row['answer_key_url'] ?? '')) ?: null,
            ...$location,
        ];
    }

    private function publicTaxonomyList(array $items): array
    {
        return array_values(array_map(static fn (array $item): array => [
            'id' => (int) ($item['id'] ?? 0),
            'name' => (string) ($item['nome'] ?? $item['name'] ?? ''),
            'slug' => (string) ($item['slug'] ?? ''),
        ], array_filter($items, 'is_array')));
    }

    private function publicOrganizationList(array $items): array
    {
        $exposure = new PublicTaxonomyExposurePolicy();
        return $this->publicTaxonomyList(array_values(array_filter(
            $items,
            static fn (mixed $item): bool => is_array($item) && $exposure->allowsOrganization($item)
        )));
    }

    private function publicProfessionalTaxonomyList(array $items, string $kind): array
    {
        $type = $kind === 'career' ? 'carreira' : 'cargo';
        return $this->publicTaxonomyList(array_values(array_filter(
            $items,
            static fn (mixed $item): bool => is_array($item)
                && ProfessionalTaxonomyReadinessValidator::evaluate($item + ['type' => $type], $kind)['status'] === 'READY'
        )));
    }

    /** @param array<string,mixed>|null $contest @return array<string,mixed>|null */
    private function publicContest(?array $contest): ?array
    {
        if ($contest === null) return null;
        $slug = trim((string) ($contest['slug'] ?? ''));
        $id = (int) ($contest['id'] ?? 0);
        $title = trim((string) ($contest['title'] ?? ''));
        if ($id <= 0 || $title === '' || strlen($slug) > 190
            || preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) !== 1) return null;
        return [
            'id' => $id,
            'slug' => $slug,
            'title' => $title,
            'status' => (string) ($contest['status'] ?? ''),
            'path' => (new PublicRouteBuilder())->contestDetail($slug),
        ];
    }

    private function firstTaxonomyMetadataValue(array $items, string $key): ?string
    {
        foreach ($items as $item) {
            if (is_array($item) && trim((string) ($item[$key] ?? '')) !== '') {
                return trim((string) $item[$key]);
            }
        }
        return null;
    }

    public function show(int $id): ?array
    {
        return $this->repository->find($id);
    }

    public function save(array $payload, array $user): array
    {
        $errors = $this->validator->validateSave($payload);
        if ($errors) {
            throw new InvalidArgumentException(json_encode($errors, JSON_UNESCAPED_UNICODE));
        }

        // MySQL commits DDL implicitly. Prepare compatibility columns before
        // opening the write transaction so the exam save remains atomic.
        $this->repository->ensureSchema();
        $this->db->beginTransaction();
        try {
            $exam = $this->repository->save($payload, (string) ($user['id'] ?? ''));
            $this->db->commit();
            return $exam;
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    public function archive(int $id): void
    {
        $this->repository->archive($id);
    }

    public function uploadFile(?array $file, string $kind, ?int $examId, array $user): array
    {
        $normalizedKind = strtolower(trim($kind));
        if (!in_array($normalizedKind, ['edital', 'gabarito', 'prova', 'outro'], true)) {
            throw new InvalidArgumentException('Tipo de arquivo da prova inválido.');
        }

        $upload = $this->validator->validateAttachmentUpload($file);
        $extension = (string) ($upload['extension'] ?? 'bin');
        $filename = $normalizedKind . '-' . date('YmdHis') . '-' . bin2hex(random_bytes(6)) . '.' . $extension;
        $storageKey = 'exams/' . $filename;
        $mimeType = (string) ($upload['mimeType'] ?? $file['type'] ?? 'application/octet-stream');
        $storage = new ObjectStorage();
        $stored = $storage->storeUploadedFile(
            (string) ($file['tmp_name'] ?? ''),
            $storageKey,
            $mimeType
        );

        $labels = [
            'edital' => 'Edital',
            'gabarito' => 'Gabarito',
            'prova' => 'Prova',
            'outro' => 'Outro',
        ];
        $originalName = trim((string) ($upload['originalName'] ?? $file['name'] ?? ''));
        $attachment = [
            'kind' => $normalizedKind,
            'label' => $labels[$normalizedKind],
            'name' => $originalName !== '' ? $originalName : $filename,
            'url' => $stored['url'],
            'storageKey' => $stored['storageKey'],
            'storageDriver' => $stored['driver'],
            'mimeType' => $mimeType,
            'size' => (int) $stored['size'],
            'uploadedAt' => date(DATE_ATOM),
            'uploadedByUserId' => (string) ($user['id'] ?? ''),
        ];

        if ($examId !== null && $examId > 0) {
            try {
                $attachment = $this->repository->addFile($examId, $attachment, (string) ($user['id'] ?? ''));
            } catch (Throwable $exception) {
                $storage->delete($stored['storageKey']);
                throw $exception;
            }
        }

        return ['file' => $attachment];
    }

    public function listFiles(int $examId): array
    {
        return $this->repository->listFiles($examId);
    }

    public function archiveFile(int $examId, int $fileId): void
    {
        $this->repository->archiveFile($examId, $fileId);
    }

    public function startExtraction(array $payload, array $user): array
    {
        $examId = isset($payload['exam_id']) && is_numeric($payload['exam_id']) ? (int) $payload['exam_id'] : null;
        $fileId = isset($payload['file_id']) && is_numeric($payload['file_id']) ? (int) $payload['file_id'] : null;
        $source = strtolower(trim((string) ($payload['origem'] ?? $payload['source'] ?? 'manual')));
        if (!in_array($source, ['edital', 'prova', 'gabarito', 'manual'], true)) {
            $source = 'manual';
        }

        if ($examId !== null && !$this->repository->find($examId)) {
            throw new InvalidArgumentException('Prova não encontrada para iniciar a extração.');
        }

        $currentExam = $examId !== null ? $this->repository->find($examId) : null;
        $file = $fileId !== null ? $this->repository->findFileById($fileId) : null;
        if ($fileId !== null && !$file) {
            throw new InvalidArgumentException('Arquivo da prova não encontrado para extração.');
        }

        $extracted = [
            'status' => 'review_required',
            'source' => $source,
            'exam' => $currentExam,
            'file' => $file,
            'draft' => is_array($payload['draft'] ?? null) ? $payload['draft'] : [],
            'notes' => [
                'A extração foi registrada para revisão. Confirme banca, órgão, cargos, requisitos, vagas, cadernos e conteúdo programático antes de aplicar.',
            ],
        ];

        return [
            'extraction' => $this->repository->createExtraction([
                'prova_id' => $examId,
                'arquivo_id' => $fileId,
                'origem' => $source,
                'status' => 'review',
                'parser_profile' => $payload['parserProfile'] ?? $payload['parser_profile'] ?? null,
                'extracted' => $extracted,
                'created_by' => (string) ($user['id'] ?? ''),
            ]),
        ];
    }

    public function reviewExtraction(int $id, array $payload, array $user): array
    {
        $extraction = $this->repository->findExtraction($id);
        if (!$extraction) {
            throw new InvalidArgumentException('Extração não encontrada.');
        }

        $decision = strtolower(trim((string) ($payload['decision'] ?? 'apply')));
        $reviewPayload = is_array($payload['review'] ?? null) ? $payload['review'] : $payload;
        $status = $decision === 'reject' ? 'failed' : ($decision === 'draft' ? 'review' : 'done');
        $savedExam = null;

        if ($decision === 'apply') {
            $examPayload = is_array($payload['exam'] ?? null)
                ? $payload['exam']
                : (is_array($reviewPayload['exam'] ?? null) ? $reviewPayload['exam'] : []);

            if ($examPayload) {
                if (empty($examPayload['id']) && !empty($extraction['provaId'])) {
                    $examPayload['id'] = $extraction['provaId'];
                }
                $savedExam = $this->save($examPayload, $user);
            }
        }

        $review = $this->repository->reviewExtraction($id, [
            'decision' => $decision,
            'payload' => $reviewPayload,
            'savedExamId' => $savedExam['id'] ?? null,
        ], (string) ($user['id'] ?? ''), $status);

        return [
            'extraction' => $review,
            'exam' => $savedExam,
        ];
    }

    public function showExtraction(int $id): ?array
    {
        return $this->repository->findExtraction($id);
    }

}
