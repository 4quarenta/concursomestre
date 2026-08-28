<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/seo/sitemaps/StaticSitemapDatasetRevision.php';

function sitemapRevisionMysqlAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function sitemapRevisionMysqlQuote(string $identifier): string
{
    if (preg_match('/^[a-z0-9_]+$/', $identifier) !== 1) {
        throw new InvalidArgumentException('Invalid fixture identifier.');
    }
    return '`' . $identifier . '`';
}

$dsn = trim((string) getenv('SITEMAP_REVISION_TEST_MYSQL_DSN'));
if ($dsn === '') {
    fwrite(STDERR, "SITEMAP_REVISION_TEST_MYSQL_DSN is required.\n");
    exit(2);
}
$db = new PDO(
    $dsn,
    (string) getenv('SITEMAP_REVISION_TEST_MYSQL_USER'),
    (string) getenv('SITEMAP_REVISION_TEST_MYSQL_PASSWORD'),
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);
$tables = [
    'blog_articles', 'contest_organizations', 'contests', 'filters', 'law_articles', 'laws',
    'material_uploads', 'materials', 'provas', 'public_simulation_questions', 'public_simulations', 'questions',
];

try {
    foreach ($tables as $table) {
        $db->exec('DROP TABLE IF EXISTS ' . sitemapRevisionMysqlQuote($table));
        $db->exec('CREATE TABLE ' . sitemapRevisionMysqlQuote($table) . ' (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, value_text VARCHAR(40) NULL) ENGINE=InnoDB');
    }
    $db->exec('DROP TABLE IF EXISTS seo_dataset_revisions');
    $migration = require __DIR__ . '/../database/migrations/20260828_120000_sitemap_dataset_revision.php';
    $migration($db);
    $migration($db);

    $initial = StaticSitemapDatasetRevision::current($db);
    foreach ($tables as $table) {
        $quoted = sitemapRevisionMysqlQuote($table);
        $db->exec("INSERT INTO {$quoted} (value_text) VALUES ('fixture')");
        $db->exec("UPDATE {$quoted} SET value_text = 'changed' WHERE id = 1");
        $db->exec("DELETE FROM {$quoted} WHERE id = 1");
    }
    $afterDirectSql = StaticSitemapDatasetRevision::current($db);
    sitemapRevisionMysqlAssert(
        $afterDirectSql['revision'] - $initial['revision'] === count($tables) * 3,
        'Direct SQL did not increment the authoritative revision for every source mutation.'
    );
    sitemapRevisionMysqlAssert($afterDirectSql['token'] !== $initial['token'], 'Direct SQL drift was not detectable.');

    $measurements = [];
    foreach ([100, 1_000, 10_000] as $cardinality) {
        $db->exec('TRUNCATE TABLE questions');
        $insert = $db->prepare('INSERT INTO questions (value_text) VALUES (:value_text)');
        for ($index = 0; $index < $cardinality; $index++) {
            $insert->execute([':value_text' => 'fixture-' . $index]);
        }
        $startedAt = hrtime(true);
        for ($sample = 0; $sample < 200; $sample++) {
            StaticSitemapDatasetRevision::current($db);
        }
        $measurements[(string) $cardinality] = (hrtime(true) - $startedAt) / 1_000_000;
    }
    $explain = $db->query('EXPLAIN SELECT revision, updated_at FROM seo_dataset_revisions WHERE id = 1 LIMIT 1')->fetch(PDO::FETCH_ASSOC);
    sitemapRevisionMysqlAssert(is_array($explain), 'Revision EXPLAIN is unavailable.');
    sitemapRevisionMysqlAssert(in_array((string) ($explain['type'] ?? ''), ['const', 'system'], true), 'Revision lookup is not constant-key access.');
    sitemapRevisionMysqlAssert((int) ($explain['rows'] ?? 0) <= 1, 'Revision lookup examines more than one row.');

    echo json_encode([
        'engineVersion' => (string) $db->query('SELECT VERSION()')->fetchColumn(),
        'directMutationDelta' => $afterDirectSql['revision'] - $initial['revision'],
        'requestFreshnessQueriesPerCheck' => 1,
        'scaleMeasurementsMsFor200Checks' => $measurements,
        'explain' => ['type' => $explain['type'] ?? null, 'key' => $explain['key'] ?? null, 'rows' => $explain['rows'] ?? null],
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
    fwrite(STDOUT, "SitemapDatasetRevisionMysqlIntegrationTest: PASS\n");
} finally {
    $rollback = (string) file_get_contents(__DIR__ . '/../database/rollbacks/20260828_120000_sitemap_dataset_revision.sql');
    foreach (array_filter(array_map('trim', explode(';', $rollback))) as $statement) {
        $db->exec($statement);
    }
    foreach ($tables as $table) {
        $db->exec('DROP TABLE IF EXISTS ' . sitemapRevisionMysqlQuote($table));
    }
}
