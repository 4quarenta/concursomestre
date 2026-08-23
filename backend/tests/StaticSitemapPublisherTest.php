<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/seo/sitemaps/StaticSitemapPublisher.php';
require_once __DIR__ . '/../modules/seo/sitemaps/StaticSitemapValidator.php';

function sitemapPublisherAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

/** @param string|list<string> $filenames */
function sitemapFixtureIndex(string|array $filenames): string
{
    $items = '';
    foreach ((array) $filenames as $filename) {
        $items .= '<sitemap><loc>https://concursomestre.com/sitemaps/' . $filename . '</loc></sitemap>';
    }
    return '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
        . '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        . $items . '</sitemapindex>' . "\n";
}

function sitemapFixtureUrlSet(string $url): string
{
    return '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
        . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        . '<url><loc>' . htmlspecialchars($url, ENT_XML1) . '</loc></url>'
        . '</urlset>' . "\n";
}

$root = sys_get_temp_dir() . '/cm-sitemap-publisher-' . bin2hex(random_bytes(5));
$output = $root . '/sitemaps';
mkdir($output, 0775, true);
file_put_contents($output . '/marker.txt', 'current');

$publisher = new StaticSitemapPublisher($output);
$validator = new StaticSitemapValidator('https://concursomestre.com');
$stage = $publisher->createStagingDirectory();
file_put_contents($stage . '/institutional-00001.xml', sitemapFixtureUrlSet('https://concursomestre.com/questoes'));
file_put_contents($stage . '/blog-articles-00001.xml', sitemapFixtureUrlSet('https://concursomestre.com/blog/noticia'));
file_put_contents($stage . '/sitemap.xml', sitemapFixtureIndex(['institutional-00001.xml', 'blog-articles-00001.xml']));

$report = $validator->validateDirectory($stage);
$validator->assertValid($report);
$publisher->promote($stage);
sitemapPublisherAssert(is_file($output . '/sitemap.xml'), 'Valid stage must be promoted.');
sitemapPublisherAssert(!is_file($output . '/marker.txt'), 'Promotion must replace the complete artifact tree.');
sitemapPublisherAssert(($report['totalUrls'] ?? 0) === 2, 'Validator must inspect every regular URL.');

$invalidStage = $publisher->createStagingDirectory();
file_put_contents($invalidStage . '/institutional-00001.xml', sitemapFixtureUrlSet('https://concursomestre.com/practice'));
file_put_contents($invalidStage . '/blog-articles-00001.xml', sitemapFixtureUrlSet('https://concursomestre.com/blog/noticia'));
file_put_contents($invalidStage . '/sitemap.xml', sitemapFixtureIndex(['institutional-00001.xml', 'blog-articles-00001.xml']));

$invalidReport = $validator->validateDirectory($invalidStage);
sitemapPublisherAssert($invalidReport['valid'] === false, 'Legacy URL must invalidate the stage.');
try {
    $validator->assertValid($invalidReport);
    throw new RuntimeException('Invalid stage was accepted.');
} catch (RuntimeException $error) {
    sitemapPublisherAssert(str_contains($error->getMessage(), 'Validacao do sitemap falhou'), 'Unexpected validation error.');
}
$publisher->discard($invalidStage);
sitemapPublisherAssert(is_file($output . '/sitemap.xml'), 'Rejected stage must preserve the currently served artifact.');

fwrite(STDOUT, "StaticSitemapPublisherTest: PASS\n");
