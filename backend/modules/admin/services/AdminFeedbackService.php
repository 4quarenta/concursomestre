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

require_once __DIR__ . '/../repositories/AdminFeedbackRepository.php';
require_once __DIR__ . '/../validators/AdminFeedbackValidator.php';
require_once __DIR__ . '/AdminUserCommunicationService.php';

/**
 * Servico do dominio administrativo de feedback.
 * Centraliza regras de consulta e atualizacao das conversas de suporte.
 */
class AdminFeedbackService
{
    private AdminFeedbackRepository $repository;
    private AdminFeedbackValidator $validator;
    private AdminUserCommunicationService $communicationService;

    /**
     * Inicializa o servico com dependencias de suporte e comunicacao.
     *
     * @since 1.0.0
     */
    public function __construct(
        AdminFeedbackRepository $repository,
        AdminFeedbackValidator $validator,
        ?AdminUserCommunicationService $communicationService = null
    ) {
        $this->repository = $repository;
        $this->validator = $validator;
        $this->communicationService = $communicationService
            ?? new AdminUserCommunicationService($repository->getConnection());
    }

    /**
     * Retorna uma thread de feedback com respostas associadas.
     *
     * @since 1.0.0
     */
    public function getThreadWithReplies(int $threadId): array
    {
        $this->validator->validateThreadId($threadId);

        $thread = $this->repository->findThreadById($threadId);
        if (!$thread) {
            throw new InvalidArgumentException('Conversa de suporte não encontrada.');
        }

        $replies = $this->repository->fetchRepliesByParentId($threadId);

        return [
            'thread' => $thread,
            'replies' => $replies,
        ];
    }

    /**
     * Lista as threads administrativas conforme filtros recebidos.
     *
     * @since 1.0.0
     */
    public function listThreads(array $filters): array
    {
        return [
            'items' => $this->repository->listThreads($filters),
        ];
    }

    /**
     * Lista apenas operadores administrativos aptos a receber suporte.
     *
     * @since 1.0.0
     */
    public function listSupportOperators(): array
    {
        return [
            'items' => $this->repository->listSupportOperators(),
        ];
    }

    /**
     * Atribui, reatribui ou remove o operador de uma thread de suporte.
     *
     * @since 1.0.0
     */
    public function assignThread(int $threadId, ?string $assignedTo): array
    {
        $this->validator->validateThreadId($threadId);
        $thread = $this->repository->findThreadById($threadId);
        if (!$thread || ($thread['parent_id'] ?? null) !== null) {
            throw new InvalidArgumentException('Somente a conversa principal pode ser atribuída.');
        }

        $type = strtolower(trim((string) ($thread['type'] ?? '')));
        if (in_array($type, ['platform-rating', 'other'], true)) {
            throw new InvalidArgumentException('Esta fila não aceita atribuição de suporte.');
        }

        $normalizedAssignee = $assignedTo !== null ? trim($assignedTo) : null;
        if ($normalizedAssignee === '') {
            $normalizedAssignee = null;
        }

        if ($normalizedAssignee !== null && !$this->repository->findSupportOperatorById($normalizedAssignee)) {
            throw new InvalidArgumentException('Operador de suporte inválido ou inativo.');
        }

        $db = $this->repository->getConnection();
        $db->beginTransaction();
        try {
            $result = $this->repository->updateAssignment($threadId, $normalizedAssignee);
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }

        return $result + [
            'assigned_user' => $normalizedAssignee !== null
                ? $this->repository->findSupportOperatorById($normalizedAssignee)
                : null,
        ];
    }

    /**
     * Atualiza o status de uma thread e dispara notificacao ao usuario.
     *
     * @since 1.0.0
     */
    public function updateFeedbackStatus(int $feedbackId, string $status): void
    {
        $this->validator->validateThreadId($feedbackId);
        $this->validator->validateStatus($status);

        $thread = $this->repository->findThreadById($feedbackId);
        if (!$thread) {
            throw new InvalidArgumentException('Conversa de suporte não encontrada.');
        }

        $this->repository->updateStatus($feedbackId, $status);

        if (in_array($status, ['read', 'resolved'], true)) {
            $this->communicationService->sendFeedbackStatusEmail($thread, $status);
        }
    }

    public function updateHomePublication(int $feedbackId, bool $published): void
    {
        $this->validator->validateThreadId($feedbackId);

        $thread = $this->repository->findThreadById($feedbackId);
        if (!$thread) {
            throw new InvalidArgumentException('Avaliação não encontrada.');
        }

        $isPlatformRating = trim((string) ($thread['type'] ?? '')) === 'platform-rating'
            || stripos((string) ($thread['reason'] ?? ''), 'Avaliar plataforma') === 0
            || (int) ($thread['public_rating'] ?? 0) > 0;

        if (!$isPlatformRating) {
            throw new InvalidArgumentException('Somente avaliações da plataforma podem ser publicadas na home.');
        }

        $this->repository->setHomePublication($feedbackId, $published);
    }

    /**
     * Registra uma resposta administrativa em uma thread de suporte.
     *
     * @since 1.0.0
     */
    public function replyToThread(string $adminUserId, int $parentId, string $details): array
    {
        $this->validator->validateReplyPayload($parentId, $details);

        $thread = $this->repository->findThreadById($parentId);
        if (!$thread) {
            throw new InvalidArgumentException('Conversa de suporte não encontrada.');
        }

        if ((string) ($thread['status'] ?? '') === 'resolved') {
            throw new InvalidArgumentException('Esta conversa já foi resolvida e não aceita novas respostas.');
        }

        $replyId = $this->repository->createReply(
            $adminUserId,
            $parentId,
            trim((string) ($thread['type'] ?? 'support')),
            'Resposta do suporte',
            $details
        );

        $this->repository->updateStatus($parentId, 'read');
        if (trim((string) ($thread['user_id'] ?? '')) !== $adminUserId) {
            $this->repository->notifyThreadOwnerReply($thread, $parentId);
        }
        $this->communicationService->sendFeedbackReplyEmail($thread, $details);

        return [
            'id' => $replyId,
            'parent_id' => $parentId,
            'status' => 'read',
        ];
    }
}
