<?php

declare(strict_types=1);

function assertAdminApiRbac(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function adminHandlerBody(string $routesSource, string $handler): string
{
    $pattern = '/function\\s+' . preg_quote($handler, '/') . '\\s*\\([^)]*\\)\\s*:\\s*void\\s*\\{/';
    if (preg_match($pattern, $routesSource, $match, PREG_OFFSET_CAPTURE) !== 1) {
        throw new RuntimeException('Handler administrativo nao encontrado: ' . $handler);
    }

    $start = $match[0][1];
    $next = strpos($routesSource, "\nfunction ", $start + strlen($match[0][0]));
    return substr($routesSource, $start, $next === false ? null : $next - $start);
}

$base = dirname(__DIR__);
$routesPath = $base . '/modules/admin/routes.php';
$routesSource = file_get_contents($routesPath);
assertAdminApiRbac(is_string($routesSource), 'Nao foi possivel ler as rotas administrativas.');

$bridgeFiles = glob($base . '/api/admin/*.php') ?: [];
assertAdminApiRbac($bridgeFiles !== [], 'Nenhum endpoint /api/admin foi encontrado.');

foreach ($bridgeFiles as $bridgePath) {
    $bridgeSource = file_get_contents($bridgePath);
    $isGranCrawlerBridge = basename($bridgePath) === 'gran_crawler.php';
    if ($isGranCrawlerBridge) {
        $granRouteSource = file_get_contents($base . '/modules/admin/gran_crawler_routes.php');
        assertAdminApiRbac(
            is_string($bridgeSource)
                && str_contains($bridgeSource, "'/../../modules/admin/gran_crawler_routes.php'")
                && str_contains($bridgeSource, 'handleAdminGranCrawlerRoute($db)')
                && is_string($granRouteSource)
                && str_contains($granRouteSource, 'requireAdminSessionContext($db)'),
            'Bridge do crawler deve delegar ao modulo dedicado protegido por RBAC.'
        );
        continue;
    }
    if (basename($bridgePath) === 'files.php') {
        $fileRouteSource = file_get_contents($base . '/modules/admin/file_library_routes.php');
        assertAdminApiRbac(
                is_string($bridgeSource)
                && str_contains($bridgeSource, 'file_library_routes.php')
                && str_contains($bridgeSource, 'handleAdminFileLibraryRoute(')
                && is_string($fileRouteSource)
                && str_contains($fileRouteSource, 'requirePlatformAdminSessionContext($db)'),
            'Bridge de arquivos deve delegar ao modulo dedicado protegido por RBAC.'
        );
        continue;
    }
    assertAdminApiRbac(
        is_string($bridgeSource) && str_contains($bridgeSource, "'/../../modules/admin/routes.php'"),
        'Bridge administrativo deve delegar ao modulo com RBAC: ' . basename($bridgePath)
    );

    preg_match('/\\b(handleAdmin[A-Za-z0-9_]+Route)\\(\\$db/', (string) $bridgeSource, $handlerMatch);
    $handler = (string) ($handlerMatch[1] ?? '');
    assertAdminApiRbac($handler !== '', 'Bridge administrativo sem handler modular: ' . basename($bridgePath));

    $handlerSource = adminHandlerBody((string) $routesSource, $handler);
    assertAdminApiRbac(
        str_contains($handlerSource, 'requireAdminSessionContext(')
            || str_contains($handlerSource, 'requirePlatformAdminSessionContext('),
        'Handler administrativo sem guarda RBAC: ' . $handler
    );
}

$middlewareSource = file_get_contents($base . '/shared/middleware/AuthMiddleware.php');
assertAdminApiRbac(
    is_string($middlewareSource) && str_contains($middlewareSource, "in_array(\$role, ['admin', 'staff'], true)"),
    'AuthMiddleware::requireAdmin deve aceitar somente admin e staff.'
);

fwrite(STDOUT, "AdminApiRbacWiringTest: PASS\n");
