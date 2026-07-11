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
    private const MAX_BODY_BYTES = 5_242_880;
    private const MAX_CLOCK_SKEW_SECONDS = 300;

    public function __construct(private readonly PDO $db)
    {
    }

    public function enqueueFromHttpRequest(string $rawBody, array $server): array
    {
        $this->assertSchemaReady();
        $this->assertHttps($server);
        if ($rawBody === '' || strlen($rawBody) > self::MAX_BODY_BYTES) {
            throw new InvalidArgumentException('Payload de ingestao invalido ou maior que 5 MB.');
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
                'INSERT INTO private_ingestion_jobs (request_id, actor_user_id, payload_json, status)
                 VALUES (:request_id, :actor_user_id, :payload_json, :status)'
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

    public function reserveNextJob(): ?array
    {
        $this->assertSchemaReady();
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->query(
                "SELECT * FROM private_ingestion_jobs
                 WHERE status = 'pending'
                 ORDER BY id ASC
                 LIMIT 1 FOR UPDATE"
            );
            $job = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!is_array($job)) {
                $this->db->commit();
                return null;
            }
            $this->db->prepare(
                "UPDATE private_ingestion_jobs
                 SET status = 'processing', attempts = attempts + 1, locked_at = UTC_TIMESTAMP()
                 WHERE id = :id"
            )->execute([':id' => (int) $job['id']]);
            $this->db->prepare("UPDATE private_ingestion_requests SET status = 'processing' WHERE id = :id")
                ->execute([':id' => (int) $job['request_id']]);
            $this->db->commit();
            return $job;
        } catch (Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    public function completeJob(int $jobId, int $requestId, array $result): void
    {
        $json = json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $this->db->prepare(
            "UPDATE private_ingestion_jobs SET status = 'done', result_json = :result_json, completed_at = UTC_TIMESTAMP() WHERE id = :id"
        )->execute([':result_json' => $json, ':id' => $jobId]);
        $this->db->prepare(
            "UPDATE private_ingestion_requests SET status = 'done', response_json = :response_json WHERE id = :id"
        )->execute([':response_json' => $json, ':id' => $requestId]);
    }

    public function failJob(int $jobId, int $requestId, Throwable $exception): void
    {
        $message = substr($exception->getMessage(), 0, 3000);
        $this->db->prepare(
            "UPDATE private_ingestion_jobs SET status = 'failed', error_message = :message, completed_at = UTC_TIMESTAMP() WHERE id = :id"
        )->execute([':message' => $message, ':id' => $jobId]);
        $this->db->prepare(
            "UPDATE private_ingestion_requests SET status = 'failed', response_json = :response_json WHERE id = :id"
        )->execute([
            ':response_json' => json_encode(['error' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':id' => $requestId,
        ]);
    }

    private function assertSchemaReady(): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'ingestao privada de questoes', [
            'private_ingestion_nonces' => ['nonce_hash', 'request_timestamp', 'expires_at'],
            'private_ingestion_requests' => ['client_key', 'idempotency_key', 'payload_hash', 'status', 'job_id'],
            'private_ingestion_jobs' => ['request_id', 'payload_json', 'status', 'attempts'],
        ]);
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
