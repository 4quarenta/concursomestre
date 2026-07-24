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
    'categoryName' => 'Editais',
    'coverImageUrl' => '/uploads/admin/blog-cover/capa.webp',
    'coverImageAlt' => 'Candidatos consultam o edital.',
    'status' => 'published',
    'tags' => ['Edital', 'Concurso'],
]);

assertBlogPlatform($article['slug'] === 'edital-publicado-para-novo-concurso', 'Article slug must be canonical.');
assertBlogPlatform(!str_contains($article['bodyHtml'], '<script'), 'Article body must remove scripts.');
assertBlogPlatform(!str_contains($article['bodyHtml'], 'javascript:'), 'Article body must remove executable URLs.');
assertBlogPlatform($article['readingMinutes'] === 1, 'Reading time must be materialized on save.');
assertBlogPlatform(count($article['tags']) === 2, 'Article tags must be normalized.');

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

$comments = (string) file_get_contents($backend . '/modules/comments/services/CommentsService.php');
assertBlogPlatform(
    str_contains($comments, "targetType === 'blog_article'"),
    'Blog comments must validate public article visibility.'
);
assertBlogPlatform(
    str_contains($comments, "return \$slug !== null ? '/blog/'"),
    'Blog comment notifications must use an article deep link.'
);

$sitemap = (string) file_get_contents($backend . '/scripts/seo/generate_static_blog_sitemaps.php');
foreach (['google-news.xml', 'INTERVAL 2 DAY', 'LIMIT 1000', 'blog-sitemap.xml', 'blog-articles-%05d.xml'] as $needle) {
    assertBlogPlatform(str_contains($sitemap, $needle), 'Blog sitemap generator is missing ' . $needle . '.');
}

$articlePage = (string) file_get_contents($root . '/src/app/blog/[slug]/page.tsx');
foreach (['NewsArticle', 'datePublished', 'dateModified', 'articleSection'] as $needle) {
    assertBlogPlatform(str_contains($articlePage, $needle), 'SSR article page is missing ' . $needle . '.');
}

$admin = (string) file_get_contents($root . '/src/app/admin/components/marketing/AdminBlogManager.tsx');
foreach (['blog-cover', 'RichTextEditor', 'scheduled', 'allowComments'] as $needle) {
    assertBlogPlatform(str_contains($admin, $needle), 'Admin blog editor is missing ' . $needle . '.');
}

fwrite(STDOUT, "Blog content platform assertions passed.\n");
