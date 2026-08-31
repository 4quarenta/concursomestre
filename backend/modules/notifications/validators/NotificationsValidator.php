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
 * Validator oficial do dominio de notificacoes.
 * Centraliza formato de payload, filtros e regras basicas de autorizacao.
 *
 * @since 1.0.0
 */
class NotificationsValidator
{
    /**
     * Valida o filtro opcional de sincronizacao incremental.
     *
     * @since 1.0.0
     */
    public function validateListQuery(array $query): array
    {
        $since = trim((string) ($query['since'] ?? ''));

        return [
            'since' => $since !== '' ? $since : null,
        ];
    }

    /**
     * Valida mutacoes que exigem um identificador de notificacao.
     *
     * @since 1.0.0
     */
    public function validateNotificationIdPayload(array $payload): string
    {
        $notificationId = trim((string) ($payload['notification_id'] ?? $payload['notificationId'] ?? ''));
        if ($notificationId === '') {
            throw new InvalidArgumentException('notification_id e obrigatorio.');
        }

        return $notificationId;
    }

    /**
     * Extrai o alvo opcional usado por operacoes em lote.
     *
     * @since 1.0.0
     */
    public function extractRequestedUserId(array $payload): ?string
    {
        $userId = trim((string) ($payload['user_id'] ?? $payload['userId'] ?? ''));
        return $userId !== '' ? $userId : null;
    }

    /**
     * Resolve o escopo real das mutacoes em lote.
     * Usuarios comuns so podem operar sobre as proprias notificacoes.
     *
     * @since 1.0.0
     */
    public function resolveScopedUserId(
        string $authenticatedUserId,
        ?string $requestedUserId,
        bool $isAdmin
    ): string {
        if ($requestedUserId === null || $requestedUserId === '') {
            return $authenticatedUserId;
        }

        if ($requestedUserId === $authenticatedUserId) {
            return $authenticatedUserId;
        }

        if ($isAdmin) {
            return $requestedUserId;
        }

        throw new DomainException('Voce nao pode gerenciar notificacoes de outro usuario.');
    }

    /**
     * Valida o payload de envio e normaliza compatibilidade com contratos antigos.
     *
     * @since 1.0.0
     */
    public function validateSendPayload(array $payload): array
    {
        $userId = trim((string) ($payload['user_id'] ?? $payload['userId'] ?? ''));
        $title = trim((string) ($payload['title'] ?? ''));
        $message = trim((string) ($payload['message'] ?? ''));
        $type = trim((string) ($payload['type'] ?? 'info'));
        $category = trim((string) ($payload['category'] ?? 'system'));
        $link = trim((string) ($payload['action_url'] ?? $payload['actionUrl'] ?? $payload['link'] ?? ''));
        $evidenceUrl = trim((string) ($payload['evidence_url'] ?? $payload['evidenceUrl'] ?? ''));

        if ($userId === '') {
            throw new InvalidArgumentException('O destinatario da notificacao e obrigatorio.');
        }

        if ($title === '') {
            throw new InvalidArgumentException('O titulo da notificacao e obrigatorio.');
        }

        if ($message === '') {
            throw new InvalidArgumentException('A mensagem da notificacao e obrigatoria.');
        }

        $allowedTypes = ['info', 'success', 'warning', 'error'];
        if (!in_array($type, $allowedTypes, true)) {
            $type = 'info';
        }

        if ($category === 'report') {
            $category = 'moderation';
        }

        $allowedCategories = ['system', 'social', 'marketplace', 'moderation'];
        if (!in_array($category, $allowedCategories, true)) {
            $category = 'system';
        }

        return [
            'userId' => $userId,
            'title' => $title,
            'message' => $message,
            'type' => $type,
            'category' => $category,
            'link' => $link !== '' ? $link : null,
            'evidenceUrl' => $evidenceUrl !== '' ? $evidenceUrl : null,
        ];
    }

    /**
     * Resolve o destinatario real do envio respeitando limites de permissao.
     * Enquanto os eventos de negocio ainda sao disparados pelo frontend, usuarios
     * autenticados podem notificar a si mesmos e o pseudo-destinatario `admin`.
     *
     * @since 1.0.0
     */
    public function resolveSendRecipient(
        string $authenticatedUserId,
        string $requestedUserId,
        bool $isAdmin
    ): string {
        if ($requestedUserId === $authenticatedUserId) {
            return $authenticatedUserId;
        }

        if ($requestedUserId === 'admin') {
            return 'admin';
        }

        if ($requestedUserId === 'all') {
            if (!$isAdmin) {
                throw new DomainException('Somente administradores podem enviar notificacoes globais.');
            }

            return 'all';
        }

        if ($isAdmin) {
            return $requestedUserId;
        }

        throw new DomainException('Voce nao pode enviar notificacoes para outro usuario.');
    }
}
