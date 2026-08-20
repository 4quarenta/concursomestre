<?php

declare(strict_types=1);

/**
 * Allowlist da landing publica de orgao. O DTO administrativo de filters nao
 * atravessa esta fronteira.
 */
final class PublicOrganizationProjection
{
    /** @param array<string, mixed> $data @param list<array{label:string,canonicalPath:string}> $breadcrumbs */
    public static function fromRepositoryData(array $data, array $breadcrumbs): array
    {
        $identity = is_array($data['identity'] ?? null) ? $data['identity'] : [];
        return [
            'id' => (int) ($identity['id'] ?? 0),
            'slug' => trim((string) ($identity['slug'] ?? '')),
            'name' => self::publicText($identity['name'] ?? ''),
            'acronym' => self::nullablePublicText($identity['acronym'] ?? null),
            'description' => self::nullablePublicText($identity['description'] ?? null),
            'website' => self::publicUrl($identity['website'] ?? null),
            'imageUrl' => self::publicUrl($identity['asset_url'] ?? null),
            'stateCode' => self::nullablePublicText($identity['meta_uf'] ?? null),
            'sphere' => self::nullablePublicText($identity['meta_esfera'] ?? null),
            'canonicalPath' => trim((string) ($data['canonicalPath'] ?? '')),
            'questionsPath' => trim((string) ($data['questionsPath'] ?? '')),
            'questionCount' => max(0, (int) ($identity['question_count'] ?? 0)),
            'examCount' => max(0, (int) ($identity['exam_count'] ?? 0)),
            'roles' => self::mapList($data['roles'] ?? [], ['id', 'slug', 'name', 'path', 'questionsPath']),
            'disciplines' => self::mapList($data['disciplines'] ?? [], ['id', 'slug', 'name', 'questionCount', 'path']),
            'boards' => self::mapList($data['boards'] ?? [], ['id', 'slug', 'name', 'acronym', 'examCount', 'path']),
            'exams' => self::mapList($data['exams'] ?? [], ['id', 'slug', 'name', 'year', 'questionCount', 'path']),
            'questions' => self::mapList($data['questions'] ?? [], ['id', 'excerpt', 'updatedAt', 'path']),
            'contests' => self::mapList($data['contests'] ?? [], ['id', 'slug', 'title', 'status', 'year', 'path']),
            'breadcrumbs' => array_values(array_map(static fn (array $item): array => [
                'label' => self::publicText($item['label'] ?? ''),
                'canonicalPath' => trim((string) ($item['canonicalPath'] ?? '')),
            ], $breadcrumbs)),
            'updatedAt' => self::nullablePublicText($identity['content_updated_at'] ?? null),
        ];
    }

    /** @param mixed $rows @param list<string> $fields @return list<array<string, mixed>> */
    private static function mapList(mixed $rows, array $fields): array
    {
        if (!is_array($rows)) {
            return [];
        }
        return array_values(array_map(static function (array $row) use ($fields): array {
            $item = [];
            foreach ($fields as $field) {
                $item[$field] = match ($field) {
                    'id', 'year', 'questionCount', 'examCount' => max(0, (int) ($row[$field] ?? 0)),
                    'acronym', 'updatedAt' => self::nullablePublicText($row[$field] ?? null),
                    default => self::publicText($row[$field] ?? ''),
                };
            }
            return $item;
        }, array_filter($rows, 'is_array')));
    }

    private static function nullablePublicText(mixed $value): ?string
    {
        $text = self::publicText($value);
        return $text === '' ? null : $text;
    }

    private static function publicText(mixed $value): string
    {
        $text = html_entity_decode(strip_tags(is_scalar($value) ? (string) $value : ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
    }

    private static function publicUrl(mixed $value): ?string
    {
        $url = self::publicText($value);
        if ($url === '' || filter_var($url, FILTER_VALIDATE_URL) === false) {
            return null;
        }
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        return in_array($scheme, ['http', 'https'], true) ? $url : null;
    }
}
