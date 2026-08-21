<?php

declare(strict_types=1);

final class PublicSimulationProjection
{
    /** @return array<string,mixed> */
    public static function summary(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'slug' => (string) ($row['slug'] ?? ''),
            'title' => (string) ($row['title'] ?? ''),
            'description' => self::nullableText($row['description'] ?? null),
            'durationMinutes' => self::nullableInt($row['duration_minutes'] ?? $row['durationMinutes'] ?? null),
            'questionCount' => max(0, (int) ($row['question_count'] ?? $row['questionCount'] ?? 0)),
            'availabilityStatus' => (string) ($row['availability_status'] ?? $row['availabilityStatus'] ?? 'unavailable'),
            'path' => (string) ($row['path'] ?? ''),
            'updatedAt' => self::nullableText($row['updated_at'] ?? $row['updatedAt'] ?? null),
        ];
    }

    /** @return array<string,mixed> */
    public static function detail(array $data): array
    {
        $simulation = $data['simulation'] ?? [];
        return self::summary($simulation + [
            'path' => $data['canonicalPath'] ?? '',
            'questionCount' => $data['questionCount'] ?? 0,
        ]) + [
            'canonicalPath' => (string) ($data['canonicalPath'] ?? ''),
            'instructions' => self::nullableText($simulation['instructions'] ?? null),
            'isAttemptAvailable' => ($simulation['availability_status'] ?? '') === 'available',
            'practicePath' => (string) ($data['practicePath'] ?? '/simulation'),
            'questions' => self::list($data['questions'] ?? [], ['id', 'excerpt', 'position', 'path']),
            'taxonomies' => self::list($data['taxonomies'] ?? [], ['id', 'slug', 'name', 'relationType', 'path']),
            'contests' => self::list($data['contests'] ?? [], ['id', 'slug', 'title', 'path']),
            'exams' => self::list($data['exams'] ?? [], ['id', 'slug', 'title', 'year', 'path']),
            'breadcrumbs' => self::list($data['breadcrumbs'] ?? [], ['label', 'canonicalPath']),
            'readiness' => is_array($data['readiness'] ?? null)
                ? $data['readiness']
                : ['status' => 'NOT_READY', 'reasonCodes' => ['instance_readiness.not_evaluated']],
        ];
    }

    /** @return list<array<string,mixed>> */
    private static function list(mixed $rows, array $allowed): array
    {
        if (!is_array($rows)) return [];
        $result = [];
        foreach ($rows as $row) {
            if (!is_array($row)) continue;
            $result[] = array_intersect_key($row, array_flip($allowed));
        }
        return $result;
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
}
