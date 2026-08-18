<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/seo/taxonomy/TaxonomyClassification.php';
require_once dirname(__DIR__) . '/modules/seo/taxonomy/TaxonomyPromotionEligibility.php';
require_once dirname(__DIR__) . '/modules/seo/reports/TaxonomyDistributionReporter.php';
require_once dirname(__DIR__) . '/modules/seo/policies/StructuralRoutePolicy.php';

function taxonomyCalibrationAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

try {
    $fixtures = [
        'materia' => ['type' => 'assunto', 'taxonomy_level' => 'materia', 'meta_materia' => 0, 'route' => 'discipline_detail'],
        'topico' => ['type' => 'assunto', 'taxonomy_level' => 'topico', 'meta_materia' => 0, 'route' => 'topic_detail'],
        'subtopico' => ['type' => 'assunto', 'taxonomy_level' => 'subtopico', 'meta_materia' => 0, 'route' => null],
        'assunto' => ['type' => 'assunto', 'taxonomy_level' => 'assunto', 'meta_materia' => 0, 'route' => 'subject_detail'],
        'banca' => ['type' => 'banca', 'taxonomy_level' => null, 'meta_materia' => 0, 'route' => 'board_detail'],
        'orgao' => ['type' => 'orgao', 'taxonomy_level' => 'assunto', 'meta_materia' => 0, 'route' => null],
        'cargo' => ['type' => 'cargo', 'taxonomy_level' => 'topico', 'meta_materia' => 0, 'route' => null],
        'ano' => ['type' => 'ano', 'taxonomy_level' => 'materia', 'meta_materia' => 0, 'route' => null],
    ];
    foreach ($fixtures as $expected => $fixture) {
        $classification = TaxonomyClassification::fromFilter($fixture);
        taxonomyCalibrationAssert($classification['kind'] === $expected, $expected . ' foi classificado como ' . $classification['kind']);
        taxonomyCalibrationAssert($classification['routeFamily'] === $fixture['route'], $expected . ' recebeu rota incorreta.');
    }

    $promotion = new TaxonomyPromotionEligibility();
    $base = ['type' => 'assunto', 'taxonomy_level' => 'materia', 'name' => 'Direito', 'slug' => 'direito'];
    $uncalibrated = $promotion->evaluate($base, ['calibrationAvailable' => false]);
    taxonomyCalibrationAssert(!$uncalibrated['promotable'], 'Taxonomia sem calibracao foi promovida.');
    taxonomyCalibrationAssert(in_array('taxonomy.calibration_required', $uncalibrated['reasonCodes'], true), 'Ausencia de calibracao nao foi registrada.');
    $long = $promotion->evaluate(array_merge($base, ['slug' => str_repeat('a', 81)]), ['calibrationAvailable' => true]);
    taxonomyCalibrationAssert(in_array('taxonomy.slug_too_long', $long['reasonCodes'], true), 'Slug > 80 foi aceito.');
    $pending = $promotion->evaluate(array_merge($base, ['taxonomy_level' => 'pending', 'name' => 'Pending']), ['calibrationAvailable' => true]);
    taxonomyCalibrationAssert(!$pending['promotable'], 'Pending foi promovido.');
    $pendingMatter = $promotion->evaluate(array_merge($base, ['taxonomy_level' => 'pending', 'meta_materia' => 1]), ['calibrationAvailable' => true]);
    taxonomyCalibrationAssert(in_array('taxonomy.pending', $pendingMatter['reasonCodes'], true), 'Pending com meta_materia foi promovido.');

    $summary = TaxonomyDistributionReporter::summarizeRows([
        $base + ['id' => 1, 'public_questions' => 0, 'public_exams' => 0, 'public_laws' => 0],
        ['id' => 2, 'type' => 'assunto', 'taxonomy_level' => 'topico', 'parent_id' => 1, 'name' => 'Topico', 'slug' => 'topico', 'public_questions' => 7],
        ['id' => 3, 'type' => 'orgao', 'name' => 'Outros', 'slug' => 'outros', 'public_questions' => 51],
    ]);
    taxonomyCalibrationAssert($summary['families']['materia']['contentBuckets']['0'] === 1, 'Bucket 0 incorreto.');
    taxonomyCalibrationAssert($summary['families']['topico']['contentBuckets']['5-9'] === 1, 'Bucket 5-9 incorreto.');
    taxonomyCalibrationAssert($summary['families']['orgao']['contentBuckets']['50+'] === 1, 'Bucket 50+ incorreto.');
    taxonomyCalibrationAssert($summary['families']['orgao']['placeholders'] === 1, 'Placeholder nao identificado.');

    $routes = new StructuralRoutePolicy();
    foreach (['discipline_detail', 'contest_hub', 'blog_category'] as $family) {
        taxonomyCalibrationAssert($routes->family($family)['defaultIndexability'] === 'INDEX', $family . ' nao esta elegivel para INDEX.');
    }
    foreach (['blog_tag', 'blog_author', 'facet'] as $family) {
        taxonomyCalibrationAssert($routes->family($family)['defaultIndexability'] === 'NOINDEX', $family . ' nao esta NOINDEX.');
    }

    echo "TaxonomyCalibrationTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'TaxonomyCalibrationTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
