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
 * Validador do fluxo administrativo de feedback.
 * Mantem os contratos de entrada explicitos e reutilizaveis.
 */
class AdminFeedbackValidator
{
    /**
     * Garante que o id da conversa de feedback e valido.
     *
     * @since 1.0.0
     */
    public function validateThreadId(int $threadId): void
    {
        if ($threadId <= 0) {
            throw new InvalidArgumentException('Conversa de feedback invalida.');
        }
    }

    /**
     * Garante que o status informado e suportado pelo fluxo.
     *
     * @since 1.0.0
     */
    public function validateStatus(string $status): void
    {
        if (!in_array($status, ['new', 'read', 'resolved'], true)) {
            throw new InvalidArgumentException('Status de feedback invalido.');
        }
    }

    /**
     * Valida o payload de resposta administrativa em uma conversa.
     *
     * @since 1.0.0
     */
    public function validateReplyPayload(int $parentId, string $details): void
    {
        $this->validateThreadId($parentId);

        if (trim($details) === '') {
            throw new InvalidArgumentException('A resposta administrativa nao pode ficar vazia.');
        }

        if (mb_strlen($details) > 5000) {
            throw new InvalidArgumentException('A resposta administrativa excede o limite permitido.');
        }
    }
}
