<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/materials/public/PublicMaterialReadiness.php';
require_once __DIR__ . '/../modules/simulations/public/PublicSimulationReadinessValidator.php';
require_once __DIR__ . '/../modules/seo/launch/SeoLaunchMode.php';
require_once __DIR__ . '/../modules/seo/services/PublicSeoEnvelopeService.php';
require_once __DIR__ . '/../modules/seo/sitemaps/AuthoritativeSitemapEligibilityService.php';

function sitemapParityAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

/** @return array<string,mixed> */
function sitemapParityCandidate(string $profile, bool $ready): array
{
    $families = [
        'question' => ['question_detail', 'question', ['id' => '1', 'slug' => 'questao-1']],
        'exam' => ['exam_detail', 'exam', ['slug' => 'prova-a']],
        'contest' => ['contest_detail', 'contest', ['slug' => 'concurso-a']],
    ];
    [$family, $resourceType, $routeParameters] = $families[$profile];
    $slug = (string) ($routeParameters['slug'] ?? 'questao-1');
    return [
        'resourceType' => $resourceType,
        'resourceId' => '1',
        'existence' => 'exists',
        'publicationInput' => ['status' => 'published', 'visibility' => 'public', 'provenanceStatus' => 'verified', 'rightsStatus' => 'allowed'],
        'publicData' => ['id' => '1', 'displayName' => ucfirst($profile) . ' A', 'updatedAt' => '2026-08-26 12:00:00'],
        'qualityEvidence' => [],
        'routeFamily' => $family,
        'routeParameters' => $routeParameters,
        'requestedSlug' => $slug,
        'canonicalSlug' => $slug,
        'canonicalEnvironment' => true,
        'readinessProfile' => $profile,
        'readinessSignals' => [
            'entityExists' => true,
            'validSlug' => true,
            'hasDefinition' => $ready,
            'notArchived' => true,
            'hasOrganization' => true,
        ],
        'qualityAffectsIndexability' => false,
    ];
}

/** @return array<string,mixed> */
function materialCandidate(array $row): array
{
    return [
        'resourceType' => 'article',
        'resourceId' => (string) ($row['id'] ?? ''),
        'existence' => 'exists',
        'publicationInput' => PublicMaterialReadiness::publicationInput($row),
        'publicData' => ['id' => (string) ($row['id'] ?? ''), 'displayName' => (string) ($row['title'] ?? 'Material')],
        'routeFamily' => 'material_detail',
        'routeParameters' => ['slug' => (string) ($row['slug'] ?? '')],
        'requestedSlug' => (string) ($row['slug'] ?? ''),
        'canonicalSlug' => (string) ($row['slug'] ?? ''),
        'canonicalEnvironment' => true,
        'readinessProfile' => 'material',
        'readinessSignals' => PublicMaterialReadiness::profileSignals($row),
        'qualityAffectsIndexability' => false,
    ];
}

/** @return array<string,mixed> */
function simulationCandidate(array $row): array
{
    return [
        'resourceType' => 'article',
        'resourceId' => (string) ($row['id'] ?? ''),
        'existence' => 'exists',
        'publicationInput' => PublicSimulationReadinessValidator::publicationInput($row),
        'publicData' => ['id' => (string) ($row['id'] ?? ''), 'displayName' => (string) ($row['title'] ?? 'Simulado')],
        'routeFamily' => 'simulation_detail',
        'routeParameters' => ['slug' => (string) ($row['slug'] ?? '')],
        'requestedSlug' => (string) ($row['slug'] ?? ''),
        'canonicalSlug' => (string) ($row['slug'] ?? ''),
        'canonicalEnvironment' => true,
        'readinessProfile' => 'simulation',
        'readinessSignals' => PublicSimulationReadinessValidator::profileSignals($row),
        'qualityAffectsIndexability' => false,
    ];
}

/**
 * @param array<string,mixed> $candidate
 * @param array{status:string,reasonCodes:list<string>} $runtimeReadiness
 */
function assertFactualParity(
    PublicSeoEnvelopeService $runtime,
    AuthoritativeSitemapEligibilityService $sitemap,
    array $candidate,
    array $runtimeReadiness,
    string $label
): void {
    $runtimeCandidate = $candidate;
    $runtimeCandidate['instanceReadiness'] = $runtimeReadiness;
    $runtimeCandidate['readinessProfile'] = 'default';
    $runtimeCandidate['readinessSignals'] = [];
    $runtimeEnvelope = $runtime->buildEnvelope($runtimeCandidate);
    $sitemapResult = $sitemap->evaluateCandidate($candidate);
    $sitemapEnvelope = $sitemapResult['envelope'];

    sitemapParityAssert($runtimeEnvelope['instanceReadiness'] === $runtimeReadiness, $label . ' runtime wrapper changed inside SEO envelope.');
    sitemapParityAssert($runtimeEnvelope['instanceReadiness'] === $sitemapEnvelope['instanceReadiness'], $label . ' factual readiness diverged.');
    sitemapParityAssert($runtimeEnvelope['publicationDecision'] === $sitemapEnvelope['publicationDecision'], $label . ' PublicationDecision diverged.');
    foreach (['indexability', 'resolution', 'canonical', 'sitemap'] as $field) {
        sitemapParityAssert(($runtimeEnvelope['seoDecision'][$field] ?? null) === ($sitemapEnvelope['seoDecision'][$field] ?? null), $label . ' ' . $field . ' diverged.');
    }
    $ready = $runtimeReadiness['status'] === 'READY';
    sitemapParityAssert(($sitemapResult['record'] !== null) === $ready, $label . ' sitemap eligibility diverged from readiness.');
}

$runtime = new PublicSeoEnvelopeService(SeoLaunchMode::PRODUCTION, true, true);
$sitemap = new AuthoritativeSitemapEligibilityService(new PublicSeoEnvelopeService(SeoLaunchMode::PRODUCTION, true, true));
$cases = [];

foreach (['question', 'exam', 'contest'] as $profile) {
    foreach ([true, false] as $ready) {
        $candidate = sitemapParityCandidate($profile, $ready);
        $runtimeEnvelope = $runtime->buildEnvelope($candidate);
        $sitemapResult = $sitemap->evaluateCandidate($candidate);
        sitemapParityAssert($runtimeEnvelope['instanceReadiness'] === $sitemapResult['envelope']['instanceReadiness'], $profile . ' readiness diverged.');
        foreach (['indexability', 'resolution', 'canonical', 'sitemap'] as $field) {
            sitemapParityAssert(($runtimeEnvelope['seoDecision'][$field] ?? null) === ($sitemapResult['envelope']['seoDecision'][$field] ?? null), $profile . ' ' . $field . ' diverged.');
        }
        $cases[] = $profile . '_' . ($ready ? 'ready' : 'not_ready');
    }
}

$materialReady = [
    'id' => 1, 'slug' => 'material-a', 'title' => 'Material A', 'status' => 'approved',
    'publication_status' => 'published', 'visibility_status' => 'public', 'rights_status' => 'approved',
    'archived_at' => null, 'has_asset' => 1,
];
$materialBlocked = array_replace($materialReady, [
    'title' => '', 'status' => 'pending', 'publication_status' => 'draft', 'rights_status' => 'denied', 'has_asset' => 0,
]);
foreach ([['material_ready', $materialReady], ['material_multiple_blockers', $materialBlocked], ['material_ready_again', $materialReady]] as [$label, $row]) {
    assertFactualParity($runtime, $sitemap, materialCandidate($row), PublicMaterialReadiness::material($row), $label);
    $cases[] = $label;
}
sitemapParityAssert(PublicMaterialReadiness::material($materialBlocked)['reasonCodes'] === [
    'instance_readiness.invalid_definition', 'instance_readiness.protected', 'instance_readiness.publication_blocked',
], 'Material reasons are not canonicalized or complete.');

$simulationReady = [
    'id' => 1, 'slug' => 'simulado-a', 'title' => 'Simulado A',
    'publication_status' => 'published', 'visibility_status' => 'public', 'archived_at' => null, 'question_count' => 1,
];
$simulationBlocked = array_replace($simulationReady, ['title' => '', 'publication_status' => 'draft', 'question_count' => 0]);
foreach ([['simulation_ready', $simulationReady], ['simulation_multiple_blockers', $simulationBlocked], ['simulation_ready_again', $simulationReady]] as [$label, $row]) {
    assertFactualParity($runtime, $sitemap, simulationCandidate($row), PublicSimulationReadinessValidator::evaluate($row), $label);
    $cases[] = $label;
}
sitemapParityAssert(PublicSimulationReadinessValidator::evaluate($simulationBlocked)['reasonCodes'] === [
    'instance_readiness.invalid_definition', 'instance_readiness.publication_blocked',
], 'Simulation reasons are not canonicalized or complete.');

$notApplicable = sitemapParityCandidate('contest', true);
$notApplicable['instanceReadiness'] = ['status' => 'NOT_APPLICABLE', 'reasonCodes' => ['instance_readiness.not_applicable']];
$notApplicable['readinessProfile'] = 'default';
$notApplicable['readinessSignals'] = [];
$notApplicableRuntime = $runtime->buildEnvelope($notApplicable);
$notApplicableSitemap = $sitemap->evaluateCandidate($notApplicable);
sitemapParityAssert($notApplicableRuntime['instanceReadiness'] === $notApplicableSitemap['envelope']['instanceReadiness'], 'NOT_APPLICABLE diverged.');
sitemapParityAssert($notApplicableSitemap['record'] === null, 'NOT_APPLICABLE entered sitemap.');
$cases[] = 'not_applicable';

$redirect = sitemapParityCandidate('contest', true);
$redirect['requestedSlug'] = 'alias-antigo';
$redirectResult = $sitemap->evaluateCandidate($redirect);
sitemapParityAssert(($redirectResult['envelope']['seoDecision']['resolution']['action'] ?? null) === 'redirect' && $redirectResult['record'] === null, 'Redirect entered sitemap.');

foreach ([['missing', 'not_found'], ['removed', 'gone']] as [$existence, $resolution]) {
    $candidate = sitemapParityCandidate('contest', true);
    $candidate['existence'] = $existence;
    $result = $sitemap->evaluateCandidate($candidate);
    sitemapParityAssert(($result['envelope']['seoDecision']['resolution']['action'] ?? null) === $resolution && $result['record'] === null, strtoupper($existence) . ' entered sitemap.');
}

$noindex = sitemapParityCandidate('contest', true);
$noindex['publicationInput']['status'] = 'draft';
$noindexResult = $sitemap->evaluateCandidate($noindex);
sitemapParityAssert(($noindexResult['envelope']['seoDecision']['indexability']['status'] ?? null) === 'NOINDEX' && $noindexResult['record'] === null, 'NOINDEX entered sitemap.');

echo json_encode([
    'gate' => 'RUNTIME_SITEMAP_FACTUAL_READINESS_PARITY_GATE',
    'status' => 'PASS',
    'materialParity' => 'PASS',
    'simulationParity' => 'PASS',
    'statusParity' => 'PASS',
    'reasonParity' => 'PASS',
    'cases' => array_merge($cases, ['redirect', '404', '410', 'noindex']),
], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
