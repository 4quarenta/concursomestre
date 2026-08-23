<?php

declare(strict_types=1);

function phase4BudgetAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

try {
    $root = dirname(__DIR__, 2);
    $generator = (string) file_get_contents($root . '/backend/scripts/seo/generate_static_sitemaps.php');
    $blogGenerator = (string) file_get_contents($root . '/backend/modules/seo/sitemaps/StaticBlogSitemapGenerator.php');
    phase4BudgetAssert(is_dir($root . '/src/app/disciplinas/[slug]'), 'Piloto SSR de disciplina nao foi criado.');
    $disciplinePage = (string) file_get_contents($root . '/src/app/disciplinas/[slug]/page.tsx');
    $taxonomyMetadata = (string) file_get_contents($root . '/src/app/taxonomias/knowledgeTaxonomyMetadata.ts');
    phase4BudgetAssert(str_contains($taxonomyMetadata, 'evaluateSeoLaunchControl'), 'Taxonomias deixaram de aplicar launch control.');
    phase4BudgetAssert(str_contains($taxonomyMetadata, 'launchModeRobots(true)'), 'PRELAUNCH deixou de produzir NOINDEX,follow.');
    phase4BudgetAssert(str_contains($disciplinePage, 'notFound()'), 'Piloto de disciplina nao possui hard 404.');
    phase4BudgetAssert(str_contains($generator, 'disciplineDetail('), 'Production-ready sitemap deixou de cobrir disciplinas.');
    phase4BudgetAssert(!str_contains($generator, "'/concursos' =>"), 'Sitemap ainda emite /concursos NOINDEX.');
    phase4BudgetAssert(str_contains($blogGenerator, 'quality PASS real'), 'Categorias sem quality real nao estao fail-closed.');
    foreach (['/blog/tag/', '/blog/autor/'] as $prefix) {
        phase4BudgetAssert(!str_contains($blogGenerator, $prefix), 'Sitemap ainda emite taxonomia NOINDEX: ' . $prefix);
    }
    phase4BudgetAssert(!str_contains($generator, '/disciplinas/{slug}'), 'Sitemap contem template de disciplina.');
    phase4BudgetAssert(str_contains($generator, 'sitemapPublicationAllowed'), 'PRELAUNCH deixou de bloquear publicacao materializada do sitemap.');
    phase4BudgetAssert(
        str_contains($generator, '$routes->simulationDetail($slug)')
            && str_contains($generator, "publication_status = 'published'")
            && str_contains($generator, 'public_simulation_questions ready_sq'),
        'Sitemap futuro de simulados nao aplica publicacao e readiness.'
    );

    echo "Phase4IndexBudgetTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'Phase4IndexBudgetTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
