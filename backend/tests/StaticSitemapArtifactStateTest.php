<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/seo/sitemaps/StaticSitemapArtifactState.php';
require_once __DIR__ . '/../modules/seo/sitemaps/StaticSitemapLogicalDataset.php';
require_once __DIR__ . '/../modules/seo/sitemaps/StaticSitemapPublisher.php';
require_once __DIR__ . '/../modules/seo/sitemaps/StaticSitemapReleaseManifest.php';

function sitemapStateAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function sitemapStateRemoveDirectory(string $directory): void
{
    if (!is_dir($directory)) return;
    foreach (scandir($directory) ?: [] as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $directory . DIRECTORY_SEPARATOR . $item;
        is_dir($path) ? sitemapStateRemoveDirectory($path) : unlink($path);
    }
    rmdir($directory);
}

$root = sys_get_temp_dir() . '/cm-sitemap-state-' . bin2hex(random_bytes(5));
$output = $root . '/sitemaps';
mkdir($output, 0775, true);
$xml = '<?xml version="1.0"?><urlset><url><loc>https://concursomestre.com/provas/a</loc></url></urlset>';
file_put_contents($output . '/exams-00001.xml', $xml);
file_put_contents($output . '/sitemap.xml', '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://concursomestre.com/sitemaps/exams-00001.xml</loc></sitemap></sitemapindex>');

$state = new StaticSitemapArtifactState($output);
$dataset = new StaticSitemapLogicalDataset();
$dataset->add(['family' => 'exam_detail', 'identity' => 'exam:1', 'canonicalUrl' => 'https://concursomestre.com/provas/a', 'lastModified' => null, 'policyVersion' => 'seo-policy.v1']);
$datasetFingerprint = $dataset->fingerprint();
$manifest = StaticSitemapReleaseManifest::create($output, $datasetFingerprint);
$manifestHash = StaticSitemapReleaseManifest::write($output, $manifest);
$artifactFingerprint = (string) $manifest['physicalSetFingerprint'];
$status = [
    'eligibleDatasetFingerprint' => $datasetFingerprint,
    'artifactFingerprint' => $artifactFingerprint,
    'releaseId' => $manifest['releaseId'],
    'manifestHash' => $manifestHash,
];

$state->invalidate('CONTENT_ELIGIBILITY_CHANGED');
sitemapStateAssert(!$state->isCurrent($status, $datasetFingerprint), 'DIRTY sitemap state must never be current.');
$state->markCurrent($datasetFingerprint, $artifactFingerprint, (string) $manifest['releaseId'], $manifestHash, gmdate('c'));
sitemapStateAssert($state->isCurrent($status, $datasetFingerprint), 'Matching materialized dataset and artifact fingerprints must be current.');

$changedFiles = $manifest['files'];
foreach ($changedFiles as &$changedFile) {
    if (($changedFile['name'] ?? null) === 'exams-00001.xml') $changedFile['sha256'] = hash('sha256', 'changed');
}
unset($changedFile);
sitemapStateAssert(
    StaticSitemapReleaseManifest::physicalFingerprint($changedFiles) !== $artifactFingerprint,
    'Changing a materialized XML file must change the artifact fingerprint.'
);

$changedDataset = new StaticSitemapLogicalDataset();
$changedDataset->add(['family' => 'exam_detail', 'identity' => 'exam:2', 'canonicalUrl' => 'https://concursomestre.com/provas/b', 'lastModified' => null, 'policyVersion' => 'seo-policy.v1']);
sitemapStateAssert(
    !$state->isCurrent($status, $changedDataset->fingerprint()),
    'Direct DB drift must invalidate unchanged artifact bytes without markDirty().'
);

$publisher = new StaticSitemapPublisher($output);
sitemapStateAssert($publisher->withdraw(), 'Published artifact must be withdrawn.');
sitemapStateAssert(!file_exists($output) && !is_link($output), 'Withdrawn sitemap path must not remain publicly resolvable.');
sitemapStateAssert(!$publisher->withdraw(), 'Withdrawing an absent artifact must be idempotent.');

@unlink($state->statePath());
sitemapStateRemoveDirectory($root);

fwrite(STDOUT, "StaticSitemapArtifactStateTest: PASS\n");
