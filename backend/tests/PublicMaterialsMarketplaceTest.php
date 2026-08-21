<?php

declare(strict_types=1);

$root = dirname(__DIR__);
require_once $root . '/modules/materials/public/PublicMaterialReadiness.php';
require_once $root . '/modules/materials/public/PublicMaterialProjection.php';
require_once $root . '/modules/seo/routes/PublicRouteBuilder.php';

$assert = static function (bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
};

try {
    $migration = (string) file_get_contents($root . '/database/migrations/20260821_120000_public_materials.php');
    $rollback = (string) file_get_contents($root . '/database/rollbacks/20260821_120000_public_materials.sql');
    $repository = (string) file_get_contents($root . '/modules/materials/public/PublicMaterialsRepository.php');
    $service = (string) file_get_contents($root . '/modules/materials/public/PublicMaterialsService.php');
    $projection = (string) file_get_contents($root . '/modules/materials/public/PublicMaterialProjection.php');
    $reporter = (string) file_get_contents($root . '/modules/seo/reports/MaterialsMarketplaceReadinessReporter.php');
    $reporterScript = (string) file_get_contents($root . '/scripts/seo/report_materials_marketplace_readiness.php');
    $sitemap = (string) file_get_contents($root . '/scripts/seo/generate_static_sitemaps.php');
    $productionMap = json_decode((string) file_get_contents(dirname($root) . '/config/seo/seo-production-page-map.v1.json'), true, flags: JSON_THROW_ON_ERROR);

    foreach (['publication_status', 'visibility_status', 'rights_status', 'availability_status', 'public_author_name', 'cover_is_public', 'preview_is_public'] as $column) {
        $assert(str_contains($migration, "'{$column}'"), 'Migration perdeu coluna publica: ' . $column);
    }
    $assert(str_contains($migration, "DEFAULT 'draft'") && str_contains($migration, "DEFAULT 'private'") && str_contains($migration, "DEFAULT 'pending'"), 'Novos materiais nao falham fechados.');
    $assert(str_contains($migration, 'CREATE TABLE IF NOT EXISTS material_aliases'), 'Aliases persistidos nao foram criados.');
    $assert(str_contains($migration, 'ON DELETE RESTRICT'), 'Alias possui delecao destrutiva.');
    $assert(!preg_match('/\$db->(?:exec|prepare)\(\s*["\']\s*(?:INSERT|UPDATE|DELETE)\b/i', $migration), 'Migration possui backfill ou DML.');
    $assert(substr_count($rollback, 'DROP TABLE IF EXISTS') === 1 && str_contains($rollback, 'DROP COLUMN slug'), 'Rollback nao esta restrito a extensao publica.');

    $readyRow = [
        'id' => 'mat-publico', 'slug' => 'guia-de-estudo', 'title' => 'Guia de estudo',
        'status' => 'approved', 'publication_status' => 'published', 'visibility_status' => 'public',
        'rights_status' => 'approved', 'archived_at' => null, 'has_asset' => 1,
        'availability_status' => 'available', 'is_free' => 0, 'price_decimal' => '29.90', 'currency' => 'BRL',
    ];
    $assert(PublicMaterialReadiness::material($readyRow)['status'] === 'READY', 'Material estruturalmente publico nao ficou READY.');
    $assert(PublicMaterialReadiness::listing($readyRow)['status'] === 'READY', 'Oferta paga valida nao ficou READY.');
    $assert(PublicMaterialReadiness::minorUnits('29.90') === 2990, 'Preco decimal nao foi convertido exatamente.');
    $assert(PublicMaterialReadiness::minorUnits('29.999') === null, 'Precisao monetaria invalida foi aceita.');
    $free = array_replace($readyRow, ['is_free' => 1, 'price_decimal' => '0.00']);
    $assert(PublicMaterialReadiness::listing($free)['status'] === 'READY', 'Gratis persistido nao ficou READY.');
    $assert(PublicMaterialReadiness::listing(array_replace($free, ['price_decimal' => '19.90']))['status'] === 'NOT_READY', 'Gratis com preco positivo foi publicado.');
    $assert(PublicMaterialReadiness::listing(array_replace($readyRow, ['currency' => 'USD']))['status'] === 'NOT_READY', 'Moeda sem suporte no checkout virou oferta publica.');
    foreach (['0.10' => 10, '0.29' => 29, '19.90' => 1990, '99.99' => 9999, '1000.00' => 100000] as $decimal => $minor) {
        $assert(PublicMaterialReadiness::minorUnits($decimal) === $minor, 'Conversao monetaria inexata: ' . $decimal);
    }
    $notForSale = array_replace($readyRow, ['availability_status' => 'not_for_sale']);
    $assert(PublicMaterialReadiness::material($notForSale)['status'] === 'READY', 'Indisponibilidade comercial apagou landing historica.');
    $assert(PublicMaterialReadiness::listing($notForSale)['status'] === 'NOT_READY', 'Material sem oferta virou listing.');
    foreach ([
        ['publication_status' => 'draft'], ['visibility_status' => 'private'], ['rights_status' => 'pending'],
        ['status' => 'pending'], ['has_asset' => 0], ['slug' => 'Slug-Invalido'],
    ] as $override) {
        $assert(PublicMaterialReadiness::material(array_replace($readyRow, $override))['status'] === 'NOT_READY', 'Gate publico aceitou estado protegido.');
    }

    $payload = PublicMaterialProjection::detail([
        'material' => $readyRow + [
            'description' => '<script>alert(1)</script>', 'public_author_name' => 'Equipe pública',
            'cover_is_public' => 1, 'cover_url' => 'https://cdn.example.com/capa.webp',
            'preview_is_public' => 1, 'preview_url' => 'https://cdn.example.com/preview.pdf?token=SECRET',
            'files_json' => ['storage_key' => 'PRIVATE_KEY'], 'author_id' => 'SELLER_PRIVATE',
            'admin_notes' => 'SECRET_ADMIN', 'payment_id' => 'SECRET_PAYMENT',
        ],
        'canonicalPath' => '/materiais/guia-de-estudo',
        'taxonomies' => [['id' => 1, 'slug' => 'direito', 'name' => 'Direito', 'relationType' => 'discipline', 'path' => '/disciplinas/direito', 'provider_id' => 'SECRET_PROVIDER']],
        'breadcrumbs' => [['label' => 'Materiais', 'canonicalPath' => '/materiais', 'admin' => 'SECRET']],
        'readiness' => ['status' => 'READY', 'reasonCodes' => []],
        'listingReadiness' => ['status' => 'READY', 'reasonCodes' => []],
    ]);
    $encoded = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    foreach (['PRIVATE_KEY', 'SELLER_PRIVATE', 'SECRET_ADMIN', 'SECRET_PAYMENT', 'SECRET_PROVIDER', 'files_json', 'author_id', 'payment_id'] as $forbidden) {
        $assert(!str_contains($encoded, $forbidden), 'Projection publica vazou ' . $forbidden);
    }
    $assert(($payload['previewUrl'] ?? null) === null, 'URL assinada/tokenizada foi exposta.');
    $contradictoryOffer = PublicMaterialProjection::summary(array_replace($free, ['price_decimal' => '19.90']));
    $assert(($contradictoryOffer['offer']['mode'] ?? null) === 'not_for_sale', 'Projection publicou gratuidade contraditoria.');
    foreach (['javascript:alert(1)', 'data:text/html,x', 'file:///tmp/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://user:pass@example.com/x'] as $unsafe) {
        $unsafePayload = PublicMaterialProjection::summary($readyRow + ['preview_is_public' => 1, 'preview_url' => $unsafe]);
        $assert(($unsafePayload['previewUrl'] ?? null) === null, 'URL publica perigosa foi aceita: ' . $unsafe);
    }

    $routes = new PublicRouteBuilder();
    $assert($routes->materialsIndex() === '/materiais', 'Hub canonico divergente.');
    $assert($routes->materialDetail('guia-de-estudo') === '/materiais/guia-de-estudo', 'Detail canonico divergente.');
    $assert($routes->marketplaceIndex() === '/marketplace', 'Marketplace funcional divergente.');
    $assert(!str_contains($repository, 'JOIN users') && !str_contains($repository, 'transactions'), 'Catalogo publico mistura vendedor privado ou compra.');
    $assert(str_contains($repository, 'DETAIL_QUERY_BUDGET = 2') && str_contains($repository, 'DIRECTORY_QUERY_BUDGET = 2'), 'Query budget constante nao foi declarado.');
    $assert(str_contains($repository, 'attached_material_id') && str_contains($repository, "status = 'attached'"), 'Asset canonico nao governa readiness.');
    $assert(str_contains($repository, "rights_status = 'approved'") && str_contains($repository, "visibility_status = 'public'"), 'Direitos/publicacao nao sao impostos no SQL.');
    $assert(str_contains($service, "['materials', 'marketplace']") && str_contains($service, 'validSlug'), 'API aceita escopo ou slug arbitrario.');
    $assert(!preg_match('/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\b/i', $reporter), 'Reporter possui comando de escrita.');
    $assert(str_contains($reporterScript, "new Database('read')") && str_contains($reporterScript, 'isUsingReplica'), 'Reporter nao exige DB_READ dedicado.');
    $assert(str_contains($sitemap, "sprintf('materials-%05d.xml'") && str_contains($sitemap, '$routes->materialDetail($slug)'), 'Sitemap Material nao e readiness-aware/loteado.');
    $assert(str_contains($sitemap, 'attached_material_id = materials.id') && str_contains($sitemap, "rights_status = 'approved'"), 'Sitemap inclui Material sem asset/direitos.');

    $families = [];
    foreach ($productionMap['families'] ?? [] as $family) $families[(string) ($family['familyId'] ?? '')] = $family;
    foreach (['materials_hub', 'material_detail'] as $familyId) {
        $family = $families[$familyId] ?? [];
        $assert(($family['launchStatus'] ?? null) === 'ACTIVE', $familyId . ' nao esta ACTIVE.');
        $assert(($family['familyEligibility'] ?? null) === 'INDEXABLE', $familyId . ' nao esta INDEXABLE.');
        $assert(($family['preLaunchIndexability'] ?? null) === 'NOINDEX', $familyId . ' perdeu PRELAUNCH.');
        $assert(($family['targetProductionIndexability'] ?? null) === 'INDEX', $familyId . ' perdeu target INDEX.');
        $assert(($family['sitemapTarget'] ?? null) === 'INCLUDE_WHEN_READY', $familyId . ' perdeu sitemap readiness.');
    }
    foreach (['marketplace', 'material_legacy'] as $familyId) {
        $family = $families[$familyId] ?? [];
        $assert(($family['familyEligibility'] ?? null) === 'PERMANENT_NOINDEX', $familyId . ' virou familia SEO.');
        $assert(($family['sitemapTarget'] ?? null) === 'EXCLUDE', $familyId . ' entrou no sitemap.');
    }
    $assert(!str_contains($projection, 'signed_download_url') && !str_contains($projection, 'storage_path'), 'Projection referencia campos privados.');

    echo "PublicMaterialsMarketplaceTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'PublicMaterialsMarketplaceTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
