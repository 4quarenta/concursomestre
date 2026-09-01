<?php

declare(strict_types=1);

$guard = (string) file_get_contents(__DIR__ . '/../shared/security/IpBanGuard.php');
$routes = (string) file_get_contents(__DIR__ . '/../modules/auth/routes.php');
$middleware = (string) file_get_contents(__DIR__ . '/../shared/middleware/AuthMiddleware.php');

if (preg_match('/CREATE\s+TABLE/i', $guard)) {
    throw new RuntimeException('IP ban guard must never execute runtime DDL.');
}
if (!str_contains($guard, 'SELECT 1 FROM security_ip_bans LIMIT 0')) {
    throw new RuntimeException('IP ban guard must validate the provisioned schema read-only.');
}
if (!str_contains($guard, 'SecurityIpBannedException')) {
    throw new RuntimeException('IP ban guard must expose a typed domain exception.');
}
if (str_contains($routes, 'catch (RuntimeException $e) {\n        Response::forbidden($e->getMessage())')) {
    throw new RuntimeException('Auth routes must not serialize arbitrary runtime failures as forbidden messages.');
}
if (!str_contains($routes, 'catch (SecurityIpBannedException)')) {
    throw new RuntimeException('Auth route must catch only the typed IP ban exception.');
}
if (!preg_match('/catch \(PDOException \$e\).*?Response::serverError\(\x27Login failed\x27, \$e\);/s', $routes)) {
    throw new RuntimeException('Auth route must sanitize database failures before generic runtime failures.');
}
if (!str_contains($middleware, 'catch (SecurityIpBannedException)')) {
    throw new RuntimeException('Auth middleware must catch only the typed IP ban exception.');
}

if (getenv('IP_BAN_RUNTIME_INTEGRATION') === '1') {
    require_once __DIR__ . '/../config/database.php';
    require_once __DIR__ . '/../shared/security/IpBanGuard.php';
    $database = new Database();
    ensureSecurityIpBanTable($database->getConnection());
}

fwrite(STDOUT, "IP ban runtime contract assertions passed.\n");
