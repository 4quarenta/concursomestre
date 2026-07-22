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
    private const DEFAULT_MAX_QUESTIONS_PER_JOB = 250;
    private const HARD_MAX_QUESTIONS_PER_JOB = 1000;
    private const DEFAULT_MAX_ATTEMPTS = 5;
    private const DEFAULT_STALE_LOCK_MINUTES = 15;
    private const MAX_CLOCK_SKEW_SECONDS = 300;

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
                'locked_at', 'locked_by', 'last_error_at', 'dead_lettered_at',
            ],
        ]);
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
