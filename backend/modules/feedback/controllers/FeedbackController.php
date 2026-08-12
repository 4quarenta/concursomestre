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
 * Controller fino do dominio de feedback publico.
 * Mantem a borda HTTP enxuta e delega a regra ao service.
 *
 * @since 1.0.0
 */
class FeedbackController
{
    /**
     * Inicializa o controller de feedback.
     *
     * @since 1.0.0
     */
    public function __construct(private readonly FeedbackService $service)
    {
    }

    /**
     * Lista as threads do usuario autenticado.
     *
     * @since 1.0.0
     */
    public function listThreads(array $authenticatedUserPayload): array
    {
        return $this->service->listThreads($authenticatedUserPayload);
    }

    /**
     * Lista sugestoes publicas para votacao.
     *
     * @since 1.0.0
     */
    public function listPublicSuggestions(?array $authenticatedUserPayload, int $limit = 80): array
    {
        return $this->service->listPublicSuggestions($authenticatedUserPayload, $limit);
    }

    /**
     * Registra voto em uma sugestao publica.
     *
     * @since 1.0.0
     */
    public function votePublicSuggestion(array $payload, array $authenticatedUserPayload): array
    {
        return $this->service->votePublicSuggestion($payload, $authenticatedUserPayload);
    }

    /**
     * Lista as respostas de uma thread especifica.
     *
     * @since 1.0.0
     */
    public function listReplies(int $threadId, array $authenticatedUserPayload): array
    {
        return $this->service->listReplies($threadId, $authenticatedUserPayload);
    }

    /**
     * Cria uma nova thread ou uma nova resposta do usuario.
     *
     * @since 1.0.0
     */
    public function createEntry(array $payload, array $authenticatedUserPayload): array
    {
        return $this->service->createEntry($payload, $authenticatedUserPayload);
    }

    /**
     * Lista depoimentos aprovados para exibicao publica.
     *
     * @since 1.0.0
     */
    public function listPublishedTestimonials(int $limit = 9): array
    {
        return $this->service->listPublishedTestimonials($limit);
    }
}
