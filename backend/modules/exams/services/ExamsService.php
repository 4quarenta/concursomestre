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

class ExamsService
{
    private ExamsRepository $repository;
    private ExamsValidator $validator;
    private PDO $db;

    public function __construct(ExamsRepository $repository, ExamsValidator $validator, PDO $db)
    {
        $this->repository = $repository;
        $this->validator = $validator;
        $this->db = $db;
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
