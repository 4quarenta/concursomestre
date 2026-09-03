<?php

declare(strict_types=1);

final class RuntimeGrantContract
{
    /** @return list<string> */
    public static function defaultRequiredCapabilities(): array
    {
        return ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
    }

    /** @return list<string> */
    public static function forbiddenCapabilities(): array
    {
        return [
            'ALL PRIVILEGES',
            'GRANT OPTION',
            'CREATE',
            'ALTER',
            'DROP',
            'INDEX',
            'TRIGGER',
            'EVENT',
            'REFERENCES',
            'CREATE USER',
            'FILE',
            'SUPER',
            'SYSTEM_VARIABLES_ADMIN',
        ];
    }

    /** @param list<string> $grants @param list<string> $required @return array<string, mixed> */
    public static function evaluate(array $grants, array $required = []): array
    {
        $required = $required === [] ? self::defaultRequiredCapabilities() : self::normalizeCapabilities($required);
        $normalized = array_map(static fn (string $grant): string => strtoupper(preg_replace('/\s+/', ' ', trim($grant)) ?? trim($grant)), $grants);
        $joined = implode("\n", $normalized);
        $missing = array_values(array_filter($required, static fn (string $capability): bool => !str_contains($joined, $capability)));
        $forbidden = array_values(array_filter(self::forbiddenCapabilities(), static fn (string $capability): bool => str_contains($joined, $capability)));

        return [
            'ok' => $missing === [] && $forbidden === [],
            'grantCount' => count($grants),
            'requiredCapabilities' => $required,
            'missingCapabilities' => $missing,
            'forbiddenCapabilities' => $forbidden,
            'ddlExpectedFromRuntime' => false,
            'rawGrantsIncluded' => false,
        ];
    }

    /** @param list<string> $capabilities @return list<string> */
    private static function normalizeCapabilities(array $capabilities): array
    {
        $normalized = array_map(static fn (string $capability): string => strtoupper(trim($capability)), $capabilities);
        $normalized = array_values(array_filter(array_unique($normalized), static fn (string $capability): bool => preg_match('/^[A-Z][A-Z0-9_ ]*$/', $capability) === 1));
        sort($normalized);
        return $normalized;
    }
}
