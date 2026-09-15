<?php

declare(strict_types=1);

/**
 * Keeps PRELAUNCH browser fixture outcomes inside the normal publication
 * pipeline. The provider is synthetic, but retry and guard remain canonical.
 */
final class BrowserFixturePublicationPolicy
{
    public const PROVIDER = 'm20f05-fixture';
    public const RETRYABLE_FAILURE = 'retryable_failure';
    public const PUBLICATION_BLOCKED = 'publication_blocked';

    /** @param array<string,mixed> $question */
    public static function isPublicationBlocked(array $question, array $payload = []): bool
    {
        return self::questionStatus($question, $payload) === self::PUBLICATION_BLOCKED;
    }

    /** @param array<string,mixed> $question @param array<string,mixed> $payload */
    public static function isRetryableFailure(array $question, array $payload = []): bool
    {
        return self::questionStatus($question, $payload) === self::RETRYABLE_FAILURE;
    }

    /** @param array<string,mixed> $question @param array<string,mixed> $payload */
    public static function shouldFailFirstRetryableAttempt(array $question, array $payload = []): bool
    {
        if (!self::isRetryableFailure($question, $payload)) {
            return false;
        }

        $import = is_array($payload['import'] ?? null) ? $payload['import'] : [];
        return (int) ($import['fixtureRetryAttempt'] ?? 1) < 2;
    }

    /** @param array<string,mixed> $payload @return array<string,mixed> */
    public static function markRetryAttempt(array $payload, int $attempt): array
    {
        $import = is_array($payload['import'] ?? null) ? $payload['import'] : [];
        $import['fixtureRetryAttempt'] = max(2, $attempt);
        $payload['import'] = $import;
        return $payload;
    }

    /** @param array<string,mixed> $question */
    private static function questionStatus(array $question, array $payload = []): ?string
    {
        $source = is_array($question['source'] ?? null) ? $question['source'] : [];
        if (strtolower(trim((string) ($source['provider'] ?? ''))) !== self::PROVIDER) {
            return null;
        }

        $status = strtolower(trim((string) ($source['fixtureStatus'] ?? '')));
        if ($status === '') {
            $import = is_array($payload['import'] ?? null) ? $payload['import'] : [];
            $status = strtolower(trim((string) ($import['fixtureStatus'] ?? '')));
        }
        return $status !== '' ? $status : null;
    }
}
