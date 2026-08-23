<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/seo/launch/SeoLaunchMode.php';
require_once dirname(__DIR__) . '/modules/seo/launch/SeoInstanceReadiness.php';
require_once dirname(__DIR__) . '/modules/seo/launch/SeoProductionPageMap.php';
require_once dirname(__DIR__) . '/modules/seo/policies/StructuralRoutePolicy.php';
require_once dirname(__DIR__) . '/modules/seo/promotion/DefaultEditorialSeoPromotionProvider.php';
require_once dirname(__DIR__) . '/modules/seo/services/SeoSlugService.php';
require_once dirname(__DIR__) . '/modules/seo/services/SeoPolicyService.php';
require_once dirname(__DIR__) . '/shared/policies/ContentPublicationPolicy.php';
require_once dirname(__DIR__) . '/modules/seo/services/SeoFactsAssembler.php';
require_once dirname(__DIR__) . '/modules/seo/policies/SeoQualityPolicy.php';

function launchAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

try {
    launchAssert(SeoLaunchMode::normalize(null) === 'PRELAUNCH', 'Missing mode did not fail safe.');
    launchAssert(SeoLaunchMode::normalize('invalid') === 'PRELAUNCH', 'Invalid mode did not fail safe.');

    $map = new SeoProductionPageMap();
    foreach ($map->families() as $family) {
        launchAssert(($family['preLaunchIndexability'] ?? null) === 'NOINDEX', 'PRELAUNCH family can index.');
        if (($family['familyEligibility'] ?? null) === 'PERMANENT_NOINDEX') {
            launchAssert(($family['targetProductionIndexability'] ?? null) === 'NOINDEX', 'Permanent family targets INDEX.');
            launchAssert(($family['sitemapTarget'] ?? null) === 'EXCLUDE', 'Permanent family targets sitemap.');
        }
    }

    $publicationPolicy = new ContentPublicationPolicy();
    $factsAssembler = new SeoFactsAssembler();
    $qualityPolicy = new SeoQualityPolicy();
    $publication = $publicationPolicy->decide([
        'status' => 'published', 'visibility' => 'public', 'rightsStatus' => 'allowed', 'provenanceStatus' => 'known',
    ], ['existingAccessAllowed' => true]);
    $facts = $factsAssembler->assemble('question', [
        'id' => '123',
        'displayName' => 'Questao publica de teste',
        'statement' => 'Assinale a alternativa correta sobre direito administrativo.',
        'subjectName' => 'Direito Administrativo',
        'publishedAt' => '2026-08-17T12:00:00Z',
        'updatedAt' => '2026-08-17T12:00:00Z',
        'breadcrumbs' => [],
    ]);
    $quality = $qualityPolicy->evaluate('question', $facts, [
        'hasVisual' => false,
        'alternativesValid' => true,
        'taxonomyValid' => true,
        'assetsValid' => true,
        'contextCoherent' => true,
        'distinctContentValid' => true,
        'exactDuplicateCount' => 1,
    ]);
    $input = [
        'resourceType' => 'question',
        'resourceId' => '123',
        'existence' => 'exists',
        'publicationDecision' => $publication,
        'seoFacts' => $facts,
        'seoQuality' => $quality,
        'instanceReadiness' => ['status' => 'READY', 'reasonCodes' => []],
        'routeFamily' => 'question_detail',
        'routeParameters' => [],
    ];
    $service = static fn (string $mode): SeoPolicyService => new SeoPolicyService(
        new StructuralRoutePolicy(),
        new DefaultEditorialSeoPromotionProvider(),
        new SeoSlugService(),
        'https://concursomestre.com',
        $map,
        $mode,
        true
    );

    $failClosedProduction = new SeoPolicyService(
        new StructuralRoutePolicy(),
        new DefaultEditorialSeoPromotionProvider(),
        new SeoSlugService(),
        'https://concursomestre.com',
        $map,
        'PRODUCTION',
        false
    );
    $blockedProduction = $failClosedProduction->decide($input);
    launchAssert($blockedProduction['indexability']['status'] === 'NOINDEX', 'PRODUCTION sem ativacao explicita produziu INDEX.');
    launchAssert(
        in_array('indexability.production_activation_missing', $blockedProduction['indexability']['reasonCodes'], true),
        'Gate de ativacao ausente nao foi registrado.'
    );

    $prelaunch = $service('PRELAUNCH')->decide($input);
    launchAssert($prelaunch['indexability']['status'] === 'NOINDEX', 'PRELAUNCH produced INDEX.');
    launchAssert($prelaunch['sitemap']['eligible'] === false, 'PRELAUNCH produced sitemap eligibility.');
    launchAssert(in_array('indexability.launch_prelaunch', $prelaunch['indexability']['reasonCodes'], true), 'PRELAUNCH reason missing.');

    $candidate = $service('GO_CANDIDATE')->decide($input);
    launchAssert($candidate['indexability']['status'] === 'NOINDEX', 'GO_CANDIDATE produced INDEX.');

    $production = $service('PRODUCTION')->decide($input);
    launchAssert($production['indexability']['status'] === 'INDEX', 'Ready production fixture did not INDEX.');
    launchAssert($production['sitemap']['eligible'] === true, 'Ready production fixture did not enter sitemap simulation.');

    $productionTaxonomy = $service('PRODUCTION')->decide(array_merge($input, [
        'routeFamily' => 'discipline_detail',
        'qualityAffectsIndexability' => false,
    ]));
    launchAssert($productionTaxonomy['indexability']['status'] === 'INDEX', 'Disciplina READY nao foi promovida na simulacao PRODUCTION.');
    launchAssert($productionTaxonomy['sitemap']['eligible'] === true, 'Disciplina READY ficou fora da simulacao de sitemap.');

    foreach (['topic_detail', 'subject_detail'] as $familyId) {
        $readyTaxonomy = $service('PRODUCTION')->decide(array_merge($input, [
            'routeFamily' => $familyId,
            'qualityAffectsIndexability' => false,
        ]));
        launchAssert($readyTaxonomy['indexability']['status'] === 'INDEX', $familyId . ' READY nao foi promovida.');
        launchAssert($readyTaxonomy['sitemap']['eligible'] === true, $familyId . ' READY ficou fora do sitemap simulado.');
    }

    $invalidTaxonomy = $service('PRODUCTION')->decide(array_merge($input, [
        'routeFamily' => 'topic_detail',
        'instanceReadiness' => ['status' => 'NOT_READY', 'reasonCodes' => ['instance_readiness.invalid_taxonomy_chain']],
        'qualityAffectsIndexability' => false,
    ]));
    launchAssert($invalidTaxonomy['indexability']['status'] === 'NOINDEX', 'Cadeia invalida foi promovida.');
    launchAssert($invalidTaxonomy['sitemap']['eligible'] === false, 'Cadeia invalida entrou no sitemap.');

    $organizationFamily = $map->family('organization_detail');
    launchAssert(($organizationFamily['launchStatus'] ?? null) === 'ACTIVE', 'Familia de orgao nao foi ativada como implementada.');
    launchAssert(($organizationFamily['targetProductionIndexability'] ?? null) === 'INDEX', 'Target de orgao deixou de ser INDEX.');
    launchAssert(($organizationFamily['sitemapTarget'] ?? null) === 'INCLUDE_WHEN_READY', 'Target de sitemap do orgao foi removido.');

    $notReady = $service('PRODUCTION')->decide(array_merge($input, [
        'instanceReadiness' => ['status' => 'NOT_READY', 'reasonCodes' => ['instance_readiness.pending']],
    ]));
    launchAssert($notReady['indexability']['status'] === 'NOINDEX', 'NOT_READY fixture produced INDEX.');

    echo "SeoLaunchControlTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'SeoLaunchControlTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
