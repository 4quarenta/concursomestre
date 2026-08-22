<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este relatorio so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/seo/reports/InternalLinkGraphReporter.php';

try {
    $database = new Database('read');
    if (!$database->isUsingReplica()) {
        throw new RuntimeException('DB_READ_* dedicado e obrigatorio para este relatorio.');
    }
    $root = dirname(__DIR__, 3);
    $contract = json_decode((string) file_get_contents($root . '/config/seo/internal-link-graph.v1.json'), true, flags: JSON_THROW_ON_ERROR);
    $pageMap = json_decode((string) file_get_contents($root . '/config/seo/seo-production-page-map.v1.json'), true, flags: JSON_THROW_ON_ERROR);
    $report = (new InternalLinkGraphReporter($database->getConnection(), $contract, $pageMap))->generate();
    echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
    exit(($report['contract']['status'] ?? 'FAIL') === 'PASS' ? 0 : 1);
} catch (Throwable $error) {
    fwrite(STDERR, 'Internal link graph report nao executado: ' . $error->getMessage() . PHP_EOL);
    exit(2);
}
