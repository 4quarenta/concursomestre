<?php

declare(strict_types=1);

final class BlogService
{
    public function __construct(
        private readonly BlogRepository $repository,
        private readonly BlogValidator $validator
    ) {
    }

    public function listPublic(array $query, ?array $viewer): array
    {
        return $this->repository->listPublic(
            $this->validator->validatePublicList($query),
            $this->userId($viewer)
        );
    }

    public function detailPublic(string $slug, ?array $viewer): array
    {
        $article = $this->repository->findPublicBySlug(trim($slug), $this->userId($viewer));
        if (!$article) {
            throw new OutOfBoundsException('Noticia nao encontrada.');
        }
        return $article;
    }

    public function categories(bool $publicOnly = true): array
    {
        return $this->repository->listCategories($publicOnly);
    }

    public function tags(bool $publicOnly = true): array
    {
        return $this->repository->listTags($publicOnly);
    }

    public function listAdmin(array $query): array
    {
        return $this->repository->listAdmin($this->validator->validateAdminList($query));
    }

    public function detailAdmin(int $id): array
    {
        $article = $this->repository->findAdminById($id);
        if (!$article) {
            throw new OutOfBoundsException('Artigo nao encontrado.');
        }
        return $article;
    }

    public function save(array $payload, array $actor): array
    {
        $article = $this->validator->validateSave($payload);
        $actorId = $this->userId($actor);
        if ($actorId === '') {
            throw new RuntimeException('Sessao administrativa invalida.');
        }
        if ($article['id'] && strtolower((string) ($actor['role'] ?? '')) === 'staff') {
            $existing = $this->repository->findAdminById((int) $article['id']);
            if (!$existing || (string) ($existing['author']['id'] ?? '') !== $actorId) {
                throw new DomainException('Staff pode editar apenas noticias de sua autoria.');
            }
        }
        $author = $this->repository->findAuthorIdentity($actorId);
        return $this->repository->save(
            $article,
            $actorId,
            trim((string) ($author['name'] ?? 'Equipe ConcursoMestre')) ?: 'Equipe ConcursoMestre',
            strtolower(trim((string) ($actor['role'] ?? $author['role'] ?? 'staff'))) ?: 'staff'
        );
    }

    public function archive(int $id, array $actor): void
    {
        if (strtolower((string) ($actor['role'] ?? '')) === 'staff') {
            $existing = $this->repository->findAdminById($id);
            if (!$existing || (string) ($existing['author']['id'] ?? '') !== $this->userId($actor)) {
                throw new DomainException('Staff pode arquivar apenas noticias de sua autoria.');
            }
        }
        if (!$this->repository->archive($id)) {
            throw new OutOfBoundsException('Artigo nao encontrado.');
        }
    }

    public function createCategory(array $payload, array $actor): array
    {
        return $this->repository->createCategory(
            $this->validator->validateCategory($payload),
            $this->userId($actor)
        );
    }

    public function createTag(array $payload, array $actor): array
    {
        return $this->repository->createTag(
            $this->validator->validateTag($payload),
            $this->userId($actor)
        );
    }

    public function toggleLike(int $articleId, array $viewer): array
    {
        if (!$this->repository->articleIsPublic($articleId)) {
            throw new OutOfBoundsException('Noticia nao encontrada.');
        }
        $userId = $this->userId($viewer);
        if ($userId === '') {
            throw new RuntimeException('Faca login para curtir esta noticia.');
        }
        return $this->repository->toggleLike($articleId, $userId);
    }

    private function userId(?array $payload): string
    {
        return trim((string) ($payload['user_id'] ?? ''));
    }
}
