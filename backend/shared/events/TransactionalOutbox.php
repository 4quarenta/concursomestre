<?php

declare(strict_types=1);

/**
 * Outbox transacional compartilhado pelos dominios da plataforma.
 * O produtor deve chamar enqueue usando a mesma conexao/transacao da escrita
 * canonica; o worker faz claim com SKIP LOCKED e retry exponencial.
 */
final class TransactionalOutbox
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function enqueue(
        string $aggregateType,
        string $aggregateId,
        string $eventType,
        string $idempotencyKey,
        array $payload,
        int $maxAttempts = 8
    ): int {
        $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded)) {
            throw new RuntimeException('Nao foi possivel serializar o evento assincrono.');
        }

        $stmt = $this->db->prepare(
            "INSERT INTO platform_event_outbox (
                aggregate_type, aggregate_id, event_type, idempotency_key,
                payload_json, status, attempts, max_attempts, available_at
             ) VALUES (
                :aggregate_type, :aggregate_id, :event_type, :idempotency_key,
                :payload_json, 'pending', 0, :max_attempts, NOW()
             ) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)"
        );
        $stmt->execute([
            ':aggregate_type' => trim($aggregateType),
            ':aggregate_id' => trim($aggregateId),
            ':event_type' => trim($eventType),
            ':idempotency_key' => trim($idempotencyKey),
            ':payload_json' => $encoded,
            ':max_attempts' => max(1, min(50, $maxAttempts)),
        ]);

        return (int) $this->db->lastInsertId();
    }

    /** @return array<int, array<string, mixed>> */
    public function claimBatch(string $workerId, int $limit = 25, int $staleAfterSeconds = 900): array
    {
        $safeLimit = max(1, min(100, $limit));
        $safeStale = max(60, min(86400, $staleAfterSeconds));
        $started = !$this->db->inTransaction();
        if ($started) {
            $this->db->beginTransaction();
        }

        try {
            $this->db->exec(
                "UPDATE platform_event_outbox
                 SET status = 'pending', locked_at = NULL, locked_by = NULL,
                     available_at = LEAST(available_at, NOW())
                 WHERE status = 'processing'
                   AND locked_at < DATE_SUB(NOW(), INTERVAL {$safeStale} SECOND)"
            );

            $stmt = $this->db->prepare(
                "SELECT *
                 FROM platform_event_outbox
                 WHERE status = 'pending'
                   AND available_at <= NOW()
                 ORDER BY available_at, id
                 LIMIT {$safeLimit}
                 FOR UPDATE SKIP LOCKED"
            );
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            if ($rows !== []) {
                $ids = array_map(static fn (array $row): int => (int) $row['id'], $rows);
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                $update = $this->db->prepare(
                    "UPDATE platform_event_outbox
                     SET status = 'processing', attempts = attempts + 1,
                         locked_at = NOW(), locked_by = ?
                     WHERE id IN ({$placeholders})"
                );
                $update->execute([$workerId, ...$ids]);
                foreach ($rows as &$row) {
                    $row['attempts'] = (int) $row['attempts'] + 1;
                }
                unset($row);
            }

            if ($started) {
                $this->db->commit();
            }
            return $rows;
        } catch (Throwable $exception) {
            if ($started && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    public function markProcessed(int $eventId): void
    {
        $stmt = $this->db->prepare(
            "UPDATE platform_event_outbox
             SET status = 'processed', processed_at = NOW(), locked_at = NULL,
                 locked_by = NULL, last_error = NULL
             WHERE id = :id"
        );
        $stmt->execute([':id' => $eventId]);
    }

    public function markFailed(array $event, Throwable $exception): void
    {
        $attempts = (int) ($event['attempts'] ?? 1);
        $maxAttempts = max(1, (int) ($event['max_attempts'] ?? 8));
        $deadLetter = $attempts >= $maxAttempts;
        $delay = min(3600, 15 * (2 ** min(8, max(0, $attempts - 1))));
        $stmt = $this->db->prepare(
            "UPDATE platform_event_outbox
             SET status = :status,
                 available_at = DATE_ADD(NOW(), INTERVAL {$delay} SECOND),
                 locked_at = NULL,
                 locked_by = NULL,
                 dead_lettered_at = :dead_lettered_at,
                 last_error = :last_error
             WHERE id = :id"
        );
        $stmt->execute([
            ':status' => $deadLetter ? 'dead_letter' : 'pending',
            ':dead_lettered_at' => $deadLetter ? date('Y-m-d H:i:s') : null,
            ':last_error' => mb_substr($exception->getMessage(), 0, 6000, 'UTF-8'),
            ':id' => (int) ($event['id'] ?? 0),
        ]);
    }
}
