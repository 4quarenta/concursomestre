<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/seo/sitemaps/StaticSitemapValidator.php';

function phase6SitemapAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function phase6SitemapTree(array $urls, ?string $lastmod = null): string
{
    $items = '';
    foreach ($urls as $url) {
        $items .= '<url><loc>' . htmlspecialchars($url, ENT_XML1) . '</loc>';
        if ($lastmod !== null) $items .= '<lastmod>' . $lastmod . '</lastmod>';
        $items .= '</url>';
    }
    return '<?xml version="1.0" encoding="UTF-8"?>'
        . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . $items . '</urlset>';
}

function phase6SitemapIndex(string $filename): string
{
    return '<?xml version="1.0" encoding="UTF-8"?>'
        . '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        . '<sitemap><loc>https://concursomestre.com/sitemaps/' . $filename . '</loc></sitemap>'
        . '</sitemapindex>';
}

$validator = new StaticSitemapValidator('https://concursomestre.com');
$root = sys_get_temp_dir() . '/cm-phase6-sitemap-' . bin2hex(random_bytes(5));
mkdir($root, 0775, true);

$cases = [
    'valid' => [phase6SitemapTree(['https://concursomestre.com/questoes/1/questao']), true],
    'duplicate' => [phase6SitemapTree(['https://concursomestre.com/provas/a', 'https://concursomestre.com/provas/a']), false],
    'permanent' => [phase6SitemapTree(['https://concursomestre.com/marketplace']), false],
    'future_lastmod' => [phase6SitemapTree(['https://concursomestre.com/provas/a'], '2999-01-01'), false],
    'wrong_host' => [phase6SitemapTree(['https://preview.example.com/provas/a']), false],
];

foreach ($cases as $name => [$urlset, $expectedValid]) {
    $directory = $root . '/' . $name;
    mkdir($directory, 0775, true);
    file_put_contents($directory . '/items-00001.xml', $urlset);
    file_put_contents($directory . '/sitemap.xml', phase6SitemapIndex('items-00001.xml'));
    $report = $validator->validateDirectory($directory);
    phase6SitemapAssert(($report['valid'] ?? null) === $expectedValid, 'Unexpected result for ' . $name . '.');
}

$unreferenced = $root . '/unreferenced';
mkdir($unreferenced, 0775, true);
file_put_contents($unreferenced . '/items-00001.xml', phase6SitemapTree(['https://concursomestre.com/provas/a']));
file_put_contents($unreferenced . '/extra-00001.xml', phase6SitemapTree(['https://concursomestre.com/provas/b']));
file_put_contents($unreferenced . '/sitemap.xml', phase6SitemapIndex('items-00001.xml'));
phase6SitemapAssert($validator->validateDirectory($unreferenced)['valid'] === false, 'Unreferenced XML was accepted.');

fwrite(STDOUT, "StaticSitemapPhase6PolicyTest: PASS\n");
