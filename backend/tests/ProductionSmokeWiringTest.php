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

declare(strict_types=1);

function assertContainsProductionSmoke(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';
$script = $base . '/scripts/tasks/production_smoke.php';

assertContainsProductionSmoke(
    $script,
    'SMOKE_API_BASE_URL',
    'Production smoke must allow the target API URL to be configured'
);

assertContainsProductionSmoke(
    $script,
    'SMOKE_WEB_BASE_URL',
    'Production smoke must allow the target web URL to be configured'
);

assertContainsProductionSmoke(
    $script,
    'SMOKE_AUTH_EMAIL',
    'Production smoke must allow authenticated smoke credentials to be configured'
);

assertContainsProductionSmoke(
    $script,
    'SMOKE_AUTH_REQUIRED',
    'Production smoke must support making authenticated smoke mandatory in staging'
);

assertContainsProductionSmoke(
    $script,
    'SMOKE_ADMIN_REQUIRED',
    'Production smoke must support making admin authenticated checks mandatory in staging'
);

assertContainsProductionSmoke(
    $script,
    '/plans/list.php',
    'Production smoke must check the public plans API'
);

assertContainsProductionSmoke(
    $script,
    '/questionsList?page=1&limit=1',
    'Production smoke must check the public questions list API'
);

assertContainsProductionSmoke(
    $script,
    '/settings.php',
    'Production smoke must check the public settings API'
);

assertContainsProductionSmoke(
    $script,
    '/auth/login.php',
    'Production smoke must exercise the real login endpoint when credentials are configured'
);

assertContainsProductionSmoke(
    $script,
    '/auth/me.php',
    'Production smoke must exercise an authenticated profile endpoint after login'
);

assertContainsProductionSmoke(
    $script,
    '/notifications/list.php?page=1&limit=1',
    'Production smoke must exercise an authenticated user endpoint after login'
);

assertContainsProductionSmoke(
    $script,
    '/admin/stats.php?period=today',
    'Production smoke must exercise the admin dashboard stats endpoint for admin/staff credentials'
);

assertContainsProductionSmoke(
    $script,
    '/admin/settings.php',
    'Production smoke must exercise the admin settings endpoint for admin/staff credentials'
);

assertContainsProductionSmoke(
    $script,
    '/admin/comments_moderation.php?status=pending&origin=all&page=1&perPage=1',
    'Production smoke must exercise the admin comments moderation list endpoint for admin/staff credentials'
);

assertContainsProductionSmoke(
    $script,
    'Authorization',
    'Production smoke must call authenticated endpoints with the issued bearer token'
);

assertContainsProductionSmoke(
    $script,
    '/questoes',
    'Production smoke must check the canonical public questions route'
);

assertContainsProductionSmoke(
    $script,
    '/practice',
    'Production smoke must check the legacy /practice alias'
);

assertContainsProductionSmoke(
    $script,
    '/questions',
    'Production smoke must check the /questions alias route'
);

assertContainsProductionSmoke(
    $script,
    "'expected_status' => 308",
    'Production smoke must require permanent redirects for legacy aliases'
);

assertContainsProductionSmoke(
    $script,
    'NEXT_REDIRECT',
    'Production smoke must fail if the legacy questions route still leaks a redirect payload'
);

assertContainsProductionSmoke(
    $script,
    'forbidden_json_keys',
    'Production smoke must reject sensitive keys returned by public JSON endpoints'
);

assertContainsProductionSmoke(
    $script,
    'smokeFindMissingHeaders',
    'Production smoke must validate required security headers'
);

assertContainsProductionSmoke(
    $script,
    'x-content-type-options',
    'Production smoke must check nosniff headers on public surfaces'
);

assertContainsProductionSmoke(
    $script,
    'content-security-policy',
    'Production smoke must check CSP headers on public surfaces'
);

assertContainsProductionSmoke(
    $script,
    'smokeUrlUsesHttpsForPublicHost',
    'Production smoke must reject HTTP on public staging/production hosts'
);

assertContainsProductionSmoke(
    $script,
    'forbidden_top_level_json_keys',
    'Production smoke must distinguish top-level admin settings from public nested metadata'
);

assertContainsProductionSmoke(
    $script,
    'hasStripeSecretConfigured',
    'Production smoke must fail if public settings expose private integration flags'
);

assertContainsProductionSmoke(
    $script,
    'stripeKey',
    'Production smoke must fail if public settings expose legacy Stripe key storage'
);

assertContainsProductionSmoke(
    $script,
    'SHOW STATUS LIKE \'Threads_connected\'',
    'Production smoke must inspect MySQL active connection count'
);

assertContainsProductionSmoke(
    $script,
    'SHOW VARIABLES LIKE \'max_connections\'',
    'Production smoke must inspect MySQL max connection limit'
);

assertContainsProductionSmoke(
    $script,
    'exit(2)',
    'Production smoke must fail non-zero when critical checks fail'
);

fwrite(STDOUT, "Production smoke wiring assertions passed.\n");
