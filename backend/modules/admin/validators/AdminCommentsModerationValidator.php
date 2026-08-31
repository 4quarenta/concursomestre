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
 * Validador da moderacao unificada de comentarios.
 *
 * @since 1.0.0
 */
class AdminCommentsModerationValidator
{
    private const FILTER_STATUSES = ['all', 'pending', 'approved', 'spam', 'trash'];
    private const MUTATION_STATUSES = ['pending', 'approved', 'spam', 'trash'];

    /**
     * Valida filtros da caixa de comentarios no formato de status do admin WordPress-like.
     *
     * @since 1.0.0
     */
    public function validateFilters(array $query): array
    {
        $status = strtolower(trim((string) ($query['status'] ?? 'pending')));
        $search = trim((string) ($query['search'] ?? ''));
        $origin = strtolower(trim((string) ($query['origin'] ?? 'all')));
        $page = max(1, (int) ($query['page'] ?? 1));
        $perPage = max(1, min(100, (int) ($query['perPage'] ?? $query['per_page'] ?? 30)));

        if (!in_array($status, self::FILTER_STATUSES, true)) {
            $status = 'pending';
        }

        if (!in_array($origin, ['all', 'question', 'material', 'law'], true)) {
            $origin = 'all';
        }

        return [
            'status' => $status,
            'search' => $search,
            'origin' => $origin,
            'page' => $page,
            'perPage' => $perPage,
        ];
    }

    public function validateUpdatePayload(array $payload): array
    {
        $id = trim((string) ($payload['id'] ?? ''));
        $status = strtolower(trim((string) ($payload['status'] ?? '')));

        if ($id === '') {
            throw new InvalidArgumentException('Identificador do comentario e obrigatorio.');
        }

        if (!in_array($status, self::MUTATION_STATUSES, true)) {
            throw new InvalidArgumentException('Status de moderacao invalido.');
        }

        return [
            'id' => $id,
            'status' => $status,
        ];
    }

    public function validateBulkPayload(array $payload): array
    {
        $status = strtolower(trim((string) ($payload['status'] ?? '')));
        $ids = $payload['ids'] ?? [];

        if (!in_array($status, self::MUTATION_STATUSES, true)) {
            throw new InvalidArgumentException('Status de moderacao invalido.');
        }

        if (!is_array($ids) || $ids === []) {
            throw new InvalidArgumentException('Selecione ao menos um comentario.');
        }

        $normalizedIds = array_values(array_filter(array_map(
            static fn ($value) => trim((string) $value),
            $ids
        )));

        if ($normalizedIds === []) {
            throw new InvalidArgumentException('Selecione ao menos um comentario.');
        }

        return [
            'ids' => $normalizedIds,
            'status' => $status,
        ];
    }
}
