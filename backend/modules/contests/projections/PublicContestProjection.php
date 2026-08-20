<?php

declare(strict_types=1);

/** Public allowlist for canonical contests. Administrative/import fields never cross this boundary. */
final class PublicContestProjection
{
    /** @param array<string,mixed> $data */
    public static function detail(array $data): array
    {
        $contest = is_array($data['contest'] ?? null) ? $data['contest'] : [];
        return [
            'id' => (int) ($contest['id'] ?? 0),
            'slug' => self::text($contest['slug'] ?? ''),
            'title' => self::text($contest['title'] ?? ''),
            'description' => self::nullableText($contest['description'] ?? null),
            'status' => self::text($contest['domain_status'] ?? ''),
            'isOpen' => (bool) ($contest['is_open'] ?? false),
            'year' => isset($contest['year']) ? (int) $contest['year'] : null,
            'officialUrl' => self::url($contest['official_url'] ?? null),
            'dates' => self::dates($contest),
            'organizations' => self::items($data['organizations'] ?? [], ['id', 'slug', 'name', 'acronym', 'path']),
            'board' => self::item($data['board'] ?? null, ['id', 'slug', 'name', 'acronym', 'path']),
            'positions' => self::items($data['positions'] ?? [], [
                'id', 'roleId', 'slug', 'name', 'path', 'vacancies', 'reserveRegistry', 'salaryMin', 'salaryMax',
                'educationLevel', 'weeklyHours', 'locationLabel',
            ]),
            'documents' => self::publicDocuments($data['documents'] ?? []),
            'exams' => self::items($data['exams'] ?? [], ['id', 'slug', 'title', 'year', 'questionCount', 'path']),
            'questions' => self::items($data['questions'] ?? [], ['id', 'excerpt', 'path']),
            'questionCount' => max(0, (int) ($data['questionCount'] ?? 0)),
            'canonicalPath' => self::text($data['canonicalPath'] ?? ''),
            'breadcrumbs' => self::items($data['breadcrumbs'] ?? [], ['label', 'canonicalPath']),
            'updatedAt' => self::nullableText($contest['updated_at'] ?? null),
        ];
    }

    /** @param array<string,mixed> $row */
    public static function summary(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'slug' => self::text($row['slug'] ?? ''),
            'title' => self::text($row['title'] ?? ''),
            'description' => self::nullableText($row['description'] ?? null),
            'status' => self::text($row['domain_status'] ?? ''),
            'isOpen' => (bool) ($row['is_open'] ?? false),
            'year' => isset($row['year']) ? (int) $row['year'] : null,
            'registrationStart' => self::dateTime($row['registration_start_at'] ?? null),
            'registrationEnd' => self::dateTime($row['registration_end_at'] ?? null),
            'organization' => self::nullableText($row['organization_name'] ?? null),
            'organizationAcronym' => self::nullableText($row['organization_acronym'] ?? null),
            'board' => self::nullableText($row['board_name'] ?? null),
            'boardAcronym' => self::nullableText($row['board_acronym'] ?? null),
            'path' => self::text($row['path'] ?? ''),
            'updatedAt' => self::nullableText($row['updated_at'] ?? null),
        ];
    }

    /** @param array<string,mixed> $row */
    private static function dates(array $row): array
    {
        return [
            'announcedAt' => self::dateTime($row['announced_at'] ?? null),
            'noticePublishedAt' => self::dateTime($row['notice_published_at'] ?? null),
            'registrationStartAt' => self::dateTime($row['registration_start_at'] ?? null),
            'registrationEndAt' => self::dateTime($row['registration_end_at'] ?? null),
            'examStartAt' => self::dateTime($row['exam_start_at'] ?? null),
        ];
    }

    /** @param mixed $rows @param list<string> $fields */
    private static function items(mixed $rows, array $fields): array
    {
        if (!is_array($rows)) return [];
        return array_values(array_filter(array_map(
            static fn (mixed $row): ?array => is_array($row) ? self::item($row, $fields) : null,
            $rows
        )));
    }

    /** @param mixed $rows */
    private static function publicDocuments(mixed $rows): array
    {
        if (!is_array($rows)) return [];
        return array_values(array_filter(array_map(static function (mixed $row): ?array {
            if (!is_array($row) || self::url($row['url'] ?? null) === null) return null;
            return self::item($row, ['id', 'type', 'title', 'url', 'publishedAt']);
        }, $rows)));
    }

    /** @param mixed $row @param list<string> $fields */
    private static function item(mixed $row, array $fields): ?array
    {
        if (!is_array($row)) return null;
        $result = [];
        foreach ($fields as $field) {
            $value = $row[$field] ?? null;
            $result[$field] = match ($field) {
                'id', 'roleId', 'vacancies', 'weeklyHours', 'year', 'questionCount' => $value === null ? null : max(0, (int) $value),
                'reserveRegistry' => (bool) $value,
                'salaryMin', 'salaryMax' => $value === null ? null : (float) $value,
                'url' => self::url($value),
                'publishedAt' => self::dateTime($value),
                'acronym', 'educationLevel', 'locationLabel' => self::nullableText($value),
                default => self::text($value),
            };
        }
        return $result;
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

    private static function dateTime(mixed $value): ?string
    {
        $text = self::nullableText($value);
        if ($text === null) return null;
        $timezoneName = trim((string) (getenv('APP_TIMEZONE') ?: 'America/Sao_Paulo'));
        try {
            $timezone = new DateTimeZone($timezoneName);
        } catch (Throwable) {
            $timezone = new DateTimeZone('America/Sao_Paulo');
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $text, $timezone);
        $errors = DateTimeImmutable::getLastErrors();
        if ($date === false || (is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
            return null;
        }
        return $date->format(DATE_ATOM);
    }

    private static function url(mixed $value): ?string
    {
        $url = self::text($value);
        if ($url === '' || filter_var($url, FILTER_VALIDATE_URL) === false) return null;
        $parts = parse_url($url);
        if (!is_array($parts)
            || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)
            || isset($parts['user']) || isset($parts['pass'])) return null;

        parse_str((string) ($parts['query'] ?? ''), $query);
        foreach (array_keys($query) as $key) {
            $normalizedKey = strtolower((string) $key);
            if (preg_match('/(?:^|[_-])(token|signature|sig|credential|secret|key)(?:$|[_-])/', $normalizedKey) === 1
                || str_starts_with($normalizedKey, 'x-amz-')) return null;
        }

        $host = trim(strtolower(rtrim((string) ($parts['host'] ?? ''), '.')), '[]');
        if ($host === '' || $host === 'localhost' || str_ends_with($host, '.localhost')
            || str_ends_with($host, '.local') || str_ends_with($host, '.internal') || ctype_digit($host)) return null;
        if (filter_var($host, FILTER_VALIDATE_IP) !== false
            && filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return null;
        }
        return $url;
    }
}
