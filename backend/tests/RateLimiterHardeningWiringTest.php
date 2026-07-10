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

require_once __DIR__ . '/../shared/middleware/RateLimiter.php';

function assertRateLimiterHardening(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assertContainsRateLimiterHardening(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';

assertContainsRateLimiterHardening($base . '/modules/auth/routes.php', "RateLimiter::enforceProfile('auth_login')", 'Auth login must enforce rate limit.');
assertContainsRateLimiterHardening($base . '/modules/auth/routes.php', "RateLimiter::enforceProfile('auth_register')", 'Auth register must enforce rate limit.');
assertContainsRateLimiterHardening($base . '/modules/auth/routes.php', "RateLimiter::enforceProfile('auth_password')", 'Password flows must enforce rate limit.');
assertContainsRateLimiterHardening($base . '/modules/comments/routes.php', "RateLimiter::enforceProfile('comment_write')", 'Comment writes must enforce rate limit.');
assertContainsRateLimiterHardening($base . '/modules/feedback/routes.php', "RateLimiter::enforceProfile('support_write')", 'Support writes must enforce rate limit.');
assertContainsRateLimiterHardening($base . '/modules/reports/routes.php', "RateLimiter::enforceProfile('report_write')", 'Report writes must enforce rate limit.');
assertContainsRateLimiterHardening($base . '/modules/materials/routes.php', "RateLimiter::enforceProfile('upload')", 'Material uploads must enforce rate limit.');
assertContainsRateLimiterHardening($base . '/modules/questions/routes.php', "RateLimiter::enforceProfile('upload')", 'Question context uploads must enforce rate limit.');
assertContainsRateLimiterHardening($base . '/modules/users/routes.php', "RateLimiter::enforceProfile('upload')", 'Profile photo uploads must enforce rate limit.');
assertContainsRateLimiterHardening($base . '/shared/middleware/RateLimiter.php', "'analytics_track' => ['max' => 120, 'window' => 60]", 'Analytics tracking rate limit profile must be explicitly configured.');
assertContainsRateLimiterHardening($base . '/modules/analytics/routes.php', "shared/middleware/RateLimiter.php", 'Analytics tracking route must load the rate limiter.');
assertContainsRateLimiterHardening($base . '/modules/analytics/routes.php', "RateLimiter::enforceProfile('analytics_track')", 'Analytics tracking must enforce rate limit.');

$runtimeDir = sys_get_temp_dir() . '/cm-rate-limit-' . bin2hex(random_bytes(4));
mkdir($runtimeDir, 0777, true);
putenv('RATE_LIMIT_DIR=' . $runtimeDir);
putenv('RATE_LIMIT_TRUST_PROXY_HEADERS=false');

try {
    $limiter = new RateLimiter(2, 60);
    assertRateLimiterHardening($limiter->check('unit-test') === true, 'First request must be allowed.');
    assertRateLimiterHardening($limiter->check('unit-test') === true, 'Second request must be allowed.');
    $retryAfter = 0;
    assertRateLimiterHardening($limiter->check('unit-test', $retryAfter) === false, 'Third request must be blocked.');
    assertRateLimiterHardening($retryAfter > 0, 'Blocked request must expose retry-after seconds.');

    $_SERVER['REMOTE_ADDR'] = '203.0.113.10';
    $_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.99';
    assertRateLimiterHardening((new RateLimiter())->getClientIP() === '203.0.113.10', 'Proxy headers must not be trusted by default.');

    putenv('RATE_LIMIT_TRUST_PROXY_HEADERS=true');
    assertRateLimiterHardening((new RateLimiter())->getClientIP() === '198.51.100.99', 'Proxy headers must be trusted only when explicitly enabled.');
} finally {
    foreach (glob($runtimeDir . '/*.json') ?: [] as $file) {
        @unlink($file);
    }
    @rmdir($runtimeDir);
    putenv('RATE_LIMIT_DIR');
    putenv('RATE_LIMIT_TRUST_PROXY_HEADERS');
    unset($_SERVER['REMOTE_ADDR'], $_SERVER['HTTP_X_FORWARDED_FOR']);
}

fwrite(STDOUT, "Rate limiter hardening wiring assertions passed.\n");
