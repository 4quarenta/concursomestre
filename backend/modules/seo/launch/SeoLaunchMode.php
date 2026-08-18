<?php

declare(strict_types=1);

final class SeoLaunchMode
{
    public const PRELAUNCH = 'PRELAUNCH';
    public const GO_CANDIDATE = 'GO_CANDIDATE';
    public const PRODUCTION = 'PRODUCTION';

    /** @return list<string> */
    public static function values(): array
    {
        return [self::PRELAUNCH, self::GO_CANDIDATE, self::PRODUCTION];
    }

    public static function normalize(mixed $value): string
    {
        $normalized = strtoupper(trim((string) $value));
        return in_array($normalized, self::values(), true) ? $normalized : self::PRELAUNCH;
    }

    public static function fromEnvironment(): string
    {
        return self::normalize(getenv('SEO_LAUNCH_MODE') ?: null);
    }

    public static function allowsRuntimeIndex(string $mode): bool
    {
        return self::normalize($mode) === self::PRODUCTION;
    }

    private function __construct()
    {
    }
}
