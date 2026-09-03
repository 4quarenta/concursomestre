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

require_once __DIR__ . '/../modules/blog/validators/BlogValidator.php';

function assertBlogPlatform(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$backend = dirname(__DIR__);
$root = dirname($backend);
$validator = new BlogValidator();
$article = $validator->validateSave([
    'title' => 'Edital publicado para novo concurso',
    'excerpt' => 'Resumo editorial objetivo para orientar o candidato sobre o novo edital.',
    'bodyHtml' => '<p>Conteudo util.</p><script>alert(1)</script><a href="javascript:alert(2)">link</a>',
    'taxonomy' => [
        'category' => ['id' => null, 'label' => 'Editais', 'slug' => 'editais'],
        'tags' => [
            ['id' => null, 'label' => 'Edital', 'slug' => 'edital'],
            ['id' => null, 'label' => 'Concurso', 'slug' => 'concurso'],
        ],
    ],
    'coverImageUrl' => '/uploads/admin/blog-cover/capa.webp',
    'coverImageAlt' => 'Candidatos consultam o edital.',
    'status' => 'published',
    'tags' => ['Edital', 'Concurso'],
]);

assertBlogPlatform($article['slug'] === 'edital-publicado-para-novo-concurso', 'Article slug must be canonical.');
assertBlogPlatform(!str_contains($article['bodyHtml'], '<script'), 'Article body must remove scripts.');
assertBlogPlatform(!str_contains($article['bodyHtml'], 'javascript:'), 'Article body must remove executable URLs.');
assertBlogPlatform($article['readingMinutes'] === 1, 'Reading time must be materialized on save.');
assertBlogPlatform(count($article['taxonomy']['tags']) === 2, 'Article tags must be normalized.');
assertBlogPlatform($article['taxonomy']['tags'][0]['kind'] === 'general', 'Legacy tags must receive the general kind.');
assertBlogPlatform($article['seoTitle'] === $article['title'], 'SEO title must derive from the post title.');
assertBlogPlatform($article['seoDescription'] === $article['excerpt'], 'SEO description must derive from the post summary.');

$regionalTag = $validator->validateTag([
    'label' => 'Nordeste',
    'kind' => 'region',
    'description' => 'Concursos e oportunidades na regiao Nordeste.',
]);
assertBlogPlatform($regionalTag['kind'] === 'region', 'Regional blog tags must preserve their editorial kind.');

$articleWithoutCover = $validator->validateSave([
    'title' => 'Noticia sem capa definida',
    'bodyHtml' => '<p>Conteudo editorial com a imagem padrao da plataforma.</p>',
    'taxonomy' => [
        'category' => ['id' => null, 'label' => 'Concursos', 'slug' => 'concursos'],
        'tags' => [],
    ],
]);
assertBlogPlatform(
    $articleWithoutCover['coverImageUrl'] === '/blog/default-cover.webp',
    'Articles without a cover must use the canonical default image.'
);
assertBlogPlatform(
    $articleWithoutCover['coverImageAlt'] !== '',
    'The default cover must include alternative text.'
);

$migration = (string) file_get_contents($backend . '/database/migrations/20260723_010000_blog_content_platform.php');
foreach ([
    'blog_categories',
    'blog_articles',
    'blog_article_tags',
    'blog_article_likes',
    'idx_blog_articles_public',
    'idx_comments_target_moderation_created',
] as $needle) {
    assertBlogPlatform(str_contains($migration, $needle), 'Blog migration is missing ' . $needle . '.');
}

$routes = (string) file_get_contents($backend . '/modules/blog/routes.php');
foreach (['requireAdminSessionContext', 'verifyAuthenticatedUserPayload', 'logAdminAudit', 'RateLimiter'] as $needle) {
    assertBlogPlatform(str_contains($routes, $needle), 'Blog routes are missing ' . $needle . '.');
}
foreach (['handleBlogTagsRoute', 'handleBlogAdminTagsRoute', 'createTag'] as $needle) {
    assertBlogPlatform(str_contains($routes, $needle), 'Blog tag routes are missing ' . $needle . '.');
}

$comments = (string) file_get_contents($backend . '/modules/comments/services/CommentsService.php');
assertBlogPlatform(
    str_contains($comments, "targetType === 'blog_article'"),
    'Blog comments must validate public article visibility.'
);
assertBlogPlatform(
    str_contains($comments, "return \$slug !== null ? '/blog/'"),
    'Blog comment notifications must use an article deep link.'
);

$sitemap = (string) file_get_contents($backend . '/modules/seo/sitemaps/StaticBlogSitemapGenerator.php');
assertBlogPlatform(str_contains($sitemap, 'blog-articles-%05d.xml'), 'Canonical sitemap is missing blog article batches.');
assertBlogPlatform(str_contains($sitemap, "'filesList' => \$files"), 'Blog batches are not returned to the canonical sitemap index.');
assertBlogPlatform(!str_contains($sitemap, 'google-news.xml'), 'Google News must wait for a dedicated product gate.');
assertBlogPlatform(!str_contains($sitemap, 'blog-sitemap.xml'), 'Parallel blog sitemap authority remains active.');

$articlePage = (string) file_get_contents($root . '/src/app/blog/[slug]/page.tsx');
foreach (['NewsArticle', 'datePublished', 'dateModified', 'articleSection', 'Em resumo', 'BlogShareBar', 'Leia também', 'BlogArticleEngagement'] as $needle) {
    assertBlogPlatform(str_contains($articlePage, $needle), 'SSR article page is missing ' . $needle . '.');
}

$admin = (string) file_get_contents($root . '/src/app/admin/operation/blog/[articleId]/edit/page.tsx');
foreach (['blog-cover', 'blog-content', 'RichTextEditor', 'allowImages', 'allowTables', 'taxonomy.tags', 'AdminStandaloneShell'] as $needle) {
    assertBlogPlatform(str_contains($admin, $needle), 'Admin blog editor is missing ' . $needle . '.');
}

$adminList = (string) file_get_contents($root . '/src/app/admin/components/blog/AdminBlogSection.tsx');
foreach (['AdminCollectionToolbar', 'AdminCollectionPagination', 'ADMIN_COLLECTION_TABLE_CLASS'] as $needle) {
    assertBlogPlatform(str_contains($adminList, $needle), 'Admin blog list is missing ' . $needle . '.');
}

$repository = (string) file_get_contents($backend . '/modules/blog/repositories/BlogRepository.php');
assertBlogPlatform(str_contains($repository, "'total' => \$total"), 'Admin blog list must return a filtered total.');
assertBlogPlatform(str_contains($repository, '$this->databaseNow()'), 'Published posts must use the database clock.');
assertBlogPlatform(str_contains($repository, 'SELECT DATE_FORMAT(NOW()'), 'The publication clock must match MySQL NOW().');
assertBlogPlatform(!str_contains($repository, "gmdate('Y-m-d H:i:s')"), 'Blog publishing must not mix UTC with the database timezone.');
assertBlogPlatform(str_contains($repository, 'DEFAULT_COVER_IMAGE'), 'Legacy posts without cover must receive the default image in public DTOs.');
assertBlogPlatform(
    str_contains($repository, "filters['status'] === 'archived'")
        && str_contains($repository, "a.status = 'archived'"),
    'Archived posts must remain visible only in the administrative archive filter.'
);
assertBlogPlatform(
    str_contains($repository, "SET status = 'archived', deleted_at = NULL"),
    'Archiving a post must preserve its administrative record rather than soft-deleting it.'
);
assertBlogPlatform(
    str_contains($repository, "a.deleted_at IS NULL OR a.status = 'archived'"),
    'Archived posts must remain retrievable by the administrative editor.'
);
foreach (['public_search_title', 'public_search_excerpt', 'public_search_body'] as $needle) {
    assertBlogPlatform(str_contains($repository, $needle), 'Public blog search must cover article content with unique placeholders: ' . $needle);
}
foreach (['listTags', 'tagSlug', 'blog_article_tags bat_filter', 'kind', 'articleCount'] as $needle) {
    assertBlogPlatform(str_contains($repository, $needle), 'Navigable blog tags are missing ' . $needle . '.');
}

$tagMigration = (string) file_get_contents($backend . '/database/migrations/20260810_190000_blog_tag_taxonomy.php');
foreach (['idx_blog_tags_kind_name', "'kind'", 'description', 'created_by'] as $needle) {
    assertBlogPlatform(str_contains($tagMigration, $needle), 'Blog tag taxonomy migration is missing ' . $needle . '.');
}

$validatorSource = (string) file_get_contents($backend . '/modules/blog/validators/BlogValidator.php');
assertBlogPlatform(str_contains($validatorSource, "'search' =>"), 'Public blog search must be validated by the backend.');

$serverData = (string) file_get_contents($root . '/src/app/blog/blogServerData.ts');
assertBlogPlatform(str_contains($serverData, "revalidate: 300"), 'Public blog reads must use a bounded shared cache.');
assertBlogPlatform(str_contains($serverData, "tags: ['public-blog']"), 'Public blog reads must expose an invalidation tag.');
assertBlogPlatform(str_contains($serverData, "...(params.search ? { search: params.search } : {})"), 'SSR blog search must reach the public API.');
assertBlogPlatform(str_contains($serverData, 'fetchBlogTagsForServer'), 'SSR blog pages must load navigable tags.');

$articleCard = (string) file_get_contents($root . '/src/app/blog/BlogArticleCard.tsx');
foreach (['article.author.name', 'dateTime=', 'formatBlogDateTime', 'compact'] as $needle) {
    assertBlogPlatform(str_contains($articleCard, $needle), 'Blog cards must show author and publication date/time: ' . $needle);
}

foreach (['article.author.name', 'dateTime=', 'formatBlogDateTime', 'Publicado em', 'Atualizado em'] as $needle) {
    assertBlogPlatform(str_contains($articlePage, $needle), 'Blog detail must show author and publication date/time: ' . $needle);
}

$blogHome = (string) file_get_contents($root . '/src/app/blog/page.tsx');
foreach (['Últimas notícias', 'Mais lidas', 'Editoria', 'Resultados para', 'categorySections'] as $needle) {
    assertBlogPlatform(str_contains($blogHome, $needle), 'Blog home must expose the editorial portal structure: ' . $needle);
}
foreach (['BlogConversionCta', 'Notícias por região', '/blog/tag/'] as $needle) {
    assertBlogPlatform(str_contains($blogHome, $needle), 'Blog home is missing conversion or tag navigation: ' . $needle);
}

$tagPage = (string) file_get_contents($root . '/src/app/blog/tag/[slug]/page.tsx');
foreach (['fetchBlogTaxonomyArchiveForServer', "'tag'", 'buildBlogTaxonomyMetadata', 'BlogTaxonomyArchivePage'] as $needle) {
    assertBlogPlatform(str_contains($tagPage, $needle), 'Blog tag page is missing ' . $needle . '.');
}
$taxonomyMetadata = (string) file_get_contents($root . '/src/app/blog/blogTaxonomyMetadata.ts');
foreach (['buildPublicPageMetadata', 'evaluateSeoLaunchControl', 'launchModeRobots(true)'] as $needle) {
    assertBlogPlatform(str_contains($taxonomyMetadata, $needle), 'Blog taxonomy metadata is missing ' . $needle . '.');
}

$cta = (string) file_get_contents($root . '/src/app/blog/BlogConversionCta.tsx');
foreach (['hasActivePlanAccess', '/auth?mode=signup', '/plans', 'publicRoutes.questions.index()'] as $needle) {
    assertBlogPlatform(str_contains($cta, $needle), 'Contextual blog CTA is missing ' . $needle . '.');
}

$blogHeader = (string) file_get_contents($root . '/src/app/blog/BlogHeader.tsx');
foreach (['Buscar notícias', 'Editorias do blog', 'BlogAccountAction'] as $needle) {
    assertBlogPlatform(str_contains($blogHeader, $needle), 'Blog header is missing newsroom navigation: ' . $needle);
}

fwrite(STDOUT, "Blog content platform assertions passed.\n");
