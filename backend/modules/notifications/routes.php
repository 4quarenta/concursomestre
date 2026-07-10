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

require_once __DIR__ . '/controllers/NotificationsController.php';
require_once __DIR__ . '/services/NotificationsService.php';
require_once __DIR__ . '/repositories/NotificationsRepository.php';
require_once __DIR__ . '/validators/NotificationsValidator.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

/**
 * Le o payload JSON das rotas de notificacao sem duplicar parsing manual.
 *
 * @since 1.0.0
 */
function readNotificationsJsonRequestBody(): array
{
    $rawBody = file_get_contents('php://input');
    if (!is_string($rawBody) || trim($rawBody) === '') {
        return [];
    }

    $decoded = json_decode($rawBody, true);
    if (!is_array($decoded)) {
        throw new InvalidArgumentException('Payload JSON invalido.');
    }

    return $decoded;
}

/**
 * Fabrica curta do controller oficial de notificacoes.
 *
 * @since 1.0.0
 */
function buildNotificationsController(PDO $db): NotificationsController
{
    return new NotificationsController(
        new NotificationsService(
            new NotificationsRepository($db),
            new NotificationsValidator()
        )
    );
}

/**
 * Lista as notificacoes do usuario autenticado.
 *
 * @since 1.0.0
 */
function handleNotificationsListRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));

        $result = buildNotificationsController($db)->listNotifications($authenticatedUserId, $_GET);
        Response::success($result, 'Notifications retrieved');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch notifications', $e);
    }
}

/**
 * Marca uma notificacao especifica como lida.
 *
 * @since 1.0.0
 */
function handleNotificationsMarkReadRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $result = buildNotificationsController($db)->markAsRead(
            $authenticatedUserId,
            readNotificationsJsonRequestBody()
        );

        Response::success($result, $result['message'] ?? 'Notification marked as read');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to mark notification as read', $e);
    }
}

/**
 * Marca todas as notificacoes do escopo autorizado como lidas.
 *
 * @since 1.0.0
 */
function handleNotificationsMarkAllReadRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $isAdmin = (($payload['role'] ?? '') === 'admin');
        $result = buildNotificationsController($db)->markAllAsRead(
            $authenticatedUserId,
            $isAdmin,
            readNotificationsJsonRequestBody()
        );

        Response::success($result, $result['message'] ?? 'Notifications marked as read');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to mark notifications as read', $e);
    }
}

/**
 * Move uma notificacao especifica para a lixeira logica.
 *
 * @since 1.0.0
 */
function handleNotificationsDeleteRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $result = buildNotificationsController($db)->deleteNotification(
            $authenticatedUserId,
            readNotificationsJsonRequestBody()
        );

        Response::success($result, $result['message'] ?? 'Notification deleted');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to delete notification', $e);
    }
}

/**
 * Limpa em lote as notificacoes do escopo autorizado.
 *
 * @since 1.0.0
 */
function handleNotificationsClearAllRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $isAdmin = (($payload['role'] ?? '') === 'admin');
        $result = buildNotificationsController($db)->clearAll(
            $authenticatedUserId,
            $isAdmin,
            readNotificationsJsonRequestBody()
        );

        Response::success($result, $result['message'] ?? 'Notifications cleared');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to clear notifications', $e);
    }
}

/**
 * Restaura uma notificacao removida logicamente.
 *
 * @since 1.0.0
 */
function handleNotificationsRestoreRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $result = buildNotificationsController($db)->restoreNotification(
            $authenticatedUserId,
            readNotificationsJsonRequestBody()
        );

        Response::success($result, $result['message'] ?? 'Notification restored');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to restore notification', $e);
    }
}

/**
 * Exclui uma notificacao definitivamente.
 *
 * @since 1.0.0
 */
function handleNotificationsPermanentDeleteRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $result = buildNotificationsController($db)->permanentDeleteNotification(
            $authenticatedUserId,
            readNotificationsJsonRequestBody()
        );

        Response::success($result, $result['message'] ?? 'Notification permanently deleted');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to permanently delete notification', $e);
    }
}

/**
 * Registra uma notificacao nova a partir do usuario autenticado.
 *
 * @since 1.0.0
 */
function handleNotificationsSendRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $isAdmin = (($payload['role'] ?? '') === 'admin');
        $result = buildNotificationsController($db)->sendNotification(
            $authenticatedUserId,
            $isAdmin,
            readNotificationsJsonRequestBody()
        );

        Response::success($result, $result['message'] ?? 'Notification sent');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to send notification', $e);
    }
}
