<?php

declare(strict_types=1);

final class BlogController
{
    public function __construct(private readonly BlogService $service)
    {
    }

    public function listPublic(array $query, ?array $viewer): array { return $this->service->listPublic($query, $viewer); }
    public function detailPublic(string $slug, ?array $viewer): array { return $this->service->detailPublic($slug, $viewer); }
    public function categories(bool $publicOnly = true): array { return $this->service->categories($publicOnly); }
    public function tags(bool $publicOnly = true): array { return $this->service->tags($publicOnly); }
    public function taxonomyArchive(array $query): array { return $this->service->taxonomyArchive($query); }
    public function listAdmin(array $query): array { return $this->service->listAdmin($query); }
    public function detailAdmin(int $id): array { return $this->service->detailAdmin($id); }
    public function save(array $payload, array $actor): array { return $this->service->save($payload, $actor); }
    public function archive(int $id, array $actor): void { $this->service->archive($id, $actor); }
    public function createCategory(array $payload, array $actor): array { return $this->service->createCategory($payload, $actor); }
    public function createTag(array $payload, array $actor): array { return $this->service->createTag($payload, $actor); }
    public function toggleLike(int $articleId, array $viewer): array { return $this->service->toggleLike($articleId, $viewer); }
}
