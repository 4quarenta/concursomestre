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

ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/env.php';
require_once __DIR__ . '/security_headers.php';
require_once __DIR__ . '/../shared/observability/RequestContext.php';
require_once __DIR__ . '/../shared/auth/AuthConfig.php';

RequestContext::bootstrap();
applyApiSecurityHeaders();

$origin = $_SERVER['HTTP_ORIGIN'] ?? null;
$allowedOrigin = null;

if (!function_exists('isSetupCorsBootstrapOrigin')) {
    /**
     * Permite CORS apenas entre o mesmo host enquanto o setup inicial ainda nao
     * foi concluido. Isso cobre VPS nova sem .env, sem virar wildcard permanente.
     *
     * @since 1.0.0
     */
    function isSetupCorsBootstrapOrigin(?string $origin): bool
    {
        if (in_array(strtolower(getEnvString('SETUP_COMPLETED', 'false')), ['1', 'true', 'yes', 'on'], true)) {
            return false;
        }

        $requestOrigin = trim((string) $origin);
        if ($requestOrigin === '') {
            return false;
        }

        $scheme = strtolower((string) parse_url($requestOrigin, PHP_URL_SCHEME));
        $originHost = strtolower((string) parse_url($requestOrigin, PHP_URL_HOST));
        $requestHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
        $requestHost = preg_replace('/:\d+$/', '', $requestHost) ?? $requestHost;

        return in_array($scheme, ['http', 'https'], true)
            && $originHost !== ''
            && $requestHost !== ''
            && $originHost === $requestHost;
    }
}

if (isProductionEnv()) {
    $allowedOrigin = is_string($origin) && !isLocalOrigin($origin)
        ? resolveAllowedCorsOrigin($origin)
        : null;
} else {
    $allowedOrigin = resolveAllowedCorsOrigin($origin);
}

if ($allowedOrigin === null && isSetupCorsBootstrapOrigin(is_string($origin) ? $origin : null)) {
    $allowedOrigin = trim((string) $origin);
}

if ($allowedOrigin !== null) {
    header("Access-Control-Allow-Origin: {$allowedOrigin}");
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Api-Key, Accept, Origin, X-Auth-Token, X-CSRF-Token, X-Client-Platform, X-CM-Session-Key, Idempotency-Key');
    http_response_code(204);
    exit();
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Api-Key, Accept, Origin, X-Auth-Token, X-CSRF-Token, X-Client-Platform, X-CM-Session-Key, Idempotency-Key');
header('Content-Type: application/json; charset=UTF-8');

$hasAuthorization = trim((string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '')) !== ''
    || trim((string) ($_SERVER['HTTP_X_AUTH_TOKEN'] ?? '')) !== '';
$hasAuthCookie = isset($_COOKIE[getAuthRefreshCookieName()])
    || isset($_COOKIE[getAuthSessionHintCookieName()]);

if ($hasAuthorization || $hasAuthCookie) {
    header('Cache-Control: no-store, private');
    header('Pragma: no-cache');
}

ob_start();
