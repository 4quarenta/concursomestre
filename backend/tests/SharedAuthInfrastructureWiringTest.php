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

function assertContainsSharedBridge(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsSharedBridge($base . '/api/middleware/Auth.php', '/shared/middleware/AuthMiddleware.php', 'Legacy auth middleware must bridge to shared middleware');
assertContainsSharedBridge($base . '/api/middleware/RateLimiter.php', '/shared/middleware/RateLimiter.php', 'Legacy rate limiter must bridge to shared middleware');
assertContainsSharedBridge($base . '/api/middleware/Security.php', '/shared/middleware/SecurityMiddleware.php', 'Legacy security middleware must bridge to shared middleware');
assertContainsSharedBridge($base . '/api/utils/AuthSession.php', '/shared/auth/AuthSession.php', 'Legacy AuthSession must bridge to shared auth');
assertContainsSharedBridge($base . '/api/utils/JWTAuth.php', '/shared/auth/JWTAuth.php', 'Legacy JWTAuth must bridge to shared auth');
assertContainsSharedBridge($base . '/api/utils/request_auth.php', '/shared/auth/request_auth.php', 'Legacy request_auth must bridge to shared auth');
assertContainsSharedBridge($base . '/api/utils/GoogleAuthenticator.php', '/shared/auth/GoogleAuthenticator.php', 'Legacy GoogleAuthenticator must bridge to shared auth');
assertContainsSharedBridge($base . '/api/utils/AdminSecurity.php', '/shared/security/AdminSecurity.php', 'Legacy AdminSecurity must bridge to shared security');

assertContainsSharedBridge($base . '/shared/auth/AuthCookies.php', "'secure' => shouldUseSecureAuthCookies()", 'Auth cookies must use Secure when production/HTTPS requires it');
assertContainsSharedBridge($base . '/shared/auth/AuthCookies.php', "'httponly' => true", 'Refresh token cookie must be HttpOnly');
assertContainsSharedBridge($base . '/shared/auth/AuthCookies.php', "'httponly' => false", 'CSRF cookie must remain readable by the frontend for double-submit validation');
assertContainsSharedBridge($base . '/shared/auth/AuthCookies.php', "'samesite' => getAuthSameSite()", 'Auth cookies must consistently use the configured SameSite policy');
assertContainsSharedBridge($base . '/shared/auth/AuthSession.php', 'assertValidCsrfToken($csrfCookie, $csrfHeader)', 'Refresh/session validation must enforce the CSRF double-submit token');
assertContainsSharedBridge($base . '/shared/auth/AuthSession.php', 'revokeSessionFamily($db, $sessionId, \'csrf_mismatch\', true)', 'CSRF mismatch must revoke the session family');
assertContainsSharedBridge($base . '/shared/auth/AuthConfig.php', 'return $appEnv === \'production\' || isHttpsRequest();', 'Production or HTTPS requests must force secure auth cookies');

fwrite(STDOUT, "Shared auth infrastructure wiring assertions passed.\n");
