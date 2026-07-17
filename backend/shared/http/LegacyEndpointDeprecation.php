<?php

declare(strict_types=1);

require_once __DIR__ . '/../observability/RequestContext.php';

/** Telemetria de aliases sem remocao automatica baseada apenas no calendario. */
final class LegacyEndpointDeprecation
{
    public static function mark(string $alias, string $successorPath): void
    {
        if (!headers_sent()) {
            header('Deprecation: true');
            header('Link: <' . self::normalizeSuccessor($successorPath) . '>; rel="successor-version"');
            $sunset = self::approvedSunsetDate();
            if ($sunset !== null) {
                header('Sunset: ' . $sunset);
            }
        }

        RequestContext::log('info', 'legacy_endpoint_used', [
            'alias' => self::normalizeAlias($alias),
            'successor' => self::normalizeSuccessor($successorPath),
            'sunset' => self::approvedSunsetDate(),
        ]);
    }

    public static function shouldReturnGone(string $alias, ?int $timestamp = null): bool
    {
        $enforced = filter_var(
            (string) (getenv('LEGACY_ENDPOINT_ENFORCE_SUNSET') ?: 'false'),
            FILTER_VALIDATE_BOOLEAN
        );
        $sunset = self::approvedSunsetDate();
        if (!$enforced || $sunset === null) {
            return false;
        }

        $sunsetTimestamp = strtotime($sunset);
        if ($sunsetTimestamp === false || ($timestamp ?? time()) <= $sunsetTimestamp) {
            return false;
        }

        $zeroConsumerAliases = array_filter(array_map(
            static fn (string $value): string => self::normalizeAlias($value),
            explode(',', (string) (getenv('LEGACY_ENDPOINT_ZERO_CONSUMER_ALIASES') ?: ''))
        ));
        return in_array(self::normalizeAlias($alias), $zeroConsumerAliases, true);
    }

    public static function approvedSunsetDate(): ?string
    {
        $value = trim((string) (getenv('LEGACY_ENDPOINT_SUNSET_HTTP_DATE') ?: ''));
        return $value !== '' && strtotime($value) !== false ? $value : null;
    }

    private static function normalizeAlias(string $alias): string
    {
        return substr(preg_replace('/[^A-Za-z0-9._\/-]+/', '', trim($alias)) ?? '', 0, 160);
    }

    private static function normalizeSuccessor(string $path): string
    {
        return '/' . ltrim(substr(preg_replace('/[^A-Za-z0-9._\/?=&-]+/', '', trim($path)) ?? '', 0, 220), '/');
    }
}
