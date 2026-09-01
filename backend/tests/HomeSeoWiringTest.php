<?php

declare(strict_types=1);

$root = dirname(__DIR__);
require_once $root . '/modules/settings/services/PublicSettingsProjection.php';
$projection = (string) file_get_contents($root . '/modules/settings/services/PublicSettingsProjection.php');
$repository = (string) file_get_contents($root . '/modules/filters/repositories/FiltersRepository.php');
$service = (string) file_get_contents($root . '/modules/filters/services/FiltersService.php');
$route = (string) file_get_contents($root . '/modules/filters/routes.php');
$api = (string) file_get_contents($root . '/api/filters/featured-organizations.php');
$adminValidator = (string) file_get_contents($root . '/modules/admin/validators/AdminSettingsValidator.php');
$blogValidator = (string) file_get_contents($root . '/modules/blog/validators/BlogValidator.php');
$blogRepository = (string) file_get_contents($root . '/modules/blog/repositories/BlogRepository.php');

$assert = static function (bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
};

foreach (['featureCards', 'socialLinks', 'featuredOrganizations', 'filterId'] as $field) {
    $assert(str_contains($projection, $field), "Projecao publica nao trata {$field}.");
}
foreach (['f.type = \'orgao\'', 'fetchPublicOrganizationsByFilterIds', 'f.slug', "REGEXP_LIKE(f.slug", 'asset_url'] as $needle) {
    $assert(str_contains($repository, $needle), "Lookup publico de orgaos nao prova {$needle}.");
}
foreach (['PublicTaxonomyExposurePolicy', 'listPublicOrganizationsByFilterIds', 'imageUrl'] as $needle) {
    $assert(str_contains($service, $needle), "Servico da Home nao aplica {$needle}.");
}
foreach (['filter_ids', 'preg_match', 'GET', 'handlePublicFeaturedOrganizationsRoute'] as $needle) {
    $assert(str_contains($route, $needle), "Rota de orgaos destacados nao valida {$needle}.");
}
$assert(str_contains($api, "Database('read')"), 'Endpoint de orgaos destacados nao usa leitura publica.');
$assert(str_contains($blogValidator, "'publishedOnly'"), 'Consulta da Home nao possui filtro explicito de publicados.');
$assert(str_contains($blogRepository, "a.status = 'published'"), 'Repositorio de noticias nao suporta publicados estritos.');
foreach (['FEATURED', 'OPEN_NOTICE', 'COMING_SOON', 'LONG_TERM', 'building', 'landmark', 'shield', 'scale'] as $needle) {
    $assert(str_contains($adminValidator, $needle), "Validacao editorial ausente: {$needle}.");
}

$public = PublicSettingsProjection::project([
    'landingPageContent' => [
        'featuredOrganizations' => [[
            'id' => 'featured-1', 'filterId' => 42, 'status' => 'FEATURED',
            'iconKey' => 'building', 'enabled' => true, 'order' => 10,
            'adminNote' => 'SECRET_ADMIN_NOTE', 'providerId' => 'SECRET_PROVIDER_ID',
        ]],
    ],
]);
$encoded = json_encode($public, JSON_THROW_ON_ERROR);
$assert(!str_contains($encoded, 'SECRET_ADMIN_NOTE') && !str_contains($encoded, 'SECRET_PROVIDER_ID'), 'Allowlist publica vazou metadata editorial interna.');
$assert(($public['marketing']['landingPageContent']['featuredOrganizations'][0]['filterId'] ?? null) === 42, 'Referencia canonica do filtro nao foi preservada.');

$adminService = (string) file_get_contents($root . '/modules/admin/services/AdminSettingsService.php');
$adminValidator = (string) file_get_contents($root . '/modules/admin/validators/AdminSettingsValidator.php');
$assert(str_contains($adminService, "AND type = 'orgao'"), 'Salvamento administrativo nao rejeita filtro de tipo incorreto.');
$assert(str_contains($adminService, 'validateFeaturedOrganizationFilterTypes'), 'Validacao de tipo do filtro nao esta ligada ao salvamento.');
$assert(str_contains($adminValidator, '$organization[\'filterId\'] ?? $organization[\'filter_id\']'), 'Payload administrativo nao usa referencia por filter ID.');
$assert(!str_contains($projection, "'organizationId'"), 'Projecao publica ainda usa organizationId como autoridade.');

echo "HomeSeoWiringTest: PASS\n";
