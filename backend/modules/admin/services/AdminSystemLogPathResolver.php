<?php

declare(strict_types=1);

/**
 * Resolves the server log without coupling the HTTP bridge to one host.
 */
final class AdminSystemLogPathResolver
{
    /** @param list<string>|null $candidatePaths */
    public function resolve(?array $candidatePaths = null): string
    {
        $configuredPath = trim((string) ($_ENV['ADMIN_SYSTEM_LOG_PATH'] ?? getenv('ADMIN_SYSTEM_LOG_PATH') ?: ''));
        $candidates = array_values(array_filter([
            $configuredPath,
            ...($candidatePaths ?? $this->defaultCandidates()),
        ], static fn ($path): bool => is_string($path) && trim($path) !== ''));

        foreach ($candidates as $candidatePath) {
            if (is_readable($candidatePath)) {
                return $candidatePath;
            }
        }

        return $candidates[0] ?? '/var/log/nginx/error.log';
    }

    /** @return list<string> */
    private function defaultCandidates(): array
    {
        return [
            '/var/log/nginx/concursomestre.error.log',
            '/var/log/nginx/error.log',
            '/var/log/apache2/error.log',
            '/var/log/php8.4-fpm.log',
            '/var/log/php8.3-fpm.log',
            '/var/log/php8.2-fpm.log',
            '/var/log/php-fpm/error.log',
            'C:\\xampp\\apache\\logs\\error.log',
        ];
    }
}
