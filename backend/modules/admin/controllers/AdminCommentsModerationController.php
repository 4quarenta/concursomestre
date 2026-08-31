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
 * Controller fino da moderacao unificada de comentarios.
 *
 * @since 1.0.0
 */
class AdminCommentsModerationController
{
    public function __construct(private readonly AdminCommentsModerationService $service)
    {
    }

    public function list(array $query): array
    {
        return $this->service->list($query);
    }

    public function update(array $payload, string $adminUserId): array
    {
        return $this->service->update($payload, $adminUserId);
    }

    public function bulkUpdate(array $payload, string $adminUserId): array
    {
        return $this->service->bulkUpdate($payload, $adminUserId);
    }

    public function export(array $query): array
    {
        return $this->service->export($query);
    }
}

