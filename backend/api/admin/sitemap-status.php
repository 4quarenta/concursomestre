<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../modules/seo/sitemaps/StaticSitemapArtifactState.php';
require_once __DIR__ . '/../../modules/seo/sitemaps/StaticSitemapDatasetRevision.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
        Response::error('Metodo nao permitido.', 405, null, 'method_not_allowed');
    }

    $db = (new Database('read'))->getConnection();
    requirePlatformAdminSessionContext($db);

    $directory = rtrim((string) (getenv('SITEMAP_OUTPUT_DIR') ?: dirname(__DIR__, 2) . '/storage/sitemaps'), '/\\');
    $statusPath = $directory . '/sitemap-status.json';
    if (!is_file($statusPath)) {
        Response::success(null, 'Status do sitemap indisponivel.');
    }

    $status = json_decode((string) file_get_contents($statusPath), true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($status)) {
        Response::success(null, 'Status do sitemap indisponivel.');
    }

    $revision = StaticSitemapDatasetRevision::current($db);
    $state = new StaticSitemapArtifactState($directory);
    if (!$state->isCurrent($status, (string) ($revision['token'] ?? ''))) {
        Response::success(null, 'Status do sitemap indisponivel.');
    }

    Response::success($status, 'Status do sitemap carregado.');
} catch (JsonException) {
    Response::success(null, 'Status do sitemap indisponivel.');
} catch (Throwable $exception) {
    Response::serverError('Nao foi possivel carregar o status do sitemap.', $exception);
}
