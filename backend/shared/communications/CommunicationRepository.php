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
                actor_id, entity_type, entity_id, created_at
            ) VALUES (
                :id, :event_type, :idempotency_key, :delivery_class, :recipient_user_id,
                :recipient_email, :payload_json, :status, NOW(), :actor_type,
                :actor_id, :entity_type, :entity_id, NOW()
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
