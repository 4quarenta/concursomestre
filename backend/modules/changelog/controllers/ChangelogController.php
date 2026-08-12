<?php

declare(strict_types=1);

require_once __DIR__ . '/../services/ChangelogService.php';

final class ChangelogController
{
    public function __construct(private readonly ChangelogService $service)
    {
    }

    public function listPublic(array $query): array
    {
        return $this->service->listPublic($query);
    }

    public function listAdmin(array $query): array
    {
        return $this->service->listAdmin($query);
    }

    public function detailAdmin(int $id): array
    {
        return $this->service->detailAdmin($id);
    }

    public function save(array $payload, array $actor): array
    {
        return $this->service->save($payload, $actor);
    }

    public function archive(int $id, array $actor): void
    {
        $this->service->archive($id, $actor);
    }

    public function listSuggestions(array $query): array
    {
        return $this->service->listSuggestions($query);
    }

    public function updateSuggestion(array $payload, array $actor): array
    {
        return $this->service->updateSuggestion($payload, $actor);
    }
}
