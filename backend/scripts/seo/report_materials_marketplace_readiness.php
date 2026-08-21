<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este relatorio so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/seo/reports/MaterialsMarketplaceReadinessReporter.php';

try {
    $database = new Database('read');
    if (!$database->isUsingReplica()) {
        throw new RuntimeException('DB_READ_* dedicado e obrigatorio para este relatorio.');
    }
    $report = (new MaterialsMarketplaceReadinessReporter($database->getConnection()))->generate();
    echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'Materials marketplace readiness report nao executado: ' . $error->getMessage() . PHP_EOL);
    exit(2);
}
