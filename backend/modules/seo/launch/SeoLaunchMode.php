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
        $authorityFile = trim((string) (getenv('SEO_LAUNCH_MODE_FILE') ?: ''));
        if ($authorityFile === '') {
            $authorityFile = dirname(__DIR__, 4) . '/storage/runtime/seo-launch-mode.json';
        }
        if (is_file($authorityFile) && is_readable($authorityFile)) {
            $payload = json_decode((string) file_get_contents($authorityFile), true);
            if (is_array($payload) && array_key_exists('mode', $payload)) {
                return self::normalize($payload['mode']);
            }
        }
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
