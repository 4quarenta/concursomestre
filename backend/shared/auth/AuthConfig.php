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

if (!function_exists('authConfig')) {
    /**
     * Le variaveis de ambiente usadas pela camada de auth, com fallback seguro.
     *
     * @since 1.0.0
     */
    function authConfig(string $key, $default = null)
    {
        $value = $_ENV[$key] ?? getenv($key);
        if ($value === false || $value === null || $value === '') {
            return $default;
        }

        return $value;
    }
}

if (!function_exists('authBoolConfig')) {
    /**
     * Normaliza variaveis booleanas vindas do ambiente para uso no auth.
     *
     * @since 1.0.0
     */
    function authBoolConfig(string $key, bool $default = false): bool
    {
        $value = authConfig($key, null);
        if ($value === null) {
            return $default;
        }

        if (is_bool($value)) {
            return $value;
        }

        return in_array(strtolower((string) $value), ['1', 'true', 'yes', 'on'], true);
    }
}

if (!function_exists('getAuthIssuer')) {
    /**
     * Resolve o issuer usado nos JWTs emitidos pela plataforma.
     *
     * @since 1.0.0
     */
    function getAuthIssuer(): string
    {
        $configured = trim((string) authConfig('AUTH_JWT_ISSUER', ''));
        if ($configured !== '') {
            return $configured;
        }

        $appUrl = trim((string) authConfig('APP_URL', 'http://localhost:3000'));
        return rtrim($appUrl, '/');
    }
}

if (!function_exists('getAuthAudience')) {
    /**
     * Define o audience esperado pelos tokens do site/app.
     *
     * @since 1.0.0
     */
    function getAuthAudience(): string
    {
        $configured = trim((string) authConfig('AUTH_JWT_AUDIENCE', ''));
        if ($configured !== '') {
            return $configured;
        }

        return 'concursomestre-web';
    }
}

if (!function_exists('getAuthAccessTokenTtlSeconds')) {
    /**
     * Tempo de vida do access token usado na navegacao do frontend.
     *
     * @since 1.0.0
     */
    function getAuthAccessTokenTtlSeconds(): int
    {
        return max(300, (int) authConfig('AUTH_ACCESS_TOKEN_TTL', 900));
    }
}

if (!function_exists('getAuthRefreshTokenTtlSeconds')) {
    /**
     * Tempo de vida do refresh token usado para renovar a sessao.
     *
     * @since 1.0.0
     */
    function getAuthRefreshTokenTtlSeconds(): int
    {
        return max(3600, (int) authConfig('AUTH_REFRESH_TOKEN_TTL', 60 * 60 * 24 * 30));
    }
}

if (!function_exists('getAuthClockSkewSeconds')) {
    /**
     * Tolerancia de clock para validar tokens emitidos.
     *
     * @since 1.0.0
     */
    function getAuthClockSkewSeconds(): int
    {
        return max(0, (int) authConfig('AUTH_CLOCK_SKEW_SECONDS', 60));
    }
}

if (!function_exists('getAuthRefreshCookieName')) {
    /**
     * Nome do cookie que armazena o refresh token no navegador.
     *
     * @since 1.0.0
     */
    function getAuthRefreshCookieName(): string
    {
        return trim((string) authConfig('AUTH_REFRESH_COOKIE_NAME', 'cm_refresh'));
    }
}

if (!function_exists('getAuthCsrfCookieName')) {
    /**
     * Nome do cookie com o token CSRF usado nas rotas protegidas.
     *
     * @since 1.0.0
     */
    function getAuthCsrfCookieName(): string
    {
        return trim((string) authConfig('AUTH_CSRF_COOKIE_NAME', 'cm_csrf'));
    }
}

if (!function_exists('getAuthCookieDomain')) {
    /**
     * Dominio configurado para cookies de auth quando ha multi-subdominio.
     *
     * @since 1.0.0
     */
    function getAuthCookieDomain(): string
    {
        return trim((string) authConfig('AUTH_COOKIE_DOMAIN', ''));
    }
}

if (!function_exists('getAuthCookiePath')) {
    /**
     * Path default do cookie de refresh.
     *
     * @since 1.0.0
     */
    function getAuthCookiePath(): string
    {
        return trim((string) authConfig('AUTH_COOKIE_PATH', '/'));
    }
}

if (!function_exists('getAuthCsrfCookiePath')) {
    /**
     * Path do cookie CSRF, geralmente raiz do site.
     *
     * @since 1.0.0
     */
    function getAuthCsrfCookiePath(): string
    {
        return trim((string) authConfig('AUTH_CSRF_COOKIE_PATH', '/'));
    }
}

if (!function_exists('getAuthSameSite')) {
    /**
     * Normaliza o SameSite para os cookies de autenticacao.
     *
     * @since 1.0.0
     */
    function getAuthSameSite(): string
    {
        $sameSite = strtolower(trim((string) authConfig('AUTH_COOKIE_SAMESITE', 'lax')));

        return match ($sameSite) {
            'strict' => 'Strict',
            'none' => 'None',
            default => 'Lax',
        };
    }
}

if (!function_exists('isHttpsRequest')) {
    /**
     * Detecta se a requisicao atual esta em HTTPS ou recebeu proxy HTTPS.
     *
     * @since 1.0.0
     */
    function isHttpsRequest(): bool
    {
        if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
            return true;
        }

        $forwardedProto = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
        return $forwardedProto === 'https';
    }
}

if (!function_exists('shouldUseSecureAuthCookies')) {
    /**
     * Decide se os cookies devem ser marcados como Secure.
     *
     * @since 1.0.0
     */
    function shouldUseSecureAuthCookies(): bool
    {
        if (authBoolConfig('AUTH_COOKIE_SECURE', false)) {
            return true;
        }

        $appEnv = strtolower((string) authConfig('APP_ENV', 'development'));
        return $appEnv === 'production' || isHttpsRequest();
    }
}

if (!function_exists('getAuthInstanceId')) {
    /**
     * Identifica a instancia que emitiu tokens para auditoria.
     *
     * @since 1.0.0
     */
    function getAuthInstanceId(): string
    {
        return trim((string) authConfig('AUTH_INSTANCE_ID', php_uname('n') ?: 'php-host'));
    }
}

if (!function_exists('getAuthClientIp')) {
    /**
     * Normaliza um candidato de IP vindo de headers de proxy ou do servidor.
     *
     * @since 1.0.0
     */
    function normalizeAuthIpCandidate(mixed $value): ?string
    {
        $raw = trim((string) $value);
        if ($raw === '' || strtolower($raw) === 'unknown') {
            return null;
        }

        if (stripos($raw, 'for=') === 0) {
            $raw = trim(substr($raw, 4), " \t\n\r\0\x0B\"'");
        }

        if (preg_match('/^\[([^\]]+)\](?::\d+)?$/', $raw, $matches)) {
            $raw = $matches[1];
        } elseif (preg_match('/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i', $raw, $matches)) {
            $raw = $matches[1];
        } elseif (preg_match('/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/', $raw, $matches)) {
            $raw = $matches[1];
        }

        return filter_var($raw, FILTER_VALIDATE_IP) ? $raw : null;
    }

    /**
     * Extrai candidatos de IP do header RFC 7239 Forwarded.
     *
     * @since 1.0.0
     */
    function extractForwardedHeaderIps(string $headerValue): array
    {
        if (trim($headerValue) === '') {
            return [];
        }

        preg_match_all('/for=(?:"?\\[?([^;,\"]+)\\]?\"?)/i', $headerValue, $matches);
        return array_values(array_filter(array_map(
            static fn (string $candidate): ?string => normalizeAuthIpCandidate($candidate),
            $matches[1] ?? []
        )));
    }

    /**
     * Informa se um IP e publico para fins de priorizacao de headers.
     *
     * @since 1.0.0
     */
    function isPublicAuthIp(string $ip): bool
    {
        return (bool) filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        );
    }

    /**
     * Resolve o IP do cliente priorizando header de proxy.
     *
     * @since 1.0.0
     */
    function getAuthClientIp(): ?string
    {
        $candidates = [];

        $singleValueHeaders = [
            'HTTP_CF_CONNECTING_IP',
            'HTTP_TRUE_CLIENT_IP',
            'HTTP_X_REAL_IP',
            'HTTP_CLIENT_IP',
            'REMOTE_ADDR',
        ];
        foreach ($singleValueHeaders as $header) {
            $candidate = normalizeAuthIpCandidate($_SERVER[$header] ?? null);
            if ($candidate !== null) {
                $candidates[] = $candidate;
            }
        }

        $listHeaders = [
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_FORWARDED',
            'HTTP_FORWARDED_FOR',
        ];
        foreach ($listHeaders as $header) {
            $raw = trim((string) ($_SERVER[$header] ?? ''));
            if ($raw === '') {
                continue;
            }

            foreach (array_map('trim', explode(',', $raw)) as $part) {
                $candidate = normalizeAuthIpCandidate($part);
                if ($candidate !== null) {
                    $candidates[] = $candidate;
                }
            }
        }

        foreach (extractForwardedHeaderIps((string) ($_SERVER['HTTP_FORWARDED'] ?? '')) as $candidate) {
            $candidates[] = $candidate;
        }

        $uniqueCandidates = array_values(array_unique($candidates));
        foreach ($uniqueCandidates as $candidate) {
            if (isPublicAuthIp($candidate)) {
                return $candidate;
            }
        }

        return $uniqueCandidates[0] ?? null;
    }
}

if (!function_exists('getAuthRefreshReuseGraceSeconds')) {
    /**
     * Janela curta para tolerar refresh concorrente muito proximo sem derrubar a sessao.
     *
     * @since 1.0.0
     */
    function getAuthRefreshReuseGraceSeconds(): int
    {
        return max(0, (int) authConfig('AUTH_REFRESH_REUSE_GRACE_SECONDS', 10));
    }
}

if (!function_exists('getAuthUserAgent')) {
    /**
     * Recupera o user-agent para auditoria e seguranca.
     *
     * @since 1.0.0
     */
    function getAuthUserAgent(): ?string
    {
        $userAgent = trim((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
        return $userAgent !== '' ? $userAgent : null;
    }
}

if (!function_exists('authNow')) {
    /**
     * Cria um DateTime padrao para logs e expiracoes.
     *
     * @since 1.0.0
     */
    function authNow(): DateTimeImmutable
    {
        return new DateTimeImmutable('now', new DateTimeZone(getAppTimezone()));
    }
}

if (!function_exists('formatAuthDate')) {
    /**
     * Padroniza datas de auth no formato persistido no banco.
     *
     * @since 1.0.0
     */
    function formatAuthDate(DateTimeImmutable $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }
}

if (!function_exists('createAuthUuid')) {
    /**
     * Gera UUID v4 para sessions e refresh tokens.
     *
     * @since 1.0.0
     */
    function createAuthUuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}

if (!function_exists('createOpaqueAuthToken')) {
    /**
     * Gera um token opaco usado em cookies e refresh tokens.
     *
     * @since 1.0.0
     */
    function createOpaqueAuthToken(int $bytes = 48): string
    {
        return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
    }
}

if (!function_exists('hashOpaqueToken')) {
    /**
     * Hash usado para armazenar tokens opacos sem vazar segredo.
     *
     * @since 1.0.0
     */
    function hashOpaqueToken(string $token): string
    {
        return hash('sha256', $token);
    }
}
