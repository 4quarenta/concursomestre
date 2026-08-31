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

require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/AuthConfig.php';
require_once __DIR__ . '/AuthLogger.php';

class JWTAuth
{
    private static ?string $secret = null;

    private static function init(): void
    {
        if (self::$secret !== null) {
            return;
        }

        $secret = authConfig('JWT_SECRET', '');
        if (!is_string($secret) || trim($secret) === '') {
            throw new RuntimeException('JWT_SECRET não configurado.');
        }

        self::$secret = trim($secret);
    }

    public static function encode(array $payload, ?int $expiresIn = null): string
    {
        self::init();

        $now = time();
        $ttl = $expiresIn ?? getAuthAccessTokenTtlSeconds();
        $payload['iss'] = $payload['iss'] ?? getAuthIssuer();
        $payload['aud'] = $payload['aud'] ?? getAuthAudience();
        $payload['typ'] = $payload['typ'] ?? 'access';
        $payload['iat'] = $payload['iat'] ?? $now;
        $payload['nbf'] = $payload['nbf'] ?? max(0, $now - 5);
        $payload['exp'] = $payload['exp'] ?? ($now + $ttl);
        $payload['jti'] = $payload['jti'] ?? createAuthUuid();

        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256'], JSON_UNESCAPED_UNICODE);
        $body = json_encode($payload, JSON_UNESCAPED_UNICODE);

        $base64UrlHeader = self::base64UrlEncode((string) $header);
        $base64UrlPayload = self::base64UrlEncode((string) $body);

        $signature = hash_hmac('sha256', $base64UrlHeader . '.' . $base64UrlPayload, self::$secret, true);
        $base64UrlSignature = self::base64UrlEncode($signature);

        return $base64UrlHeader . '.' . $base64UrlPayload . '.' . $base64UrlSignature;
    }

    public static function verify(string $jwt, array $options = []): ?array
    {
        $result = self::verifyDetailed($jwt, $options);
        return $result['valid'] ? $result['payload'] : null;
    }

    public static function verifyDetailed(string $jwt, array $options = []): array
    {
        self::init();

        if (!is_string($jwt)) {
            return self::invalidResult('token_not_string');
        }

        $jwt = trim($jwt);
        if (
            (str_starts_with($jwt, '"') && str_ends_with($jwt, '"')) ||
            (str_starts_with($jwt, "'") && str_ends_with($jwt, "'"))
        ) {
            $jwt = trim(substr($jwt, 1, -1));
        }

        if ($jwt === '' || $jwt === 'undefined' || $jwt === 'null') {
            return self::invalidResult('token_missing');
        }

        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            return self::invalidResult('token_malformed');
        }

        [$base64UrlHeader, $base64UrlPayload, $base64UrlSignature] = $parts;

        $expectedSignature = hash_hmac('sha256', $base64UrlHeader . '.' . $base64UrlPayload, self::$secret, true);
        $expectedSignatureEncoded = self::base64UrlEncode($expectedSignature);

        if (!hash_equals($expectedSignatureEncoded, $base64UrlSignature)) {
            return self::invalidResult('invalid_signature');
        }

        $decodedPayload = self::base64UrlDecode($base64UrlPayload);
        if ($decodedPayload === false) {
            return self::invalidResult('payload_decode_failed');
        }

        $payload = json_decode($decodedPayload, true);
        if (!is_array($payload)) {
            return self::invalidResult('payload_invalid');
        }

        $clockSkew = getAuthClockSkewSeconds();
        $now = time();

        $issuer = (string) ($payload['iss'] ?? '');
        if ($issuer === '' || !hash_equals(getAuthIssuer(), $issuer)) {
            return self::invalidResult('issuer_invalid', $payload);
        }

        $audience = $payload['aud'] ?? null;
        $expectedAudience = getAuthAudience();
        $audienceMatches = false;
        if (is_array($audience)) {
            $audienceMatches = in_array($expectedAudience, $audience, true);
        } elseif (is_string($audience)) {
            $audienceMatches = hash_equals($expectedAudience, $audience);
        }
        if (!$audienceMatches) {
            return self::invalidResult('audience_invalid', $payload);
        }

        $nbf = isset($payload['nbf']) ? (int) $payload['nbf'] : null;
        if ($nbf !== null && ($now + $clockSkew) < $nbf) {
            return self::invalidResult('token_not_yet_valid', $payload);
        }

        $iat = isset($payload['iat']) ? (int) $payload['iat'] : null;
        if ($iat !== null && $iat > ($now + $clockSkew)) {
            return self::invalidResult('issued_in_future', $payload);
        }

        $exp = isset($payload['exp']) ? (int) $payload['exp'] : null;
        if ($exp !== null && $now > ($exp + $clockSkew)) {
            return self::invalidResult('token_expired', $payload);
        }

        if (!($options['skip_session_check'] ?? false) && !empty($payload['user_id']) && !empty($payload['session_id'])) {
            $sessionResult = self::validateSessionState($payload, $options['db'] ?? null);
            if (!$sessionResult['valid']) {
                return self::invalidResult((string) $sessionResult['reason'], $payload);
            }
        }

        return [
            'valid' => true,
            'reason' => null,
            'payload' => $payload,
        ];
    }

    public static function getUserId(string $jwt): ?string
    {
        $payload = self::verify($jwt);
        return $payload['user_id'] ?? null;
    }

    private static function validateSessionState(array $payload, ?PDO $db = null): array
    {
        try {
            if (!$db) {
                require_once __DIR__ . '/../../config/database.php';
                $database = new Database();
                $db = $database->getConnection();
            }

            $stmt = $db->prepare(
                "SELECT id, user_id, status, expires_at, revoked_at
                 FROM auth_sessions
                 WHERE id = :id
                 LIMIT 1"
            );
            $stmt->execute([':id' => (string) $payload['session_id']]);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$session) {
                return ['valid' => false, 'reason' => 'session_not_found'];
            }

            if (!hash_equals((string) $session['user_id'], (string) $payload['user_id'])) {
                return ['valid' => false, 'reason' => 'session_user_mismatch'];
            }

            if (!empty($session['revoked_at']) || ($session['status'] ?? '') !== 'active') {
                return ['valid' => false, 'reason' => 'session_revoked'];
            }

            if (!empty($session['expires_at'])) {
                $expiresAt = strtotime((string) $session['expires_at']);
                if ($expiresAt !== false && time() > ($expiresAt + getAuthClockSkewSeconds())) {
                    return ['valid' => false, 'reason' => 'session_expired'];
                }
            }

            return ['valid' => true, 'reason' => null];
        } catch (Throwable $e) {
            logAuthEvent('jwt_session_lookup_failed', [
                'reason' => $e->getMessage(),
                'session_id' => $payload['session_id'] ?? null,
                'user_id' => $payload['user_id'] ?? null,
            ]);

            return ['valid' => false, 'reason' => 'session_lookup_failed'];
        }
    }

    private static function invalidResult(string $reason, ?array $payload = null): array
    {
        return [
            'valid' => false,
            'reason' => $reason,
            'payload' => $payload,
        ];
    }

    private static function base64UrlEncode(string $data): string
    {
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
    }

    private static function base64UrlDecode(string $data)
    {
        $normalized = str_replace(['-', '_'], ['+', '/'], $data);
        $remainder = strlen($normalized) % 4;
        if ($remainder > 0) {
            $normalized .= str_repeat('=', 4 - $remainder);
        }

        return base64_decode($normalized, true);
    }
}
