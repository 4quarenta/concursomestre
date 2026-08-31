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
 * Controller fino do dominio de notificacoes.
 * Ele apenas repassa contexto minimo para a camada de service.
 *
 * @since 1.0.0
 */
class NotificationsController
{
    /**
     * Inicializa o controller de notificacoes.
     *
     * @since 1.0.0
     */
    public function __construct(private readonly NotificationsService $service)
    {
    }

    /**
     * Encaminha a listagem de notificacoes para o service.
     *
     * @since 1.0.0
     */
    public function listNotifications(string $authenticatedUserId, array $query): array
    {
        return $this->service->listNotifications($authenticatedUserId, $query);
    }

    /**
     * Encaminha a marcacao de leitura para o service.
     *
     * @since 1.0.0
     */
    public function markAsRead(string $authenticatedUserId, array $payload): array
    {
        return $this->service->markAsRead($authenticatedUserId, $payload);
    }

    /**
     * Encaminha a marcacao em lote para o service.
     *
     * @since 1.0.0
     */
    public function markAllAsRead(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        return $this->service->markAllAsRead($authenticatedUserId, $isAdmin, $payload);
    }

    /**
     * Encaminha a exclusao logica para o service.
     *
     * @since 1.0.0
     */
    public function deleteNotification(string $authenticatedUserId, array $payload): array
    {
        return $this->service->deleteNotification($authenticatedUserId, $payload);
    }

    /**
     * Encaminha a limpeza em lote para o service.
     *
     * @since 1.0.0
     */
    public function clearAll(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        return $this->service->clearAll($authenticatedUserId, $isAdmin, $payload);
    }

    /**
     * Encaminha restauracao da lixeira para o service.
     *
     * @since 1.0.0
     */
    public function restoreNotification(string $authenticatedUserId, array $payload): array
    {
        return $this->service->restoreNotification($authenticatedUserId, $payload);
    }

    /**
     * Encaminha exclusao definitiva para o service.
     *
     * @since 1.0.0
     */
    public function permanentDeleteNotification(string $authenticatedUserId, array $payload): array
    {
        return $this->service->permanentDeleteNotification($authenticatedUserId, $payload);
    }

    /**
     * Encaminha o envio de notificacao para o service.
     *
     * @since 1.0.0
     */
    public function sendNotification(string $authenticatedUserId, bool $isAdmin, array $payload): array
    {
        return $this->service->sendNotification($authenticatedUserId, $isAdmin, $payload);
    }
}
