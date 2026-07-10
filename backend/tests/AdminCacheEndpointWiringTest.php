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

function assertContainsText(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';

assertContainsText($base . '/api/admin/cache.php', 'handleAdminCacheRoute($db);', 'Admin cache endpoint must delegate to the admin module');
assertContainsText($base . '/api/cache/manage.php', "require_once __DIR__ . '/../admin/cache.php';", 'Legacy cache manage endpoint must bridge to admin/cache.php');
assertContainsText($base . '/router.php', "'cacheManage' => 'api/admin/cache.php'", 'Router alias cacheManage must point to the official admin cache endpoint');
assertContainsText($base . '/.htaccess', 'RewriteRule ^api/cacheManage$ api/admin/cache.php [L]', 'Root rewrite for cacheManage must point to admin/cache.php');
assertContainsText($base . '/modules/statistics/routes.php', 'function buildStatisticsBancaCache(StatisticsRepository $repository): SimpleCache', 'Statistics banca cache must read operational cache settings');
assertContainsText($base . '/modules/statistics/routes.php', "(bool) (\$settings['enabled'] ?? 0)", 'Statistics banca cache must respect the global enabled flag');
assertContainsText($base . '/modules/statistics/routes.php', "\$cache = buildStatisticsBancaCache(\$context['repository']);", 'Statistics banca info route must pass the repository to the cache builder');

fwrite(STDOUT, "Admin cache endpoint wiring assertions passed.\n");
