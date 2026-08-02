<?php

declare(strict_types=1);

function adminGranTaxonomyRateLimitAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$base = dirname(__DIR__);
$limiter = file_get_contents($base . '/shared/middleware/RateLimiter.php');
$route = file_get_contents($base . '/modules/admin/gran_crawler_routes.php');

adminGranTaxonomyRateLimitAssert(
    is_string($limiter) && is_string($route),
    'Arquivos do limitador da sincronizacao Gran indisponiveis.'
);
adminGranTaxonomyRateLimitAssert(
    str_contains($limiter, "'admin_taxonomy_sync' => ['max' => 600, 'window' => 900]"),
    'A sincronizacao de taxonomias precisa de perfil proprio com lotes grandes para nao consumir o limite da coleta avulsa.'
);
adminGranTaxonomyRateLimitAssert(
    substr_count($route, "RateLimiter::enforceProfile('admin_taxonomy_sync', \$actorUserId)") === 7,
    'Cada operacao mutavel da sincronizacao Gran deve usar o perfil administrativo de lote.'
);
adminGranTaxonomyRateLimitAssert(
    str_contains($route, "RateLimiter::enforceProfile('admin_crawler', \$actorUserId);")
        && str_contains($route, "\$action === 'map'"),
    'A coleta avulsa deve manter o limite restrito do crawler.'
);

echo "AdminGranTaxonomyRateLimitWiringTest: PASS\n";
