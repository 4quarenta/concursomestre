<?php

declare(strict_types=1);

require_once __DIR__ . '/../repositories/ChangelogRepository.php';
require_once __DIR__ . '/../validators/ChangelogValidator.php';

final class ChangelogService
{
    public function __construct(
        private readonly ChangelogRepository $repository,
        private readonly ChangelogValidator $validator
    ) {
    }

    public function listPublic(array $query): array
    {
        return $this->mapPage($this->repository->listPublic($this->validator->validatePublicList($query)));
    }

    public function listAdmin(array $query): array
    {
        return $this->mapPage($this->repository->listAdmin($this->validator->validateAdminList($query)));
    }

    public function detailAdmin(int $id): array
    {
        if ($id <= 0) {
            throw new InvalidArgumentException('Novidade invalida.');
        }
        $entry = $this->repository->findById($id);
        if (!$entry) {
            throw new OutOfBoundsException('Novidade nao encontrada.');
        }
        return $this->mapEntry($entry);
    }

    public function save(array $payload, array $actor): array
    {
        $actorId = trim((string) ($actor['user_id'] ?? $actor['id'] ?? ''));
        if ($actorId === '') {
            throw new RuntimeException('Sessao administrativa invalida.');
        }
        return $this->mapEntry($this->repository->save($this->validator->validateSave($payload), $actorId));
    }

    public function archive(int $id, array $actor): void
    {
        $actorId = trim((string) ($actor['user_id'] ?? $actor['id'] ?? ''));
        if ($id <= 0 || $actorId === '') {
            throw new InvalidArgumentException('Novidade invalida.');
        }
        if (!$this->repository->archive($id, $actorId)) {
            throw new OutOfBoundsException('Novidade nao encontrada.');
        }
    }

    public function listSuggestions(array $query): array
    {
        $page = $this->repository->listSuggestions($this->validator->validateSuggestionList($query));
        $page['items'] = array_map([$this, 'mapSuggestion'], $page['items'] ?? []);
        return $page;
    }

    public function updateSuggestion(array $payload, array $actor): array
    {
        $actorId = trim((string) ($actor['user_id'] ?? $actor['id'] ?? ''));
        if ($actorId === '') {
            throw new RuntimeException('Sessao administrativa invalida.');
        }
        $suggestion = $this->repository->updateSuggestion(
            $this->validator->validateSuggestionUpdate($payload),
            $actorId
        );
        if (!$suggestion) {
            throw new OutOfBoundsException('Sugestao nao encontrada.');
        }
        return $this->mapSuggestion($suggestion);
    }

    private function mapPage(array $page): array
    {
        $page['items'] = array_map([$this, 'mapEntry'], $page['items'] ?? []);
        return $page;
    }

    private function mapEntry(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'version' => trim((string) ($row['version'] ?? '')),
            'slug' => trim((string) ($row['slug'] ?? '')),
            'releaseDate' => (string) ($row['release_date'] ?? ''),
            'publishedAt' => $row['published_at'] ?? null,
            'title' => trim((string) ($row['title'] ?? '')),
            'description' => trim((string) ($row['description'] ?? '')),
            'content' => $this->validator->normalizeContentJson($row['content_json'] ?? null),
            'status' => trim((string) ($row['status'] ?? 'published')),
            'createdAt' => $row['created_at'] ?? null,
            'updatedAt' => $row['updated_at'] ?? null,
            'createdBy' => [
                'id' => $row['created_by'] ?? null,
                'name' => $row['creator_name'] ?? null,
            ],
            'updatedBy' => [
                'id' => $row['updated_by'] ?? null,
                'name' => $row['updater_name'] ?? null,
            ],
        ];
    }

    private function mapSuggestion(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'title' => trim((string) ($row['reason'] ?? '')),
            'details' => trim((string) ($row['details'] ?? '')),
            'supportStatus' => trim((string) ($row['support_status'] ?? 'new')),
            'status' => trim((string) ($row['suggestion_status'] ?? 'pending')),
            'platformVersion' => trim((string) ($row['platform_version'] ?? '1.0.0')) ?: '1.0.0',
            'adminNote' => $row['suggestion_admin_note'] ?? null,
            'changelogId' => isset($row['suggestion_changelog_id']) ? (int) $row['suggestion_changelog_id'] : null,
            'changelogTitle' => $row['changelog_title'] ?? null,
            'likes' => (int) ($row['likes'] ?? 0),
            'dislikes' => (int) ($row['dislikes'] ?? 0),
            'createdAt' => $row['created_at'] ?? null,
            'updatedAt' => $row['updated_at'] ?? null,
            'reviewedAt' => $row['suggestion_reviewed_at'] ?? null,
            'user' => [
                'id' => $row['user_id'] ?? null,
                'name' => $row['user_name'] ?? null,
                'email' => $row['user_email'] ?? null,
            ],
        ];
    }
}
