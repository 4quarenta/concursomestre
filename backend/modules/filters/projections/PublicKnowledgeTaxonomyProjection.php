<?php

declare(strict_types=1);

/** Allowlist compartilhada pelas landings de disciplina, topico e assunto. */
final class PublicKnowledgeTaxonomyProjection
{
    /** @param array<string, mixed> $data @param list<array{label:string,canonicalPath:string}> $breadcrumbs */
    public static function fromRepositoryData(array $data, array $breadcrumbs): array
    {
        $identity = is_array($data['identity'] ?? null) ? $data['identity'] : [];
        return [
            'id' => (int) ($identity['id'] ?? 0),
            'slug' => self::text($identity['slug'] ?? ''),
            'requestedSlug' => self::text($data['requestedSlug'] ?? $identity['slug'] ?? ''),
            'name' => self::text($identity['name'] ?? ''),
            'description' => self::nullablePublicText($identity['description'] ?? null),
            'taxonomyLevel' => self::text($data['taxonomyLevel'] ?? $identity['taxonomy_level'] ?? ''),
            'canonicalPath' => self::text($data['canonicalPath'] ?? ''),
            'questionsPath' => self::text($data['questionsPath'] ?? ''),
            'readiness' => self::readiness($data['readiness'] ?? null),
            'parent' => self::identity($data['parent'] ?? null),
            'root' => self::identity($data['root'] ?? null),
            'topic' => self::identity($data['topic'] ?? null),
            'subtopic' => self::identity($data['subtopic'] ?? null, false),
            'questionCount' => max(0, (int) ($identity['question_count'] ?? 0)),
            'topics' => self::mapList($data['topics'] ?? [], ['id', 'slug', 'name', 'questionCount', 'path', 'questionsPath']),
            'subtopics' => self::mapList($data['subtopics'] ?? [], ['id', 'slug', 'name']),
            'subjects' => self::mapList($data['subjects'] ?? [], ['id', 'slug', 'name', 'questionCount', 'path', 'questionsPath', 'subtopicId', 'subtopicName']),
            'exams' => self::mapList($data['exams'] ?? [], ['id', 'slug', 'name', 'year', 'questionCount', 'path']),
            'boards' => self::mapList($data['boards'] ?? [], ['id', 'slug', 'name', 'acronym', 'questionCount', 'path']),
            'organizations' => self::mapList($data['organizations'] ?? [], ['id', 'slug', 'name', 'acronym', 'questionCount', 'path']),
            'questions' => self::mapList($data['questions'] ?? [], ['id', 'excerpt', 'updatedAt', 'path']),
            'breadcrumbs' => array_values(array_map(static fn (array $item): array => [
                'label' => self::text($item['label'] ?? ''),
                'canonicalPath' => self::text($item['canonicalPath'] ?? ''),
            ], array_filter($breadcrumbs, 'is_array'))),
            'updatedAt' => self::nullableText($identity['content_updated_at'] ?? null),
        ];
    }

    /** @return array{status:string,reasonCodes:list<string>} */
    private static function readiness(mixed $value): array
    {
        $value = is_array($value) ? $value : [];
        return [
            'status' => (string) ($value['status'] ?? 'NOT_READY'),
            'reasonCodes' => array_values(array_filter($value['reasonCodes'] ?? [], 'is_string')),
        ];
    }

    /** @return array<string, mixed>|null */
    private static function identity(mixed $value, bool $withPath = true): ?array
    {
        if (!is_array($value) || (int) ($value['id'] ?? 0) <= 0) return null;
        $result = [
            'id' => (int) $value['id'],
            'slug' => self::text($value['slug'] ?? ''),
            'name' => self::text($value['name'] ?? ''),
            'taxonomyLevel' => self::text($value['taxonomyLevel'] ?? $value['taxonomy_level'] ?? ''),
        ];
        if ($withPath) $result['path'] = self::text($value['path'] ?? '');
        return $result;
    }

    /** @param mixed $rows @param list<string> $fields @return list<array<string, mixed>> */
    private static function mapList(mixed $rows, array $fields): array
    {
        if (!is_array($rows)) return [];
        return array_values(array_map(static function (array $row) use ($fields): array {
            $item = [];
            foreach ($fields as $field) {
                $item[$field] = match ($field) {
                    'id', 'year', 'questionCount', 'subtopicId' => max(0, (int) ($row[$field] ?? 0)),
                    'acronym', 'updatedAt', 'subtopicName' => self::nullableText($row[$field] ?? null),
                    'excerpt' => self::publicText($row[$field] ?? ''),
                    default => self::text($row[$field] ?? ''),
                };
            }
            return $item;
        }, array_filter($rows, 'is_array')));
    }

    private static function nullableText(mixed $value): ?string
    {
        $text = self::text($value);
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

    private static function text(mixed $value): string
    {
        return is_scalar($value) ? trim((string) $value) : '';
    }
}
