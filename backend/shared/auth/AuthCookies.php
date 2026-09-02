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

require_once __DIR__ . '/AuthConfig.php';

if (!function_exists('setRefreshTokenCookie')) {
    /**
     * Persiste o refresh token no cookie usado pelo frontend para renovar sessao.
     *
     * @since 1.0.0
     */
    function setRefreshTokenCookie(string $token, DateTimeImmutable $expiresAt): void
    {
        $options = [
            'expires' => $expiresAt->getTimestamp(),
            'path' => getAuthCookiePath(),
            'secure' => shouldUseSecureAuthCookies(),
            'httponly' => true,
            'samesite' => getAuthSameSite(),
        ];

        $domain = getAuthCookieDomain();
        if ($domain !== '') {
            $options['domain'] = $domain;
        }

        setcookie(getAuthRefreshCookieName(), $token, $options);

        $hintOptions = $options;
        $hintOptions['path'] = '/';
        $hintOptions['httponly'] = false;
        setcookie(getAuthSessionHintCookieName(), '1', $hintOptions);
    }
}

if (!function_exists('setCsrfCookie')) {
    /**
     * Persiste o token CSRF separado para validacao de mutacoes sensiveis.
     *
     * @since 1.0.0
     */
    function setCsrfCookie(string $token, DateTimeImmutable $expiresAt): void
    {
        $options = [
            'expires' => $expiresAt->getTimestamp(),
            'path' => getAuthCsrfCookiePath(),
            'secure' => shouldUseSecureAuthCookies(),
            'httponly' => false,
            'samesite' => getAuthSameSite(),
        ];

        $domain = getAuthCookieDomain();
        if ($domain !== '') {
            $options['domain'] = $domain;
        }

        setcookie(getAuthCsrfCookieName(), $token, $options);
    }
}

if (!function_exists('setAuthRouteSessionCookie')) {
    /**
     * Persiste a ancora de sessao usada exclusivamente na decisao server-side
     * de acesso ao shell administrativo. Ela nao e um bearer token de API.
     *
     * @since 1.0.0
     */
    function setAuthRouteSessionCookie(string $sessionId, DateTimeImmutable $expiresAt): void
    {
        $options = [
            'expires' => $expiresAt->getTimestamp(),
            'path' => '/',
            'secure' => shouldUseSecureAuthCookies(),
            'httponly' => true,
            'samesite' => getAuthSameSite(),
        ];

        $domain = getAuthCookieDomain();
        if ($domain !== '') {
            $options['domain'] = $domain;
        }

        setcookie(getAuthRouteSessionCookieName(), $sessionId, $options);
    }
}

if (!function_exists('clearAuthCookies')) {
    /**
     * Remove cookies de auth ao fazer logout ou revogacao de sessao.
     *
     * @since 1.0.0
     */
    function clearAuthCookies(): void
    {
        $expiredAt = time() - 3600;
        $refreshOptions = [
            'expires' => $expiredAt,
            'path' => getAuthCookiePath(),
            'secure' => shouldUseSecureAuthCookies(),
            'httponly' => true,
            'samesite' => getAuthSameSite(),
        ];

        $csrfOptions = [
            'expires' => $expiredAt,
            'path' => getAuthCsrfCookiePath(),
            'secure' => shouldUseSecureAuthCookies(),
            'httponly' => false,
            'samesite' => getAuthSameSite(),
        ];

        $hintOptions = [
            'expires' => $expiredAt,
            'path' => '/',
            'secure' => shouldUseSecureAuthCookies(),
            'httponly' => false,
            'samesite' => getAuthSameSite(),
        ];

        $routeSessionOptions = [
            'expires' => $expiredAt,
            'path' => '/',
            'secure' => shouldUseSecureAuthCookies(),
            'httponly' => true,
            'samesite' => getAuthSameSite(),
        ];

        $domain = getAuthCookieDomain();
        if ($domain !== '') {
            $refreshOptions['domain'] = $domain;
            $csrfOptions['domain'] = $domain;
            $hintOptions['domain'] = $domain;
            $routeSessionOptions['domain'] = $domain;
        }

        $refreshCookiePaths = array_values(array_unique(array_filter([
            getAuthCookiePath(),
            '/api/auth',
            '/questao-pro-backend/api/auth',
            '/',
        ])));

        foreach ($refreshCookiePaths as $path) {
            $refreshOptions['path'] = $path;
            setcookie(getAuthRefreshCookieName(), '', $refreshOptions);
        }

        setcookie(getAuthCsrfCookieName(), '', $csrfOptions);
        setcookie(getAuthSessionHintCookieName(), '', $hintOptions);
        setcookie(getAuthRouteSessionCookieName(), '', $routeSessionOptions);
    }
}

if (!function_exists('getRefreshTokenFromCookie')) {
    /**
     * Recupera o refresh token direto do cookie para o fluxo de renovacao.
     *
     * @since 1.0.0
     */
    function getRefreshTokenFromCookie(): ?string
    {
        $token = trim((string) ($_COOKIE[getAuthRefreshCookieName()] ?? ''));
        return $token !== '' ? $token : null;
    }
}

if (!function_exists('getAuthRouteSessionIdFromCookie')) {
    /**
     * Recupera somente UUIDs canonicos do cookie de sessao de rota. Valores
     * malformados nao chegam a consulta de autorizacao.
     *
     * @since 1.0.0
     */
    function getAuthRouteSessionIdFromCookie(): ?string
    {
        $sessionId = trim((string) ($_COOKIE[getAuthRouteSessionCookieName()] ?? ''));

        if (!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i', $sessionId)) {
            return null;
        }

        return strtolower($sessionId);
    }
}

if (!function_exists('getCsrfTokenFromCookie')) {
    /**
     * Recupera o CSRF token salvo em cookie.
     *
     * @since 1.0.0
     */
    function getCsrfTokenFromCookie(): ?string
    {
        $token = trim((string) ($_COOKIE[getAuthCsrfCookieName()] ?? ''));
        return $token !== '' ? $token : null;
    }
}

if (!function_exists('getCsrfTokenFromRequest')) {
    /**
     * Recupera o CSRF token enviado pelo frontend via header.
     *
     * @since 1.0.0
     */
    function getCsrfTokenFromRequest(): ?string
    {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $token = $headers['X-CSRF-Token'] ?? $headers['x-csrf-token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        $token = trim((string) $token);

        return $token !== '' ? $token : null;
    }
}

if (!function_exists('assertValidCsrfToken')) {
    /**
     * Compara o token CSRF do cookie com o recebido na requisicao.
     *
     * @since 1.0.0
     */
    function assertValidCsrfToken(?string $cookieToken, ?string $requestToken): bool
    {
        return is_string($cookieToken)
            && $cookieToken !== ''
            && is_string($requestToken)
            && $requestToken !== ''
            && hash_equals($cookieToken, $requestToken);
    }
}
