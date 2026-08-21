<?php

declare(strict_types=1);

require_once __DIR__ . '/PublicMaterialReadiness.php';

final class PublicMaterialProjection
{
    /** @return array<string,mixed> */
    public static function summary(array $row): array
    {
        $amountMinor = PublicMaterialReadiness::minorUnits($row['price_decimal'] ?? $row['price'] ?? null);
        $availability = (string) ($row['availability_status'] ?? 'not_for_sale');
        $isFree = (int) ($row['is_free'] ?? 0) === 1;
        $currency = self::currency($row['currency'] ?? null);
        $freeOffer = $isFree && ($amountMinor === null || $amountMinor === 0);
        $paidOffer = !$isFree && $amountMinor !== null && $amountMinor > 0 && $currency === 'BRL';
        $mode = match (true) {
            $availability === 'included_in_plan' => 'included_in_plan',
            $availability === 'available' && $freeOffer => 'free',
            $availability === 'available' && $paidOffer => 'paid',
            $availability === 'unavailable' => 'unavailable',
            default => 'not_for_sale',
        };
        return [
            'id' => (string) ($row['id'] ?? ''),
            'slug' => (string) ($row['slug'] ?? ''),
            'title' => (string) ($row['title'] ?? ''),
            'description' => self::nullableText($row['description'] ?? null),
            'format' => self::nullableText($row['type'] ?? null),
            'pageCount' => self::nullableInt($row['page_count'] ?? $row['pageCount'] ?? null),
            'year' => self::nullableInt($row['year'] ?? null),
            'publicAuthorName' => self::nullableText($row['public_author_name'] ?? $row['publicAuthorName'] ?? null),
            'coverUrl' => (int) ($row['cover_is_public'] ?? 0) === 1 ? self::safePublicUrl($row['cover_url'] ?? null) : null,
            'previewUrl' => (int) ($row['preview_is_public'] ?? 0) === 1 ? self::safePublicUrl($row['preview_url'] ?? null) : null,
            'hasAsset' => (int) ($row['has_asset'] ?? $row['hasAsset'] ?? 0) === 1,
            'offer' => [
                'mode' => $mode,
                'amountMinor' => $mode === 'paid' ? $amountMinor : null,
                'currency' => $mode === 'paid' ? $currency : null,
                'available' => in_array($mode, ['free', 'paid', 'included_in_plan'], true),
            ],
            'path' => (string) ($row['path'] ?? ''),
            'updatedAt' => self::nullableText($row['updated_at'] ?? $row['updatedAt'] ?? null),
        ];
    }

    /** @return array<string,mixed> */
    public static function detail(array $data): array
    {
        return self::summary(($data['material'] ?? []) + ['path' => $data['canonicalPath'] ?? '']) + [
            'canonicalPath' => (string) ($data['canonicalPath'] ?? ''),
            'marketplacePath' => '/marketplace',
            'taxonomies' => self::allowedRows($data['taxonomies'] ?? [], ['id', 'slug', 'name', 'relationType', 'path']),
            'breadcrumbs' => self::allowedRows($data['breadcrumbs'] ?? [], ['label', 'canonicalPath']),
            'readiness' => is_array($data['readiness'] ?? null)
                ? $data['readiness'] : ['status' => 'NOT_READY', 'reasonCodes' => ['instance_readiness.not_evaluated']],
            'listingReadiness' => is_array($data['listingReadiness'] ?? null)
                ? $data['listingReadiness'] : ['status' => 'NOT_READY', 'reasonCodes' => ['instance_readiness.not_evaluated']],
        ];
    }

    /** @return list<array<string,mixed>> */
    private static function allowedRows(mixed $rows, array $keys): array
    {
        if (!is_array($rows)) return [];
        $allowed = array_flip($keys);
        return array_values(array_map(static fn(array $row): array => array_intersect_key($row, $allowed), array_filter($rows, 'is_array')));
    }

    private static function nullableText(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));
        return $text === '' ? null : $text;
    }

    private static function nullableInt(mixed $value): ?int
    {
        return $value === null || $value === '' ? null : max(0, (int) $value);
    }

    private static function currency(mixed $value): ?string
    {
        $currency = strtoupper(trim((string) ($value ?? '')));
        return preg_match('/^[A-Z]{3}$/', $currency) === 1 ? $currency : null;
    }

    private static function safePublicUrl(mixed $value): ?string
    {
        $url = trim((string) ($value ?? ''));
        if ($url === '' || filter_var($url, FILTER_VALIDATE_URL) === false) return null;
        $parts = parse_url($url);
        if (!is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https' || isset($parts['user']) || isset($parts['pass'])) return null;
        $host = strtolower((string) ($parts['host'] ?? ''));
        if ($host === '' || $host === 'localhost' || str_ends_with($host, '.localhost')) return null;
        if (filter_var($host, FILTER_VALIDATE_IP) !== false && !filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return null;
        $query = strtolower((string) ($parts['query'] ?? ''));
        if (preg_match('/(?:token|signature|x-amz-|credential|secret|key)=/', $query) === 1) return null;
        return $url;
    }
}
