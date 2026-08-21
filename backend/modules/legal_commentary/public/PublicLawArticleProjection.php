<?php

declare(strict_types=1);

final class PublicLawArticleProjection
{
    /** @return array<string,mixed> */
    public static function detail(array $data): array
    {
        $row = is_array($data['article'] ?? null) ? $data['article'] : [];
        return [
            'law' => [
                'id' => (int) ($row['law_id'] ?? 0),
                'slug' => (string) ($row['law_slug'] ?? ''),
                'title' => self::plain($row['law_title'] ?? ''),
                'shortTitle' => self::nullablePlain($row['law_short_title'] ?? null),
                'number' => self::nullablePlain($row['law_number'] ?? null),
                'year' => self::nullablePlain($row['law_year'] ?? null),
                'status' => (string) ($row['law_status'] ?? ''),
                'officialUrl' => self::safePublicUrl($row['law_official_url'] ?? null),
                'sourceName' => self::nullablePlain($row['law_source_name'] ?? null),
                'updatedAt' => self::nullablePlain($row['law_updated_at'] ?? null),
            ],
            'article' => [
                'id' => (int) ($row['article_id'] ?? 0),
                'lawId' => (int) ($row['law_id'] ?? 0),
                'sectionId' => self::nullableInt($row['section_id'] ?? null),
                'slug' => (string) ($row['article_slug'] ?? ''),
                'number' => self::plain($row['article_number'] ?? ''),
                'title' => self::nullablePlain($row['article_title'] ?? null),
                'officialText' => self::plain($row['official_text'] ?? ''),
                'officialStatus' => (string) ($row['article_status'] ?? 'active'),
                'officialAnchor' => self::nullablePlain($row['official_anchor'] ?? null),
                'updatedAt' => self::nullablePlain($row['article_updated_at'] ?? null),
                'blocks' => self::blocks($data['blocks'] ?? []),
            ],
            'section' => self::section($row),
            'navigation' => [
                'previous' => self::navigation($data['previous'] ?? null),
                'next' => self::navigation($data['next'] ?? null),
            ],
            'canonicalPath' => (string) ($data['canonicalPath'] ?? ''),
            'breadcrumbs' => self::breadcrumbs($data['breadcrumbs'] ?? []),
            'readiness' => is_array($data['readiness'] ?? null)
                ? $data['readiness']
                : ['status' => 'NOT_READY', 'reasonCodes' => ['instance_readiness.not_evaluated']],
            'editorial' => [
                'commentaryAvailable' => false,
                'protectedContentIncluded' => false,
            ],
        ];
    }

    /** @return list<array<string,mixed>> */
    private static function blocks(mixed $rows): array
    {
        if (!is_array($rows)) return [];
        $result = [];
        foreach ($rows as $row) {
            if (!is_array($row)) continue;
            $text = self::plain($row['text'] ?? '');
            if ($text === '') continue;
            $result[] = [
                'id' => (int) ($row['id'] ?? 0),
                'uid' => (string) ($row['block_uid'] ?? ''),
                'kind' => (string) ($row['kind'] ?? 'paragraph'),
                'label' => self::nullablePlain($row['label'] ?? null),
                'text' => $text,
                'parentUid' => self::nullablePlain($row['parent_block_uid'] ?? null),
                'anchor' => self::nullablePlain($row['anchor'] ?? null),
                'sortOrder' => (int) ($row['sort_order'] ?? 0),
            ];
        }
        return $result;
    }

    /** @return array<string,mixed>|null */
    private static function navigation(mixed $row): ?array
    {
        if (!is_array($row)) return null;
        return [
            'slug' => (string) ($row['slug'] ?? ''),
            'number' => self::plain($row['article_number'] ?? ''),
            'title' => self::nullablePlain($row['title'] ?? null),
            'path' => (string) ($row['path'] ?? ''),
        ];
    }

    /** @return array<string,mixed>|null */
    private static function section(array $row): ?array
    {
        if ((int) ($row['section_id'] ?? 0) <= 0) return null;
        return [
            'id' => (int) $row['section_id'],
            'title' => self::nullablePlain($row['section_display_title'] ?? null),
            'titleLabel' => self::nullablePlain($row['section_title_label'] ?? null),
            'titleName' => self::nullablePlain($row['section_title_name'] ?? null),
            'chapterLabel' => self::nullablePlain($row['section_chapter_label'] ?? null),
            'chapterName' => self::nullablePlain($row['section_chapter_name'] ?? null),
        ];
    }

    /** @return list<array{label:string,path:string}> */
    private static function breadcrumbs(mixed $rows): array
    {
        if (!is_array($rows)) return [];
        $result = [];
        foreach ($rows as $row) {
            if (!is_array($row)) continue;
            $label = self::plain($row['label'] ?? '');
            $path = trim((string) ($row['path'] ?? ''));
            if ($label !== '' && str_starts_with($path, '/')) $result[] = ['label' => $label, 'path' => $path];
        }
        return $result;
    }

    private static function plain(mixed $value): string
    {
        $text = html_entity_decode(strip_tags((string) ($value ?? '')), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/[\x{0000}-\x{0008}\x{000B}\x{000C}\x{000E}-\x{001F}\x{007F}]/u', ' ', $text) ?? '';
        $text = preg_replace('/[ \t]+/u', ' ', $text) ?? '';
        $text = preg_replace('/\R{3,}/u', "\n\n", $text) ?? '';
        return trim($text);
    }

    private static function nullablePlain(mixed $value): ?string
    {
        $text = self::plain($value);
        return $text === '' ? null : $text;
    }

    private static function nullableInt(mixed $value): ?int
    {
        return $value === null || $value === '' ? null : (int) $value;
    }

    private static function safePublicUrl(mixed $value): ?string
    {
        $url = trim((string) ($value ?? ''));
        if ($url === '' || filter_var($url, FILTER_VALIDATE_URL) === false) return null;
        $parts = parse_url($url);
        if (!is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https'
            || isset($parts['user']) || isset($parts['pass'])) return null;
        $host = strtolower((string) ($parts['host'] ?? ''));
        if ($host === '' || $host === 'localhost' || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) return null;
        if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false
            && filter_var($host, FILTER_VALIDATE_IP) !== false) return null;
        $query = strtolower((string) ($parts['query'] ?? ''));
        if (preg_match('/(?:token|signature|x-amz-|credential|key)=/', $query) === 1) return null;
        return $url;
    }

    private function __construct() {}
}
