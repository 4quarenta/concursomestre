<?php

declare(strict_types=1);

$root = dirname(__DIR__);
require_once $root . '/modules/filters/professional/ProfessionalTaxonomyReadinessValidator.php';
require_once $root . '/modules/filters/professional/PublicProfessionalTaxonomyProjection.php';
require_once $root . '/modules/seo/routes/PublicRouteBuilder.php';

$assert = static function (bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
};

try {
    $career = ['id' => 10, 'type' => 'carreira', 'slug' => 'carreira-fiscal', 'name' => 'Carreira Fiscal', 'taxonomy_level' => null];
    $position = ['id' => 20, 'type' => 'cargo', 'slug' => 'auditor-fiscal', 'name' => 'Auditor Fiscal', 'taxonomy_level' => null];
    $assert(ProfessionalTaxonomyReadinessValidator::evaluate($career, 'career')['status'] === 'READY', 'Carreira publica nao ficou READY.');
    $assert(ProfessionalTaxonomyReadinessValidator::evaluate($position, 'position')['status'] === 'READY', 'Cargo publico nao ficou READY.');
    $assert(ProfessionalTaxonomyReadinessValidator::evaluate($position, 'career')['reasonCodes'] === ['instance_readiness.wrong_type'], 'Wrong type nao foi isolado.');
    foreach (['pending', 'internal', 'technical'] as $level) {
        $blocked = ProfessionalTaxonomyReadinessValidator::evaluate(array_replace($position, ['taxonomy_level' => $level]), 'position');
        $assert(in_array('instance_readiness.publication_blocked', $blocked['reasonCodes'], true), $level . ' foi publicado.');
    }
    foreach (['Outros', 'Geral', 'Cargo não identificado', 'A definir'] as $name) {
        $blocked = ProfessionalTaxonomyReadinessValidator::evaluate(array_replace($position, ['name' => $name]), 'position');
        $assert(in_array('instance_readiness.placeholder', $blocked['reasonCodes'], true), 'Placeholder foi publicado: ' . $name);
    }
    $duplicate = ProfessionalTaxonomyReadinessValidator::evaluate(array_replace($position, ['canonical_slug_count' => 2]), 'position');
    $assert(in_array('instance_readiness.duplicate_canonical_slug', $duplicate['reasonCodes'], true), 'Slug canonico duplicado nao foi detectado.');
    foreach (['orphan_relation', 'invalid_relation', 'nonpublic_relation'] as $relationIssue) {
        $result = ProfessionalTaxonomyReadinessValidator::evaluate(array_replace($position, [$relationIssue => true]), 'position');
        $assert(in_array('instance_readiness.' . $relationIssue, $result['reasonCodes'], true), 'Relacao invalida nao foi detectada: ' . $relationIssue);
    }
    $assert(ProfessionalTaxonomyReadinessValidator::evaluate(array_replace($position, ['slug' => 'Auditor-Fiscal']), 'position')['status'] === 'NOT_READY', 'Slug nao persistivel resolveu.');
    $assert(ProfessionalTaxonomyReadinessValidator::evaluate(array_replace($position, ['question_count' => 0, 'exam_count' => 0]), 'position')['status'] === 'READY', 'Volume temporario virou gate de readiness.');

    $projection = PublicProfessionalTaxonomyProjection::detail([
        'kind' => 'position', 'identity' => $position + [
            'description' => 'Cargo público.', 'question_count' => 1, 'exam_count' => 1,
            'provider_identity' => 'SECRET_PROVIDER', 'admin_notes' => 'SECRET_ADMIN',
        ],
        'canonicalPath' => '/cargos/auditor-fiscal', 'questionsPath' => '/questoes?role=Auditor%20Fiscal',
        'contestsPath' => '/concursos?cargo=Auditor%20Fiscal',
        'readiness' => ['status' => 'READY', 'reasonCodes' => []],
        'careers' => [['id' => 10, 'slug' => 'carreira-fiscal', 'name' => 'Carreira Fiscal', 'path' => '/carreiras/carreira-fiscal', 'external_id' => 'SECRET_EXTERNAL']],
        'questions' => [['id' => 30, 'excerpt' => 'Questão pública', 'path' => '/questoes/30/questao-publica', 'correctAnswer' => 'SECRET_ANSWER']],
    ]);
    $encoded = json_encode($projection, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    foreach (['SECRET_PROVIDER', 'SECRET_ADMIN', 'SECRET_EXTERNAL', 'SECRET_ANSWER', 'provider_identity', 'admin_notes', 'correctAnswer'] as $forbidden) {
        $assert(!str_contains($encoded, $forbidden), 'Projection publica vazou ' . $forbidden);
    }

    $routes = new PublicRouteBuilder();
    $assert($routes->careerDetail('carreira-fiscal') === '/carreiras/carreira-fiscal', 'Rota canonica de Carreira divergente.');
    $assert($routes->positionDetail('auditor-fiscal') === '/cargos/auditor-fiscal', 'Rota canonica de Cargo divergente.');

    $repository = (string) file_get_contents($root . '/modules/filters/professional/ProfessionalTaxonomiesRepository.php');
    $service = (string) file_get_contents($root . '/modules/filters/professional/ProfessionalTaxonomiesService.php');
    $directoryEndpoint = (string) file_get_contents($root . '/api/filters/professional-directory.php');
    $detailEndpoint = (string) file_get_contents($root . '/api/filters/professional-taxonomy.php');
    $reporterScript = (string) file_get_contents($root . '/scripts/seo/report_professional_taxonomy_readiness.php');
    $contestService = (string) file_get_contents($root . '/modules/contests/services/ContestsService.php');
    $sitemap = (string) file_get_contents($root . '/scripts/seo/generate_static_sitemaps.php');
    $productionMap = json_decode((string) file_get_contents(dirname($root) . '/config/seo/seo-production-page-map.v1.json'), true, flags: JSON_THROW_ON_ERROR);
    $assert(str_contains($repository, "'career' => 'carreira'") && str_contains($repository, "'position' => 'cargo'"), 'Tipos canonicos nao estao fixados no repository.');
    $assert(str_contains($repository, "relation_type='cargo_career'") && str_contains($repository, "relation_type='cargo_organization'"), 'Relacoes profissionais nao sao explicitas.');
    $assert(str_contains($repository, 'filter_aliases') && str_contains($repository, "publicFilterClause('f', \$type)"), 'Alias nao esta tipado pela familia canonica.');
    $assert(str_contains($repository, 'PUBLIC_DETAIL_QUERY_BUDGET = 7'), 'Query budget constante nao foi documentado.');
    $assert(str_contains($repository, 'CHAR_LENGTH({$alias}.slug) <= 190'), 'Repository aceita slug acima do contrato publico.');
    $assert(!preg_match('/low_volume|low_diversity|no_exam|no_board|no_description/i', $service), 'Quality temporaria governa o runtime.');
    $assert(str_contains($service, "'role' => \$name"), 'CTA de Cargo nao usa o parametro funcional role.');
    $assert(str_contains($contestService, 'ProfessionalTaxonomyReadinessValidator::evaluate'), 'Contest interlink nao exige Cargo READY.');
    $assert(str_contains($directoryEndpoint, "new Database('read')") && str_contains($detailEndpoint, "new Database('read')"), 'Endpoints publicos nao usam Database read.');
    $assert(str_contains($reporterScript, "new Database('read')") && str_contains($reporterScript, 'isUsingReplica'), 'Reporter nao exige credencial DB_READ dedicada.');
    $assert(!preg_match('/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\b/i', $reporterScript), 'Reporter possui comando de escrita.');
    $assert(str_contains($sitemap, "type IN ('carreira', 'cargo')") && str_contains($sitemap, "sprintf('professional-%05d.xml'"), 'Sitemap profissional nao e materializado em lotes.');
    $assert(str_contains($sitemap, 'cargo nao identificado'), 'Sitemap nao exclui placeholder NOT_READY.');
    $assert(str_contains($sitemap, 'CHAR_LENGTH(slug) <= 190'), 'Sitemap inclui slug profissional acima do limite publico.');
    $families = [];
    foreach ($productionMap['families'] ?? [] as $family) $families[(string) ($family['familyId'] ?? '')] = $family;
    foreach (['careers_hub', 'career_detail', 'positions_hub', 'position_detail'] as $familyId) {
        $family = $families[$familyId] ?? [];
        $assert(($family['launchStatus'] ?? null) === 'ACTIVE', $familyId . ' nao esta ACTIVE.');
        $assert(($family['familyEligibility'] ?? null) === 'INDEXABLE', $familyId . ' nao esta INDEXABLE.');
        $assert(($family['preLaunchIndexability'] ?? null) === 'NOINDEX', $familyId . ' nao esta protegido no PRELAUNCH.');
        $assert(($family['targetProductionIndexability'] ?? null) === 'INDEX', $familyId . ' perdeu o target de producao.');
        $assert(($family['sitemapTarget'] ?? null) === 'INCLUDE_WHEN_READY', $familyId . ' possui target de sitemap divergente.');
    }

    foreach (['carreiras', 'cargos'] as $directory) {
        $page = (string) file_get_contents(dirname($root) . '/src/app/' . $directory . '/page.tsx');
        $detailPage = (string) file_get_contents(dirname($root) . '/src/app/' . $directory . '/[slug]/page.tsx');
        $assert(!str_contains($page, "'use client'") && !str_contains($detailPage, "'use client'"), $directory . ' nao e Server Component.');
        $assert(str_contains($detailPage, 'notFound()') && str_contains($detailPage, 'permanentRedirect'), $directory . ' nao possui hard 404/alias 308.');
        $assert(!preg_match('/useDocumentSeo|document\.title/', $page . $detailPage), $directory . ' reintroduziu metadata client-side.');
    }

    echo "PublicProfessionalTaxonomiesTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'PublicProfessionalTaxonomiesTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
