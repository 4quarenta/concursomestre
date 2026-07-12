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

/**
 * Service oficial de notificacoes.
 * Orquestra autorizacao, normalizacao do payload e formato retornado ao frontend.
 *
 * @since 1.0.0
 */
class NotificationsService
{
    /**
     * Inicializa o service de notificacoes com dependencias principais.
     *
     * @since 1.0.0
     */
    public function __construct(
        private readonly NotificationsRepository $repository,
        private readonly NotificationsValidator $validator
    ) {
    }

    /**
     * Lista notificacoes do usuario autenticado em formato compativel com o app.
     *
     * @since 1.0.0
     */
    public function listNotifications(string $authenticatedUserId, array $query): array
    {
        $filters = $this->validator->validateListQuery($query);
        $rows = $this->repository->listByUserId(
            $authenticatedUserId,
            $filters['since'],
            $filters['limit'],
            $filters['cursor']
        );
        $hasMore = count($rows) > $filters['limit'];
        if ($hasMore) {
            $rows = array_slice($rows, 0, $filters['limit']);
        }

        $items = array_map([$this, 'mapNotificationRow'], $rows);

        return [
            'items' => $items,
            'count' => count($items),
            'limit' => $filters['limit'],
            'hasMore' => $hasMore,
            'nextCursor' => $hasMore ? $this->encodeCursorFromRow($rows[count($rows) - 1] ?? null) : null,
            'unreadCount' => $this->repository->countUnreadByUserId($authenticatedUserId),
        ];
    }

    /**
     * Marca uma notificacao especifica como lida.
     *
     * @since 1.0.0
     */
    public function markAsRead(string $authenticatedUserId, array $payload): array
    {
        $notificationId = $this->validator->validateNotificationIdPayload($payload);
        $this->repository->markAsRead($authenticatedUserId, $notificationId);

        return [
            'success' => true,
            'notificationId' => $notificationId,
            'message' => 'Notificacao marcada como lida.',
        ];
    }

    /**
     * Marca em lote as notificacoes do escopo autorizado.
     *
     * @since 1.0.0
     */
    public function markAllAsRead(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        $targetUserId = $this->validator->resolveScopedUserId(
            $authenticatedUserId,
            $this->validator->extractRequestedUserId($payload),
            $isAdmin
        );

        $this->repository->markAllAsRead($targetUserId);

        return [
            'success' => true,
            'userId' => $targetUserId,
            'message' => 'Notificacoes marcadas como lidas.',
        ];
    }

    /**
     * Realiza exclusao logica de uma notificacao individual.
     *
     * @since 1.0.0
     */
    public function deleteNotification(string $authenticatedUserId, array $payload): array
    {
        $notificationId = $this->validator->validateNotificationIdPayload($payload);
        $this->repository->softDelete($authenticatedUserId, $notificationId);

        return [
            'success' => true,
            'notificationId' => $notificationId,
            'message' => 'Notificacao movida para a lixeira.',
        ];
    }

    /**
     * Limpa em lote as notificacoes visiveis do escopo autorizado.
     *
     * @since 1.0.0
     */
    public function clearAll(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        $targetUserId = $this->validator->resolveScopedUserId(
            $authenticatedUserId,
            $this->validator->extractRequestedUserId($payload),
            $isAdmin
        );

        $this->repository->clearAll($targetUserId);

        return [
            'success' => true,
            'userId' => $targetUserId,
            'message' => 'Notificacoes limpas com sucesso.',
        ];
    }

    /**
     * Restaura uma notificacao da lixeira.
     *
     * @since 1.0.0
     */
    public function restoreNotification(string $authenticatedUserId, array $payload): array
    {
        $notificationId = $this->validator->validateNotificationIdPayload($payload);
        $this->repository->restore($authenticatedUserId, $notificationId);

        return [
            'success' => true,
            'notificationId' => $notificationId,
            'message' => 'Notificacao restaurada.',
        ];
    }

    /**
     * Exclui definitivamente uma notificacao.
     *
     * @since 1.0.0
     */
    public function permanentDeleteNotification(string $authenticatedUserId, array $payload): array
    {
        $notificationId = $this->validator->validateNotificationIdPayload($payload);
        $this->repository->permanentDelete($authenticatedUserId, $notificationId);

        return [
            'success' => true,
            'notificationId' => $notificationId,
            'message' => 'Notificacao excluida definitivamente.',
        ];
    }

    /**
     * Registra uma notificacao nova preservando compatibilidade com o app atual.
     *
     * @since 1.0.0
     */
    public function sendNotification(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        $normalized = $this->validator->validateSendPayload($payload);
        $recipientUserId = $this->validator->resolveSendRecipient(
            $authenticatedUserId,
            $normalized['userId'],
            $isAdmin
        );

        $recipientIds = match ($recipientUserId) {
            'admin' => $this->repository->listActiveAdminIds(),
            'all' => $this->repository->listActiveUserIds(),
            default => [$recipientUserId],
        };

        $created = [];
        foreach (array_values(array_unique(array_filter($recipientIds))) as $targetUserId) {
            $notification = [
                'id' => 'not-' . uniqid('', true) . '-' . time(),
                'user_id' => (string) $targetUserId,
                'title' => $normalized['title'],
                'message' => $normalized['message'],
                'type' => $normalized['type'],
                'category' => $normalized['category'],
                'link' => $normalized['link'],
                'evidence_url' => $normalized['evidenceUrl'],
                'event_key' => $normalized['eventKey'],
                'severity' => $normalized['severity'],
                'channel' => $normalized['channel'],
                'entity_type' => $normalized['entityType'],
                'entity_id' => $normalized['entityId'],
                'action_key' => $normalized['actionKey'],
                'is_read' => 0,
                'created_at' => date('Y-m-d H:i:s'),
            ];

            $this->repository->insert($notification);
            $created[] = $this->mapNotificationRow($notification);
        }

        return [
            'notification' => $created[0] ?? null,
            'notifications' => $created,
            'count' => count($created),
            'message' => count($created) > 1
                ? 'Notificacoes enviadas com sucesso.'
                : 'Notificacao enviada com sucesso.',
        ];
    }

    /**
     * Adapta a linha SQL para o contrato consumido pelo frontend.
     *
     * @since 1.0.0
     */
    private function mapNotificationRow(array $row): array
    {
        $deletedAt = null;
        $deletedAtRaw = trim((string) ($row['deleted_at'] ?? ''));
        if ($deletedAtRaw !== '' && $deletedAtRaw !== '0') {
            $deletedAtTimestamp = strtotime($deletedAtRaw);
            if ($deletedAtTimestamp !== false) {
                $deletedAt = $deletedAtTimestamp * 1000;
            }
        }

        $createdAt = trim((string) ($row['created_at'] ?? ''));
        $createdTimestamp = strtotime($createdAt);
        if ($createdTimestamp === false) {
            $createdTimestamp = time();
        }

        $category = trim((string) ($row['category'] ?? 'system'));
        if ($category === 'moderation') {
            $category = 'report';
        }

        if (!in_array($category, ['system', 'social', 'marketplace', 'report'], true)) {
            $category = 'system';
        }

        $type = trim((string) ($row['type'] ?? 'info'));
        if (!in_array($type, ['info', 'success', 'warning', 'error'], true)) {
            $type = 'info';
        }

        return [
            'id' => (string) ($row['id'] ?? ('not-' . uniqid('', true))),
            'userId' => (string) ($row['user_id'] ?? ''),
            'title' => (string) ($row['title'] ?? ''),
            'message' => (string) ($row['message'] ?? ''),
            'type' => $type,
            'category' => $category,
            'isRead' => (bool) ($row['is_read'] ?? false),
            'timestamp' => $createdTimestamp * 1000,
            'link' => ($row['link'] ?? null) ?: null,
            'evidenceUrl' => ($row['evidence_url'] ?? null) ?: null,
            'eventKey' => ($row['event_key'] ?? null) ?: null,
            'severity' => ($row['severity'] ?? null) ?: $type,
            'channel' => ($row['channel'] ?? null) ?: 'in_app',
            'entityType' => ($row['entity_type'] ?? null) ?: null,
            'entityId' => ($row['entity_id'] ?? null) ?: null,
            'actionKey' => ($row['action_key'] ?? null) ?: null,
            'deletedAt' => $deletedAt,
        ];
    }

    private function encodeCursorFromRow(?array $row): ?string
    {
        if (!is_array($row)) {
            return null;
        }

        $createdAt = trim((string) ($row['created_at'] ?? ''));
        $id = trim((string) ($row['id'] ?? ''));
        if ($createdAt === '' || $id === '') {
            return null;
        }

        return rtrim(strtr(base64_encode($createdAt . '|' . $id), '+/', '-_'), '=');
    }
}
