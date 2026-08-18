<?php

declare(strict_types=1);

/**
 * Allowlist da landing piloto de disciplina. Campos ausentes no modelo
 * interno nao atravessam esta fronteira por acidente.
 */
final class PublicDisciplineProjection
{
    /** @param array<string, mixed> $data @param list<array{label:string,canonicalPath:string}> $breadcrumbs */
    public static function fromRepositoryData(array $data, array $breadcrumbs): array
    {
        $identity = is_array($data['identity'] ?? null) ? $data['identity'] : [];
        return [
            'id' => (int) ($identity['id'] ?? 0),
            'slug' => trim((string) ($identity['slug'] ?? '')),
            'name' => trim((string) ($identity['name'] ?? '')),
            'description' => self::nullablePublicText($identity['description'] ?? null),
            'canonicalPath' => trim((string) ($data['canonicalPath'] ?? '')),
            'questionsPath' => trim((string) ($data['questionsPath'] ?? '')),
            'parent' => null,
            'root' => null,
            'questionCount' => max(0, (int) ($identity['question_count'] ?? 0)),
            'topics' => self::mapList($data['topics'] ?? [], ['id', 'slug', 'name', 'questionCount', 'questionsPath']),
            'exams' => self::mapList($data['exams'] ?? [], ['id', 'slug', 'name', 'year', 'questionCount', 'path']),
            'boards' => self::mapList($data['boards'] ?? [], ['id', 'slug', 'name', 'acronym', 'questionCount', 'path']),
            'questions' => self::mapList($data['questions'] ?? [], ['id', 'excerpt', 'updatedAt', 'path']),
            'breadcrumbs' => array_values(array_map(static fn (array $item): array => [
                'label' => trim((string) ($item['label'] ?? '')),
                'canonicalPath' => trim((string) ($item['canonicalPath'] ?? '')),
            ], $breadcrumbs)),
            'updatedAt' => self::nullableText($identity['content_updated_at'] ?? null),
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
                    'id', 'year', 'questionCount' => max(0, (int) ($row[$field] ?? 0)),
                    'acronym', 'updatedAt' => self::nullableText($row[$field] ?? null),
                    'excerpt' => self::publicText($row[$field] ?? ''),
                    default => trim((string) ($row[$field] ?? '')),
                };
            }
            return $item;
        }, array_filter($rows, 'is_array')));
    }

    private static function nullableText(mixed $value): ?string
    {
        $text = is_scalar($value) ? trim((string) $value) : '';
        return $text === '' ? null : $text;
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
}
