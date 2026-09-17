<?php

declare(strict_types=1);

require_once __DIR__ . '/CommunicationPolicy.php';
require_once __DIR__ . '/CommunicationRepository.php';
require_once __DIR__ . '/EmailProviderAdapter.php';
require_once __DIR__ . '/../events/TransactionalOutbox.php';

/**
 * Autoridade unica para transformar eventos de dominio em intents e deliveries.
 * O canal in-app e persistido na mesma transacao; e-mail segue pelo outbox.
 */
final class CommunicationService
{
    public function __construct(
        private readonly PDO $db,
        private readonly CommunicationRepository $repository,
        private readonly CommunicationPolicy $policy,
        private readonly TransactionalOutbox $outbox,
        private readonly EmailProviderAdapter $emailProvider
    ) {
    }

    public static function fromDatabase(PDO $db): self
    {
        return new self(
            $db,
            new CommunicationRepository($db),
            new CommunicationPolicy($db),
            new TransactionalOutbox($db),
            new EmailProviderAdapter()
        );
    }

    /**
     * Publica um e-mail transacional sem permitir que o dominio acesse SMTP.
     * O worker continua sendo o unico executor do provider.
     */
    public static function queueEmail(PDO $db, array $email): array
    {
        $eventType = trim((string) ($email['eventType'] ?? ''));
        $idempotencyKey = trim((string) ($email['idempotencyKey'] ?? ''));
        $recipientEmail = trim((string) ($email['recipientEmail'] ?? ''));
        if ($eventType === '' || $idempotencyKey === '' || $recipientEmail === '') {
            throw new InvalidArgumentException('E-mail sem identidade semantica ou destinatario.');
        }

        return self::fromDatabase($db)->publish([
            'eventType' => $eventType,
            'idempotencyKey' => $idempotencyKey,
            'deliveryClass' => (string) ($email['deliveryClass'] ?? CommunicationPolicy::CLASS_TRANSACTIONAL),
            'recipientUserId' => $email['recipientUserId'] ?? null,
            'recipientEmail' => $recipientEmail,
            'channels' => [CommunicationPolicy::CHANNEL_EMAIL],
            'title' => (string) ($email['subject'] ?? ''),
            'message' => (string) ($email['text'] ?? ''),
            'type' => 'info',
            'category' => (string) ($email['category'] ?? 'system'),
            'link' => $email['link'] ?? null,
            'actorType' => $email['actorType'] ?? null,
            'actorId' => $email['actorId'] ?? null,
            'entityType' => $email['entityType'] ?? null,
            'entityId' => $email['entityId'] ?? null,
            'payload' => [
                'recipientName' => (string) ($email['recipientName'] ?? 'Usuário'),
                'emailSubject' => (string) ($email['subject'] ?? ''),
                'emailHtml' => (string) ($email['html'] ?? ''),
                'emailText' => (string) ($email['text'] ?? ''),
                'templateKey' => $email['templateKey'] ?? null,
            ],
        ]);
    }

    /**
     * Publica uma intent idempotente. Retorna created=false em repeticao sem novo efeito.
     * @return array{intentId:string,created:bool,channels:array<string,string>}
     */
    public function publish(array $event): array
    {
        $eventType = $this->requiredString($event, 'eventType');
        $idempotencyKey = $this->requiredString($event, 'idempotencyKey');
        $deliveryClass = trim((string) ($event['deliveryClass'] ?? CommunicationPolicy::CLASS_TRANSACTIONAL));
        if (!in_array($deliveryClass, [CommunicationPolicy::CLASS_TRANSACTIONAL, CommunicationPolicy::CLASS_MARKETING], true)) {
            throw new InvalidArgumentException('Classe de comunicacao nao suportada.');
        }
        $userId = $this->nullableString($event['recipientUserId'] ?? null);
        $email = $this->nullableString($event['recipientEmail'] ?? null);
        if ($email !== null && filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException('Destinatario de e-mail invalido.');
        }
        $channels = array_values(array_unique(array_filter(array_map('strval', $event['channels'] ?? [CommunicationPolicy::CHANNEL_IN_APP]))));
        if (in_array(CommunicationPolicy::CHANNEL_IN_APP, $channels, true) && $userId === null) {
            throw new InvalidArgumentException('Delivery in-app sem destinatario.');
        }
        $payload = is_array($event['payload'] ?? null) ? $event['payload'] : [];
        $encodedPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

        $existing = $this->repository->findIntentByKey($idempotencyKey);
        if (is_array($existing)) {
            return [
                'intentId' => (string) $existing['id'],
                'created' => false,
                'channels' => $this->existingChannels((string) $existing['id']),
            ];
        }

        $intentId = 'comm-' . substr(hash('sha256', $idempotencyKey), 0, 56);
        $started = !$this->db->inTransaction();
        if ($started) {
            $this->db->beginTransaction();
        }

        try {
            $created = $this->repository->insertIntent([
                'id' => $intentId,
                'event_type' => $eventType,
                'idempotency_key' => $idempotencyKey,
                'delivery_class' => $deliveryClass,
                'recipient_user_id' => $userId,
                'recipient_email' => $email,
                'payload_json' => $encodedPayload,
                'actor_type' => $this->nullableString($event['actorType'] ?? null),
                'actor_id' => $this->nullableString($event['actorId'] ?? null),
                'entity_type' => $this->nullableString($event['entityType'] ?? null),
                'entity_id' => $this->nullableString($event['entityId'] ?? null),
            ]);

            if (!$created) {
                $existing = $this->repository->findIntentByKey($idempotencyKey);
                if (!is_array($existing)) {
                    throw new RuntimeException('Intent de comunicacao duplicada sem registro recuperavel.');
                }
                if ($started) {
                    $this->db->commit();
                }
                return [
                    'intentId' => (string) $existing['id'],
                    'created' => false,
                    'channels' => $this->existingChannels((string) $existing['id']),
                ];
            }

            $channelResults = [];
            foreach ($channels as $channel) {
                if (!$this->policy->allows($deliveryClass, $channel, $userId)) {
                    $this->repository->insertDelivery($intentId, $channel, 'suppressed');
                    $channelResults[$channel] = 'suppressed';
                    continue;
                }

                $this->repository->insertDelivery($intentId, $channel, 'pending');
                if ($channel === CommunicationPolicy::CHANNEL_IN_APP) {
                    $this->repository->insertInAppNotification([
                        'id' => 'not-' . substr(hash('sha256', $intentId . ':in_app'), 0, 56),
                        'user_id' => $userId ?? '',
                        'title' => (string) ($event['title'] ?? ''),
                        'message' => (string) ($event['message'] ?? ''),
                        'type' => (string) ($event['type'] ?? 'info'),
                        'category' => (string) ($event['category'] ?? 'system'),
                        'link' => $event['link'] ?? null,
                        'evidence_url' => $event['evidenceUrl'] ?? null,
                        'event_key' => $eventType,
                        'entity_type' => $event['entityType'] ?? null,
                        'entity_id' => $event['entityId'] ?? null,
                        'action_key' => $event['actionKey'] ?? null,
                    ]);
                    $this->repository->markDelivery($intentId, $channel, 'processed');
                    $channelResults[$channel] = 'processed';
                    continue;
                }

                if ($channel === CommunicationPolicy::CHANNEL_EMAIL) {
                    if ($email === '') {
                        $this->repository->markDelivery($intentId, $channel, 'skipped', 'Destinatario sem e-mail.');
                        $channelResults[$channel] = 'skipped';
                        continue;
                    }
                    $this->outbox->enqueue(
                        'communication_intent',
                        $intentId,
                        'communication.intent.dispatch',
                        'communication:' . $intentId . ':email',
                        ['intentId' => $intentId, 'channel' => $channel]
                    );
                    $channelResults[$channel] = 'queued';
                    continue;
                }

                throw new InvalidArgumentException('Canal de comunicacao nao suportado.');
            }

            $this->repository->insertAudit($intentId, 'communication.intent.created', 'accepted', [
                'eventType' => $eventType,
                'deliveryClass' => $deliveryClass,
                'channels' => $channelResults,
                'idempotencyKey' => $idempotencyKey,
            ]);

            if ($started) {
                $this->db->commit();
            }
            return ['intentId' => $intentId, 'created' => true, 'channels' => $channelResults];
        } catch (Throwable $exception) {
            if ($started && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
    }

    /**
     * Consumidor canonico do delivery de e-mail disparado pelo outbox.
     * O worker chama este metodo; nunca o controller HTTP.
     */
    public function dispatchEmail(string $intentId): array
    {
        $intent = $this->repository->findIntentById($intentId);
        if (!is_array($intent)) {
            throw new RuntimeException('Intent de comunicacao nao encontrada.');
        }

        $delivery = $this->repository->findDelivery($intentId, CommunicationPolicy::CHANNEL_EMAIL);
        if (!is_array($delivery)) {
            throw new RuntimeException('Delivery de e-mail nao encontrado.');
        }
        if (in_array((string) ($delivery['status'] ?? ''), ['processed', 'suppressed', 'skipped'], true)) {
            return ['intentId' => $intentId, 'status' => (string) $delivery['status']];
        }

        if (getenv('M20F07_SYNTHETIC_RUN') === '1' && getenv('CM_SYNTHETIC_EMAIL_SINK') !== '1') {
            throw new RuntimeException('Execucao sintetica M20F-07 sem sink de e-mail ativo.');
        }

        $payload = json_decode((string) ($intent['payload_json'] ?? ''), true);
        if (!is_array($payload)) {
            throw new RuntimeException('Payload da intent de comunicacao invalido.');
        }

        $email = trim((string) ($intent['recipient_email'] ?? ''));
        $subject = trim((string) ($payload['emailSubject'] ?? $payload['subject'] ?? ''));
        $html = (string) ($payload['emailHtml'] ?? $payload['htmlBody'] ?? '');
        $text = (string) ($payload['emailText'] ?? $payload['textBody'] ?? '');
        if ($email === '' || $subject === '' || trim($html) === '') {
            throw new RuntimeException('Intent de e-mail sem destinatario ou corpo completo.');
        }

        $this->repository->markDelivery($intentId, CommunicationPolicy::CHANNEL_EMAIL, 'processing', null, false);
        try {
            $this->emailProvider->send($email, (string) ($payload['recipientName'] ?? 'Usuário'), $subject, $html, $text);
            $this->repository->markDelivery($intentId, CommunicationPolicy::CHANNEL_EMAIL, 'processed');
            $this->repository->updateIntentStatus($intentId, 'processed');
            $this->repository->insertAudit($intentId, 'communication.email.delivered', 'accepted', [
                'channel' => CommunicationPolicy::CHANNEL_EMAIL,
                'provider' => 'Mailer',
            ]);
            return ['intentId' => $intentId, 'status' => 'processed'];
        } catch (Throwable $exception) {
            $this->repository->markDelivery($intentId, CommunicationPolicy::CHANNEL_EMAIL, 'failed', $exception->getMessage());
            $this->repository->updateIntentStatus($intentId, 'failed', $exception->getMessage());
            $this->repository->insertAudit($intentId, 'communication.email.failed', 'failed', [
                'channel' => CommunicationPolicy::CHANNEL_EMAIL,
                'errorClass' => get_class($exception),
            ]);
            throw $exception;
        }
    }

    private function existingChannels(string $intentId): array
    {
        $stmt = $this->db->prepare('SELECT channel, status FROM communication_deliveries WHERE intent_id = :intent_id');
        $stmt->execute([':intent_id' => $intentId]);
        $result = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $result[(string) $row['channel']] = (string) $row['status'];
        }
        return $result;
    }

    private function requiredString(array $event, string $key): string
    {
        $value = trim((string) ($event[$key] ?? ''));
        if ($value === '') {
            throw new InvalidArgumentException('Evento de comunicacao sem ' . $key . '.');
        }
        return $value;
    }

    private function nullableString($value): ?string
    {
        $normalized = trim((string) $value);
        return $normalized === '' ? null : $normalized;
    }
}
