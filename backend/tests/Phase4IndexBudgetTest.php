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
    $disciplineMetadata = (string) file_get_contents($root . '/src/app/disciplinas/disciplineMetadata.ts');
    phase4BudgetAssert(str_contains($disciplineMetadata, 'index: false'), 'Piloto de disciplina deixou de ser NOINDEX.');
    phase4BudgetAssert(str_contains($disciplineMetadata, 'follow: true'), 'Piloto de disciplina deixou de permitir follow.');
    phase4BudgetAssert(str_contains($disciplinePage, 'notFound()'), 'Piloto de disciplina nao possui hard 404.');
    phase4BudgetAssert(!str_contains($generator, 'disciplineDetail('), 'Sitemap passou a emitir disciplinas.');
    phase4BudgetAssert(!str_contains($generator, "'/concursos' =>"), 'Sitemap ainda emite /concursos NOINDEX.');
    foreach (['/blog/categoria/', '/blog/tag/', '/blog/autor/'] as $prefix) {
        phase4BudgetAssert(!str_contains($blogGenerator, $prefix), 'Sitemap ainda emite taxonomia sem promocao: ' . $prefix);
    }
    phase4BudgetAssert(!str_contains($generator, '/disciplinas/{slug}'), 'Sitemap contem template de disciplina.');

    echo "Phase4IndexBudgetTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'Phase4IndexBudgetTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
