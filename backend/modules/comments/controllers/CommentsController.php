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
 * Controller fino do dominio de comentarios.
 *
 * @since 1.0.0
 */
class CommentsController
{
    /**
     * Inicializa o controller de comentarios.
     *
     * @since 1.0.0
     */
    public function __construct(private readonly CommentsService $service)
    {
    }

    /**
     * Encaminha a listagem de comentarios.
     *
     * @since 1.0.0
     */
    public function listComments(array $query, ?array $authenticatedUserPayload): array
    {
        return $this->service->listComments($query, $authenticatedUserPayload);
    }

    /**
     * Encaminha a criacao de comentario.
     *
     * @since 1.0.0
     */
    public function addComment(array $payload, array $authenticatedUserPayload): array
    {
        return $this->service->addComment($payload, $authenticatedUserPayload);
    }

    /**
     * Encaminha o toggle de curtida.
     *
     * @since 1.0.0
     */
    public function toggleLike(array $payload, array $authenticatedUserPayload): array
    {
        return $this->service->toggleLike($payload, $authenticatedUserPayload);
    }

    /**
     * Encaminha a exclusao do comentario.
     *
     * @since 1.0.0
     */
    public function deleteComment(array $payload, array $authenticatedUserPayload): array
    {
        return $this->service->deleteComment($payload, $authenticatedUserPayload);
    }
}
