<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$files = [
    '/config/cors.php' => ['RequestContext::bootstrap()'],
    '/shared/http/ApiResponse.php' => ['RequestContext::applyResponseHeaders()'],
    '/shared/observability/RequestContext.php' => ['X-Request-Id:', '[REDACTED]', 'http_request_completed'],
    '/shared/health/SystemHealthService.php' => ['SchemaMigrationRunner', 'runtimeStore', 'workers'],
    '/shared/health/SystemReadinessEndpoint.php' => ['SystemHealthService::readiness', 'service_not_ready'],
    '/api/system/health.php' => ['SystemHealthService::liveness()'],
    '/api/system/readiness.php' => ['SystemReadinessEndpoint::respond()'],
    '/config/database.php' => [
        '[database_connection_failed]',
        'Database connection failed. Reference:',
    ],
];

foreach ($files as $relative => $needles) {
    $content = file_get_contents($root . $relative);
    if (!is_string($content)) {
        throw new RuntimeException('Arquivo de observabilidade ausente: ' . $relative);
    }
    foreach ($needles as $needle) {
        if (!str_contains($content, $needle)) {
            throw new RuntimeException("Sinal ausente em {$relative}: {$needle}");
        }
    }
}

$databaseConfig = file_get_contents($root . '/config/database.php');
if (!is_string($databaseConfig) || str_contains($databaseConfig, 'Database connection failed: " . $exception->getMessage()')) {
    throw new RuntimeException('Detalhes do PDO ainda podem escapar pela excecao publica.');
}

fwrite(STDOUT, "ReleaseObservabilityWiringTest: PASS\n");
