<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$route = (string) file_get_contents($root . '/modules/admin/gran_crawler_routes.php');
$service = (string) file_get_contents($root . '/modules/admin/services/AdminGranCrawlerService.php');
$component = (string) file_get_contents(dirname($root) . '/src/app/admin/components/import/AdminGranCrawlerSection.tsx');
$fixture = (string) file_get_contents($root . '/modules/ingestion/providers/BrowserFixtureProviderAdapter.php');

function m20f05WiringAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

m20f05WiringAssert(str_contains($route, "action === 'map_fixture_provider'"), 'Endpoint fixture admin ausente.');
m20f05WiringAssert(str_contains($route, 'requireAdminSessionContext'), 'Fixture deve herdar autenticacao admin.');
m20f05WiringAssert(str_contains($route, "RateLimiter::enforceProfile('admin_crawler_mapping'"), 'Fixture deve preservar rate limit do mapeamento.');
m20f05WiringAssert(str_contains($route, 'gran_crawler.fixture_provider_map'), 'Fixture deve gerar auditoria admin.');
m20f05WiringAssert(str_contains($service, 'mapBrowserFixtureProvider'), 'Servico fixture do crawler ausente.');
m20f05WiringAssert(str_contains($service, 'CanonicalImportSessionService'), 'Fixture deve usar autoridade canonica de sessao.');
m20f05WiringAssert(str_contains($service, 'BrowserFixtureProviderAdapter::provider()'), 'Fixture deve preservar identidade de provider.');
m20f05WiringAssert(str_contains($fixture, 'SeoLaunchModeAuthority::read()'), 'Fixture deve consultar autoridade de PRELAUNCH.');
m20f05WiringAssert(str_contains($fixture, "SeoLaunchMode::PRELAUNCH"), 'Fixture deve falhar fechado fora de PRELAUNCH.');
m20f05WiringAssert(!str_contains($fixture, 'curl_') && !str_contains($fixture, 'file_get_contents('), 'Fixture nao pode buscar URL remota.');
m20f05WiringAssert(str_contains($component, "action: 'map_fixture_provider'"), 'UI admin deve acionar provider fixture real.');
m20f05WiringAssert(str_contains($component, 'Carregar fixture M20F-05'), 'Botao fixture deve estar visivel na tela admin.');
m20f05WiringAssert(str_contains($component, "result?.provider === 'm20f05-fixture'"), 'Paginacao deve permanecer no provider fixture.');

fwrite(STDOUT, "M20F05BrowserFixtureWiringTest: PASS\n");
