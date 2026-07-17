<?php

declare(strict_types=1);

/** Contexto de observabilidade sem dados pessoais por requisicao. */
final class RequestContext
{
    private static ?string $requestId = null;
    private static float $startedAt = 0.0;
    private static bool $bootstrapped = false;

    public static function bootstrap(): void
    {
        if (self::$bootstrapped) {
            return;
        }

        self::$bootstrapped = true;
        self::$startedAt = microtime(true);
        self::$requestId = self::resolveRequestId($_SERVER['HTTP_X_REQUEST_ID'] ?? null);

        if (!headers_sent()) {
            header('X-Request-Id: ' . self::$requestId);
            header('Access-Control-Expose-Headers: X-Request-Id, X-Response-Time-Ms');
        }

        register_shutdown_function(static function (): void {
            RequestContext::finish();
        });
    }

    public static function id(): string
    {
        if (!self::$bootstrapped) {
            self::bootstrap();
        }
        return self::$requestId ?? 'unknown';
    }

    public static function elapsedMilliseconds(): int
    {
        return self::$startedAt <= 0
            ? 0
            : max(0, (int) round((microtime(true) - self::$startedAt) * 1000));
    }

    public static function applyResponseHeaders(): void
    {
        if (headers_sent()) {
            return;
        }
        header('X-Request-Id: ' . self::id());
        header('X-Response-Time-Ms: ' . self::elapsedMilliseconds());
    }

    public static function log(string $level, string $event, array $context = []): void
    {
        $payload = [
            'timestamp' => gmdate(DATE_ATOM),
            'level' => strtolower($level),
            'event' => $event,
            'request_id' => self::id(),
            'context' => self::sanitize($context),
        ];
        error_log(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{"event":"log_encoding_failed"}');
    }

    private static function finish(): void
    {
        self::applyResponseHeaders();
        $enabled = filter_var((string) (getenv('OBSERVABILITY_REQUEST_LOG_ENABLED') ?: 'false'), FILTER_VALIDATE_BOOLEAN);
        if (!$enabled || PHP_SAPI === 'cli') {
            return;
        }

        $path = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
        self::log('info', 'http_request_completed', [
            'method' => strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')),
            'path' => $path !== '' ? $path : '/',
            'status_code' => http_response_code(),
            'duration_ms' => self::elapsedMilliseconds(),
            'memory_peak_bytes' => memory_get_peak_usage(true),
        ]);
    }

    private static function resolveRequestId(mixed $candidate): string
    {
        $value = trim((string) $candidate);
        if ($value !== '' && preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$/', $value)) {
            return $value;
        }

        try {
            return bin2hex(random_bytes(16));
        } catch (Throwable) {
            return str_replace('.', '', uniqid('req_', true));
        }
    }

    private static function sanitize(mixed $value, ?string $key = null): mixed
    {
        $sensitive = '/password|passwd|secret|token|authorization|cookie|cpf|card|cvv|email|phone|address|document/i';
        if ($key !== null && preg_match($sensitive, $key)) {
            return '[REDACTED]';
        }
        if (is_array($value)) {
            $result = [];
            foreach ($value as $itemKey => $itemValue) {
                $result[$itemKey] = self::sanitize($itemValue, is_string($itemKey) ? $itemKey : null);
            }
            return $result;
        }
        if (is_object($value)) {
            return self::sanitize(get_object_vars($value));
        }
        if (is_string($value) && strlen($value) > 500) {
            return substr($value, 0, 500) . '...';
        }
        return $value;
    }
}
