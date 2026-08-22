<?php

declare(strict_types=1);

final class PublicBlogTaxonomyProjection
{
    /** @return array<string,mixed> */
    public static function taxonomy(array $row, string $type, string $canonicalPath, array $readiness): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'type' => $type,
            'label' => trim((string) ($row['name'] ?? '')),
            'slug' => trim((string) ($row['slug'] ?? '')),
            'kind' => $type === 'tag' ? trim((string) ($row['kind'] ?? 'general')) : null,
            'description' => self::nullableText($row['description'] ?? null),
            'imageUrl' => self::safePublicAsset($row['image_url'] ?? null),
            'articleCount' => max(0, (int) ($row['article_count'] ?? 0)),
            'lastPublishedAt' => self::nullableText($row['last_published_at'] ?? null),
            'canonicalPath' => $canonicalPath,
            'readiness' => $readiness,
        ];
    }

    /** @return array<string,mixed> */
    public static function articleCard(array $article): array
    {
        $category = is_array($article['taxonomy']['category'] ?? null) ? $article['taxonomy']['category'] : [];
        $tags = is_array($article['taxonomy']['tags'] ?? null) ? $article['taxonomy']['tags'] : [];
        $author = is_array($article['author'] ?? null) ? $article['author'] : [];
        $engagement = is_array($article['engagement'] ?? null) ? $article['engagement'] : [];

        return [
            'id' => (int) ($article['id'] ?? 0),
            'title' => (string) ($article['title'] ?? ''),
            'slug' => (string) ($article['slug'] ?? ''),
            'excerpt' => (string) ($article['excerpt'] ?? ''),
            'readingMinutes' => max(1, (int) ($article['readingMinutes'] ?? 1)),
            'coverImageUrl' => self::safePublicAsset($article['coverImageUrl'] ?? null) ?? '',
            'coverImageAlt' => (string) ($article['coverImageAlt'] ?? ''),
            'featured' => (bool) ($article['featured'] ?? false),
            'publishedAt' => self::nullableText($article['publishedAt'] ?? null),
            'updatedAt' => self::nullableText($article['updatedAt'] ?? null),
            'taxonomy' => [
                'category' => self::taxonomyReference($category, false),
                'tags' => array_values(array_map(
                    static fn (array $tag): array => self::taxonomyReference($tag, true),
                    array_filter($tags, 'is_array')
                )),
            ],
            'author' => [
                'id' => (string) ($author['id'] ?? ''),
                'name' => (string) ($author['name'] ?? 'Equipe ConcursoMestre'),
                'avatarUrl' => self::safePublicAsset($author['avatarUrl'] ?? null),
                'role' => (string) ($author['role'] ?? 'author'),
            ],
            'engagement' => [
                'likesCount' => max(0, (int) ($engagement['likesCount'] ?? 0)),
                'commentsCount' => max(0, (int) ($engagement['commentsCount'] ?? 0)),
                'isLiked' => false,
            ],
        ];
    }

    /** @return array<string,mixed> */
    private static function taxonomyReference(array $row, bool $includeKind): array
    {
        $result = [
            'id' => isset($row['id']) ? (int) $row['id'] : null,
            'label' => (string) ($row['label'] ?? ''),
            'slug' => (string) ($row['slug'] ?? ''),
        ];
        if ($includeKind) $result['kind'] = (string) ($row['kind'] ?? 'general');
        return $result;
    }

    private static function nullableText(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));
        return $text === '' ? null : $text;
    }

    private static function safePublicAsset(mixed $value): ?string
    {
        $url = trim((string) ($value ?? ''));
        if ($url === '') return null;
        if (str_starts_with($url, '/uploads/') || str_starts_with($url, '/blog/')) return $url;
        if (filter_var($url, FILTER_VALIDATE_URL) === false) return null;
        $parts = parse_url($url);
        if (!is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https') return null;
        if (isset($parts['user']) || isset($parts['pass'])) return null;
        $host = trim(strtolower(rtrim((string) ($parts['host'] ?? ''), '.')), '[]');
        if ($host === '' || $host === 'localhost' || str_ends_with($host, '.localhost')
            || str_ends_with($host, '.local') || str_ends_with($host, '.internal') || ctype_digit($host)) return null;
        if (filter_var($host, FILTER_VALIDATE_IP) !== false
            && filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) return null;
        parse_str((string) ($parts['query'] ?? ''), $query);
        foreach (array_keys($query) as $key) {
            $normalizedKey = strtolower((string) $key);
            if (preg_match('/(?:^|[_-])(token|signature|sig|credential|secret|key)(?:$|[_-])/', $normalizedKey) === 1
                || str_starts_with($normalizedKey, 'x-amz-')) return null;
        }
        return $url;
    }
}
