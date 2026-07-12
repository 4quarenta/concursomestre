<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth/AuthConfig.php';

/**
 * Cursor opaco e assinado para paginacoes ordenadas por created_at e id.
 * O cursor nao transporta escopo de usuario e nao pode ser alterado pelo cliente.
 */
final class SignedKeysetCursor
{
    public static function encode(string $scope, string $createdAt, string $id): string
    {
        $payload = json_encode([
            'scope' => $scope,
            'createdAt' => $createdAt,
            'id' => $id,
        ], JSON_UNESCAPED_SLASHES);

        if (!is_string($payload)) {
            throw new RuntimeException('Nao foi possivel gerar o cursor de paginacao.');
        }

        $encodedPayload = self::base64UrlEncode($payload);
        $signature = hash_hmac('sha256', $encodedPayload, self::secret(), true);

        return $encodedPayload . '.' . self::base64UrlEncode($signature);
    }

    /**
     * @return array{createdAt: string, id: string}|null
     */
    public static function decode(?string $cursor, string $scope): ?array
    {
        $value = trim((string) $cursor);
        if ($value === '') {
            return null;
        }

        $parts = explode('.', $value, 2);
        if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
            throw new InvalidArgumentException('Cursor de paginacao invalido.');
        }

        $expectedSignature = self::base64UrlEncode(hash_hmac('sha256', $parts[0], self::secret(), true));
        if (!hash_equals($expectedSignature, $parts[1])) {
            throw new InvalidArgumentException('Cursor de paginacao invalido.');
        }

        $decoded = self::base64UrlDecode($parts[0]);
        $payload = is_string($decoded) ? json_decode($decoded, true) : null;
        if (!is_array($payload)
            || !hash_equals($scope, (string) ($payload['scope'] ?? ''))
            || trim((string) ($payload['createdAt'] ?? '')) === ''
            || trim((string) ($payload['id'] ?? '')) === '') {
            throw new InvalidArgumentException('Cursor de paginacao invalido.');
        }

        return [
            'createdAt' => (string) $payload['createdAt'],
            'id' => (string) $payload['id'],
        ];
    }

    private static function secret(): string
    {
        $secret = trim((string) authConfig('JWT_SECRET', ''));
        if ($secret === '') {
            throw new RuntimeException('JWT_SECRET nao configurado para assinar cursores.');
        }

        return $secret;
    }

    private static function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $value): string|false
    {
        $padded = str_pad(strtr($value, '-_', '+/'), strlen($value) % 4 === 0 ? strlen($value) : strlen($value) + (4 - (strlen($value) % 4)), '=');
        return base64_decode($padded, true);
    }
}
