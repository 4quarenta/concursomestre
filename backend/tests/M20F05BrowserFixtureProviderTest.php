<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/ingestion/providers/BrowserFixtureProviderAdapter.php';
require_once dirname(__DIR__) . '/modules/ingestion/providers/GranIngestionBoundary.php';

function m20f05FixtureAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$previousLaunchMode = getenv('SEO_LAUNCH_MODE');
putenv('SEO_LAUNCH_MODE=PRELAUNCH');

try {
    $runId = 'm20f05-fixture-test-20260913';
    $provider = new BrowserFixtureProviderAdapter();
    $pageOne = $provider->collectPage($runId, 1, 3);
    m20f05FixtureAssert($pageOne['runId'] === $runId, 'Fixture deve preservar run id sintetico.');
    m20f05FixtureAssert($pageOne['total'] === 6 && $pageOne['pages'] === 2, 'Fixture deve cobrir paginacao deterministica.');
    m20f05FixtureAssert(count($pageOne['items']) === 3 && count($pageOne['payloads']) === 3, 'Fixture deve produzir candidatos canonicos e payloads.');
    m20f05FixtureAssert($pageOne['items'][0] instanceof CanonicalIngestionItem, 'Fixture deve usar CanonicalIngestionItem.');
    m20f05FixtureAssert($pageOne['items'][0]->sourceProvider === BrowserFixtureProviderAdapter::provider(), 'Provider fixture nao pode virar Gran por acidente.');

    $preview = (new GranIngestionBoundary())->previewPayloads(
        $pageOne['payloads'],
        $runId,
        BrowserFixtureProviderAdapter::provider()
    );
    m20f05FixtureAssert($preview['provider'] === BrowserFixtureProviderAdapter::provider(), 'Preview deve preservar provider fixture.');
    m20f05FixtureAssert($preview['metrics']['planned'] >= 2, 'Fixture deve ter candidatos publicaveis/revisaveis planejados.');
    m20f05FixtureAssert($preview['metrics']['rejected'] >= 0, 'Metricas do preview devem ser expostas.');

    $store = new InMemoryIngestionStore();
    $session = new CanonicalImportSessionService($store);
    $session->start($runId, BrowserFixtureProviderAdapter::provider(), BrowserFixtureProviderAdapter::contractVersion());
    $session->transition($runId, 'CREATED', 'COLLECTING');
    $session->transition($runId, 'COLLECTING', 'COLLECTED', ['received' => count($pageOne['items'])]);
    $sessionPreview = $session->preview($runId, $pageOne['items'], [$pageOne['items'][0]->sourceEntityId]);
    m20f05FixtureAssert($sessionPreview['items'][0]['selected'] === true, 'Selecao escolhida deve aparecer no preview de sessao.');
    m20f05FixtureAssert($sessionPreview['items'][1]['selected'] === false, 'Candidato nao selecionado nao pode persistir como selecionado.');

    $invalidTransitionRejected = false;
    try {
        $session->transition($runId, 'CREATED', 'COMPLETED');
    } catch (LogicException) {
        $invalidTransitionRejected = true;
    }
    m20f05FixtureAssert($invalidTransitionRejected, 'Transicao invalida de sessao nao pode ser aceita.');
} finally {
    if ($previousLaunchMode === false) {
        putenv('SEO_LAUNCH_MODE');
    } else {
        putenv('SEO_LAUNCH_MODE=' . $previousLaunchMode);
    }
}

fwrite(STDOUT, "M20F05BrowserFixtureProviderTest: PASS\n");
