<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';

/**
 * Authenticates and queues payloads from a local, operator-controlled crawler.
 * It intentionally accepts JSON only: no remote URL, browser cookie or crawler
 * credential is ever persisted by the platform.
 */
final class PrivateQuestionIngestionService
{
    private const DEFAULT_MAX_BODY_BYTES = 15_000_000;
    private const HARD_MAX_BODY_BYTES = 15_500_000;
    private const DEFAULT_MAX_QUESTIONS_PER_JOB = 1000;
    private const HARD_MAX_QUESTIONS_PER_JOB = 1000;
    private const MAX_PAYLOADS_PER_JOB = 50;
    private const DEFAULT_MAX_ATTEMPTS = 5;
    private const DEFAULT_STALE_LOCK_MINUTES = 15;
    private const MAX_CLOCK_SKEW_SECONDS = 300;
    private const MAX_QUESTIONS_PER_BATCH = 5000;

    public function __construct(private readonly PDO $db)
    {
    }

    public function enqueueFromHttpRequest(string $rawBody, array $server): array
    {
        $this->assertSchemaReady();
        $this->assertHttps($server);
        $maxBodyBytes = $this->maxBodyBytes();
        if ($rawBody === '' || strlen($rawBody) > $maxBodyBytes) {
            throw new InvalidArgumentException(sprintf(
                'Payload de ingestao invalido ou maior que %.1f MB.',
                $maxBodyBytes / 1_000_000
            ));
        }

        $clientKey = trim((string) ($server['HTTP_X_QUESTION_INGEST_KEY'] ?? ''));
        $timestamp = trim((string) ($server['HTTP_X_QUESTION_INGEST_TIMESTAMP'] ?? ''));
        $nonce = trim((string) ($server['HTTP_X_QUESTION_INGEST_NONCE'] ?? ''));
        $signature = trim((string) ($server['HTTP_X_QUESTION_INGEST_SIGNATURE'] ?? ''));
        $idempotencyKey = trim((string) ($server['HTTP_IDEMPOTENCY_KEY'] ?? ''));
        $secret = trim((string) (getenv('QUESTION_INGESTION_SECRET') ?: ''));
        $expectedClientKey = trim((string) (getenv('QUESTION_INGESTION_CLIENT_KEY') ?: 'local-crawler'));

        if ($secret === '' || $clientKey === '' || !hash_equals($expectedClientKey, $clientKey)) {
            throw new DomainException('Cliente de ingestao nao autorizado.');
        }
        if (!ctype_digit($timestamp) || abs(time() - (int) $timestamp) > self::MAX_CLOCK_SKEW_SECONDS) {
            throw new DomainException('Timestamp de ingestao invalido ou expirado.');
        }
        if (preg_match('/^[A-Za-z0-9_-]{16,128}$/', $nonce) !== 1) {
            throw new InvalidArgumentException('Nonce de ingestao invalido.');
        }
        if (preg_match('/^[a-f0-9]{64}$/i', $signature) !== 1 || $idempotencyKey === '' || strlen($idempotencyKey) > 120) {
            throw new InvalidArgumentException('Cabecalhos de assinatura ou idempotencia invalidos.');
        }

        $expectedSignature = hash_hmac('sha256', $timestamp . '.' . $nonce . '.' . $rawBody, $secret);
        if (!hash_equals($expectedSignature, strtolower($signature))) {
            throw new DomainException('Assinatura de ingestao invalida.');
        }
        $payload = json_decode($rawBody, true);
        if (!is_array($payload) || ($payload['schemaVersion'] ?? null) !== 'question-import.v2') {
            throw new InvalidArgumentException('A ingestao exige o contrato question-import.v2.');
        }
        $questions = $payload['questions'] ?? [];
        if (!is_array($questions)) {
            throw new InvalidArgumentException('O campo questions deve ser uma lista.');
        }
        $maxQuestions = $this->maxQuestionsPerJob();
        if (count($questions) > $maxQuestions) {
            throw new InvalidArgumentException(sprintf(
                'O lote possui %d questoes. Divida-o em lotes de no maximo %d para limitar locks e memoria.',
                count($questions),
                $maxQuestions
            ));
        }

        $payloadHash = hash('sha256', $rawBody);
        $nonceHash = hash('sha256', $clientKey . ':' . $nonce);
        $this->db->beginTransaction();
        try {
            $this->db->prepare('DELETE FROM private_ingestion_nonces WHERE expires_at < UTC_TIMESTAMP()')->execute();
            $insertNonce = $this->db->prepare(
                'INSERT INTO private_ingestion_nonces (nonce_hash, request_timestamp, expires_at)
                 VALUES (:nonce_hash, :request_timestamp, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))'
            );
            try {
                $insertNonce->execute([
                    ':nonce_hash' => $nonceHash,
                    ':request_timestamp' => (int) $timestamp,
                ]);
            } catch (PDOException $exception) {
                if ((string) $exception->getCode() === '23000') {
                    throw new DomainException('Nonce de ingestao ja utilizado.');
                }
                throw $exception;
            }

            $existing = $this->db->prepare(
                'SELECT id, payload_hash, status, job_id, response_json
                 FROM private_ingestion_requests
                 WHERE client_key = :client_key AND idempotency_key = :idempotency_key
                 LIMIT 1 FOR UPDATE'
            );
            $existing->execute([
                ':client_key' => $clientKey,
                ':idempotency_key' => $idempotencyKey,
            ]);
            $request = $existing->fetch(PDO::FETCH_ASSOC);
            if (is_array($request)) {
                if (!hash_equals((string) $request['payload_hash'], $payloadHash)) {
                    throw new DomainException('A chave de idempotencia ja foi usada para outro payload.');
                }
                $this->db->commit();
                return [
                    'requestId' => (int) $request['id'],
                    'jobId' => isset($request['job_id']) ? (int) $request['job_id'] : null,
                    'status' => (string) $request['status'],
                    'idempotentReplay' => true,
                ];
            }

            $insertRequest = $this->db->prepare(
                'INSERT INTO private_ingestion_requests (client_key, idempotency_key, payload_hash, status)
                 VALUES (:client_key, :idempotency_key, :payload_hash, :status)'
            );
            $insertRequest->execute([
                ':client_key' => $clientKey,
                ':idempotency_key' => $idempotencyKey,
                ':payload_hash' => $payloadHash,
                ':status' => 'pending',
            ]);
            $requestId = (int) $this->db->lastInsertId();
            $insertJob = $this->db->prepare(
                'INSERT INTO private_ingestion_jobs (request_id, actor_user_id, payload_json, status, available_at)
                 VALUES (:request_id, :actor_user_id, :payload_json, :status, UTC_TIMESTAMP())'
            );
            $insertJob->execute([
                ':request_id' => $requestId,
                ':actor_user_id' => trim((string) (getenv('QUESTION_INGESTION_ACTOR_ID') ?: '')) ?: null,
                ':payload_json' => $rawBody,
                ':status' => 'pending',
            ]);
            $jobId = (int) $this->db->lastInsertId();
            $this->db->prepare('UPDATE private_ingestion_requests SET job_id = :job_id WHERE id = :id')->execute([
                ':job_id' => $jobId,
                ':id' => $requestId,
            ]);
            $this->db->commit();
            return [
                'requestId' => $requestId,
                'jobId' => $jobId,
                'status' => 'pending',
                'idempotentReplay' => false,
            ];
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    /**
     * Enfileira um lote enviado por uma sessao administrativa ja autenticada.
     *
     * Diferente do cliente local HMAC, o ator vem exclusivamente da sessao
     * validada pelo endpoint /api/admin. Nenhuma credencial do provedor externo
     * faz parte do payload persistido.
     */
    public function enqueueFromAdminSession(
        array $payload,
        string $actorUserId,
        string $idempotencyKey = '',
        ?int $batchId = null
    ): array {
        $this->assertSchemaReady();
        $actorUserId = trim($actorUserId);
        if ($actorUserId === '' || strlen($actorUserId) > 80) {
            throw new DomainException('Sessao administrativa invalida para a ingestao.');
        }
        if ($batchId !== null && $batchId < 1) {
            throw new InvalidArgumentException('Lote-pai de ingestao invalido.');
        }
        if (($payload['schemaVersion'] ?? null) !== 'question-import.v2') {
            throw new InvalidArgumentException('A ingestao exige o contrato question-import.v2.');
        }
        $questions = $this->flattenPayloadQuestions($payload);
        if ($questions === []) {
            throw new InvalidArgumentException('Selecione ao menos uma questao para importar.');
        }
        if (count($questions) > $this->maxQuestionsPerJob()) {
            throw new InvalidArgumentException(sprintf(
                'O lote possui %d questoes. Divida-o em lotes de no maximo %d.',
                count($questions),
                $this->maxQuestionsPerJob()
            ));
        }

        $rawBody = json_encode(
            $payload,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        );
        if (strlen($rawBody) > $this->maxBodyBytes()) {
            throw new InvalidArgumentException('O lote excede o limite seguro de ingestao.');
        }

        $payloadHash = hash('sha256', $rawBody);
        $idempotencyKey = trim($idempotencyKey);
        if ($idempotencyKey === '') {
            $idempotencyKey = 'admin-' . $payloadHash;
        }
        if (strlen($idempotencyKey) > 120 || preg_match('/^[A-Za-z0-9_.:-]+$/', $idempotencyKey) !== 1) {
            throw new InvalidArgumentException('Chave de idempotencia invalida.');
        }
        $clientKey = 'admin-browser:' . $actorUserId;

        $this->db->beginTransaction();
        try {
            $existing = $this->db->prepare(
                'SELECT id, payload_hash, status, job_id
                 FROM private_ingestion_requests
                 WHERE client_key = :client_key AND idempotency_key = :idempotency_key
                 LIMIT 1 FOR UPDATE'
            );
            $existing->execute([
                ':client_key' => $clientKey,
                ':idempotency_key' => $idempotencyKey,
            ]);
            $request = $existing->fetch(PDO::FETCH_ASSOC);
            if (is_array($request)) {
                if (!hash_equals((string) $request['payload_hash'], $payloadHash)) {
                    throw new DomainException('A chave de idempotencia ja foi usada para outro lote.');
                }
                if ($batchId !== null && !empty($request['job_id'])) {
                    $this->db->prepare(
                        'UPDATE private_ingestion_jobs SET batch_id = :batch_id '
                        . 'WHERE id = :job_id AND (batch_id IS NULL OR batch_id = :batch_id_match)'
                    )->execute([
                        ':batch_id' => $batchId,
                        ':batch_id_match' => $batchId,
                        ':job_id' => (int) $request['job_id'],
                    ]);
                }
                $this->db->commit();
                return [
                    'requestId' => (int) $request['id'],
                    'jobId' => isset($request['job_id']) ? (int) $request['job_id'] : null,
                    'status' => (string) $request['status'],
                    'idempotentReplay' => true,
                ];
            }

            $insertRequest = $this->db->prepare(
                'INSERT INTO private_ingestion_requests (client_key, idempotency_key, payload_hash, status)
                 VALUES (:client_key, :idempotency_key, :payload_hash, :status)'
            );
            $insertRequest->execute([
                ':client_key' => $clientKey,
                ':idempotency_key' => $idempotencyKey,
                ':payload_hash' => $payloadHash,
                ':status' => 'pending',
            ]);
            $requestId = (int) $this->db->lastInsertId();

            $insertJob = $this->db->prepare(
                'INSERT INTO private_ingestion_jobs '
                . '(request_id, batch_id, actor_user_id, payload_json, status, available_at) '
                . 'VALUES (:request_id, :batch_id, :actor_user_id, :payload_json, :status, UTC_TIMESTAMP())'
            );
            $insertJob->execute([
                ':request_id' => $requestId,
                ':batch_id' => $batchId,
                ':actor_user_id' => $actorUserId,
                ':payload_json' => $rawBody,
                ':status' => 'pending',
            ]);
            $jobId = (int) $this->db->lastInsertId();
            $this->db->prepare(
                'UPDATE private_ingestion_requests SET job_id = :job_id WHERE id = :id'
            )->execute([':job_id' => $jobId, ':id' => $requestId]);
            $this->db->commit();

            return [
                'requestId' => $requestId,
                'jobId' => $jobId,
                'status' => 'pending',
                'idempotentReplay' => false,
            ];
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    /**
     * Enfileira uma submissao administrativa grande como um lote-pai observavel.
     * Os filhos continuam usando exatamente a fila canonica existente.
     *
     * @param array<int,array<string,mixed>> $payloads
     */
    public function enqueueBatchFromAdminSession(
        array $payloads,
        string $actorUserId,
        string $idempotencyKey = ''
    ): array {
        $this->assertBatchSchemaReady();
        $actorUserId = trim($actorUserId);
        if ($actorUserId === '' || strlen($actorUserId) > 80) {
            throw new DomainException('Sessao administrativa invalida para a ingestao.');
        }

        $normalizedPayloads = [];
        $questionCount = 0;
        $questionKeys = [];
        $collectionPages = [];
        foreach ($payloads as $payload) {
            if (!is_array($payload) || ($payload['schemaVersion'] ?? null) !== 'question-import.v2') {
                throw new InvalidArgumentException('Todos os lotes devem usar o contrato question-import.v2.');
            }
            $questions = is_array($payload['questions'] ?? null) ? array_values($payload['questions']) : [];
            if ($questions === []) {
                continue;
            }
            $questionCount += count($questions);
            foreach ($questions as $position => $question) {
                if (!is_array($question)) {
                    throw new InvalidArgumentException('O lote contem uma questao invalida.');
                }
                $questionKeys[] = $this->questionSourceKey($question, $position);
            }
            $importMetadata = is_array($payload['import'] ?? null) ? $payload['import'] : [];
            $collectionPage = (int) ($importMetadata['collectionPage'] ?? 0);
            if ($collectionPage > 0) $collectionPages[] = $collectionPage;
            $normalizedPayloads[] = $payload;
        }
        self::assertBatchQuestionCount($questionCount);
        $collectionPages = array_values(array_unique($collectionPages));
        sort($collectionPages);

        $canonical = json_encode(
            $normalizedPayloads,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        );
        $payloadHash = hash('sha256', $canonical);
        $idempotencyKey = trim($idempotencyKey) ?: 'gran-batch-' . $payloadHash;
        if (strlen($idempotencyKey) > 120 || preg_match('/^[A-Za-z0-9_.:-]+$/', $idempotencyKey) !== 1) {
            throw new InvalidArgumentException('Chave de idempotencia invalida.');
        }

        $batch = $this->findOrCreateBatch(
            $actorUserId,
            $idempotencyKey,
            $payloadHash,
            $questionCount,
            array_values(array_unique($questionKeys)),
            $collectionPages
        );
        $chunks = $this->splitCanonicalPayloads($normalizedPayloads);
        foreach ($chunks as $index => $chunk) {
            $childKey = $idempotencyKey . '-job-' . ($index + 1);
            $this->enqueueFromAdminSession($chunk, $actorUserId, $childKey, (int) $batch['id']);
        }
        $this->db->prepare(
            'UPDATE private_ingestion_batches SET job_count = :job_count WHERE id = :id'
        )->execute([':job_count' => count($chunks), ':id' => (int) $batch['id']]);

        return $this->refreshBatch((int) $batch['id']) + [
            'idempotentReplay' => (bool) ($batch['idempotentReplay'] ?? false),
        ];
    }

    /** @return array<string,mixed>|null */
    public function getCurrentProcessingBatch(string $actorUserId): ?array
    {
        $this->assertBatchSchemaReady();
        $actorUserId = trim($actorUserId);
        if ($actorUserId === '') {
            throw new InvalidArgumentException('Usuario do processamento nao informado.');
        }

        $stmt = $this->db->prepare(
            'SELECT * FROM private_ingestion_batches '
            . "WHERE actor_user_id = :actor_user_id "
            . "ORDER BY CASE WHEN status IN ('pending', 'processing') THEN 0 ELSE 1 END, id DESC LIMIT 1"
        );
        $stmt->execute([':actor_user_id' => $actorUserId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        // Rebuild the snapshot from retained jobs so batches created before a
        // diagnostics schema upgrade also expose their per-question failures.
        return is_array($row) ? $this->refreshBatch((int) $row['id']) : null;
    }

    /** @return array{batches:int,jobs:int,requests:int} */
    public function pruneCompletedProcessingRecords(int $retentionDays = 1, int $limit = 500): array
    {
        $this->assertBatchSchemaReady();
        $retentionDays = max(1, min(30, $retentionDays));
        $limit = max(1, min(1000, $limit));
        $lock = $this->db->query("SELECT GET_LOCK('question_ingestion_retention', 0)");
        if ((int) $lock->fetchColumn() !== 1) {
            return ['batches' => 0, 'jobs' => 0, 'requests' => 0];
        }

        try {
            $stmt = $this->db->query(
                "SELECT id FROM private_ingestion_batches
                 WHERE status IN ('done', 'failed', 'partial')
                   AND completed_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL {$retentionDays} DAY)
                 ORDER BY id ASC LIMIT {$limit}"
            );
            $batchIds = array_values(array_filter(array_map(
                'intval',
                $stmt->fetchAll(PDO::FETCH_COLUMN) ?: []
            ), static fn (int $id): bool => $id > 0));
            if ($batchIds === []) {
                return ['batches' => 0, 'jobs' => 0, 'requests' => 0];
            }

            $placeholders = implode(',', array_fill(0, count($batchIds), '?'));
            $requestsStmt = $this->db->prepare(
                "SELECT request_id FROM private_ingestion_jobs WHERE batch_id IN ({$placeholders})"
            );
            $requestsStmt->execute($batchIds);
            $requestIds = array_values(array_filter(array_map(
                'intval',
                $requestsStmt->fetchAll(PDO::FETCH_COLUMN) ?: []
            ), static fn (int $id): bool => $id > 0));

            $this->db->beginTransaction();
            $jobsDelete = $this->db->prepare(
                "DELETE FROM private_ingestion_jobs WHERE batch_id IN ({$placeholders})"
            );
            $jobsDelete->execute($batchIds);
            $deletedJobs = $jobsDelete->rowCount();

            $deletedRequests = 0;
            if ($requestIds !== []) {
                $requestPlaceholders = implode(',', array_fill(0, count($requestIds), '?'));
                $requestsDelete = $this->db->prepare(
                    "DELETE FROM private_ingestion_requests WHERE id IN ({$requestPlaceholders})"
                );
                $requestsDelete->execute($requestIds);
                $deletedRequests = $requestsDelete->rowCount();
            }

            $batchesDelete = $this->db->prepare(
                "DELETE FROM private_ingestion_batches WHERE id IN ({$placeholders})"
            );
            $batchesDelete->execute($batchIds);
            $deletedBatches = $batchesDelete->rowCount();
            $this->db->commit();

            return [
                'batches' => $deletedBatches,
                'jobs' => $deletedJobs,
                'requests' => $deletedRequests,
            ];
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        } finally {
            $this->db->query("SELECT RELEASE_LOCK('question_ingestion_retention')");
        }
    }

    /** @param array<string,mixed> $payload @return array<string,mixed> */
    private function summarizeJobPayload(array $payload): array
    {
        $payloads = [];
        if (is_array($payload['batches'] ?? null)) {
            foreach ($payload['batches'] as $batch) {
                if (is_array($batch) && is_array($batch['payload'] ?? null)) $payloads[] = $batch['payload'];
            }
        } else {
            $payloads[] = $payload;
        }

        $questionCount = 0;
        $examTitles = [];
        $collectionPages = [];
        foreach ($payloads as $item) {
            $questions = is_array($item['questions'] ?? null) ? $item['questions'] : [];
            $questionCount += count($questions);
            $exam = is_array($item['exam'] ?? null) ? $item['exam'] : [];
            $title = trim((string) ($exam['title'] ?? ''));
            if ($title !== '') $examTitles[] = $title;
            $importMetadata = is_array($item['import'] ?? null) ? $item['import'] : [];
            $page = (int) ($importMetadata['collectionPage'] ?? 0);
            if ($page > 0) $collectionPages[] = $page;
        }
        $examTitles = array_values(array_unique($examTitles));
        $collectionPages = array_values(array_unique($collectionPages));
        sort($collectionPages);

        return [
            'questionCount' => $questionCount,
            'examCount' => count($examTitles),
            'examTitles' => array_slice($examTitles, 0, 5),
            'collectionPages' => $collectionPages,
        ];
    }

    public function reserveNextJob(?string $workerId = null): ?array
    {
        $this->assertSchemaReady();
        $workerId = $this->normalizeWorkerId($workerId);
        $staleMinutes = $this->staleLockMinutes();
        $this->db->beginTransaction();
        try {
            $maxAttempts = $this->maxAttempts();
            $this->db->exec(
                "UPDATE private_ingestion_jobs jobs
                 INNER JOIN private_ingestion_requests requests ON requests.id = jobs.request_id
                 SET jobs.status = 'failed',
                     jobs.error_message = COALESCE(jobs.error_message, 'Worker interrompido apos o limite de tentativas.'),
                     jobs.last_error_at = UTC_TIMESTAMP(),
                     jobs.completed_at = UTC_TIMESTAMP(),
                     jobs.dead_lettered_at = UTC_TIMESTAMP(),
                     jobs.locked_at = NULL,
                     jobs.locked_by = NULL,
                     requests.status = 'failed'
                 WHERE jobs.status = 'processing'
                   AND jobs.attempts >= {$maxAttempts}
                   AND jobs.locked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL {$staleMinutes} MINUTE)"
            );
            $this->db->exec(
                "UPDATE private_ingestion_jobs jobs
                 INNER JOIN private_ingestion_requests requests ON requests.id = jobs.request_id
                 SET jobs.status = 'pending',
                     jobs.available_at = UTC_TIMESTAMP(),
                     jobs.locked_at = NULL,
                     jobs.locked_by = NULL,
                     requests.status = 'pending'
                 WHERE jobs.status = 'processing'
                   AND jobs.attempts < {$maxAttempts}
                   AND jobs.locked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL {$staleMinutes} MINUTE)"
            );
            $stmt = $this->db->query(
                "SELECT * FROM private_ingestion_jobs
                 WHERE status = 'pending'
                   AND (available_at IS NULL OR available_at <= UTC_TIMESTAMP())
                 ORDER BY available_at ASC, id ASC
                 LIMIT 1 FOR UPDATE SKIP LOCKED"
            );
            $job = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!is_array($job)) {
                $this->db->commit();
                return null;
            }
            $this->db->prepare(
                "UPDATE private_ingestion_jobs
                 SET status = 'processing', attempts = attempts + 1, locked_at = UTC_TIMESTAMP(), locked_by = :locked_by
                 WHERE id = :id"
            )->execute([':locked_by' => $workerId, ':id' => (int) $job['id']]);
            $this->db->prepare("UPDATE private_ingestion_requests SET status = 'processing' WHERE id = :id")
                ->execute([':id' => (int) $job['request_id']]);
            $this->db->commit();
            $job['attempts'] = (int) ($job['attempts'] ?? 0) + 1;
            $job['locked_by'] = $workerId;
            return $job;
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    public function completeJob(int $jobId, int $requestId, array $result, ?string $workerId = null): void
    {
        $json = json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $this->db->beginTransaction();
        try {
            $sql = "UPDATE private_ingestion_jobs
                    SET status = 'done', result_json = :result_json, completed_at = UTC_TIMESTAMP(),
                        locked_at = NULL, locked_by = NULL
                    WHERE id = :id AND request_id = :request_id AND status = 'processing'";
            $params = [
                ':result_json' => $json,
                ':id' => $jobId,
                ':request_id' => $requestId,
            ];
            if ($workerId !== null && trim($workerId) !== '') {
                $sql .= ' AND locked_by = :locked_by';
                $params[':locked_by'] = $this->normalizeWorkerId($workerId);
            }
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            if ($stmt->rowCount() !== 1) {
                throw new RuntimeException('O job nao pertence mais a este worker ou ja foi finalizado.');
            }
            $requestStmt = $this->db->prepare(
                "UPDATE private_ingestion_requests
                 SET status = 'done', response_json = :response_json
                 WHERE id = :id AND job_id = :job_id"
            );
            $requestStmt->execute([
                ':response_json' => $json,
                ':id' => $requestId,
                ':job_id' => $jobId,
            ]);
            if ($requestStmt->rowCount() !== 1) {
                throw new RuntimeException('A requisicao da ingestao nao corresponde ao job concluido.');
            }
            $this->db->commit();
            $this->refreshBatchForJob($jobId);
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    public function failJob(int $jobId, int $requestId, Throwable $exception, ?string $workerId = null): string
    {
        $message = substr($exception->getMessage(), 0, 3000);
        $this->db->beginTransaction();
        try {
            $select = $this->db->prepare(
                'SELECT attempts, locked_by FROM private_ingestion_jobs WHERE id = :id LIMIT 1 FOR UPDATE'
            );
            $select->execute([':id' => $jobId]);
            $job = $select->fetch(PDO::FETCH_ASSOC);
            if (!is_array($job)) {
                throw new RuntimeException('Job de ingestao nao encontrado ao registrar falha.');
            }
            $normalizedWorkerId = $workerId !== null && trim($workerId) !== ''
                ? $this->normalizeWorkerId($workerId)
                : null;
            if ($normalizedWorkerId !== null
                && (string) ($job['locked_by'] ?? '') !== $normalizedWorkerId) {
                throw new RuntimeException('O job nao pertence mais a este worker.');
            }

            $attempts = max(1, (int) ($job['attempts'] ?? 1));
            $willRetry = $this->isRetryableFailure($exception) && $attempts < $this->maxAttempts();
            if ($willRetry) {
                $delaySeconds = min(900, 15 * (2 ** max(0, $attempts - 1)));
                $availableAt = gmdate('Y-m-d H:i:s', time() + $delaySeconds);
                $this->db->prepare(
                    "UPDATE private_ingestion_jobs
                     SET status = 'pending', available_at = :available_at, error_message = :message,
                         last_error_at = UTC_TIMESTAMP(), locked_at = NULL, locked_by = NULL
                     WHERE id = :id"
                )->execute([
                    ':available_at' => $availableAt,
                    ':message' => $message,
                    ':id' => $jobId,
                ]);
                $response = json_encode([
                    'error' => $message,
                    'retryScheduledAt' => $availableAt,
                    'attempts' => $attempts,
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $this->db->prepare(
                    "UPDATE private_ingestion_requests SET status = 'pending', response_json = :response_json WHERE id = :id"
                )->execute([':response_json' => $response, ':id' => $requestId]);
                $this->db->commit();
                $this->refreshBatchForJob($jobId);
                return 'pending';
            }

            $this->db->prepare(
                "UPDATE private_ingestion_jobs
                 SET status = 'failed', error_message = :message, last_error_at = UTC_TIMESTAMP(),
                     completed_at = UTC_TIMESTAMP(), dead_lettered_at = UTC_TIMESTAMP(),
                     locked_at = NULL, locked_by = NULL
                 WHERE id = :id"
            )->execute([':message' => $message, ':id' => $jobId]);
            $this->db->prepare(
                "UPDATE private_ingestion_requests SET status = 'failed', response_json = :response_json WHERE id = :id"
            )->execute([
                ':response_json' => json_encode([
                    'error' => $message,
                    'attempts' => $attempts,
                    'deadLettered' => true,
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ':id' => $requestId,
            ]);
            $this->db->commit();
            $this->refreshBatchForJob($jobId);
            return 'failed';
        } catch (Throwable $failure) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $failure;
        }
    }

    private function assertSchemaReady(): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'ingestao privada de questoes', [
            'private_ingestion_nonces' => ['nonce_hash', 'request_timestamp', 'expires_at'],
            'private_ingestion_requests' => ['client_key', 'idempotency_key', 'payload_hash', 'status', 'job_id'],
            'private_ingestion_jobs' => [
                'request_id', 'payload_json', 'status', 'available_at', 'attempts',
                'locked_at', 'locked_by', 'last_error_at', 'dead_lettered_at', 'batch_id',
            ],
        ]);
    }

    private function assertBatchSchemaReady(): void
    {
        $this->assertSchemaReady();
        SchemaReadiness::assertTablesAndColumns($this->db, 'lotes do crawler Gran', [
            'private_ingestion_batches' => [
                'public_id', 'actor_user_id', 'idempotency_key', 'payload_hash', 'status',
                'question_count', 'job_count', 'question_keys_json', 'question_statuses_json',
                'question_errors_json', 'collection_pages_json',
            ],
            'private_ingestion_jobs' => ['batch_id'],
        ]);
    }

    /** @return array<string,mixed> */
    private function findOrCreateBatch(
        string $actorUserId,
        string $idempotencyKey,
        string $payloadHash,
        int $questionCount,
        array $questionKeys,
        array $collectionPages
    ): array {
        $select = $this->db->prepare(
            'SELECT * FROM private_ingestion_batches
             WHERE actor_user_id = :actor_user_id AND idempotency_key = :idempotency_key LIMIT 1'
        );
        $select->execute([':actor_user_id' => $actorUserId, ':idempotency_key' => $idempotencyKey]);
        $existing = $select->fetch(PDO::FETCH_ASSOC);
        if (is_array($existing)) {
            if (!hash_equals((string) $existing['payload_hash'], $payloadHash)) {
                throw new DomainException('A chave de idempotencia ja foi usada para outra submissao.');
            }
            $existing['idempotentReplay'] = true;
            return $existing;
        }

        $publicId = $this->uuidV4();
        $insert = $this->db->prepare(
            'INSERT INTO private_ingestion_batches
             (public_id, actor_user_id, idempotency_key, payload_hash, status, question_count, question_keys_json, collection_pages_json)
             VALUES (:public_id, :actor_user_id, :idempotency_key, :payload_hash, :status, :question_count, :question_keys_json, :collection_pages_json)'
        );
        try {
            $insert->execute([
                ':public_id' => $publicId,
                ':actor_user_id' => $actorUserId,
                ':idempotency_key' => $idempotencyKey,
                ':payload_hash' => $payloadHash,
                ':status' => 'pending',
                ':question_count' => $questionCount,
                ':question_keys_json' => json_encode($questionKeys, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ':collection_pages_json' => json_encode($collectionPages, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
            return ['id' => (int) $this->db->lastInsertId(), 'public_id' => $publicId, 'idempotentReplay' => false];
        } catch (PDOException $exception) {
            if ((int) ($exception->errorInfo[1] ?? 0) !== 1062) {
                throw $exception;
            }
            $select->execute([':actor_user_id' => $actorUserId, ':idempotency_key' => $idempotencyKey]);
            $existing = $select->fetch(PDO::FETCH_ASSOC);
            if (!is_array($existing) || !hash_equals((string) $existing['payload_hash'], $payloadHash)) {
                throw new DomainException('A chave de idempotencia ja foi usada para outra submissao.');
            }
            $existing['idempotentReplay'] = true;
            return $existing;
        }
    }

    /** @param array<int,array<string,mixed>> $payloads @return array<int,array<string,mixed>> */
    private function splitCanonicalPayloads(array $payloads): array
    {
        $units = [];
        foreach ($payloads as $payload) {
            $questions = array_values($payload['questions']);
            $current = [];
            foreach ($questions as $question) {
                $candidate = [...$current, $question];
                $candidatePayload = $this->payloadWithQuestions($payload, $candidate);
                $encoded = json_encode($candidatePayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
                if ($current !== [] && (count($candidate) > $this->maxQuestionsPerJob() || strlen($encoded) > $this->maxBodyBytes())) {
                    $units[] = $this->payloadWithQuestions($payload, $current);
                    $current = [$question];
                    $single = json_encode(
                        $this->payloadWithQuestions($payload, $current),
                        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
                    );
                    if (strlen($single) > $this->maxBodyBytes()) {
                        throw new InvalidArgumentException('Uma questao isolada excede o limite seguro de 15 MB.');
                    }
                    continue;
                }
                $current = $candidate;
            }
            if ($current !== []) {
                $units[] = $this->payloadWithQuestions($payload, $current);
            }
        }

        $chunks = [];
        $currentUnits = [];
        $currentQuestionCount = 0;
        foreach ($units as $unit) {
            $unitQuestionCount = count($unit['questions'] ?? []);
            $candidateUnits = [...$currentUnits, $unit];
            $candidateQuestionCount = $currentQuestionCount + $unitQuestionCount;
            $candidatePayload = $this->buildJobPayload($candidateUnits);
            $encoded = json_encode(
                $candidatePayload,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
            );
            $exceedsLimit = count($candidateUnits) > self::MAX_PAYLOADS_PER_JOB
                || $candidateQuestionCount > $this->maxQuestionsPerJob()
                || strlen($encoded) > $this->maxBodyBytes();

            if ($currentUnits !== [] && $exceedsLimit) {
                $chunks[] = $this->buildJobPayload($currentUnits);
                $currentUnits = [$unit];
                $currentQuestionCount = $unitQuestionCount;
                $singleJob = json_encode(
                    $this->buildJobPayload($currentUnits),
                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
                );
                if (strlen($singleJob) > $this->maxBodyBytes()) {
                    throw new InvalidArgumentException('Uma prova isolada excede o limite seguro de 15 MB.');
                }
                continue;
            }
            if ($exceedsLimit) {
                throw new InvalidArgumentException('Um lote isolado excede os limites seguros da fila.');
            }
            $currentUnits = $candidateUnits;
            $currentQuestionCount = $candidateQuestionCount;
        }
        if ($currentUnits !== []) {
            $chunks[] = $this->buildJobPayload($currentUnits);
        }
        return $chunks;
    }

    /** @param array<int,array<string,mixed>> $payloads @return array<string,mixed> */
    private function buildJobPayload(array $payloads): array
    {
        if (count($payloads) === 1) return $payloads[0];
        return [
            'schemaVersion' => 'question-import.v2',
            'batches' => array_map(static function (array $payload, int $index): array {
                $exam = is_array($payload['exam'] ?? null) ? $payload['exam'] : [];
                $clientKey = trim((string) (
                    $exam['sourceKey']
                    ?? $exam['externalId']
                    ?? $exam['title']
                    ?? 'batch-' . ($index + 1)
                ));
                return ['clientKey' => $clientKey . ':' . ($index + 1), 'payload' => $payload];
            }, $payloads, array_keys($payloads)),
        ];
    }

    /** @return array<int,array<string,mixed>> */
    private function flattenPayloadQuestions(array $payload): array
    {
        if (is_array($payload['questions'] ?? null)) {
            return array_values(array_filter($payload['questions'], 'is_array'));
        }
        $questions = [];
        foreach ((array) ($payload['batches'] ?? []) as $batch) {
            if (!is_array($batch)) continue;
            $batchPayload = is_array($batch['payload'] ?? null) ? $batch['payload'] : $batch;
            foreach ((array) ($batchPayload['questions'] ?? []) as $question) {
                if (is_array($question)) $questions[] = $question;
            }
        }
        return $questions;
    }

    /** @param array<int,array<string,mixed>> $questions @return array<string,mixed> */
    private function payloadWithQuestions(array $payload, array $questions): array
    {
        $numbers = [];
        $contextIds = [];
        foreach ($questions as $question) {
            $number = (int) ($question['source']['questionNumber'] ?? 0);
            if ($number > 0) $numbers[$number] = true;
            $contextId = trim((string) ($question['source']['contextTempId'] ?? ''));
            if ($contextId !== '') $contextIds[$contextId] = true;
        }
        $payload['questions'] = array_values($questions);
        if (is_array($payload['contexts'] ?? null)) {
            $payload['contexts'] = array_values(array_filter(
                $payload['contexts'],
                static function (mixed $context) use ($numbers, $contextIds): bool {
                    if (!is_array($context)) return false;
                    $tempId = trim((string) ($context['tempId'] ?? ''));
                    if ($tempId !== '' && isset($contextIds[$tempId])) return true;
                    foreach ((array) ($context['questionNumbers'] ?? []) as $number) {
                        if (isset($numbers[(int) $number])) return true;
                    }
                    return false;
                }
            ));
        }
        if (isset($payload['exam']['questionRange']) && is_array($payload['exam']['questionRange'])) {
            $ordered = array_keys($numbers);
            sort($ordered, SORT_NUMERIC);
            $payload['exam']['questionRange'] = [
                'start' => $ordered[0] ?? null,
                'end' => $ordered !== [] ? $ordered[count($ordered) - 1] : null,
                'total' => count($questions),
            ];
        }
        return $payload;
    }

    private function questionSourceKey(array $question, int $fallback): string
    {
        $source = is_array($question['source'] ?? null) ? $question['source'] : [];
        $provider = trim((string) ($source['provider'] ?? 'gran')) ?: 'gran';
        $external = trim((string) ($source['externalId'] ?? ''));
        if ($external !== '') return $provider . ':question:' . $external;
        $tempId = trim((string) ($question['tempId'] ?? ''));
        if ($tempId !== '') return $tempId;
        return $provider . ':fallback:' . $fallback . ':' . hash('sha256', json_encode($question));
    }

    private static function assertBatchQuestionCount(int $questionCount): void
    {
        if ($questionCount < 1 || $questionCount > self::MAX_QUESTIONS_PER_BATCH) {
            throw new InvalidArgumentException('Envie entre 1 e 5000 questoes por submissao.');
        }
    }

    /** @return array<string,mixed> */
    private function refreshBatch(int $batchId): array
    {
        $batchStmt = $this->db->prepare('SELECT * FROM private_ingestion_batches WHERE id = :id LIMIT 1');
        $batchStmt->execute([':id' => $batchId]);
        $batch = $batchStmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($batch)) throw new RuntimeException('Lote de ingestao nao encontrado.');

        $jobsStmt = $this->db->prepare(
            'SELECT status, payload_json, result_json, error_message FROM private_ingestion_jobs WHERE batch_id = :batch_id'
        );
        $jobsStmt->execute([':batch_id' => $batchId]);
        $counts = ['pending' => 0, 'processing' => 0, 'done' => 0, 'failed' => 0, 'created' => 0, 'duplicates' => 0, 'questionFailures' => 0];
        $errors = [];
        $questionStatuses = [];
        $questionErrors = [];
        foreach ($jobsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $job) {
            $status = (string) ($job['status'] ?? 'pending');
            if (isset($counts[$status])) $counts[$status]++;
            $result = json_decode((string) ($job['result_json'] ?? ''), true);
            $jobPayload = json_decode((string) ($job['payload_json'] ?? ''), true);
            $questionKeysByTempId = [];
            $questionKeysByNumber = [];
            $questionKeysByClientKey = [];
            $questionKeysByClientNumber = [];
            $jobQuestionKeys = [];
            $jobBatches = is_array($jobPayload['batches'] ?? null)
                ? array_values($jobPayload['batches'])
                : [['clientKey' => '', 'payload' => is_array($jobPayload) ? $jobPayload : []]];
            $position = 0;
            foreach ($jobBatches as $jobBatch) {
                if (!is_array($jobBatch)) continue;
                $clientKey = trim((string) ($jobBatch['clientKey'] ?? $jobBatch['client_key'] ?? ''));
                $batchPayload = is_array($jobBatch['payload'] ?? null) ? $jobBatch['payload'] : $jobBatch;
                foreach ((array) ($batchPayload['questions'] ?? []) as $question) {
                    if (!is_array($question)) continue;
                    $key = $this->questionSourceKey($question, $position++);
                    $jobQuestionKeys[$key] = true;
                    $tempId = trim((string) ($question['tempId'] ?? ''));
                    $number = trim((string) ($question['source']['questionNumber'] ?? ''));
                    if ($tempId !== '') $questionKeysByTempId[$tempId] = $key;
                    if ($number !== '') $questionKeysByNumber[$number] = $key;
                    if ($clientKey !== '') {
                        $questionKeysByClientKey[$clientKey][] = $key;
                        if ($number !== '') $questionKeysByClientNumber[$clientKey . ':' . $number] = $key;
                    }
                    $questionStatuses[$key] = match ($status) {
                        'processing' => 'processing',
                        'done' => 'published',
                        'failed' => 'failed',
                        default => 'queued',
                    };
                }
            }
            if (is_array($result)) {
                $counts['created'] += (int) ($result['count'] ?? $result['createdCount'] ?? 0);
                $counts['duplicates'] += (int) (
                    $result['skippedDuplicateCount']
                    ?? $result['skipped_duplicate_count']
                    ?? $result['duplicateCount']
                    ?? 0
                );
                $itemFailures = is_array($result['itemFailures'] ?? null) ? $result['itemFailures'] : [];
                $counts['questionFailures'] += count($itemFailures);
                foreach ($itemFailures as $failure) {
                    if (!is_array($failure)) continue;
                    $failureTempId = trim((string) ($failure['tempId'] ?? ''));
                    $failureNumber = trim((string) ($failure['questionNumber'] ?? ''));
                    $failureClientKey = trim((string) ($failure['clientKey'] ?? $failure['client_key'] ?? ''));
                    $failureKey = $questionKeysByTempId[$failureTempId]
                        ?? $questionKeysByClientNumber[$failureClientKey . ':' . $failureNumber]
                        ?? $questionKeysByNumber[$failureNumber]
                        ?? null;
                    if (is_string($failureKey) && $failureKey !== '') {
                        $questionStatuses[$failureKey] = 'failed';
                        $questionErrors[$failureKey] = $this->publicQuestionFailure($failure);
                    } elseif ($failureClientKey !== '') {
                        foreach ($questionKeysByClientKey[$failureClientKey] ?? [] as $clientQuestionKey) {
                            $questionStatuses[$clientQuestionKey] = 'failed';
                            $questionErrors[$clientQuestionKey] = $this->publicQuestionFailure($failure);
                        }
                    }
                }
            }
            $error = trim((string) ($job['error_message'] ?? ''));
            if ($error !== '') $errors[] = $this->sanitizePublicFailureMessage($error);
            if ($status === 'failed') {
                $jobFailure = $this->publicQuestionFailure([
                    'code' => 'job_processing_failed',
                    'message' => $error,
                ]);
                foreach (array_keys($jobQuestionKeys) as $questionKey) {
                    $questionErrors[$questionKey] ??= $jobFailure;
                }
            }
        }
        $jobCount = $counts['pending'] + $counts['processing'] + $counts['done'] + $counts['failed'];
        $status = $counts['processing'] > 0 ? 'processing'
            : ($counts['pending'] > 0 ? 'pending'
                : ($counts['failed'] > 0
                    ? ($counts['done'] > 0 ? 'partial' : 'failed')
                    : ($counts['questionFailures'] > 0 ? 'partial' : 'done')));
        $update = $this->db->prepare(
            'UPDATE private_ingestion_batches SET status = :status, job_count = :job_count,
             pending_job_count = :pending, processing_job_count = :processing,
             completed_job_count = :completed, failed_job_count = :failed,
             created_question_count = :created, duplicate_question_count = :duplicates,
             failed_question_count = :question_failures, question_statuses_json = :question_statuses_json,
             question_errors_json = :question_errors_json,
             error_summary = :error_summary,
             started_at = IF(:has_started = 1, COALESCE(started_at, UTC_TIMESTAMP()), started_at),
             completed_at = IF(:is_complete = 1, COALESCE(completed_at, UTC_TIMESTAMP()), NULL)
             WHERE id = :id'
        );
        $update->execute([
            ':status' => $status,
            ':job_count' => $jobCount,
            ':pending' => $counts['pending'],
            ':processing' => $counts['processing'],
            ':completed' => $counts['done'],
            ':failed' => $counts['failed'],
            ':created' => $counts['created'],
            ':duplicates' => $counts['duplicates'],
            ':question_failures' => $counts['questionFailures'],
            ':question_statuses_json' => json_encode($questionStatuses, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':question_errors_json' => json_encode($questionErrors, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':error_summary' => $errors === [] ? null : substr(implode(' | ', array_unique($errors)), 0, 3000),
            ':has_started' => ($counts['processing'] + $counts['done'] + $counts['failed']) > 0 ? 1 : 0,
            ':is_complete' => ($jobCount > 0 && $counts['pending'] === 0 && $counts['processing'] === 0) ? 1 : 0,
            ':id' => $batchId,
        ]);
        $batchStmt->execute([':id' => $batchId]);
        $row = $batchStmt->fetch(PDO::FETCH_ASSOC) ?: $batch;
        return $this->formatBatchRow($row);
    }

    /** @param array<string,mixed> $row @return array<string,mixed> */
    private function formatBatchRow(array $row): array
    {
        $keys = json_decode((string) ($row['question_keys_json'] ?? '[]'), true);
        $questionStatuses = json_decode((string) ($row['question_statuses_json'] ?? '{}'), true);
        $questionErrors = json_decode((string) ($row['question_errors_json'] ?? '{}'), true);
        $collectionPages = json_decode((string) ($row['collection_pages_json'] ?? '[]'), true);
        $collectionPages = is_array($collectionPages)
            ? array_values(array_filter(array_map('intval', $collectionPages), static fn (int $page): bool => $page > 0))
            : [];
        $questionCount = (int) $row['question_count'];
        $pageLabel = $collectionPages === []
            ? ''
            : (count($collectionPages) === 1
                ? 'Pagina ' . $collectionPages[0]
                : 'Paginas ' . implode(', ', $collectionPages));
        $displayName = trim(implode(' - ', array_filter([
            $pageLabel,
            sprintf('%d questao(oes)', $questionCount),
        ])));
        return [
            'batchId' => (string) $row['public_id'],
            'displayName' => $displayName,
            'collectionPages' => $collectionPages,
            'status' => (string) $row['status'],
            'questionCount' => $questionCount,
            'jobCount' => (int) $row['job_count'],
            'pending' => (int) $row['pending_job_count'],
            'processing' => (int) $row['processing_job_count'],
            'published' => (int) $row['created_question_count'],
            'duplicates' => (int) $row['duplicate_question_count'],
            'failures' => (int) $row['failed_question_count'],
            'questionKeys' => is_array($keys) ? $keys : [],
            'questionStatuses' => is_array($questionStatuses) ? $questionStatuses : [],
            'questionErrors' => is_array($questionErrors) ? $questionErrors : [],
            'error' => trim((string) ($row['error_summary'] ?? '')) ?: null,
            'createdAt' => $row['created_at'] ?? null,
            'startedAt' => $row['started_at'] ?? null,
            'completedAt' => $row['completed_at'] ?? null,
        ];
    }

    /** @param array<string,mixed> $failure @return array{code:string,message:string} */
    private function publicQuestionFailure(array $failure): array
    {
        $code = strtolower(trim((string) ($failure['code'] ?? 'publication_failed')));
        $code = preg_replace('/[^a-z0-9_.-]+/', '_', $code) ?: 'publication_failed';
        $message = $this->sanitizePublicFailureMessage((string) ($failure['message'] ?? ''));
        return [
            'code' => substr($code, 0, 64),
            'message' => $message,
        ];
    }

    private function sanitizePublicFailureMessage(string $message): string
    {
        $message = trim((string) preg_replace('/[\x00-\x1F\x7F]+/u', ' ', strip_tags($message)));
        $containsInternalDetail = preg_match(
            '/SQLSTATE|PDOException|stack\s+trace|(?:SELECT|INSERT|UPDATE|DELETE)\s+.+\s+(?:FROM|INTO|SET)|\/home\/|\\\\vendor\\\\/i',
            $message
        ) === 1;
        if ($message === '' || $containsInternalDetail) {
            return 'Falha interna ao publicar esta questao. Tente novamente; se persistir, consulte os logs administrativos.';
        }
        return mb_substr($message, 0, 300);
    }

    private function refreshBatchForJob(int $jobId): void
    {
        try {
            $stmt = $this->db->prepare('SELECT batch_id FROM private_ingestion_jobs WHERE id = :id LIMIT 1');
            $stmt->execute([':id' => $jobId]);
            $batchId = (int) $stmt->fetchColumn();
            if ($batchId > 0) {
                $this->refreshBatch($batchId);
            }
        } catch (Throwable $exception) {
            error_log(sprintf(
                '[private-ingestion] Falha ao consolidar o lote do job %d: %s',
                $jobId,
                $exception->getMessage()
            ));
        }
    }

    private function uuidV4(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        $hex = bin2hex($data);
        return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4)
            . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
    }

    private function maxBodyBytes(): int
    {
        $configured = (int) (getenv('QUESTION_INGESTION_MAX_BODY_BYTES') ?: self::DEFAULT_MAX_BODY_BYTES);
        return max(1_000_000, min(self::HARD_MAX_BODY_BYTES, $configured));
    }

    private function maxQuestionsPerJob(): int
    {
        $configured = (int) (getenv('QUESTION_INGESTION_MAX_QUESTIONS_PER_JOB')
            ?: self::DEFAULT_MAX_QUESTIONS_PER_JOB);
        return max(1, min(self::HARD_MAX_QUESTIONS_PER_JOB, $configured));
    }

    private function maxAttempts(): int
    {
        return max(1, min(10, (int) (getenv('QUESTION_INGESTION_MAX_ATTEMPTS') ?: self::DEFAULT_MAX_ATTEMPTS)));
    }

    private function staleLockMinutes(): int
    {
        return max(5, min(120, (int) (getenv('QUESTION_INGESTION_STALE_LOCK_MINUTES')
            ?: self::DEFAULT_STALE_LOCK_MINUTES)));
    }

    private function normalizeWorkerId(?string $workerId): string
    {
        $value = trim((string) $workerId);
        if ($value === '') {
            $value = (gethostname() ?: 'worker') . ':' . getmypid();
        }
        return substr((string) preg_replace('/[^A-Za-z0-9_.:-]+/', '-', $value), 0, 120);
    }

    private function isRetryableFailure(Throwable $exception): bool
    {
        if ($exception instanceof InvalidArgumentException || $exception instanceof DomainException) {
            return false;
        }
        if (!$exception instanceof PDOException) {
            return true;
        }

        $sqlState = strtoupper((string) $exception->getCode());
        $driverCode = (int) ($exception->errorInfo[1] ?? 0);
        return str_starts_with($sqlState, '08')
            || $sqlState === '40001'
            || in_array($driverCode, [1205, 1213, 2006, 2013], true);
    }

    private function assertHttps(array $server): void
    {
        $https = strtolower(trim((string) ($server['HTTPS'] ?? '')));
        $forwardedProto = strtolower(trim((string) ($server['HTTP_X_FORWARDED_PROTO'] ?? '')));
        if (!in_array($https, ['on', '1'], true) && $forwardedProto !== 'https') {
            throw new DomainException('A ingestao privada exige HTTPS.');
        }
    }
}
