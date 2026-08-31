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

require_once __DIR__ . '/../repositories/AdminCommentsModerationRepository.php';
require_once __DIR__ . '/../validators/AdminCommentsModerationValidator.php';

/**
 * Service da moderacao unificada de comentarios.
 *
 * @since 1.0.0
 */
class AdminCommentsModerationService
{
    public function __construct(
        private readonly AdminCommentsModerationRepository $repository,
        private readonly AdminCommentsModerationValidator $validator
    ) {
    }

    public function list(array $query): array
    {
        return $this->repository->listItems($this->validator->validateFilters($query));
    }

    public function update(array $payload, string $adminUserId): array
    {
        $normalized = $this->validator->validateUpdatePayload($payload);
        return $this->repository->updateModerationStatus($normalized['id'], $normalized['status'], $adminUserId);
    }

    public function bulkUpdate(array $payload, string $adminUserId): array
    {
        $normalized = $this->validator->validateBulkPayload($payload);
        return $this->repository->bulkUpdateModerationStatus($normalized['ids'], $normalized['status'], $adminUserId);
    }

    public function export(array $query): array
    {
        return $this->repository->exportItems($this->validator->validateFilters($query));
    }
}

