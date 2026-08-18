<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este relatorio so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/seo/reports/TaxonomyQualityCalibrationReporter.php';

try {
    $db = (new Database('read'))->getConnection();
    $report = (new TaxonomyQualityCalibrationReporter($db))->generate();
    echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'Taxonomy quality calibration nao executada: ' . $error->getMessage() . PHP_EOL);
    exit(2);
}
