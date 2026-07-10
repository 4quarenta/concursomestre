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
 * Validator oficial do dominio de comentarios.
 * Centraliza payloads e regras de entrada antes da camada de service.
 *
 * @since 1.0.0
 */
class CommentsValidator
{
    /**
     * Valida o target da listagem.
     *
     * @since 1.0.0
     */
    public function validateListQuery(array $query): array
    {
        $targetId = trim((string) ($query['target_id'] ?? $query['targetId'] ?? ''));
        $fallbackUserId = trim((string) ($query['user_id'] ?? $query['userId'] ?? ''));

        if ($targetId === '') {
            throw new InvalidArgumentException('target_id e obrigatorio.');
        }

        return [
            'targetId' => $targetId,
            'fallbackUserId' => $fallbackUserId !== '' ? $fallbackUserId : null,
        ];
    }

    /**
     * Valida o payload do endpoint handle e normaliza a action.
     *
     * @since 1.0.0
     */
    public function validateHandlePayload(array $payload): array
    {
        $action = trim((string) ($payload['action'] ?? ''));
        if (!in_array($action, ['add', 'like', 'delete'], true)) {
            throw new InvalidArgumentException('Acao de comentario invalida.');
        }

        return [
            'action' => $action,
            'payload' => $payload,
        ];
    }

    /**
     * Valida o payload de criacao de comentario.
     *
     * @since 1.0.0
     */
    public function validateAddPayload(array $payload): array
    {
        $commentPayload = isset($payload['comment']) && is_array($payload['comment'])
            ? $payload['comment']
            : $payload;

        $targetId = trim((string) (
            $payload['question_id']
            ?? $payload['questionId']
            ?? $commentPayload['question_id']
            ?? $commentPayload['questionId']
            ?? ''
        ));
        $content = trim((string) ($commentPayload['content'] ?? $commentPayload['text'] ?? ''));
        $parentId = trim((string) (
            $payload['parent_id']
            ?? $payload['parentId']
            ?? $commentPayload['parent_id']
            ?? $commentPayload['parentId']
            ?? ''
        ));
        $targetType = trim((string) ($payload['targetType'] ?? $commentPayload['targetType'] ?? 'question'));

        if ($targetId === '') {
            throw new InvalidArgumentException('question_id e obrigatorio.');
        }

        if ($content === '') {
            throw new InvalidArgumentException('content e obrigatorio.');
        }

        if (!in_array($targetType, ['question', 'material'], true)) {
            $targetType = 'question';
        }

        return [
            'targetId' => $targetId,
            'content' => $content,
            'parentId' => $parentId !== '' ? $parentId : null,
            'targetType' => $targetType,
        ];
    }

    /**
     * Valida curtida e exclusao que exigem o id do comentario.
     *
     * @since 1.0.0
     */
    public function validateCommentMutationPayload(array $payload): string
    {
        $commentId = trim((string) ($payload['commentId'] ?? $payload['comment_id'] ?? ''));
        if ($commentId === '') {
            throw new InvalidArgumentException('commentId e obrigatorio.');
        }

        return $commentId;
    }
}
