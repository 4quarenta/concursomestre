<?php

declare(strict_types=1);

/**
 * Persistencia da autoridade de comunicacoes. Nenhum metodo cria schema em runtime.
 */
final class CommunicationRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function findIntentByKey(string $idempotencyKey): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM communication_intents WHERE idempotency_key = :idempotency_key LIMIT 1');
        $stmt->execute([':idempotency_key' => $idempotencyKey]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function findIntentById(string $intentId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM communication_intents WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $intentId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function findLatestIntentByOrderingKey(string $orderingKey): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM communication_intents
             WHERE ordering_key = :ordering_key
             ORDER BY source_revision DESC, created_at DESC, id DESC LIMIT 1'
        );
        $stmt->execute([':ordering_key' => $orderingKey]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function findDelivery(string $intentId, string $channel): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM communication_deliveries
             WHERE intent_id = :intent_id AND channel = :channel LIMIT 1'
        );
        $stmt->execute([':intent_id' => $intentId, ':channel' => $channel]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function insertIntent(array $intent): bool
    {
        $stmt = $this->db->prepare(
            'INSERT INTO communication_intents (
                id, event_type, idempotency_key, delivery_class, recipient_user_id,
                recipient_email, payload_json, status, available_at, actor_type,
                actor_id, entity_type, entity_id, ordering_key, source_revision,
                source_transition_id, source_state, created_at
            ) VALUES (
                :id, :event_type, :idempotency_key, :delivery_class, :recipient_user_id,
                :recipient_email, :payload_json, :status, NOW(), :actor_type,
                :actor_id, :entity_type, :entity_id, :ordering_key, :source_revision,
                :source_transition_id, :source_state, NOW()
            ) ON DUPLICATE KEY UPDATE id = id'
        );
        $stmt->execute([
            ':id' => $intent['id'],
            ':event_type' => $intent['event_type'],
            ':idempotency_key' => $intent['idempotency_key'],
            ':delivery_class' => $intent['delivery_class'],
            ':recipient_user_id' => $intent['recipient_user_id'],
            ':recipient_email' => $intent['recipient_email'],
            ':payload_json' => $intent['payload_json'],
            ':status' => $intent['status'] ?? 'pending',
            ':actor_type' => $intent['actor_type'] ?? null,
            ':actor_id' => $intent['actor_id'] ?? null,
            ':entity_type' => $intent['entity_type'] ?? null,
            ':entity_id' => $intent['entity_id'] ?? null,
            ':ordering_key' => $intent['ordering_key'] ?? null,
            ':source_revision' => $intent['source_revision'] ?? null,
            ':source_transition_id' => $intent['source_transition_id'] ?? null,
            ':source_state' => $intent['source_state'] ?? null,
        ]);

        return $stmt->rowCount() === 1;
    }

    public function insertDelivery(string $intentId, string $channel, string $status = 'pending'): bool
    {
        $stmt = $this->db->prepare(
            'INSERT INTO communication_deliveries (intent_id, channel, status, created_at)
             VALUES (:intent_id, :channel, :status, NOW())
             ON DUPLICATE KEY UPDATE intent_id = intent_id'
        );
        $stmt->execute([
            ':intent_id' => $intentId,
            ':channel' => $channel,
            ':status' => $status,
        ]);

        return $stmt->rowCount() === 1;
    }

    public function insertInAppNotification(array $notification): void
    {
        $stmt = $this->db->prepare(
            'INSERT INTO notifications (
                id, user_id, title, message, type, category, link, evidence_url,
                event_key, severity, channel, entity_type, entity_id, action_key,
                is_read, created_at
            ) VALUES (
                :id, :user_id, :title, :message, :type, :category, :link, :evidence_url,
                :event_key, :severity, :channel, :entity_type, :entity_id, :action_key,
                0, NOW()
            ) ON DUPLICATE KEY UPDATE id = id'
        );
        $stmt->execute([
            ':id' => $notification['id'],
            ':user_id' => $notification['user_id'],
            ':title' => $notification['title'],
            ':message' => $notification['message'],
            ':type' => $notification['type'] ?? 'info',
            ':category' => $notification['category'] ?? 'system',
            ':link' => $notification['link'] ?? null,
            ':evidence_url' => $notification['evidence_url'] ?? null,
            ':event_key' => $notification['event_key'] ?? null,
            ':severity' => $notification['severity'] ?? ($notification['type'] ?? 'info'),
            ':channel' => CommunicationPolicy::CHANNEL_IN_APP,
            ':entity_type' => $notification['entity_type'] ?? null,
            ':entity_id' => $notification['entity_id'] ?? null,
            ':action_key' => $notification['action_key'] ?? null,
        ]);
    }

    public function markDelivery(string $intentId, string $channel, string $status, ?string $error = null, bool $countAttempt = true): void
    {
        $stmt = $this->db->prepare(
            'UPDATE communication_deliveries
             SET status = :status, attempts = attempts + :count_attempt, last_error = :last_error,
                 delivered_at = CASE WHEN :delivered_status = "processed" THEN NOW() ELSE delivered_at END
             WHERE intent_id = :intent_id AND channel = :channel'
        );
        $stmt->execute([
            ':status' => $status,
            ':count_attempt' => $countAttempt ? 1 : 0,
            ':last_error' => $error !== null ? mb_substr($error, 0, 6000, 'UTF-8') : null,
            ':delivered_status' => $status,
            ':intent_id' => $intentId,
            ':channel' => $channel,
        ]);
    }

    public function setDeliveryProviderMessageId(string $intentId, string $channel, string $providerMessageId): void
    {
        $stmt = $this->db->prepare(
            'UPDATE communication_deliveries
             SET provider_message_id = :provider_message_id
             WHERE intent_id = :intent_id AND channel = :channel'
        );
        $stmt->execute([
            ':provider_message_id' => $providerMessageId,
            ':intent_id' => $intentId,
            ':channel' => $channel,
        ]);
    }

    public function updateIntentStatus(string $intentId, string $status, ?string $error = null): void
    {
        $stmt = $this->db->prepare(
            'UPDATE communication_intents
             SET status = :status, last_error = :last_error,
                 processed_at = CASE WHEN :processed_status = "processed" THEN NOW() ELSE processed_at END
             WHERE id = :id'
        );
        $stmt->execute([
            ':status' => $status,
            ':last_error' => $error !== null ? mb_substr($error, 0, 6000, 'UTF-8') : null,
            ':processed_status' => $status,
            ':id' => $intentId,
        ]);
    }

    public function hasPendingDeliveries(string $intentId): bool
    {
        $stmt = $this->db->prepare(
            "SELECT 1 FROM communication_deliveries
             WHERE intent_id = :intent_id AND status IN ('pending', 'processing') LIMIT 1"
        );
        $stmt->execute([':intent_id' => $intentId]);
        return $stmt->fetchColumn() !== false;
    }

    public function suppressPendingForOrderingKey(string $orderingKey, int $revision): int
    {
        $stmt = $this->db->prepare(
            "UPDATE communication_deliveries d
             INNER JOIN communication_intents i ON i.id = d.intent_id
             SET d.status = 'suppressed', d.last_error = 'Superseded by a newer ordered transition'
             WHERE i.ordering_key = :ordering_key
               AND (i.source_revision IS NULL OR i.source_revision < :revision)
               AND d.status IN ('pending', 'processing')"
        );
        $stmt->execute([':ordering_key' => $orderingKey, ':revision' => $revision]);

        $status = $this->db->prepare(
            "UPDATE communication_intents
             SET status = 'superseded', last_error = 'Superseded by a newer ordered transition'
             WHERE ordering_key = :ordering_key
               AND (source_revision IS NULL OR source_revision < :revision)
               AND status IN ('pending', 'processing')"
        );
        $status->execute([':ordering_key' => $orderingKey, ':revision' => $revision]);

        return $stmt->rowCount();
    }

    public function listForAdmin(array $filters): array
    {
        $page = max(1, min((int) ($filters['page'] ?? 1), 10000));
        $perPage = max(1, min((int) ($filters['perPage'] ?? 25), 50));
        $offset = ($page - 1) * $perPage;
        $where = [];
        $params = [];
        foreach (['event_type' => 'i.event_type', 'delivery_class' => 'i.delivery_class', 'status' => 'd.status', 'channel' => 'd.channel'] as $key => $column) {
            $value = trim((string) ($filters[$key] ?? ''));
            if ($value !== '') {
                $where[] = "{$column} = :{$key}";
                $params[":{$key}"] = $value;
            }
        }
        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $where[] = '(i.id LIKE :search OR i.event_type LIKE :search OR i.idempotency_key LIKE :search OR i.entity_id LIKE :search)';
            $params[':search'] = '%' . mb_substr($search, 0, 80, 'UTF-8') . '%';
        }
        $clause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $count = $this->db->prepare("SELECT COUNT(*) FROM communication_intents i INNER JOIN communication_deliveries d ON d.intent_id = i.id {$clause}");
        $count->execute($params);
        $total = (int) $count->fetchColumn();

        $sql = "SELECT i.id, i.event_type, i.delivery_class, i.recipient_user_id, i.status AS intent_status,
                       i.entity_type, i.entity_id, i.ordering_key, i.source_revision, i.source_state,
                       i.idempotency_key, i.created_at, i.processed_at, i.last_error AS intent_error,
                       d.channel, d.status AS delivery_status, d.attempts, d.provider_message_id,
                       d.last_error AS delivery_error, d.delivered_at
                FROM communication_intents i
                INNER JOIN communication_deliveries d ON d.intent_id = i.id
                {$clause}
                ORDER BY i.created_at DESC, i.id DESC
                LIMIT {$perPage} OFFSET {$offset}";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return [
            'items' => array_map(static function (array $item): array {
                $email = (string) ($item['recipient_user_id'] ?? '');
                return [
                    ...$item,
                    'recipient' => $email !== '' ? substr($email, 0, 8) . '…' : null,
                ];
            }, $items),
            'page' => $page,
            'perPage' => $perPage,
            'total' => $total,
            'pages' => max(1, (int) ceil($total / $perPage)),
        ];
    }

    public function insertAudit(string $intentId, string $eventName, string $result, array $metadata = []): void
    {
        $encoded = json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $stmt = $this->db->prepare(
            'INSERT INTO communication_audit_events (intent_id, event_name, result, metadata_json, created_at)
             VALUES (:intent_id, :event_name, :result, :metadata_json, NOW())'
        );
        $stmt->execute([
            ':intent_id' => $intentId,
            ':event_name' => $eventName,
            ':result' => $result,
            ':metadata_json' => $encoded,
        ]);
    }
}
