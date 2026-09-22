<?php

declare(strict_types=1);

final class ChangelogValidator
{
    private const ENTRY_STATUSES = ['draft', 'published', 'archived'];
    private const ENTRY_CHANNELS = ['WEB', 'APP', 'BOTH'];
    private const SUGGESTION_STATUSES = [
        'pending',
        'under_review',
        'approved',
        'planned',
        'in_progress',
        'completed',
        'declined',
    ];

    public function normalizeContentJson(mixed $rawValue): array
    {
        $decoded = is_array($rawValue)
            ? $rawValue
            : (is_string($rawValue) ? json_decode($rawValue, true) : []);
        if (!is_array($decoded)) {
            return [];
        }

        $sections = [];
        foreach ($decoded as $section) {
            if (!is_array($section)) {
                continue;
            }
            $title = trim((string) ($section['title'] ?? ''));
            $items = array_values(array_filter(array_map(
                static fn (mixed $item): string => trim((string) $item),
                is_array($section['items'] ?? null) ? $section['items'] : []
            )));
            if ($title === '' && $items === []) {
                continue;
            }
            $sections[] = [
                'title' => mb_substr($title ?: 'O que mudou', 0, 120),
                'icon' => mb_substr(trim((string) ($section['icon'] ?? 'Sparkles')), 0, 40),
                'items' => array_map(static fn (string $item): string => mb_substr($item, 0, 600), $items),
            ];
        }
        return $sections;
    }

    public function validatePublicList(array $query): array
    {
        $channel = strtoupper(trim((string) ($query['channel'] ?? 'WEB')));
        if (!in_array($channel, self::ENTRY_CHANNELS, true)) {
            throw new InvalidArgumentException('Canal de novidades invalido.');
        }
        return [
            'page' => max(1, (int) ($query['page'] ?? 1)),
            'limit' => max(1, min(20, (int) ($query['limit'] ?? 8))),
            'channel' => $channel,
        ];
    }

    public function validateAdminList(array $query): array
    {
        $status = strtolower(trim((string) ($query['status'] ?? '')));
        if ($status !== '' && !in_array($status, self::ENTRY_STATUSES, true)) {
            throw new InvalidArgumentException('Status editorial invalido.');
        }
        return [
            'page' => max(1, (int) ($query['page'] ?? 1)),
            'limit' => max(1, min(50, (int) ($query['limit'] ?? 20))),
            'status' => $status,
            'search' => mb_substr(trim((string) ($query['search'] ?? '')), 0, 160),
        ];
    }

    public function validateSave(array $payload): array
    {
        $id = (int) ($payload['id'] ?? 0);
        $title = trim((string) ($payload['title'] ?? ''));
        $description = trim((string) ($payload['description'] ?? ''));
        $slug = $this->slugify((string) ($payload['slug'] ?? $title));
        $status = strtolower(trim((string) ($payload['status'] ?? 'draft')));
        $channel = strtoupper(trim((string) ($payload['channel'] ?? 'BOTH')));
        $releaseDate = $this->normalizeDate((string) ($payload['releaseDate'] ?? $payload['release_date'] ?? ''));
        $content = $this->normalizeContentJson($payload['content'] ?? $payload['content_json'] ?? []);

        if ($title === '' || mb_strlen($title) > 180) {
            throw new InvalidArgumentException('Informe um titulo com ate 180 caracteres.');
        }
        if ($description === '' || mb_strlen($description) > 500) {
            throw new InvalidArgumentException('Informe uma mensagem curta com ate 500 caracteres.');
        }
        if ($slug === '') {
            throw new InvalidArgumentException('Nao foi possivel gerar o slug da novidade.');
        }
        if (!in_array($status, self::ENTRY_STATUSES, true)) {
            throw new InvalidArgumentException('Status editorial invalido.');
        }
        if (!in_array($channel, self::ENTRY_CHANNELS, true)) {
            throw new InvalidArgumentException('Canal de novidades invalido.');
        }
        if ($content === []) {
            throw new InvalidArgumentException('Adicione pelo menos uma mudanca.');
        }

        return [
            'id' => $id > 0 ? $id : null,
            'version' => mb_substr(trim((string) ($payload['version'] ?? '')), 0, 64),
            'slug' => $slug,
            'releaseDate' => $releaseDate,
            'title' => $title,
            'description' => $description,
            'content' => $content,
            'status' => $status,
            'channel' => $channel,
        ];
    }

    public function validateSuggestionList(array $query): array
    {
        $status = strtolower(trim((string) ($query['status'] ?? '')));
        if ($status !== '' && !in_array($status, self::SUGGESTION_STATUSES, true)) {
            throw new InvalidArgumentException('Status da sugestao invalido.');
        }
        return [
            'page' => max(1, (int) ($query['page'] ?? 1)),
            'limit' => max(1, min(50, (int) ($query['limit'] ?? 20))),
            'status' => $status,
            'search' => mb_substr(trim((string) ($query['search'] ?? '')), 0, 160),
        ];
    }

    public function validateSuggestionUpdate(array $payload): array
    {
        $id = (int) ($payload['id'] ?? 0);
        $status = strtolower(trim((string) ($payload['status'] ?? '')));
        if ($id <= 0) {
            throw new InvalidArgumentException('Sugestao invalida.');
        }
        if (!in_array($status, self::SUGGESTION_STATUSES, true)) {
            throw new InvalidArgumentException('Status da sugestao invalido.');
        }
        return [
            'id' => $id,
            'status' => $status,
            'adminNote' => mb_substr(trim((string) ($payload['adminNote'] ?? '')), 0, 2000),
            'changelogId' => max(0, (int) ($payload['changelogId'] ?? 0)) ?: null,
        ];
    }

    private function normalizeDate(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return date('Y-m-d');
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) {
            throw new InvalidArgumentException('Data de publicacao invalida.');
        }
        return $value;
    }

    private function slugify(string $value): string
    {
        $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', trim($value));
        $normalized = strtolower(is_string($converted) ? $converted : $value);
        $normalized = preg_replace('/[^a-z0-9]+/', '-', $normalized) ?? '';
        return substr(trim($normalized, '-'), 0, 190);
    }
}
