<?php

declare(strict_types=1);

$root = dirname(__DIR__);
require_once $root . '/modules/legal_commentary/public/PublicLawArticleReadiness.php';
require_once $root . '/modules/legal_commentary/public/PublicLawArticleProjection.php';
require_once $root . '/modules/seo/policies/StructuralRoutePolicy.php';
require_once $root . '/modules/seo/routes/PublicRouteBuilder.php';

$assert = static function (bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
};

$base = [
    'law_id' => 1, 'law_slug' => 'constituicao-federal', 'law_title' => 'Constituicao Federal',
    'law_status' => 'published', 'law_published_at' => '2026-01-01 00:00:00',
    'article_id' => 5, 'article_slug' => 'artigo-5-a', 'article_number' => '5-A',
    'article_title' => 'Direitos fundamentais', 'official_text' => 'Texto oficial.',
    'article_status' => 'active', 'law_official_url' => 'https://www.planalto.gov.br/lei',
];
$assert(PublicLawArticleReadiness::evaluate($base)['status'] === 'READY', 'Published official article must be READY without commentary.');
$assert(PublicLawArticleReadiness::evaluate(array_merge($base, ['article_status' => 'revoked']))['status'] === 'READY', 'Revoked historical article must remain eligible.');
$assert(PublicLawArticleReadiness::evaluate(array_merge($base, ['article_status' => 'vetoed']))['status'] === 'READY', 'Vetoed historical article must remain eligible.');
$missingText = PublicLawArticleReadiness::evaluate(array_merge($base, ['official_text' => '']));
$assert($missingText['status'] === 'NOT_READY'
    && in_array('instance_readiness.empty_official_content', $missingText['reasonCodes'], true), 'Missing official text must have a distinct readiness reason.');
$invalidSlug = PublicLawArticleReadiness::evaluate(array_merge($base, ['article_slug' => 'Artigo-5']));
$assert($invalidSlug['status'] === 'NOT_READY'
    && in_array('instance_readiness.invalid_slug', $invalidSlug['reasonCodes'], true)
    && in_array('instance_readiness.invalid_canonical', $invalidSlug['reasonCodes'], true), 'Invalid persisted slug must invalidate the canonical.');
$privateLaw = PublicLawArticleReadiness::evaluate(array_merge($base, ['law_status' => 'draft']));
$privateArticle = PublicLawArticleReadiness::evaluate(array_merge($base, ['article_status' => 'draft']));
$assert(in_array('instance_readiness.nonpublic_law', $privateLaw['reasonCodes'], true), 'Nonpublic Law reason was collapsed.');
$assert(in_array('instance_readiness.nonpublic_article', $privateArticle['reasonCodes'], true), 'Nonpublic Article reason was collapsed.');

$projection = PublicLawArticleProjection::detail([
    'article' => $base + ['admin_notes' => 'SECRET_ADMIN_NOTE_SENTINEL', 'provider_id' => 'SECRET_IMPORTER_SENTINEL'],
    'blocks' => [['id' => 1, 'block_uid' => 'caput', 'kind' => 'caput', 'label' => 'Art. 5-A', 'text' => '<script>alert(1)</script>Texto publico', 'source_note' => 'private']],
    'canonicalPath' => '/lei-comentada/constituicao-federal/artigo-5-a',
    'readiness' => ['status' => 'READY', 'reasonCodes' => []],
]);
$encoded = json_encode($projection);
$assert(!str_contains($encoded, '<script>') && str_contains($encoded, 'Texto publico'), 'Official text projection must neutralize markup.');
$assert(!str_contains($encoded, 'SECRET_') && !str_contains($encoded, 'source_note'), 'Projection leaked importer/admin fields.');
$privateSource = PublicLawArticleProjection::detail(['article' => array_merge($base, ['law_official_url' => 'https://127.0.0.1/private'])]);
$assert($privateSource['law']['officialUrl'] === null, 'Private source URL crossed the projection boundary.');
foreach ([
    'javascript:alert(1)', 'data:text/html,unsafe', 'file:///etc/passwd',
    'https://localhost/private', 'https://user:pass@example.org/source',
    'https://example.org/source?token=private',
] as $unsafeSource) {
    $unsafeProjection = PublicLawArticleProjection::detail([
        'article' => array_merge($base, ['law_official_url' => $unsafeSource]),
    ]);
    $assert($unsafeProjection['law']['officialUrl'] === null, 'Unsafe source URL crossed the projection boundary.');
}

$routes = new PublicRouteBuilder();
$assert($routes->lawsIndex() === '/lei-comentada', 'Canonical law hub route is invalid.');
$assert($routes->lawArticleDetail('constituicao-federal', 'artigo-5-a') === '/lei-comentada/constituicao-federal/artigo-5-a', 'Canonical article route is invalid.');

$repository = file_get_contents($root . '/modules/legal_commentary/public/PublicLawArticleRepository.php');
$service = file_get_contents($root . '/modules/legal_commentary/public/PublicLawArticleService.php');
$endpoint = file_get_contents($root . '/api/legal-commentary/article-detail.php');
$importer = file_get_contents($root . '/modules/legal_commentary/services/PlanaltoImportService.php');
$sitemap = file_get_contents($root . '/scripts/seo/generate_static_sitemaps.php');
$reporter = file_get_contents($root . '/modules/seo/reports/LawArticleReadinessReporter.php');
$map = json_decode(file_get_contents(dirname($root) . '/config/seo/seo-production-page-map.v1.json'), true, 512, JSON_THROW_ON_ERROR);
$family = array_values(array_filter($map['families'], static fn(array $item): bool => $item['familyId'] === 'law_article_detail'))[0] ?? null;
$assert(str_contains($repository, 'INNER JOIN law_articles a ON a.law_id = l.id'), 'Article identity must use explicit law_id.');
$assert(str_contains($repository, 'ORDER BY sort_order DESC, id DESC') && str_contains($repository, 'ORDER BY sort_order, id LIMIT 1'), 'Article navigation must use persisted normative order, not lexical labels.');
$assert(str_contains($repository, 'l.slug = :law_slug') && str_contains($repository, 'a.slug = :article_slug'), 'Wrong-law combinations must not resolve.');
$assert(!preg_match('/question_filters|prova_filters|related_question/i', $repository), 'Article repository must not infer relations from questions or exams.');
$assert(str_contains($endpoint, "new Database('read')"), 'Public article endpoint must use the read connection.');
$assert(str_contains($service, 'lawArticleDetail') && str_contains($service, 'redirectPath'), 'Canonical route and one-hop law alias are not wired.');
$assert(str_contains($service, "['label' => 'Lei Comentada', 'path' => \$routes->lawsIndex()]"), 'Article breadcrumb must link to the law hub.');
$assert(str_contains($importer, "\$article['slug'] = \$persistedSlug"), 'Importer must preserve an existing article slug.');
$assert(str_contains($sitemap, "a.official_status IN ('active', 'revoked', 'vetoed')") && str_contains($sitemap, "'law_article_detail'"), 'Sitemap readiness is not wired.');
$assert(str_contains($reporter, 'SELECT COUNT(*) FROM laws') && str_contains($reporter, "'totalLaws'"), 'Read-only reporter must count canonical laws and articles.');
$assert($family !== null && $family['launchStatus'] === 'ACTIVE' && $family['familyEligibility'] === 'INDEXABLE'
    && $family['targetProductionIndexability'] === 'INDEX' && $family['preLaunchIndexability'] === 'NOINDEX', 'Production Page Map contract is invalid.');

echo "PublicLawArticlesTest PASS\n";
