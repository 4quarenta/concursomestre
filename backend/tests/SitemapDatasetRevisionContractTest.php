<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/seo/sitemaps/StaticSitemapDatasetRevision.php';

function sitemapRevisionAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$db->exec('CREATE TABLE seo_dataset_revisions (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, updated_at TEXT NOT NULL)');
$db->exec("INSERT INTO seo_dataset_revisions (id, revision, updated_at) VALUES (1, 7, '2026-08-28 12:00:00')");
$first = StaticSitemapDatasetRevision::current($db);
sitemapRevisionAssert($first['revision'] === 7, 'Revision authority returned the wrong value.');
sitemapRevisionAssert(preg_match('/^[a-f0-9]{64}$/', $first['token']) === 1, 'Revision token is invalid.');

$db->exec('UPDATE seo_dataset_revisions SET revision = revision + 1 WHERE id = 1');
$second = StaticSitemapDatasetRevision::current($db);
sitemapRevisionAssert($second['revision'] === 8, 'Revision authority did not observe a mutation.');
sitemapRevisionAssert($second['token'] !== $first['token'], 'Revision mutation must change the request-time token.');

$migration = (string) file_get_contents(__DIR__ . '/../database/migrations/20260828_120000_sitemap_dataset_revision.php');
$expectedTables = [
    'blog_articles', 'contest_organizations', 'contests', 'filters', 'law_articles', 'laws',
    'material_uploads', 'materials', 'provas', 'public_simulation_questions', 'public_simulations', 'questions',
];
foreach ($expectedTables as $table) {
    sitemapRevisionAssert(str_contains($migration, "'{$table}'"), 'Revision migration omits sitemap source table: ' . $table);
}
foreach (['INSERT', 'UPDATE', 'DELETE'] as $operation) {
    sitemapRevisionAssert(str_contains($migration, "'{$operation}'"), 'Revision migration omits operation: ' . $operation);
}

$requestSource = (string) file_get_contents(__DIR__ . '/../../src/services/seo/staticSitemapArtifacts.ts');
sitemapRevisionAssert(
    str_contains($requestSource, 'read_sitemap_dataset_revision.php'),
    'Request path does not use the bounded revision reader.'
);
sitemapRevisionAssert(
    !str_contains($requestSource, 'generate_static_sitemaps.php'),
    'Request path still invokes the O(N) materializer.'
);
sitemapRevisionAssert(
    !str_contains($requestSource, 'SITEMAP_FINGERPRINT_ONLY'),
    'Request path still invokes full-dataset fingerprint mode.'
);

fwrite(STDOUT, "SitemapDatasetRevisionContractTest: PASS\n");
