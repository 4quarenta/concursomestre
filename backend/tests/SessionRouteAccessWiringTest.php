<?php

declare(strict_types=1);

function assertSessionRouteAccessContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || !str_contains($content, $needle)) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__);
$proxyPath = dirname(__DIR__, 2) . '/src/proxy.ts';

assertSessionRouteAccessContains(
    $base . '/api/auth/session-route-access.php',
    'handleAuthSessionRouteAccessRoute',
    'Session route access endpoint must delegate to the auth module.'
);
assertSessionRouteAccessContains(
    $base . '/modules/auth/routes.php',
    'HTTP_X_CONCURSOMESTRE_SESSION_ROUTE_CHECK',
    'Session route access must require the private server check header.'
);
assertSessionRouteAccessContains(
    $base . '/modules/auth/routes.php',
    "(string) (\$record['session_status'] ?? '') !== 'active'",
    'Session route access must reject inactive sessions.'
);
assertSessionRouteAccessContains(
    $base . '/modules/auth/routes.php',
    "strtotime((string) \$record['session_expires_at']) < time()",
    'Session route access must reject expired sessions.'
);
assertSessionRouteAccessContains(
    $proxyPath,
    "request.nextUrl.pathname === '/' && await hasAuthenticatedRouteSession(request)",
    'The root route must be resolved from the authenticated server session.'
);
assertSessionRouteAccessContains(
    $base . '/shared/auth/AuthCookies.php',
    "setcookie(getAuthSessionHintCookieName(), '1'",
    'Issuing a refresh cookie must also publish a non-sensitive session hint.'
);
assertSessionRouteAccessContains(
    $base . '/shared/auth/AuthCookies.php',
    "setcookie(getAuthSessionHintCookieName(), '',",
    'Logout must clear the non-sensitive session hint.'
);
assertSessionRouteAccessContains(
    $proxyPath,
    "dashboardUrl.pathname = '/dashboard'",
    'An authenticated root request must be redirected before rendering.'
);

fwrite(STDOUT, "SessionRouteAccessWiringTest: PASS\n");
