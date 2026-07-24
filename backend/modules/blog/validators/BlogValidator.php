<?php

declare(strict_types=1);

final class BlogValidator
{
    public function validatePublicList(array $query): array
    {
        return [
            'limit' => max(1, min(30, (int) ($query['limit'] ?? 12))),
            'cursor' => $this->optionalString($query['cursor'] ?? null),
            'categorySlug' => $this->optionalString($query['category'] ?? null),
            'authorId' => $this->optionalString($query['author'] ?? null),
            'featured' => filter_var($query['featured'] ?? false, FILTER_VALIDATE_BOOL),
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
        $categoryId = isset($payload['categoryId']) && (int) $payload['categoryId'] > 0
            ? (int) $payload['categoryId']
            : null;
        $categoryName = trim((string) ($payload['categoryName'] ?? ''));
        $status = strtolower(trim((string) ($payload['status'] ?? 'draft')));
        $coverImageUrl = trim((string) ($payload['coverImageUrl'] ?? ''));
        $coverImageAlt = trim((string) ($payload['coverImageAlt'] ?? ''));

        if ($title === '' || mb_strlen($title) > 220) {
            throw new InvalidArgumentException('Informe um titulo com ate 220 caracteres.');
        }
        if ($slug === '') {
            throw new InvalidArgumentException('Nao foi possivel gerar o slug do artigo.');
        }
        if ($excerpt === '' || mb_strlen($excerpt) > 600) {
            throw new InvalidArgumentException('Informe um resumo com ate 600 caracteres.');
        }
        if ($bodyText === '') {
            throw new InvalidArgumentException('O conteudo do artigo e obrigatorio.');
        }
        if ($categoryId === null && $categoryName === '') {
            throw new InvalidArgumentException('Selecione ou crie uma categoria.');
        }
        if (!in_array($status, ['draft', 'scheduled', 'published', 'archived'], true)) {
            throw new InvalidArgumentException('Status editorial invalido.');
        }
        if (in_array($status, ['published', 'scheduled'], true) && ($coverImageUrl === '' || $coverImageAlt === '')) {
            throw new InvalidArgumentException('Imagem de capa e texto alternativo sao obrigatorios para publicar.');
        }
        if ($coverImageUrl !== '' && !$this->isAllowedAssetUrl($coverImageUrl)) {
            throw new InvalidArgumentException('URL da imagem de capa invalida.');
        }

        $scheduledAt = $this->normalizeDateTime($payload['scheduledAt'] ?? null);
        if ($status === 'scheduled' && $scheduledAt === null) {
            throw new InvalidArgumentException('Informe a data de agendamento.');
        }

        $tags = $payload['tags'] ?? [];
        if (is_string($tags)) {
            $tags = preg_split('/[\r\n,]+/', $tags) ?: [];
        }
        $normalizedTags = [];
        foreach (is_array($tags) ? $tags : [] as $tag) {
            $name = trim((string) (is_array($tag) ? ($tag['name'] ?? '') : $tag));
            if ($name !== '' && mb_strlen($name) <= 100) {
                $normalizedTags[mb_strtolower($name)] = $name;
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
            'categoryId' => $categoryId,
            'categoryName' => $categoryName,
            'coverImageUrl' => $coverImageUrl,
            'coverImageAlt' => $coverImageAlt,
            'status' => $status,
            'featured' => filter_var($payload['featured'] ?? false, FILTER_VALIDATE_BOOL),
            'allowComments' => !array_key_exists('allowComments', $payload)
                || filter_var($payload['allowComments'], FILTER_VALIDATE_BOOL),
            'sourceName' => $this->limitedOptionalString($payload['sourceName'] ?? null, 180),
            'sourceUrl' => $this->validatedOptionalUrl($payload['sourceUrl'] ?? null),
            'seoTitle' => $this->limitedOptionalString($payload['seoTitle'] ?? null, 180),
            'seoDescription' => $this->limitedOptionalString($payload['seoDescription'] ?? null, 320),
            'canonicalUrl' => $this->validatedOptionalUrl($payload['canonicalUrl'] ?? null),
            'scheduledAt' => $scheduledAt,
            'tags' => array_values($normalizedTags),
        ];
    }

    public function validateCategory(array $payload): array
    {
        $name = trim((string) ($payload['name'] ?? ''));
        if ($name === '' || mb_strlen($name) > 120) {
            throw new InvalidArgumentException('Informe o nome da categoria.');
        }

        return [
            'name' => $name,
            'slug' => $this->slugify((string) ($payload['slug'] ?? $name)),
            'description' => $this->limitedOptionalString($payload['description'] ?? null, 500),
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
            || str_starts_with($url, 'https://')
            || str_starts_with($url, 'http://');
    }

    private function optionalString(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));
        return $normalized !== '' ? $normalized : null;
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
