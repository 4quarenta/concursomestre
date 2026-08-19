<?php

declare(strict_types=1);

final class ContestOpenState
{
    public static function sqlPredicate(string $alias = 'c'): string
    {
        if (preg_match('/^[a-z][a-z0-9_]*$/i', $alias) !== 1) {
            throw new InvalidArgumentException('Invalid SQL alias.');
        }

        return "{$alias}.domain_status = 'registration_open'
            AND ({$alias}.registration_start_at IS NULL OR {$alias}.registration_start_at <= NOW())
            AND ({$alias}.registration_end_at IS NULL OR {$alias}.registration_end_at >= NOW())
            AND ({$alias}.registration_start_at IS NULL OR {$alias}.registration_end_at IS NULL
                OR {$alias}.registration_end_at >= {$alias}.registration_start_at)";
    }

    public static function isOpen(
        string $status,
        ?string $registrationStart,
        ?string $registrationEnd,
        DateTimeImmutable $now,
    ): bool {
        if ($status !== 'registration_open') return false;

        $start = self::date($registrationStart, $now->getTimezone());
        $end = self::date($registrationEnd, $now->getTimezone());
        if (($registrationStart !== null && $start === null) || ($registrationEnd !== null && $end === null)) {
            return false;
        }
        if ($start !== null && $end !== null && $end < $start) return false;

        return ($start === null || $start <= $now) && ($end === null || $end >= $now);
    }

    private static function date(?string $value, DateTimeZone $timezone): ?DateTimeImmutable
    {
        if ($value === null || trim($value) === '') return null;
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', trim($value), $timezone);
        $errors = DateTimeImmutable::getLastErrors();
        if ($parsed === false || (is_array($errors) && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
            return null;
        }
        return $parsed;
    }
}
