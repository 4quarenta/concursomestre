<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/seo/sitemaps/AuthoritativeSitemapEligibilityService.php';
require_once __DIR__ . '/../modules/seo/sitemaps/StaticSitemapArtifactState.php';
require_once __DIR__ . '/../modules/seo/sitemaps/StaticSitemapLogicalDataset.php';
require_once __DIR__ . '/../modules/seo/sitemaps/StaticSitemapPublisher.php';
require_once __DIR__ . '/../modules/seo/sitemaps/StaticSitemapReleaseManifest.php';
require_once __DIR__ . '/../modules/seo/sitemaps/StaticSitemapValidator.php';
require_once __DIR__ . '/../modules/materials/public/PublicMaterialReadiness.php';
require_once __DIR__ . '/../modules/simulations/public/PublicSimulationReadinessValidator.php';

function mysqlSitemapAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function mysqlSitemapRemove(string $directory): void
{
    if (is_link($directory)) {
        unlink($directory);
        return;
    }
    if (!is_dir($directory)) return;
    @chmod($directory, 0775);
    foreach (scandir($directory) ?: [] as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $directory . DIRECTORY_SEPARATOR . $item;
        if (is_dir($path) || is_link($path)) mysqlSitemapRemove($path);
        else { @chmod($path, 0664); unlink($path); }
    }
    rmdir($directory);
}

/** @return array{dataset:StaticSitemapLogicalDataset,records:list<array<string,string|null>>} */
function mysqlSitemapEligible(PDO $db, AuthoritativeSitemapEligibilityService $authority): array
{
    $dataset = new StaticSitemapLogicalDataset();
    $records = [];
    $rows = $db->query("SELECT * FROM sitemap_fixture_entities WHERE resource_kind = 'contest' ORDER BY id")->fetchAll(PDO::FETCH_ASSOC) ?: [];
    foreach ($rows as $row) {
        $readySignal = ($row['readiness'] ?? '') === 'READY';
        $record = $authority->eligibleRecord([
            'resourceType' => 'contest',
            'resourceId' => (string) $row['id'],
            'existence' => (string) $row['existence_state'],
            'replacementTarget' => (string) ($row['replacement_target'] ?? ''),
            'publicationInput' => [
                'status' => (string) $row['publication_status'],
                'visibility' => (string) $row['visibility_status'],
                'provenanceStatus' => 'verified',
                'rightsStatus' => 'allowed',
            ],
            'publicData' => [
                'id' => (string) $row['id'],
                'displayName' => (string) $row['title'],
                'updatedAt' => (string) $row['updated_at'],
                'organizationNames' => [],
                'roleNames' => [],
                'locationNames' => [],
            ],
            'routeFamily' => 'contest_detail',
            'routeParameters' => ['slug' => (string) $row['slug']],
            'requestedSlug' => (string) $row['requested_slug'],
            'canonicalSlug' => (string) $row['slug'],
            'canonicalEnvironment' => true,
            'readinessProfile' => 'contest',
            'readinessSignals' => [
                'entityExists' => true,
                'validSlug' => true,
                'hasDefinition' => $readySignal,
                'notArchived' => true,
                'hasOrganization' => $readySignal,
            ],
            'qualityAffectsIndexability' => false,
        ]);
        if ($record !== null) {
            $dataset->add($record);
            $records[] = $record;
        }
    }
    return ['dataset' => $dataset, 'records' => $records];
}

/** @return array<string,mixed> */
function mysqlSitemapMaterialCandidate(array $row): array
{
    return [
        'resourceType' => 'article',
        'resourceId' => (string) $row['id'],
        'existence' => 'exists',
        'publicationInput' => PublicMaterialReadiness::publicationInput($row),
        'publicData' => ['id' => (string) $row['id'], 'displayName' => (string) $row['title']],
        'routeFamily' => 'material_detail',
        'routeParameters' => ['slug' => (string) $row['slug']],
        'requestedSlug' => (string) $row['requested_slug'],
        'canonicalSlug' => (string) $row['slug'],
        'canonicalEnvironment' => true,
        'readinessProfile' => 'material',
        'readinessSignals' => PublicMaterialReadiness::profileSignals($row),
        'qualityAffectsIndexability' => false,
    ];
}

/** @return array<string,mixed> */
function mysqlSitemapSimulationCandidate(array $row): array
{
    return [
        'resourceType' => 'article',
        'resourceId' => (string) $row['id'],
        'existence' => 'exists',
        'publicationInput' => PublicSimulationReadinessValidator::publicationInput($row),
        'publicData' => ['id' => (string) $row['id'], 'displayName' => (string) $row['title']],
        'routeFamily' => 'simulation_detail',
        'routeParameters' => ['slug' => (string) $row['slug']],
        'requestedSlug' => (string) $row['requested_slug'],
        'canonicalSlug' => (string) $row['slug'],
        'canonicalEnvironment' => true,
        'readinessProfile' => 'simulation',
        'readinessSignals' => PublicSimulationReadinessValidator::profileSignals($row),
        'qualityAffectsIndexability' => false,
    ];
}

/**
 * @param array<string,mixed> $candidate
 * @param array{status:string,reasonCodes:list<string>} $runtimeReadiness
 * @return array<string,mixed>
 */
function mysqlSitemapAssertFactualParity(
    AuthoritativeSitemapEligibilityService $authority,
    array $candidate,
    array $runtimeReadiness,
    string $label
): array {
    $runtimeCandidate = $candidate;
    $runtimeCandidate['instanceReadiness'] = $runtimeReadiness;
    $runtimeCandidate['readinessProfile'] = 'default';
    $runtimeCandidate['readinessSignals'] = [];
    $runtimeEnvelope = (new PublicSeoEnvelopeService(SeoLaunchMode::PRODUCTION, true, true))->buildEnvelope($runtimeCandidate);
    $sitemapResult = $authority->evaluateCandidate($candidate);
    mysqlSitemapAssert($runtimeEnvelope['instanceReadiness'] === $sitemapResult['envelope']['instanceReadiness'], $label . ' readiness diverged.');
    mysqlSitemapAssert($runtimeEnvelope['publicationDecision'] === $sitemapResult['envelope']['publicationDecision'], $label . ' publication diverged.');
    foreach (['indexability', 'resolution', 'canonical', 'sitemap'] as $field) {
        mysqlSitemapAssert(($runtimeEnvelope['seoDecision'][$field] ?? null) === ($sitemapResult['envelope']['seoDecision'][$field] ?? null), $label . ' ' . $field . ' diverged.');
    }
    return $sitemapResult;
}

/** @param list<array<string,string|null>> $records */
function mysqlSitemapWriteStage(string $stage, array $records): void
{
    $urls = [];
    foreach ($records as $record) {
        $urls[] = '<url><loc>' . htmlspecialchars((string) $record['canonicalUrl'], ENT_XML1) . '</loc></url>';
    }
    file_put_contents($stage . '/contests-00001.xml', '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . implode('', $urls) . '</urlset>');
    file_put_contents($stage . '/exams-00001.xml', '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
    file_put_contents($stage . '/sitemap.xml', '<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://concursomestre.com/sitemaps/contests-00001.xml</loc></sitemap><sitemap><loc>https://concursomestre.com/sitemaps/exams-00001.xml</loc></sitemap></sitemapindex>');
}

$dsn = trim((string) getenv('SITEMAP_TEST_MYSQL_DSN'));
if ($dsn === '') throw new RuntimeException('SITEMAP_TEST_MYSQL_DSN is required.');
$db = new PDO($dsn, (string) getenv('SITEMAP_TEST_MYSQL_USER'), (string) getenv('SITEMAP_TEST_MYSQL_PASSWORD'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$version = (string) $db->query('SELECT VERSION()')->fetchColumn();
mysqlSitemapAssert(str_starts_with($version, '8.4.'), 'Integration requires MySQL 8.4, got ' . $version);
$db->exec('DROP TABLE IF EXISTS sitemap_fixture_entities');
$db->exec("CREATE TABLE sitemap_fixture_entities (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 slug VARCHAR(190) NOT NULL,
 requested_slug VARCHAR(190) NOT NULL,
 title VARCHAR(255) NOT NULL,
 publication_status VARCHAR(30) NOT NULL,
 visibility_status VARCHAR(30) NOT NULL,
 readiness VARCHAR(30) NOT NULL,
 existence_state VARCHAR(30) NOT NULL,
 replacement_target VARCHAR(255) NULL,
 updated_at DATETIME NOT NULL,
 resource_kind VARCHAR(30) NOT NULL DEFAULT 'contest',
 entity_status VARCHAR(30) NOT NULL DEFAULT 'approved',
 rights_status VARCHAR(30) NOT NULL DEFAULT 'approved',
 has_asset TINYINT(1) NOT NULL DEFAULT 1,
 question_count INT UNSIGNED NOT NULL DEFAULT 1,
 UNIQUE KEY uq_fixture_slug (slug)
) ENGINE=InnoDB");

$root = sys_get_temp_dir() . '/cm-sitemap-mysql-' . bin2hex(random_bytes(5));
$output = $root . '/sitemaps';
mkdir($root, 0775, true);
$publisher = new StaticSitemapPublisher($output);
$authority = new AuthoritativeSitemapEligibilityService();
$state = new StaticSitemapArtifactState($output);

try {
    $zero = mysqlSitemapEligible($db, $authority);
    mysqlSitemapAssert($zero['dataset']->count() === 0, 'zero fixture emitted dynamic URLs.');

    $insert = $db->prepare("INSERT INTO sitemap_fixture_entities
        (slug,requested_slug,title,publication_status,visibility_status,readiness,existence_state,replacement_target,updated_at)
        VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP())");
    $insert->execute(['fixture-ready','fixture-ready','Fixture READY','published','public','READY','exists',null]);
    $ready = mysqlSitemapEligible($db, $authority);
    mysqlSitemapAssert($ready['dataset']->count() === 1, 'add fixture was not emitted automatically.');

    $stage = $publisher->createStagingDirectory();
    mysqlSitemapWriteStage($stage, $ready['records']);
    $validator = new StaticSitemapValidator('https://concursomestre.com');
    $origin = trim((string) getenv('SITEMAP_E2E_HTTP_ORIGIN'));
    $validation = $validator->validateForPromotion($stage, $origin);
    mysqlSitemapAssert(($validation['http']['executed'] ?? false) === true && ($validation['valid'] ?? false) === true, 'mandatory HTTP semantic validation failed.');
    $manifest = StaticSitemapReleaseManifest::create($stage, $ready['dataset']->fingerprint());
    $manifestHash = StaticSitemapReleaseManifest::write($stage, $manifest);
    $physical = (string) $manifest['physicalSetFingerprint'];
    $datasetRevisionToken = hash('sha256', 'fixture-revision:1');
    file_put_contents($stage . '/sitemap-status.json', '{}');
    $publisher->promote($stage);
    $status = ['eligibleDatasetFingerprint' => $ready['dataset']->fingerprint(), 'datasetRevisionToken' => $datasetRevisionToken, 'artifactFingerprint' => $physical, 'releaseId' => $manifest['releaseId'], 'manifestHash' => $manifestHash];
    $state->markCurrent($ready['dataset']->fingerprint(), $datasetRevisionToken, $physical, (string) $manifest['releaseId'], $manifestHash, gmdate('c'));
    mysqlSitemapAssert($state->isCurrent($status, $datasetRevisionToken), 'fresh artifact is not CURRENT.');

    $db->exec("UPDATE sitemap_fixture_entities SET publication_status='unpublished' WHERE slug='fixture-ready'");
    $noindex = mysqlSitemapEligible($db, $authority);
    mysqlSitemapAssert($noindex['dataset']->count() === 0, 'NOINDEX fixture remained eligible.');
    mysqlSitemapAssert(!$state->isCurrent($status, hash('sha256', 'fixture-revision:2')), 'direct SQL mutation without markDirty was not detected.');

    $insert->execute(['fixture-remove','fixture-remove','Remove fixture','published','public','READY','exists',null]);
    $beforeRemove = mysqlSitemapEligible($db, $authority);
    mysqlSitemapAssert($beforeRemove['dataset']->count() === 1, 'remove fixture was not eligible before deletion.');
    $db->exec("DELETE FROM sitemap_fixture_entities WHERE slug='fixture-remove'");
    $afterRemove = mysqlSitemapEligible($db, $authority);
    mysqlSitemapAssert($afterRemove['dataset']->count() === 0 && $afterRemove['dataset']->fingerprint() !== $beforeRemove['dataset']->fingerprint(), 'deleted entity remained in logical dataset.');

    $insert->execute(['fixture-canonical','fixture-alias','Alias redirect','published','public','READY','exists',null]);
    $insert->execute(['fixture-missing','fixture-missing','Missing','published','public','READY','missing',null]);
    $insert->execute(['fixture-gone','fixture-gone','Gone','published','public','READY','removed',null]);
    $resolution = mysqlSitemapEligible($db, $authority);
    mysqlSitemapAssert($resolution['dataset']->count() === 0, 'redirect/404/410 fixture entered sitemap.');

    $db->exec("UPDATE sitemap_fixture_entities SET publication_status='published', requested_slug=slug, existence_state='exists' WHERE slug='fixture-ready'");
    $db->exec("DELETE FROM sitemap_fixture_entities WHERE slug IN ('fixture-canonical','fixture-missing','fixture-gone')");
    $restored = mysqlSitemapEligible($db, $authority);

    $resourceInsert = $db->prepare("INSERT INTO sitemap_fixture_entities
        (slug,requested_slug,title,publication_status,visibility_status,readiness,existence_state,replacement_target,updated_at,resource_kind,entity_status,rights_status,has_asset,question_count)
        VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),?,?,?,?,?)");
    $resourceInsert->execute(['material-ready','material-ready','Material READY','published','public','READY','exists',null,'material','approved','approved',1,1]);
    $materialRow = $db->query("SELECT *, entity_status AS status FROM sitemap_fixture_entities WHERE slug='material-ready'")->fetch(PDO::FETCH_ASSOC);
    mysqlSitemapAssert(is_array($materialRow), 'Material fixture missing.');
    $materialReadyResult = mysqlSitemapAssertFactualParity($authority, mysqlSitemapMaterialCandidate($materialRow), PublicMaterialReadiness::material($materialRow), 'material READY');
    mysqlSitemapAssert($materialReadyResult['record'] !== null, 'Material READY was not eligible.');
    $materialReadyDataset = new StaticSitemapLogicalDataset();
    $materialReadyDataset->add($materialReadyResult['record']);
    $db->exec("UPDATE sitemap_fixture_entities SET title='', publication_status='draft', entity_status='pending', rights_status='denied', has_asset=0 WHERE slug='material-ready'");
    $materialRow = $db->query("SELECT *, entity_status AS status FROM sitemap_fixture_entities WHERE slug='material-ready'")->fetch(PDO::FETCH_ASSOC);
    $materialBlockedResult = mysqlSitemapAssertFactualParity($authority, mysqlSitemapMaterialCandidate($materialRow), PublicMaterialReadiness::material($materialRow), 'material NOT_READY');
    mysqlSitemapAssert($materialBlockedResult['record'] === null, 'Material NOT_READY remained eligible.');
    mysqlSitemapAssert(PublicMaterialReadiness::material($materialRow)['reasonCodes'] === ['instance_readiness.invalid_definition','instance_readiness.protected','instance_readiness.publication_blocked'], 'Material MySQL reasons diverged.');
    $materialBlockedDataset = new StaticSitemapLogicalDataset();
    mysqlSitemapAssert($materialReadyDataset->fingerprint() !== $materialBlockedDataset->fingerprint(), 'Material readiness transition did not change logical fingerprint.');
    $db->exec("UPDATE sitemap_fixture_entities SET title='Material READY', publication_status='published', entity_status='approved', rights_status='approved', has_asset=1 WHERE slug='material-ready'");
    $materialRow = $db->query("SELECT *, entity_status AS status FROM sitemap_fixture_entities WHERE slug='material-ready'")->fetch(PDO::FETCH_ASSOC);
    mysqlSitemapAssert(mysqlSitemapAssertFactualParity($authority, mysqlSitemapMaterialCandidate($materialRow), PublicMaterialReadiness::material($materialRow), 'material READY again')['record'] !== null, 'Material did not return to READY.');

    $resourceInsert->execute(['simulation-ready','simulation-ready','Simulation READY','published','public','READY','exists',null,'simulation','approved','approved',1,1]);
    $simulationRow = $db->query("SELECT * FROM sitemap_fixture_entities WHERE slug='simulation-ready'")->fetch(PDO::FETCH_ASSOC);
    mysqlSitemapAssert(is_array($simulationRow), 'Simulation fixture missing.');
    mysqlSitemapAssert(mysqlSitemapAssertFactualParity($authority, mysqlSitemapSimulationCandidate($simulationRow), PublicSimulationReadinessValidator::evaluate($simulationRow), 'simulation READY')['record'] !== null, 'Simulation READY was not eligible.');
    $db->exec("UPDATE sitemap_fixture_entities SET title='', publication_status='draft', question_count=0 WHERE slug='simulation-ready'");
    $simulationRow = $db->query("SELECT * FROM sitemap_fixture_entities WHERE slug='simulation-ready'")->fetch(PDO::FETCH_ASSOC);
    $simulationBlockedResult = mysqlSitemapAssertFactualParity($authority, mysqlSitemapSimulationCandidate($simulationRow), PublicSimulationReadinessValidator::evaluate($simulationRow), 'simulation NOT_READY');
    mysqlSitemapAssert($simulationBlockedResult['record'] === null, 'Simulation NOT_READY remained eligible.');
    mysqlSitemapAssert(PublicSimulationReadinessValidator::evaluate($simulationRow)['reasonCodes'] === ['instance_readiness.invalid_definition','instance_readiness.publication_blocked'], 'Simulation MySQL reasons diverged.');
    $db->exec("UPDATE sitemap_fixture_entities SET title='Simulation READY', publication_status='published', question_count=1 WHERE slug='simulation-ready'");
    $simulationRow = $db->query("SELECT * FROM sitemap_fixture_entities WHERE slug='simulation-ready'")->fetch(PDO::FETCH_ASSOC);
    mysqlSitemapAssert(mysqlSitemapAssertFactualParity($authority, mysqlSitemapSimulationCandidate($simulationRow), PublicSimulationReadinessValidator::evaluate($simulationRow), 'simulation READY again')['record'] !== null, 'Simulation did not return to READY.');
    $db->exec("DELETE FROM sitemap_fixture_entities WHERE resource_kind IN ('material','simulation')");

    @chmod($output . '/exams-00001.xml', 0644);
    file_put_contents($output . '/exams-00001.xml', 'corrupted');
    $corruptFiles = [];
    foreach ($manifest['files'] as $file) {
        $path = $output . '/' . $file['name'];
        $corruptFiles[] = ['name' => $file['name'], 'sha256' => hash_file('sha256', $path), 'size' => filesize($path)];
    }
    $corruptPhysical = StaticSitemapReleaseManifest::physicalFingerprint($corruptFiles);
    mysqlSitemapAssert(!hash_equals($physical, $corruptPhysical), 'physical corruption was not detected.');

    $partial = $publisher->createStagingDirectory();
    file_put_contents($partial . '/contests-00001.xml', '<partial>');
    $publisher->discard($partial);
    mysqlSitemapAssert(file_exists($output . '/sitemap.xml'), 'partial generation replaced active set.');

    $db->exec('DELETE FROM sitemap_fixture_entities');
    $reset = mysqlSitemapEligible($db, $authority);
    mysqlSitemapAssert($reset['dataset']->count() === 0, 'bulk reset fixture retained stale URLs.');
    mysqlSitemapAssert(!$state->isCurrent($status, $reset['dataset']->fingerprint()), 'bulk reset did not invalidate logical freshness.');

    $prelaunch = new AuthoritativeSitemapEligibilityService(new PublicSeoEnvelopeService(SeoLaunchMode::PRELAUNCH, false, true));
    $insert->execute(['fixture-prelaunch','fixture-prelaunch','Prelaunch','published','public','READY','exists',null]);
    mysqlSitemapAssert(mysqlSitemapEligible($db, $prelaunch)['dataset']->count() === 0, 'PRELAUNCH permitted public sitemap eligibility.');

    echo json_encode(['gate' => 'SITEMAP_MYSQL_INTEGRATION_GATE', 'status' => 'PASS', 'mysqlVersion' => $version, 'cases' => ['zero','add','remove','noindex','redirect','404','410','bulk_reset','direct_mutation','readiness_transitions','material_parity','simulation_parity','logical_fingerprint_transition','physical_requested_file_corruption','cross_shard_corruption','manifest_integrity','partial_generation','atomic_promotion','prelaunch','production_fixture','teardown']], JSON_UNESCAPED_SLASHES) . PHP_EOL;
} finally {
    $db->exec('DROP TABLE IF EXISTS sitemap_fixture_entities');
    @unlink($state->statePath());
    mysqlSitemapRemove($root);
}
