<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

/**
 * Environment Configuration Loader
 * Loads .env file and makes variables available via getenv()
 */

class EnvLoader {
    public static function load($path = __DIR__ . '/../.env') {
        if (!file_exists($path)) {
            error_log("Warning: .env file not found at $path");
            return false;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        
        foreach ($lines as $line) {
            // Skip comments
            if (strpos(trim($line), '#') === 0) {
                continue;
            }

            // Parse key=value
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);

                // Remove quotes if present
                if (preg_match('/^(["\'])(.*)\\1$/', $value, $matches)) {
                    $value = $matches[2];
                }

                // Set environment variable
                putenv("$key=$value");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }

        return true;
    }
}

// Auto-load on include
EnvLoader::load();

if (!function_exists('getEnvString')) {
    function getEnvString(string $key, string $fallback = ''): string {
        $value = $_ENV[$key] ?? getenv($key);
        if ($value === false || $value === null) {
            return $fallback;
        }

        $value = trim((string) $value);
        return $value !== '' ? $value : $fallback;
    }
}

if (!function_exists('getAppEnv')) {
    function getAppEnv(): string {
        return strtolower(getEnvString('APP_ENV', 'development'));
    }
}

if (!function_exists('isProductionEnv')) {
    function isProductionEnv(): bool {
        return getAppEnv() === 'production';
    }
}

if (!function_exists('isLocalOrigin')) {
    function isLocalOrigin(string $origin): bool {
        $host = parse_url($origin, PHP_URL_HOST);
        if (!is_string($host) || $host === '') {
            return false;
        }

        return in_array(strtolower($host), ['localhost', '127.0.0.1', '::1'], true);
    }
}

if (!function_exists('getConfiguredCorsAllowedOrigins')) {
    function getConfiguredCorsAllowedOrigins(): array {
        $configuredOrigins = getEnvString('CORS_ALLOWED_ORIGINS');
        $allowedOrigins = array_values(array_filter(array_map('trim', explode(',', $configuredOrigins))));

        if ($allowedOrigins) {
            return $allowedOrigins;
        }

        if (isProductionEnv()) {
            error_log('[cors] CORS_ALLOWED_ORIGINS nao configurado em producao.');
            return [];
        }

        return [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
        ];
    }
}

if (!function_exists('isAllowedLocalDevelopmentOrigin')) {
    function isAllowedLocalDevelopmentOrigin(string $origin): bool {
        if (isProductionEnv()) {
            return false;
        }

        $scheme = strtolower((string) parse_url($origin, PHP_URL_SCHEME));
        if (!in_array($scheme, ['http', 'https'], true)) {
            return false;
        }

        return isLocalOrigin($origin);
    }
}

if (!function_exists('resolveAllowedCorsOrigin')) {
    function resolveAllowedCorsOrigin(?string $origin): ?string {
        $requestOrigin = trim((string) $origin);
        if ($requestOrigin === '') {
            return null;
        }

        $allowedOrigins = getConfiguredCorsAllowedOrigins();
        if (isProductionEnv()) {
            $allowedOrigins = array_values(array_filter(
                $allowedOrigins,
                static fn (string $allowedOrigin): bool => !isLocalOrigin($allowedOrigin),
            ));
        }

        if (in_array($requestOrigin, $allowedOrigins, true)) {
            return $requestOrigin;
        }

        if (isAllowedLocalDevelopmentOrigin($requestOrigin)) {
            return $requestOrigin;
        }

        return null;
    }
}

if (!function_exists('getAppTimezone')) {
    function getAppTimezone(): string {
        return getEnvString('APP_TIMEZONE', 'America/Sao_Paulo');
    }
}

if (!function_exists('getDatabaseTimezoneOffset')) {
    function getDatabaseTimezoneOffset(?string $timezone = null): string {
        $timezone = $timezone ?: getAppTimezone();

        try {
            $date = new DateTime('now', new DateTimeZone($timezone));
            return $date->format('P');
        } catch (Throwable $e) {
            return '-03:00';
        }
    }
}

date_default_timezone_set(getAppTimezone());
?>
