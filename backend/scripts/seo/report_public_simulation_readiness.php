<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este relatorio so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/seo/reports/PublicSimulationReadinessReporter.php';

try {
    $database = new Database('read');
    if (!$database->isUsingReplica()) throw new RuntimeException('DB_READ_* dedicado e obrigatorio para este relatorio.');
    echo json_encode((new PublicSimulationReadinessReporter($database->getConnection()))->generate(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'Public simulation readiness report nao executado: ' . $error->getMessage() . PHP_EOL);
    exit(2);
}
