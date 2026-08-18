<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/seo/reports/TaxonomyQualityCalibrationReporter.php';

function calibrationReporterAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

try {
    $reflection = new ReflectionClass(TaxonomyQualityCalibrationReporter::class);
    calibrationReporterAssert($reflection->hasMethod('generate'), 'Reporter nao expoe generate().');
    $source = (string) file_get_contents($reflection->getFileName());
    foreach (['INSERT ', 'UPDATE ', 'DELETE ', 'ALTER ', 'CREATE ', 'DROP ', 'TRUNCATE '] as $write) {
        calibrationReporterAssert(stripos($source, $write) === false, 'Reporter contem operacao de escrita: ' . trim($write));
    }
    calibrationReporterAssert(str_contains($source, "filters.slug"), 'Autoridade de slug persistido nao foi registrada.');
    calibrationReporterAssert(str_contains($source, "'newIndexUrls' => 0"), 'Index budget runtime nao esta travado em zero.');
    calibrationReporterAssert(str_contains($source, "'newSitemapUrls' => 0"), 'Sitemap runtime nao esta travado em zero.');
    echo "TaxonomyQualityCalibrationReporterTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'TaxonomyQualityCalibrationReporterTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
