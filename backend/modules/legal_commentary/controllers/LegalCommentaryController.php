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

require_once __DIR__ . '/../services/LegalCommentaryService.php';

/**
 * Controller HTTP fino do modulo Lei Comentada.
 *
 * @since 1.0.0
 */
class LegalCommentaryController
{
    private LegalCommentaryService $service;

    public function __construct(LegalCommentaryService $service)
    {
        $this->service = $service;
    }

    public function home(?string $userId = null): array
    {
        return $this->service->home($userId);
    }

    public function search(string $query, ?string $userId = null): array
    {
        return $this->service->search($query, $userId);
    }

    public function detail(string $identifier, ?string $userId = null, bool $incrementAccess = false): array
    {
        return $this->service->detail($identifier, $userId, $incrementAccess);
    }

    public function detailOutline(string $identifier, ?string $userId = null): array
    {
        return $this->service->detailOutline($identifier, $userId);
    }

    public function toggleFavorite(string $userId, array $payload, string $userRole = ''): array
    {
        return $this->service->toggleFavorite(
            $userId,
            (string) ($payload['type'] ?? ''),
            (string) ($payload['targetId'] ?? ''),
            $userRole
        );
    }

    public function recordProgress(string $userId, array $payload): array
    {
        return $this->service->recordProgress($userId, $payload);
    }

    public function handleNote(string $userId, string $method, array $payload): array
    {
        if (strtoupper($method) === 'GET') {
            return $this->service->listUserNotes($userId);
        }

        if (!empty($payload['delete']) || (string) ($payload['action'] ?? '') === 'delete') {
            return $this->service->deleteUserNote($userId, $payload);
        }

        return $this->service->saveUserNote($userId, $payload);
    }

    public function handleReaderAnnotation(string $userId, string $method, array $payload): array
    {
        if (strtoupper($method) === 'GET') {
            return $this->service->getReaderAnnotation($userId, $payload);
        }

        if (!empty($payload['delete']) || (string) ($payload['action'] ?? '') === 'delete') {
            return $this->service->deleteReaderAnnotation($userId, $payload);
        }

        return $this->service->saveReaderAnnotation($userId, $payload);
    }

    public function handleComment(string $userId, string $userName, array $payload, string $userRole = ''): array
    {
        $action = (string) ($payload['action'] ?? 'create');

        if ($action === 'update') {
            return $this->service->updateComment($userId, $payload);
        }

        if ($action === 'delete') {
            $this->service->deleteComment($userId, $payload);
            return ['deleted' => true];
        }

        if ($action === 'report') {
            return $this->service->reportComment($userId, $payload);
        }

        if ($action === 'react') {
            return $this->service->reactToContent($userId, $payload);
        }

        return $this->service->createComment($userId, $userName, $payload, $userRole);
    }

    public function adminList(array $query = []): array
    {
        return $this->service->adminList($query);
    }

    public function adminDetail(?string $identifier = null): array
    {
        if (!$identifier || $identifier === 'new') {
            return $this->service->adminNew();
        }

        return $this->service->adminDetail($identifier);
    }

    public function adminSave(array $payload): array
    {
        return $this->service->adminSave($payload);
    }

    public function adminDelete(int $lawId, string $adminUserId = '', string $adminRole = ''): array
    {
        $this->service->adminDelete($lawId, $adminUserId, $adminRole);
        return ['deleted' => true];
    }

    public function adminGenerateEditorial(array $payload): array
    {
        return $this->service->adminGenerateEditorial($payload);
    }

    public function adminStartBatch(int $lawId, array $articleIds = [], ?string $adminUserId = null): array
    {
        return $this->service->adminStartBatch($lawId, $articleIds, $adminUserId);
    }

    public function adminBatchStatus(int $runId, ?int $lawId = null): array
    {
        return $this->service->adminBatchStatus($runId, $lawId);
    }

    public function adminRetryBatch(int $runId, ?string $adminUserId = null): array
    {
        return $this->service->adminRetryBatch($runId, $adminUserId);
    }

    public function adminStopBatch(int $runId): array
    {
        return $this->service->adminStopBatch($runId);
    }
}
