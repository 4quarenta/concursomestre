<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este relatorio so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/seo/reports/TaxonomyDistributionReporter.php';

try {
    $overlapLimit = 100;
    foreach ($argv as $argument) {
        if (str_starts_with($argument, '--overlap-limit=')) {
            $overlapLimit = max(0, min(500, (int) substr($argument, 16)));
        }
    }
    $db = (new Database('read'))->getConnection();
    $report = (new TaxonomyDistributionReporter($db))->generate($overlapLimit);
    echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'Taxonomy distribution report nao executado: ' . $error->getMessage() . PHP_EOL);
    exit(2);
}
