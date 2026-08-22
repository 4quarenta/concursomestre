<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/blog/reports/BlogTaxonomyReadinessReporter.php';

try {
    $database = new Database('read');
    if (!$database->isUsingReplica()) {
        throw new RuntimeException('DB_READ_* dedicado e obrigatorio para este relatorio.');
    }
    $db = $database->getConnection();
    $report = (new BlogTaxonomyReadinessReporter($db))->report();
    fwrite(STDOUT, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
} catch (Throwable $error) {
    fwrite(STDERR, 'BLOG_TAXONOMY_REPORT_FAILED: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
