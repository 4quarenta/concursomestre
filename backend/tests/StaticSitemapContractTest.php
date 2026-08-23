<?php

declare(strict_types=1);

function sitemapContractAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$backend = dirname(__DIR__);
$root = dirname($backend);
$generator = (string) file_get_contents($backend . '/scripts/seo/generate_static_sitemaps.php');
$blogWrapper = (string) file_get_contents($backend . '/scripts/seo/generate_static_blog_sitemaps.php');
$blogGenerator = (string) file_get_contents($backend . '/modules/seo/sitemaps/StaticBlogSitemapGenerator.php');
$publisher = (string) file_get_contents($backend . '/modules/seo/sitemaps/StaticSitemapPublisher.php');
$validator = (string) file_get_contents($backend . '/modules/seo/sitemaps/StaticSitemapValidator.php');

foreach (['PublicRouteBuilder', 'SeoSlugService', 'createStagingDirectory', 'validateDirectory', 'promote'] as $needle) {
    sitemapContractAssert(str_contains($generator, $needle), 'Authoritative generator missing ' . $needle . '.');
}
sitemapContractAssert(str_contains($generator, 'SeoProductionPageMap'), 'Generator does not enforce the production page map.');
sitemapContractAssert(str_contains($generator, 'SeoRuntimeEnvironment'), 'Generator does not enforce the canonical production environment.');
sitemapContractAssert(str_contains($generator, 'sitemapPublicationAllowed'), 'Generator can publish without explicit sitemap activation.');
sitemapContractAssert(str_contains($generator, "'familyId' => 'support'"), 'Production support target is missing from sitemap candidates.');
sitemapContractAssert(str_contains($generator, "['launchStatus'] ?? null) !== 'ACTIVE'"), 'Non-active families are not excluded from sitemap publication.');
sitemapContractAssert(!str_contains($generator, "'/practice'"), 'Generator still emits /practice.');
sitemapContractAssert(!str_contains($generator, "'/question/'"), 'Generator still emits /question.');
sitemapContractAssert(!str_contains($generator, "'/blog/provas'"), 'Generator still emits /blog/provas.');
sitemapContractAssert(!str_contains($generator, "'/concursos' =>"), 'NOINDEX contest hub is still emitted.');
sitemapContractAssert(!str_contains($generator, 'NOW() AS last_modified'), 'Generator fabricates taxonomy lastmod.');
sitemapContractAssert(str_contains($generator, 'public_simulation_questions ready_sq'), 'Simulation sitemap is not readiness-aware.');
sitemapContractAssert(str_contains($generator, '$routes->simulationDetail($slug)'), 'Canonical simulation details are missing from the production sitemap simulation.');
sitemapContractAssert(str_contains($generator, "publish_status IN ('published', 'scheduled')"), 'Question sitemap does not use the canonical publication states.');
sitemapContractAssert(str_contains($generator, 'published_sort_at IS NOT NULL'), 'Question sitemap does not require a valid publication instant.');
sitemapContractAssert(str_contains($generator, 'published_sort_at <= NOW()'), 'Question sitemap can expose future questions.');
sitemapContractAssert(str_contains($generator, 'CHAR_LENGTH(slug) <= 190'), 'Persisted entity slug limits are not enforced before sitemap emission.');
sitemapContractAssert(!preg_match('/COALESCE\([^\r\n]*NOW\(\)/', $generator), 'Generator fabricates entity lastmod.');
sitemapContractAssert(str_contains($generator, "'lastmod' => null"), 'Taxonomies without material date must omit lastmod.');
sitemapContractAssert(
    !preg_match('/(?:\$write|file_put_contents)\([^\r\n]*robots\.txt/', $generator),
    'Sitemap generator must not write an artifact that competes with the canonical robots route.'
);
sitemapContractAssert(str_contains($blogWrapper, "generate_static_sitemaps.php"), 'Blog script must delegate to the only authority.');
sitemapContractAssert(!str_contains($blogGenerator, 'NOW()) AS last_modified'), 'Blog generator fabricates lastmod.');
sitemapContractAssert(str_contains($blogGenerator, 'quality PASS real'), 'Blog category omission is not documented as fail-closed.');
sitemapContractAssert(str_contains($blogGenerator, "'filesList' => \$files"), 'Blog children are not returned to the canonical sitemap index.');
sitemapContractAssert(!str_contains($blogGenerator, '/blog/tag/'), 'Unpromoted blog tags are still emitted.');
sitemapContractAssert(!str_contains($blogGenerator, '/blog/autor/'), 'Unpromoted blog authors are still emitted.');
sitemapContractAssert(!str_contains($blogGenerator, 'google-news'), 'Google News was introduced without a dedicated product gate.');
sitemapContractAssert(!str_contains($blogGenerator, 'blog-sitemap.xml'), 'Parallel blog sitemap authority still exists.');
sitemapContractAssert(str_contains($generator, "'organizations'"), 'Organization sitemap family is missing.');
sitemapContractAssert(str_contains($generator, "'disciplines'"), 'Discipline sitemap family is missing.');
sitemapContractAssert(str_contains($generator, "'topics'"), 'Topic sitemap family is missing.');
sitemapContractAssert(str_contains($generator, "'subjects'"), 'Subject sitemap family is missing.');
sitemapContractAssert(str_contains($publisher, 'rename($stagingDirectory, $this->outputDirectory)'), 'Publication must promote the validated tree.');
sitemapContractAssert(str_contains($publisher, 'promoteWithAtomicSymlink'), 'Linux publication must atomically swap an immutable release pointer.');
sitemapContractAssert(str_contains($validator, "'legacy_url'"), 'Validator must reject aliases.');
sitemapContractAssert(str_contains($validator, "'canonical_mismatch'"), 'Validator must verify self canonical over HTTP.');

sitemapContractAssert(!is_file($root . '/src/app/sitemap.ts'), 'Dynamic Next sitemap authority still exists.');
sitemapContractAssert(!is_file($root . '/scripts/seo/generate-sitemap.mjs'), 'Independent Node sitemap writer still exists.');
sitemapContractAssert(is_file($root . '/src/app/sitemap.xml/route.ts'), 'Static sitemap fallback route is missing.');
sitemapContractAssert(is_file($root . '/src/app/sitemaps/[filename]/route.ts'), 'Static section fallback route is missing.');

fwrite(STDOUT, "StaticSitemapContractTest: PASS\n");
