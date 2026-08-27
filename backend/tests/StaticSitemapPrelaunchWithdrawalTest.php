<?php

declare(strict_types=1);

function prelaunchWithdrawalAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function prelaunchWithdrawalRemove(string $directory): void
{
    if (!is_dir($directory)) return;
    foreach (scandir($directory) ?: [] as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $directory . DIRECTORY_SEPARATOR . $item;
        is_dir($path) ? prelaunchWithdrawalRemove($path) : unlink($path);
    }
    rmdir($directory);
}

$root = sys_get_temp_dir() . '/cm-sitemap-prelaunch-' . bin2hex(random_bytes(5));
$output = $root . '/sitemaps';
mkdir($output, 0775, true);
file_put_contents($output . '/sitemap.xml', '<stale/>');
file_put_contents($output . '/questions-00001.xml', '<stale/>');

$previous = [
    'SEO_LAUNCH_MODE' => getenv('SEO_LAUNCH_MODE'),
    'SEO_DEPLOYMENT_ENVIRONMENT' => getenv('SEO_DEPLOYMENT_ENVIRONMENT'),
    'SEO_PRODUCTION_INDEXING' => getenv('SEO_PRODUCTION_INDEXING'),
    'SEO_PRODUCTION_SITEMAP' => getenv('SEO_PRODUCTION_SITEMAP'),
    'SITEMAP_OUTPUT_DIR' => getenv('SITEMAP_OUTPUT_DIR'),
];
putenv('SEO_LAUNCH_MODE=PRELAUNCH');
putenv('SEO_DEPLOYMENT_ENVIRONMENT');
putenv('SEO_PRODUCTION_INDEXING');
putenv('SEO_PRODUCTION_SITEMAP');
putenv('SITEMAP_OUTPUT_DIR=' . $output);

$command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/../scripts/seo/generate_static_sitemaps.php');
$lines = [];
$exitCode = 0;
exec($command . ' 2>&1', $lines, $exitCode);

foreach ($previous as $name => $value) {
    putenv($value === false ? $name : $name . '=' . $value);
}

prelaunchWithdrawalAssert($exitCode === 0, 'PRELAUNCH withdrawal must complete without database access.');
prelaunchWithdrawalAssert(!file_exists($output) && !is_link($output), 'PRELAUNCH must withdraw the stale public artifact tree.');
$statePath = $root . '/.sitemaps-publication-state.json';
$state = json_decode((string) file_get_contents($statePath), true, 32, JSON_THROW_ON_ERROR);
prelaunchWithdrawalAssert(($state['state'] ?? null) === 'DIRTY', 'PRELAUNCH must persist a DIRTY publication state.');
prelaunchWithdrawalAssert(
    str_contains(implode("\n", $lines), '"status":"withdrawn"'),
    'PRELAUNCH generator output must declare withdrawal.'
);

unlink($statePath);
prelaunchWithdrawalRemove($root);

fwrite(STDOUT, "StaticSitemapPrelaunchWithdrawalTest: PASS\n");
