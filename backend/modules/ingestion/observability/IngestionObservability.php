<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../shared/observability/RequestContext.php';

final class IngestionObservability
{
    /** @param array<string,mixed> $context */
    public static function event(string $name, array $context = []): void
    {
        $safe = [];
        foreach ($context as $key => $value) {
            if (preg_match('/password|secret|token|authorization|cookie|payload|content|body/i', (string) $key) === 1) {
                continue;
            }
            if (is_scalar($value) || $value === null) {
                $safe[$key] = is_string($value) ? substr($value, 0, 300) : $value;
            }
        }
        RequestContext::log('info', 'ingestion_' . strtolower($name), $safe);
    }
}
