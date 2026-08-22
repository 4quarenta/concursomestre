<?php

declare(strict_types=1);

final class BlogValidator
{
    private const DEFAULT_COVER_IMAGE = '/blog/default-cover.webp';
    private const DEFAULT_COVER_ALT = 'Caderno de estudos e notícias do ConcursoMestre.';
    private const TAG_KINDS = [
        'general',
        'topic',
        'region',
        'state',
        'career',
        'organization',
        'exam_board',
    ];

    public function validatePublicList(array $query): array
    {
        return [
            'limit' => max(1, min(30, (int) ($query['limit'] ?? 12))),
            'cursor' => $this->limitedOptionalString($query['cursor'] ?? null, 4096),
            'categorySlug' => $this->optionalString($query['category'] ?? null),
            'tagSlug' => $this->optionalString($query['tag'] ?? null),
            'authorId' => $this->optionalString($query['author'] ?? null),
            'featured' => filter_var($query['featured'] ?? false, FILTER_VALIDATE_BOOL),
            'search' => $this->limitedOptionalString($query['search'] ?? $query['q'] ?? null, 160),
        ];
    }

    /** @return array{type:string,slug:string,cursor:?string,limit:int} */
    public function validatePublicTaxonomyArchive(array $query): array
    {
        $type = strtolower(trim((string) ($query['type'] ?? '')));
        $slug = trim((string) ($query['slug'] ?? ''));
        if (!in_array($type, ['category', 'tag'], true)) {
            throw new InvalidArgumentException('Tipo de taxonomia editorial invalido.');
        }
        if ($slug === '' || strlen($slug) > 140 || preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $slug) !== 1) {
            throw new InvalidArgumentException('Slug de taxonomia editorial invalido.');
        }
        return [
            'type' => $type,
            'slug' => $slug,
            'cursor' => $this->limitedOptionalString($query['cursor'] ?? null, 4096),
            'limit' => max(1, min(30, (int) ($query['limit'] ?? 24))),
        ];
    }

    public function validateAdminList(array $query): array
    {
        $status = $this->optionalString($query['status'] ?? null);
        if ($status !== null && !in_array($status, ['draft', 'scheduled', 'published', 'archived'], true)) {
            throw new InvalidArgumentException('Status editorial invalido.');
        }

        return [
            'limit' => max(1, min(50, (int) ($query['limit'] ?? 30))),
            'cursor' => $this->optionalString($query['cursor'] ?? null),
            'status' => $status,
            'search' => $this->optionalString($query['search'] ?? null),
        ];
    }

    public function validateSave(array $payload): array
    {
        $id = isset($payload['id']) && (int) $payload['id'] > 0 ? (int) $payload['id'] : null;
        $title = trim((string) ($payload['title'] ?? ''));
        $slug = $this->slugify((string) ($payload['slug'] ?? $title));
        $excerpt = trim((string) ($payload['excerpt'] ?? ''));
        $bodyHtml = $this->sanitizeHtml((string) ($payload['bodyHtml'] ?? $payload['body_html'] ?? ''));
        $bodyText = trim(html_entity_decode(strip_tags($bodyHtml), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $wordCount = count(preg_split('/\s+/u', $bodyText, -1, PREG_SPLIT_NO_EMPTY) ?: []);
        $taxonomy = is_array($payload['taxonomy'] ?? null) ? $payload['taxonomy'] : [];
        $category = $this->normalizeTaxonomyReference($taxonomy['category'] ?? null, 120);
        $status = strtolower(trim((string) ($payload['status'] ?? 'draft')));
        $coverImageUrl = trim((string) ($payload['coverImageUrl'] ?? '')) ?: self::DEFAULT_COVER_IMAGE;
        $coverImageAlt = trim((string) ($payload['coverImageAlt'] ?? '')) ?: self::DEFAULT_COVER_ALT;

        if ($title === '' || mb_strlen($title) > 220) {
            throw new InvalidArgumentException('Informe um titulo com ate 220 caracteres.');
        }
        if ($slug === '') {
            throw new InvalidArgumentException('Nao foi possivel gerar o slug do artigo.');
        }
        if ($bodyText === '') {
            throw new InvalidArgumentException('O conteudo do artigo e obrigatorio.');
        }
        if ($excerpt === '') {
            $excerpt = mb_substr($bodyText, 0, 600);
        }
        if (mb_strlen($excerpt) > 600) {
            throw new InvalidArgumentException('Informe um resumo com ate 600 caracteres.');
        }
        if ($category === null) {
            throw new InvalidArgumentException('Selecione ou crie uma categoria.');
        }
        if (!in_array($status, ['draft', 'scheduled', 'published', 'archived'], true)) {
            throw new InvalidArgumentException('Status editorial invalido.');
        }
        if (!$this->isAllowedAssetUrl($coverImageUrl)) {
            throw new InvalidArgumentException('URL da imagem de capa invalida.');
        }

        $scheduledAt = $this->normalizeDateTime($payload['scheduledAt'] ?? null);
        if ($status === 'scheduled' && $scheduledAt === null) {
            throw new InvalidArgumentException('Informe a data de agendamento.');
        }

        $normalizedTags = [];
        foreach (is_array($taxonomy['tags'] ?? null) ? $taxonomy['tags'] : [] as $tag) {
            $reference = $this->normalizeTagReference($tag);
            if ($reference !== null) {
                $normalizedTags[mb_strtolower($reference['label'])] = $reference;
            }
        }

        return [
            'id' => $id,
            'title' => $title,
            'slug' => $slug,
            'excerpt' => $excerpt,
            'bodyHtml' => $bodyHtml,
            'bodyText' => $bodyText,
            'readingMinutes' => max(1, (int) ceil($wordCount / 220)),
            'taxonomy' => [
                'category' => $category,
                'tags' => array_values($normalizedTags),
            ],
            'coverImageUrl' => $coverImageUrl,
            'coverImageAlt' => $coverImageAlt,
            'status' => $status,
            'featured' => filter_var($payload['featured'] ?? false, FILTER_VALIDATE_BOOL),
            'allowComments' => !array_key_exists('allowComments', $payload)
                || filter_var($payload['allowComments'], FILTER_VALIDATE_BOOL),
            'sourceName' => $this->limitedOptionalString($payload['sourceName'] ?? null, 180),
            'sourceUrl' => $this->validatedOptionalUrl($payload['sourceUrl'] ?? null),
            'seoTitle' => mb_substr($title, 0, 180),
            'seoDescription' => mb_substr($excerpt, 0, 320),
            'canonicalUrl' => null,
            'scheduledAt' => $scheduledAt,
            'tags' => array_values($normalizedTags),
        ];
    }

    public function validateCategory(array $payload): array
    {
        $name = trim((string) ($payload['label'] ?? ''));
        if ($name === '' || mb_strlen($name) > 120) {
            throw new InvalidArgumentException('Informe o nome da categoria.');
        }

        return [
            'name' => $name,
            'slug' => $this->slugify((string) ($payload['slug'] ?? $name)),
            'description' => $this->limitedOptionalString($payload['description'] ?? null, 500),
        ];
    }

    public function validateTag(array $payload): array
    {
        $reference = $this->normalizeTagReference($payload);
        if ($reference === null || $reference['label'] === '') {
            throw new InvalidArgumentException('Informe o nome da tag.');
        }

        return [
            'name' => $reference['label'],
            'slug' => $reference['slug'],
            'kind' => $reference['kind'],
            'description' => $this->limitedOptionalString($payload['description'] ?? null, 500),
            'imageUrl' => $this->validatedOptionalUrl($payload['imageUrl'] ?? $payload['image_url'] ?? null),
        ];
    }

    public function slugify(string $value): string
    {
        $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', trim($value));
        $normalized = strtolower(is_string($converted) ? $converted : $value);
        $normalized = preg_replace('/[^a-z0-9]+/', '-', $normalized) ?? '';
        return substr(trim($normalized, '-'), 0, 240);
    }

    private function sanitizeHtml(string $html): string
    {
        $html = preg_replace('#<(script|style|iframe|object|embed|form)[^>]*>.*?</\1>#is', '', $html) ?? '';
        $html = strip_tags(
            $html,
            '<p><br><h2><h3><h4><strong><b><em><i><u><blockquote><ul><ol><li><a><img><figure><figcaption><table><thead><tbody><tr><th><td><hr><code><pre>'
        );
        $html = preg_replace('/\son[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $html) ?? '';
        $html = preg_replace('/\sstyle\s*=\s*("[^"]*"|\'[^\']*\')/i', '', $html) ?? '';
        $html = preg_replace_callback(
            '/\s(href|src)\s*=\s*(["\'])(.*?)\2/i',
            static function (array $matches): string {
                $attribute = strtolower((string) $matches[1]);
                $value = trim((string) $matches[3]);
                if ($value === '' || preg_match('#^(javascript|data:text/html):#i', $value)) {
                    return '';
                }
                return ' ' . $attribute . '="' . htmlspecialchars($value, ENT_QUOTES, 'UTF-8') . '"';
            },
            $html
        ) ?? '';
        return trim($html);
    }

    private function isAllowedAssetUrl(string $url): bool
    {
        return str_starts_with($url, '/uploads/')
            || str_starts_with($url, '/blog/')
            || str_starts_with($url, 'https://')
            || str_starts_with($url, 'http://');
    }

    private function optionalString(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));
        return $normalized !== '' ? $normalized : null;
    }

    /** @return array{id:?int,label:string,slug:string}|null */
    private function normalizeTaxonomyReference(mixed $value, int $maxLabelLength): ?array
    {
        if (!is_array($value)) {
            return null;
        }
        $id = isset($value['id']) && (int) $value['id'] > 0 ? (int) $value['id'] : null;
        $label = trim((string) ($value['label'] ?? ''));
        if ($label === '' && $id === null) {
            return null;
        }
        if ($label !== '' && mb_strlen($label) > $maxLabelLength) {
            throw new InvalidArgumentException('Nome de taxonomia excede o limite permitido.');
        }
        return [
            'id' => $id,
            'label' => $label,
            'slug' => $this->slugify((string) ($value['slug'] ?? $label)),
        ];
    }

    /** @return array{id:?int,label:string,slug:string,kind:string}|null */
    private function normalizeTagReference(mixed $value): ?array
    {
        $reference = $this->normalizeTaxonomyReference($value, 100);
        if ($reference === null) {
            return null;
        }
        $kind = strtolower(trim((string) (is_array($value) ? ($value['kind'] ?? 'general') : 'general')));
        if (!in_array($kind, self::TAG_KINDS, true)) {
            throw new InvalidArgumentException('Tipo de tag editorial invalido.');
        }
        return [...$reference, 'kind' => $kind];
    }

    private function limitedOptionalString(mixed $value, int $max): ?string
    {
        $normalized = $this->optionalString($value);
        if ($normalized !== null && mb_strlen($normalized) > $max) {
            throw new InvalidArgumentException('Campo textual excede o limite permitido.');
        }
        return $normalized;
    }

    private function validatedOptionalUrl(mixed $value): ?string
    {
        $url = $this->optionalString($value);
        if ($url !== null && filter_var($url, FILTER_VALIDATE_URL) === false) {
            throw new InvalidArgumentException('URL invalida.');
        }
        return $url;
    }

    private function normalizeDateTime(mixed $value): ?string
    {
        $normalized = $this->optionalString($value);
        if ($normalized === null) {
            return null;
        }
        $timestamp = strtotime($normalized);
        if ($timestamp === false) {
            throw new InvalidArgumentException('Data e hora invalidas.');
        }
        return gmdate('Y-m-d H:i:s', $timestamp);
    }
}
