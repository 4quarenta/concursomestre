<?php

declare(strict_types=1);

/** Allowlist publica compartilhada por Carreira e Cargo. */
final class PublicProfessionalTaxonomyProjection
{
    /** @param array<string,mixed> $data */
    public static function detail(array $data): array
    {
        $identity = is_array($data['identity'] ?? null) ? $data['identity'] : [];
        return [
            'kind' => self::text($data['kind'] ?? ''),
            'id' => max(0, (int) ($identity['id'] ?? 0)),
            'slug' => self::text($identity['slug'] ?? ''),
            'name' => self::text($identity['name'] ?? ''),
            'description' => self::nullableText($identity['description'] ?? null),
            'canonicalPath' => self::text($data['canonicalPath'] ?? ''),
            'questionsPath' => self::text($data['questionsPath'] ?? ''),
            'contestsPath' => self::text($data['contestsPath'] ?? ''),
            'questionCount' => max(0, (int) ($identity['question_count'] ?? 0)),
            'examCount' => max(0, (int) ($identity['exam_count'] ?? 0)),
            'careers' => self::items($data['careers'] ?? [], ['id', 'slug', 'name', 'path']),
            'positions' => self::items($data['positions'] ?? [], ['id', 'slug', 'name', 'questionCount', 'examCount', 'path']),
            'contests' => self::items($data['contests'] ?? [], ['id', 'slug', 'title', 'status', 'year', 'organization', 'path']),
            'organizations' => self::items($data['organizations'] ?? [], ['id', 'slug', 'name', 'acronym', 'path']),
            'exams' => self::items($data['exams'] ?? [], ['id', 'slug', 'name', 'year', 'questionCount', 'path']),
            'questions' => self::items($data['questions'] ?? [], ['id', 'excerpt', 'path']),
            'boards' => self::items($data['boards'] ?? [], ['id', 'slug', 'name', 'acronym', 'path']),
            'breadcrumbs' => self::items($data['breadcrumbs'] ?? [], ['label', 'canonicalPath']),
            'readiness' => self::readiness($data['readiness'] ?? null),
            'updatedAt' => self::nullableText($identity['content_updated_at'] ?? null),
        ];
    }

    /** @param mixed $rows @param list<string> $fields */
    private static function items(mixed $rows, array $fields): array
    {
        if (!is_array($rows)) return [];
        return array_values(array_map(static function (array $row) use ($fields): array {
            $item = [];
            foreach ($fields as $field) {
                $value = $row[$field] ?? null;
                $item[$field] = match ($field) {
                    'id', 'year', 'questionCount', 'examCount' => $value === null ? null : max(0, (int) $value),
                    'acronym', 'organization' => self::nullableText($value),
                    default => self::text($value),
                };
            }
            return $item;
        }, array_filter($rows, 'is_array')));
    }

    /** @return array{status:string,reasonCodes:list<string>} */
    private static function readiness(mixed $value): array
    {
        if (!is_array($value)) return ['status' => 'NOT_READY', 'reasonCodes' => ['instance_readiness.missing_identity']];
        return [
            'status' => self::text($value['status'] ?? 'NOT_READY'),
            'reasonCodes' => array_values(array_map('strval', is_array($value['reasonCodes'] ?? null) ? $value['reasonCodes'] : [])),
        ];
    }

    private static function text(mixed $value): string
    {
        $text = html_entity_decode(strip_tags(is_scalar($value) ? (string) $value : ''), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
    }

    private static function nullableText(mixed $value): ?string
    {
        $text = self::text($value);
        return $text === '' ? null : $text;
    }
}
