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

require_once __DIR__ . '/../services/AdminFeedbackService.php';

/**
 * Controller HTTP do fluxo administrativo de feedback.
 * Delega a regra de negocio ao servico e mantem a borda do caso de uso enxuta.
 */
class AdminFeedbackController
{
    private AdminFeedbackService $service;

    /**
     * Inicializa o controller com o servico de feedback administrativo.
     *
     * @since 1.0.0
     */
    public function __construct(AdminFeedbackService $service)
    {
        $this->service = $service;
    }

    /**
     * Retorna uma thread de feedback com respostas.
     *
     * @since 1.0.0
     */
    public function showThread(int $threadId): array
    {
        return $this->service->getThreadWithReplies($threadId);
    }

    /**
     * Lista threads de feedback conforme filtros enviados.
     *
     * @since 1.0.0
     */
    public function listThreads(array $filters): array
    {
        return $this->service->listThreads($filters);
    }

    public function listSupportOperators(): array
    {
        return $this->service->listSupportOperators();
    }

    public function assignThread(int $threadId, ?string $assignedTo): array
    {
        return $this->service->assignThread($threadId, $assignedTo);
    }

    /**
     * Atualiza o status de um feedback.
     *
     * @since 1.0.0
     */
    public function updateStatus(int $feedbackId, string $status): void
    {
        $this->service->updateFeedbackStatus($feedbackId, $status);
    }

    public function updateHomePublication(int $feedbackId, bool $published): void
    {
        $this->service->updateHomePublication($feedbackId, $published);
    }

    /**
     * Registra uma resposta administrativa em uma thread.
     *
     * @since 1.0.0
     */
    public function replyToThread(string $adminUserId, int $parentId, string $details): array
    {
        return $this->service->replyToThread($adminUserId, $parentId, $details);
    }
}
