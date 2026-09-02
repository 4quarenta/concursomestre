<?php

declare(strict_types=1);

function assertAdminRouteAccessContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || !str_contains($content, $needle)) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__);
$proxyCandidates = [
    dirname(__DIR__, 2) . '/src/proxy.ts',
    dirname(__DIR__) . '/../frontend/src/proxy.ts',
];
$proxyPath = null;
foreach ($proxyCandidates as $candidate) {
    if (is_file($candidate)) {
        $proxyPath = $candidate;
        break;
    }
}
if ($proxyPath === null) {
    throw new RuntimeException('Nao foi possivel localizar src/proxy.ts.');
}
assertAdminRouteAccessContains(
    $base . '/api/auth/admin-route-access.php',
    'handleAuthAdminRouteAccessRoute',
    'Admin route access endpoint must delegate to the auth module.'
);
assertAdminRouteAccessContains(
    $base . '/modules/auth/routes.php',
    'getAuthRouteSessionIdFromCookie()',
    'Admin route access must prefer the stable HttpOnly route-session cookie.'
);
assertAdminRouteAccessContains(
    $base . '/modules/auth/routes.php',
    'findAuthRouteSessionRecord($db, $routeSessionId)',
    'Admin route access must validate the route session against persistent state.'
);
assertAdminRouteAccessContains(
    $base . '/shared/auth/AuthSession.php',
    "setAuthRouteSessionCookie(\$session['id'], \$session['expires_at'])",
    'Login must issue a stable route-session cookie.'
);
assertAdminRouteAccessContains(
    $base . '/shared/auth/AuthSession.php',
    "setAuthRouteSessionCookie(\$sessionId, \$newRefresh['expires_at'])",
    'Refresh rotation must preserve the stable route-session cookie.'
);
assertAdminRouteAccessContains(
    $base . '/shared/auth/AuthCookies.php',
    "setcookie(getAuthRouteSessionCookieName(), '', \$routeSessionOptions)",
    'Logout must clear the route-session cookie.'
);
assertAdminRouteAccessContains(
    $base . '/modules/auth/routes.php',
    "in_array(\$role, ['admin', 'staff'], true)",
    'Admin route access must allow only admin and staff roles.'
);
assertAdminRouteAccessContains(
    $base . '/modules/auth/routes.php',
    "Response::notFound('Recurso nao encontrado.')",
    'Admin route access must hide anonymous, invalid and ordinary sessions behind 404.'
);
assertAdminRouteAccessContains(
    $base . '/modules/auth/routes.php',
    "|| !empty(\$record['session_revoked_at'])",
    'Admin route access must reject revoked refresh sessions.'
);
assertAdminRouteAccessContains(
    $base . '/modules/auth/routes.php',
    "strtotime((string) \$record['session_expires_at']) < time()",
    'Admin route access must reject expired sessions.'
);
assertAdminRouteAccessContains(
    $base . '/modules/auth/routes.php',
    "(string) (\$record['session_status'] ?? '') !== 'active'",
    'Admin route access must validate the active refresh-session state.'
);
assertAdminRouteAccessContains(
    $proxyPath,
    'await canAccessAdminRoute(request)',
    'Next proxy must use the server-side admin access check.'
);

fwrite(STDOUT, "AdminRouteAccessWiringTest: PASS\n");
