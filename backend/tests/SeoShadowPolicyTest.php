<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/shared/policies/ContentPublicationPolicy.php';
require_once dirname(__DIR__) . '/modules/seo/services/SeoFactsAssembler.php';
require_once dirname(__DIR__) . '/modules/seo/policies/SeoQualityPolicy.php';
require_once dirname(__DIR__) . '/modules/seo/policies/StructuralRoutePolicy.php';
require_once dirname(__DIR__) . '/modules/seo/promotion/DefaultEditorialSeoPromotionProvider.php';
require_once dirname(__DIR__) . '/modules/seo/services/SeoSlugService.php';
require_once dirname(__DIR__) . '/modules/seo/services/SeoPolicyService.php';
require_once dirname(__DIR__) . '/modules/seo/reports/SeoShadowProjectionRepository.php';
require_once dirname(__DIR__) . '/modules/seo/reports/SeoShadowReporter.php';

function seoShadowAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

/** @return array<string, mixed> */
function seoShadowPublicData(string $resourceType, string $id = '123'): array
{
    $common = [
        'id' => $id,
        'displayName' => ucfirst($resourceType) . ' ' . $id,
        'publishedAt' => '2026-08-12T12:00:00Z',
        'updatedAt' => '2026-08-12T13:00:00Z',
        'breadcrumbs' => [],
    ];
    return match ($resourceType) {
        'question' => $common + [
            'statement' => 'Assinale a alternativa correta sobre o conteudo apresentado.',
            'supportText' => 'Texto publico de apoio.',
            'subjectName' => 'Direito Administrativo',
            'topicName' => 'Atos administrativos',
            'boardName' => 'CEBRASPE',
            'year' => 2026,
        ],
        'exam' => $common + [
            'boardName' => 'CEBRASPE',
            'organizationNames' => ['PM-PB'],
            'roleNames' => ['Soldado'],
            'year' => 2026,
        ],
        'taxonomy' => $common + [
            'taxonomyKind' => 'discipline',
            'publicDescription' => 'Conteudo publico da disciplina.',
            'editorialIntroduction' => 'Introducao editorial publica.',
            'publicItemCount' => 30,
        ],
        'board' => $common + [
            'acronym' => 'CEBRASPE',
            'fullName' => 'Centro Brasileiro de Pesquisa em Avaliacao e Selecao',
            'website' => 'https://www.cebraspe.org.br',
            'publicDescription' => 'Informacoes publicas sobre a banca.',
            'editorialIntroduction' => 'Caracteristicas publicas da banca.',
            'publicQuestionCount' => 100,
            'publicExamCount' => 10,
        ],
        'law' => $common + [
            'identifier' => 'Lei 11.340/2006',
            'jurisdiction' => 'Brasil',
            'articleCount' => 46,
            'publicDescription' => 'Texto legal publico.',
            'commentaryExcerpt' => 'Comentario editorial publico.',
        ],
        default => throw new InvalidArgumentException('Fixture desconhecida.'),
    };
}

/** @return array<string, mixed> */
function seoShadowEvidence(string $resourceType): array
{
    return match ($resourceType) {
        'question' => [
            'hasVisual' => false,
            'alternativesValid' => true,
            'taxonomyValid' => true,
            'assetsValid' => true,
            'contextCoherent' => true,
            'distinctContentValid' => true,
            'exactDuplicateCount' => 1,
        ],
        'exam' => ['relationsValid' => true, 'officialFileCount' => 1, 'publicQuestionCount' => 10],
        'taxonomy' => ['hierarchyValid' => true, 'publicContentValid' => true, 'editorialContextValid' => true],
        'board' => ['editorialContextValid' => true],
        'law' => ['editorialContextValid' => true],
        default => [],
    };
}

try {
    $publicationPolicy = new ContentPublicationPolicy();
    $factsAssembler = new SeoFactsAssembler();
    $qualityPolicy = new SeoQualityPolicy();
    $routes = new StructuralRoutePolicy();
    $promotionProvider = new DefaultEditorialSeoPromotionProvider();
    $seoPolicy = new SeoPolicyService($routes, $promotionProvider, new SeoSlugService());

    $public = $publicationPolicy->decide([
        'status' => 'published',
        'visibility' => 'public',
        'provenanceStatus' => 'unknown',
        'rightsStatus' => 'not_evaluable',
    ], ['existingAccessAllowed' => true, 'evaluatedAt' => '2026-08-12T12:00:00Z']);
    seoShadowAssert($public['status'] === 'published' && $public['access'] === 'allowed', 'Direitos nao avaliaveis bloquearam conteudo publico em shadow mode.');
    seoShadowAssert(in_array('publication.rights_not_evaluable', $public['reasonCodes'], true), 'Direitos nao avaliaveis nao foram registrados.');

    $private = $publicationPolicy->decide([
        'status' => 'published', 'visibility' => 'authenticated', 'rightsStatus' => 'allowed', 'provenanceStatus' => 'known',
    ], ['existingAccessAllowed' => false]);
    seoShadowAssert($private['access'] === 'denied', 'A decisao contextual ignorou o acesso existente.');
    $blocked = $publicationPolicy->decide([
        'status' => 'published', 'visibility' => 'public', 'moderationStatus' => 'blocked', 'rightsStatus' => 'allowed', 'provenanceStatus' => 'known',
    ], ['existingAccessAllowed' => true]);
    seoShadowAssert($blocked['status'] === 'blocked' && $blocked['access'] === 'denied', 'Moderacao bloqueada nao foi separada do SEO.');
    $scheduled = $publicationPolicy->decide([
        'status' => 'scheduled', 'visibility' => 'public', 'scheduledAt' => '2099-01-01T00:00:00Z', 'rightsStatus' => 'allowed', 'provenanceStatus' => 'known',
    ], ['existingAccessAllowed' => true, 'evaluatedAt' => '2026-08-12T12:00:00Z']);
    seoShadowAssert($scheduled['status'] === 'scheduled', 'Agendamento futuro foi tratado como publicado.');

    $factsByResource = [];
    foreach (['question', 'exam', 'taxonomy', 'board', 'law'] as $resourceType) {
        $source = seoShadowPublicData($resourceType);
        $source['answer'] = ['raw' => 'A'];
        $source['resposta'] = 'A';
        $source['correctOptionIndex'] = 0;
        $source['correctAlternativeId'] = 'alt-a';
        $source['teacherComment'] = 'conteudo protegido';
        $source['detailedComment'] = 'conteudo protegido';
        $source['editorial'] = [['body' => 'marcador-editorial-protegido']];
        $source['questionEditorials'] = [['body' => 'marcador-question-editorials-protegido']];
        $facts = $factsAssembler->assemble($resourceType, $source);
        $factsByResource[$resourceType] = $facts;
        $encoded = json_encode($facts, JSON_THROW_ON_ERROR);
        foreach ([
            '"answer":', '"resposta":', '"correctOptionIndex":', '"correctAlternativeId":',
            '"teacherComment":', '"detailedComment":', '"editorial":', '"questionEditorials":',
            'marcador-editorial-protegido', 'marcador-question-editorials-protegido',
        ] as $forbidden) {
            seoShadowAssert(!str_contains($encoded, $forbidden), 'SeoFacts expos campo protegido: ' . $forbidden);
        }
        $quality = $qualityPolicy->evaluate($resourceType, $facts, seoShadowEvidence($resourceType));
        seoShadowAssert($quality['status'] === 'PASS', 'Quality PASS falhou para ' . $resourceType . ': ' . implode(',', $quality['reasonCodes']));
    }

    $questionFailData = seoShadowPublicData('question');
    $questionFailData['statement'] = 'Enunciado ainda nao preenchido.';
    $questionFail = $qualityPolicy->evaluate(
        'question',
        $factsAssembler->assemble('question', $questionFailData),
        array_merge(seoShadowEvidence('question'), ['alternativesValid' => false])
    );
    seoShadowAssert($questionFail['status'] === 'FAIL', 'Quality FAIL de question nao foi produzido.');
    seoShadowAssert(in_array('quality.question.placeholder_content', $questionFail['reasonCodes'], true), 'Placeholder nao foi identificado.');
    $questionNotEvaluated = $qualityPolicy->evaluate('question', $factsByResource['question'], []);
    seoShadowAssert($questionNotEvaluated['status'] === 'NOT_EVALUATED', 'Evidencia ausente foi presumida.');

    $indexDecision = $seoPolicy->decide([
        'resourceType' => 'question', 'resourceId' => '123', 'existence' => 'exists',
        'publicationDecision' => $public, 'seoFacts' => $factsByResource['question'],
        'seoQuality' => $qualityPolicy->evaluate('question', $factsByResource['question'], seoShadowEvidence('question')),
        'routeFamily' => 'question_detail', 'routeParameters' => [], 'canonicalEnvironment' => true,
    ]);
    seoShadowAssert($indexDecision['indexability']['status'] === 'INDEX', 'Question PASS publica nao produziu INDEX potencial.');
    seoShadowAssert($indexDecision['sitemap']['eligible'] === true, 'INDEX potencial nao ficou elegivel no relatorio.');

    $privateDecision = $seoPolicy->decide([
        'resourceType' => 'question', 'resourceId' => '124', 'existence' => 'exists',
        'publicationDecision' => $private, 'seoFacts' => $factsByResource['question'],
        'seoQuality' => ['status' => 'PASS', 'reasonCodes' => [], 'checks' => []],
        'routeFamily' => 'question_detail', 'routeParameters' => [],
    ]);
    seoShadowAssert($privateDecision['indexability']['status'] === 'NOINDEX', 'Conteudo privado produziu INDEX potencial.');
    $blockedDecision = $seoPolicy->decide([
        'resourceType' => 'question', 'resourceId' => '125', 'existence' => 'exists',
        'publicationDecision' => $blocked, 'seoFacts' => $factsByResource['question'],
        'seoQuality' => ['status' => 'PASS', 'reasonCodes' => [], 'checks' => []],
        'routeFamily' => 'question_detail', 'routeParameters' => [],
    ]);
    seoShadowAssert($blockedDecision['indexability']['status'] === 'NOINDEX', 'Conteudo bloqueado produziu INDEX potencial.');

    $failDecision = $seoPolicy->decide([
        'resourceType' => 'question', 'resourceId' => '126', 'existence' => 'exists',
        'publicationDecision' => $public, 'seoFacts' => $factsByResource['question'],
        'seoQuality' => $questionFail, 'routeFamily' => 'question_detail', 'routeParameters' => [],
    ]);
    seoShadowAssert($failDecision['indexability']['status'] === 'NOINDEX', 'Quality FAIL produziu INDEX potencial.');
    $notEvaluatedDecision = $seoPolicy->decide([
        'resourceType' => 'question', 'resourceId' => '127', 'existence' => 'exists',
        'publicationDecision' => $public, 'seoFacts' => $factsByResource['question'],
        'seoQuality' => $questionNotEvaluated, 'routeFamily' => 'question_detail', 'routeParameters' => [],
    ]);
    seoShadowAssert($notEvaluatedDecision['indexability']['status'] === 'NOINDEX', 'Quality NOT_EVALUATED produziu INDEX potencial.');

    $redirect = $seoPolicy->decide([
        'resourceType' => 'question', 'resourceId' => '123', 'existence' => 'exists',
        'publicationDecision' => $public, 'seoFacts' => $factsByResource['question'],
        'seoQuality' => ['status' => 'PASS', 'reasonCodes' => [], 'checks' => []],
        'routeFamily' => 'question_detail', 'routeParameters' => [], 'requestedSlug' => 'slug-antigo',
    ]);
    seoShadowAssert($redirect['resolution']['action'] === 'redirect' && !isset($redirect['canonical']), 'Slug divergente nao produziu redirect hipotetico valido.');
    $missing = $seoPolicy->decide(['resourceType' => 'question', 'resourceId' => '999', 'existence' => 'missing']);
    $removed = $seoPolicy->decide(['resourceType' => 'question', 'resourceId' => '998', 'existence' => 'removed']);
    seoShadowAssert($missing['resolution']['action'] === 'not_found', 'Missing nao produziu not_found.');
    seoShadowAssert($removed['resolution']['action'] === 'gone', 'Removed nao produziu gone.');
    try {
        $seoPolicy->decide([
            'resourceType' => 'question', 'resourceId' => '997', 'existence' => 'exists',
            'publicationDecision' => $public, 'seoFacts' => $factsByResource['exam'],
            'seoQuality' => ['status' => 'PASS', 'reasonCodes' => [], 'checks' => []],
            'routeFamily' => 'question_detail', 'routeParameters' => [],
        ]);
        seoShadowAssert(false, 'SeoPolicyService aceitou fatos de outro recurso.');
    } catch (InvalidArgumentException $expected) {
        seoShadowAssert(str_contains($expected->getMessage(), 'outro tipo'), 'Falha de tipo retornou motivo inesperado.');
    }

    $taxonomyPromotion = $promotionProvider->resolve($routes->family('discipline_detail'), []);
    $questionPromotion = $promotionProvider->resolve($routes->family('question_detail'), []);
    seoShadowAssert($taxonomyPromotion['status'] === 'pending', 'Landing editorial foi promovida automaticamente.');
    seoShadowAssert($questionPromotion['status'] === 'not_required', 'Question detail exigiu promocao indevida.');
    seoShadowAssert($routes->buildPath('question_detail', ['id' => 123, 'slug' => 'exemplo']) === '/questoes/123/exemplo', 'Structural Route Policy nao foi interpretada.');
    seoShadowAssert(SeoShadowProjectionRepository::queryBudgetPerBatch('question') === 6, 'Question excedeu o teto de queries por lote.');
    seoShadowAssert(SeoShadowProjectionRepository::queryBudgetPerBatch('exam') === 3, 'Exam excedeu o teto de queries por lote.');
    seoShadowAssert(SeoShadowProjectionRepository::queryBudgetPerBatch('taxonomy') === 3, 'Taxonomy excedeu o teto de queries por lote.');
    seoShadowAssert(SeoShadowProjectionRepository::queryBudgetPerBatch('board') === 3, 'Board excedeu o teto de queries por lote.');
    seoShadowAssert(SeoShadowProjectionRepository::queryBudgetPerBatch('law') === 2, 'Law excedeu o teto de queries por lote.');

    $reporter = new SeoShadowReporter($publicationPolicy, $factsAssembler, $qualityPolicy, $seoPolicy);
    $report = $reporter->emptyReport();
    foreach ([
        ['id' => '201', 'evidence' => seoShadowEvidence('question')],
        ['id' => '202', 'evidence' => array_merge(seoShadowEvidence('question'), ['alternativesValid' => false])],
        ['id' => '203', 'evidence' => []],
    ] as $fixture) {
        $reporter->append($report, [
            'resourceType' => 'question', 'resourceId' => $fixture['id'], 'existence' => 'exists',
            'routeFamily' => 'question_detail', 'routeParameters' => [],
            'publicationInput' => ['status' => 'published', 'visibility' => 'public', 'rightsStatus' => 'not_evaluable'],
            'publicData' => seoShadowPublicData('question', $fixture['id']),
            'qualityEvidence' => $fixture['evidence'],
        ]);
    }
    $report = $reporter->finalize($report, 6, 0.01);
    seoShadowAssert($report['quality'] === ['PASS' => 1, 'FAIL' => 1, 'NOT_EVALUATED' => 1], 'Shadow report nao agregou quality corretamente.');
    seoShadowAssert($report['indexability'] === ['INDEX' => 1, 'NOINDEX' => 2], 'Shadow report nao agregou indexabilidade potencial.');

    $publicRuntimePaths = [dirname(__DIR__) . '/api', dirname(__DIR__) . '/modules'];
    $forbiddenImports = ['SeoPolicyService.php', 'SeoShadowReporter.php', 'SeoQualityPolicy.php'];
    foreach ($publicRuntimePaths as $runtimePath) {
        if (!is_dir($runtimePath)) {
            continue;
        }
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($runtimePath, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if (!$file->isFile() || strtolower($file->getExtension()) !== 'php') {
                continue;
            }
            $normalized = str_replace('\\', '/', $file->getPathname());
            if (str_contains($normalized, '/modules/seo/')) {
                continue;
            }
            $source = file_get_contents($file->getPathname()) ?: '';
            foreach ($forbiddenImports as $forbiddenImport) {
                seoShadowAssert(!str_contains($source, $forbiddenImport), 'Runtime publico integrou shadow policy: ' . $normalized);
            }
        }
    }

    echo "SeoShadowPolicyTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'SeoShadowPolicyTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
