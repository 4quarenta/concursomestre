<?php

declare(strict_types=1);

require_once __DIR__ . '/../errors/HttpException.php';

/** Entrada HTTP normalizada para rotas e bridges. */
final class Request
{
    private static ?string $rawBodyOverride = null;
    private static ?string $rawBodyCache = null;

    public static function method(): string
    {
        return strtoupper(trim((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'))) ?: 'GET';
    }

    /** @param list<string> $allowedMethods */
    public static function requireMethod(array $allowedMethods): void
    {
        $normalized = array_values(array_unique(array_filter(array_map(
            static fn (string $method): string => strtoupper(trim($method)),
            $allowedMethods
        ))));

        if (in_array(self::method(), $normalized, true)) {
            return;
        }

        if ($normalized !== []) {
            header('Allow: ' . implode(', ', $normalized));
        }

        throw new MethodNotAllowedException($normalized);
    }

    public static function rawBody(): string
    {
        if (self::$rawBodyOverride !== null) {
            return self::$rawBodyOverride;
        }

        if (self::$rawBodyCache === null) {
            $body = file_get_contents('php://input');
            self::$rawBodyCache = is_string($body) ? $body : '';
        }

        return self::$rawBodyCache;
    }

    /** @return array<string, mixed> */
    public static function json(): array
    {
        $rawBody = trim(self::rawBody());
        if ($rawBody === '') {
            return [];
        }

        try {
            $decoded = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new InvalidArgumentException('Payload JSON invalido.', 0, $exception);
        }

        if (!is_array($decoded) || array_is_list($decoded)) {
            throw new InvalidArgumentException('O payload JSON deve ser um objeto.');
        }

        return $decoded;
    }

    /** @return array<string, mixed> */
    public static function query(): array
    {
        return is_array($_GET) ? $_GET : [];
    }

    /** @return array<string, string> */
    public static function headers(): array
    {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $normalized = [];

        if (is_array($headers)) {
            foreach ($headers as $name => $value) {
                $normalized[strtolower((string) $name)] = trim((string) $value);
            }
        }

        foreach ($_SERVER as $name => $value) {
            if (!str_starts_with((string) $name, 'HTTP_')) {
                continue;
            }
            $headerName = strtolower(str_replace('_', '-', substr((string) $name, 5)));
            $normalized[$headerName] ??= trim((string) $value);
        }

        if (isset($_SERVER['CONTENT_TYPE'])) {
            $normalized['content-type'] ??= trim((string) $_SERVER['CONTENT_TYPE']);
        }

        return $normalized;
    }

    /** @internal */
    public static function setRawBodyForTesting(?string $body): void
    {
        self::$rawBodyOverride = $body;
        self::$rawBodyCache = null;
    }
}
