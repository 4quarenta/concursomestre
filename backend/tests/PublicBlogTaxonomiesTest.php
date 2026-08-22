<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/blog/public/PublicBlogTaxonomyProjection.php';
require_once dirname(__DIR__) . '/modules/blog/public/PublicBlogTaxonomyReadiness.php';
require_once dirname(__DIR__) . '/modules/blog/validators/BlogValidator.php';
putenv('JWT_SECRET=blog-taxonomy-audit-test-secret');
$_ENV['JWT_SECRET'] = 'blog-taxonomy-audit-test-secret';
require_once dirname(__DIR__) . '/shared/pagination/SignedKeysetCursor.php';
require_once dirname(__DIR__) . '/modules/blog/repositories/BlogRepository.php';

function blogTaxonomyAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$backend = dirname(__DIR__);
$root = dirname($backend);

$ready = PublicBlogTaxonomyReadiness::evaluate([
    'id' => 7, 'name' => 'Editais', 'slug' => 'editais', 'article_count' => 1,
]);
blogTaxonomyAssert($ready === ['status' => 'READY', 'reasonCodes' => []], 'Uma categoria publica com um post deve ficar READY sem threshold de volume.');
$empty = PublicBlogTaxonomyReadiness::evaluate([
    'id' => 8, 'name' => 'Sem posts', 'slug' => 'sem-posts', 'article_count' => 0,
]);
blogTaxonomyAssert($empty['status'] === 'NOT_READY' && in_array('instance_readiness.publication_blocked', $empty['reasonCodes'], true), 'Archive vazio pode ser indexado.');
blogTaxonomyAssert(!PublicBlogTaxonomyReadiness::validSlug('Editais'), 'Slug publico deve ser case-sensitive e persistido.');
blogTaxonomyAssert(!PublicBlogTaxonomyReadiness::validType('assunto'), 'Taxonomia de pratica atravessou a enum editorial.');

$validator = new BlogValidator();
$validCursor = SignedKeysetCursor::encodePayload([
    'publishedAt' => '2026-08-20 10:00:00',
    'id' => '17',
], 'blog.public');
$validatedArchive = $validator->validatePublicTaxonomyArchive([
    'type' => 'category', 'slug' => 'seguranca', 'cursor' => $validCursor,
]);
blogTaxonomyAssert($validatedArchive['cursor'] === $validCursor, 'Cursor publico valido nao foi preservado.');
$decodePublicCursor = new ReflectionMethod(BlogRepository::class, 'decodePublicCursor');
blogTaxonomyAssert(
    $decodePublicCursor->invoke(null, $validCursor) === [
        'publishedAt' => '2026-08-20 10:00:00', 'id' => 17,
    ],
    'Cursor publico valido perdeu a chave publicada deterministica.'
);
foreach (['garbage', substr($validCursor, 0, -1) . 'x'] as $invalidCursor) {
    try {
        SignedKeysetCursor::decodePayload($invalidCursor, 'blog.public');
        throw new RuntimeException('Cursor adulterado foi aceito.');
    } catch (InvalidArgumentException) {
        // Falha fechada esperada.
    }
}
foreach ([
    ['publishedAt' => 'not-a-date', 'id' => '17'],
    ['publishedAt' => '2026-08-20 10:00:00', 'id' => '0'],
    ['id' => '17'],
] as $invalidPayload) {
    try {
        $decodePublicCursor->invoke(
            null,
            SignedKeysetCursor::encodePayload($invalidPayload, 'blog.public')
        );
        throw new RuntimeException('Cursor assinado com payload invalido foi aceito.');
    } catch (InvalidArgumentException) {
        // Falha fechada esperada.
    }
}
try {
    $validator->validatePublicTaxonomyArchive([
        'type' => 'category', 'slug' => 'seguranca', 'cursor' => str_repeat('a', 4097),
    ]);
    throw new RuntimeException('Cursor oversized foi aceito.');
} catch (InvalidArgumentException) {
    // Falha fechada esperada.
}

$projection = PublicBlogTaxonomyProjection::taxonomy([
    'id' => 7, 'name' => 'Editais', 'slug' => 'editais', 'description' => 'Noticias editoriais.',
    'image_url' => '/uploads/blog/editais.webp', 'article_count' => 2, 'last_published_at' => '2026-08-20 10:00:00',
    'created_by' => 'private-user', 'seo_experiment' => 'secret', 'admin_notes' => 'sentinel',
], 'category', '/blog/categoria/editais', $ready);
foreach (['created_by', 'seo_experiment', 'admin_notes'] as $forbidden) {
    blogTaxonomyAssert(!array_key_exists($forbidden, $projection), 'Projection vazou ' . $forbidden . '.');
}
foreach ([
    'http://example.com/image.jpg',
    'https://localhost/image.jpg',
    'https://127.0.0.1/image.jpg',
    'https://user:pass@example.com/image.jpg',
    'https://example.com/image.jpg?token=private',
] as $unsafeImage) {
    $unsafeProjection = PublicBlogTaxonomyProjection::taxonomy([
        'id' => 7, 'name' => 'Editais', 'slug' => 'editais', 'article_count' => 1, 'image_url' => $unsafeImage,
    ], 'category', '/blog/categoria/editais', $ready);
    blogTaxonomyAssert($unsafeProjection['imageUrl'] === null, 'Projection aceitou asset inseguro: ' . $unsafeImage);
}

$card = PublicBlogTaxonomyProjection::articleCard([
    'id' => 1, 'title' => 'Edital publicado', 'slug' => 'edital-publicado', 'excerpt' => 'Resumo publico.',
    'readingMinutes' => 2, 'coverImageUrl' => 'https://127.0.0.1/private-cover.jpg', 'coverImageAlt' => 'Capa',
    'taxonomy' => ['category' => ['id' => 7, 'label' => 'Editais', 'slug' => 'editais'], 'tags' => []],
    'author' => ['id' => 'public-author', 'name' => 'Equipe', 'role' => 'staff'], 'engagement' => [],
    'bodyHtml' => 'PROTECTED_BODY', 'correctAnswer' => 'A', 'adminNotes' => 'PROTECTED_ADMIN',
]);
foreach (['bodyHtml', 'correctAnswer', 'adminNotes', 'sourceUrl', 'scheduledAt'] as $forbidden) {
    blogTaxonomyAssert(!array_key_exists($forbidden, $card), 'Card publico vazou ' . $forbidden . '.');
}
blogTaxonomyAssert($card['coverImageUrl'] === '', 'Card publico aceitou asset privado como capa.');
$safeCard = PublicBlogTaxonomyProjection::articleCard([
    'id' => 2, 'title' => 'Capa publica', 'slug' => 'capa-publica', 'excerpt' => 'Resumo.',
    'coverImageUrl' => '/blog/default-cover.webp', 'coverImageAlt' => 'Capa publica',
]);
blogTaxonomyAssert($safeCard['coverImageUrl'] === '/blog/default-cover.webp', 'Card rejeitou asset publico local.');

$repository = (string) file_get_contents($backend . '/modules/blog/repositories/BlogRepository.php');
foreach (["c.slug = :slug", "t.slug = :slug", "a.status IN ('published', 'scheduled')", 'a.published_at <= NOW()', 'SignedKeysetCursor'] as $needle) {
    blogTaxonomyAssert(str_contains($repository, $needle), 'Repository publico nao preserva ' . $needle . '.');
}
blogTaxonomyAssert(!str_contains($repository, 'taxonomy_level'), 'Taxonomia editorial foi misturada com taxonomia de pratica.');
blogTaxonomyAssert(str_contains($repository, 'decodePublicCursor'), 'Cursor publico nao valida o payload do dominio.');
blogTaxonomyAssert(str_contains($repository, "DateTimeImmutable::createFromFormat('!Y-m-d H:i:s'"), 'Cursor publico nao valida a data materializada.');

$endpoint = (string) file_get_contents($backend . '/api/blog/taxonomy.php');
blogTaxonomyAssert(str_contains($endpoint, "Database('read')"), 'Endpoint de taxonomia nao usa conexao read-only.');
$service = (string) file_get_contents($backend . '/modules/blog/services/BlogService.php');
blogTaxonomyAssert(str_contains($service, 'PublicBlogTaxonomyProjection::articleCard'), 'Endpoint nao aplica projection allowlist aos cards.');
$sitemap = (string) file_get_contents($backend . '/modules/seo/sitemaps/StaticBlogSitemapGenerator.php');
blogTaxonomyAssert(str_contains($sitemap, 'blogCategoryDetail'), 'Categoria READY ausente do sitemap de producao.');
blogTaxonomyAssert(!str_contains($sitemap, 'blogTagDetail'), 'Tag PERMANENT_NOINDEX entrou no sitemap.');

$pageMap = json_decode((string) file_get_contents($root . '/config/seo/seo-production-page-map.v1.json'), true, 512, JSON_THROW_ON_ERROR);
$families = array_column($pageMap['families'] ?? [], null, 'familyId');
blogTaxonomyAssert(($families['blog_category']['familyEligibility'] ?? null) === 'INDEXABLE', 'Categoria perdeu eligibility INDEXABLE.');
blogTaxonomyAssert(($families['blog_tag']['familyEligibility'] ?? null) === 'PERMANENT_NOINDEX', 'Tag nao esta fail-closed.');
foreach ([
    'BLOG_CATEGORY_GOVERNANCE_REQUIRED',
    'BLOG_CATEGORY_SLUG_CHANGE_CONTROL_REQUIRED',
    'BLOG_CATEGORY_MERGE_ALIAS_STRATEGY_REQUIRED',
    'BLOG_TAG_GOVERNANCE_REQUIRED',
    'BLOG_TAXONOMY_REAL_DATA_VALIDATION',
    'BLOG_TAXONOMY_REAL_DATA_QUALITY_GATE',
    'BLOG_TAXONOMY_REAL_DATA_EXPLAIN_REQUIRED',
] as $requirement) {
    $registered = in_array($requirement, $families['blog_category']['requirements'] ?? [], true)
        || in_array($requirement, $families['blog_tag']['requirements'] ?? [], true);
    blogTaxonomyAssert($registered, 'Production Page Map nao registra gate: ' . $requirement);
}

$reporter = (string) file_get_contents($backend . '/modules/blog/reports/BlogTaxonomyReadinessReporter.php');
foreach (['zeroPublicPosts', 'onePublicPost', 'potentialThinGroups', 'normalizedNameDuplicateGroups', 'orphanArticleTags', 'wrongTypeIssues', 'READ_ONLY'] as $needle) {
    blogTaxonomyAssert(str_contains($reporter, $needle), 'Reporter nao cobre ' . $needle . '.');
}
foreach (['INSERT ', 'UPDATE ', 'DELETE ', 'ALTER ', 'DROP ', 'TRUNCATE '] as $write) {
    blogTaxonomyAssert(!str_contains($reporter, $write), 'Reporter contem comando de escrita: ' . $write);
}
$reporterScript = (string) file_get_contents($backend . '/scripts/seo/report_blog_taxonomies.php');
blogTaxonomyAssert(str_contains($reporterScript, 'isUsingReplica()'), 'Reporter nao exige DB_READ_* dedicado.');

fwrite(STDOUT, "PublicBlogTaxonomiesTest: PASS\n");
