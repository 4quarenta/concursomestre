<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/seo/reports/IndexPolicyPhase6Reporter.php';
require_once dirname(__DIR__) . '/modules/seo/launch/SeoRuntimeEnvironment.php';

function phase6PolicyAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$report = (new IndexPolicyPhase6Reporter(dirname(__DIR__, 2)))->report();
phase6PolicyAssert(($report['valid'] ?? false) === true, 'Phase 6 policy report is invalid.');
phase6PolicyAssert(($report['fixtures']['failed'] ?? -1) === 0, 'Phase 6 fixture matrix diverged.');
phase6PolicyAssert(($report['contracts']['productionPageMapFamilies'] ?? 0) >= 55, 'Production Page Map inventory is incomplete.');
phase6PolicyAssert(($report['contracts']['internalLinkGraphFamilies'] ?? 0) === 44, 'Phase 5 graph inventory drifted.');
phase6PolicyAssert(($report['database']['status'] ?? null) === 'NOT_EXECUTED', 'Fixture test must not access a database.');

$environment = new SeoRuntimeEnvironment();
putenv('CANONICAL_BASE_URL');
putenv('SEO_DEPLOYMENT_ENVIRONMENT');
putenv('SEO_PRODUCTION_INDEXING');
putenv('SEO_PRODUCTION_SITEMAP');
$blocked = $environment->evaluate('PRODUCTION');
phase6PolicyAssert($blocked['runtimeIndexingAllowed'] === false, 'Missing production environment did not fail closed.');

putenv('CANONICAL_BASE_URL=https://concursomestre.com');
putenv('SEO_DEPLOYMENT_ENVIRONMENT=PRODUCTION');
putenv('SEO_PRODUCTION_INDEXING=CONFIRMED');
putenv('SEO_PRODUCTION_SITEMAP=DISABLED');
$indexOnly = $environment->evaluate('PRODUCTION', 'https://concursomestre.com');
phase6PolicyAssert($indexOnly['runtimeIndexingAllowed'] === true, 'Explicit canonical production indexing gate did not open.');
phase6PolicyAssert($indexOnly['sitemapPublicationAllowed'] === false, 'Sitemap opened without its independent confirmation.');

putenv('SEO_PRODUCTION_SITEMAP=CONFIRMED');
$fullyActivated = $environment->evaluate('PRODUCTION', 'https://concursomestre.com');
phase6PolicyAssert($fullyActivated['sitemapPublicationAllowed'] === true, 'Fully confirmed sitemap gate did not open.');
phase6PolicyAssert(
    $environment->evaluate('PRODUCTION', 'https://preview.example.com')['runtimeIndexingAllowed'] === false,
    'Noncanonical request origin was accepted.'
);

fwrite(STDOUT, "IndexPolicyPhase6ReporterTest: PASS\n");
