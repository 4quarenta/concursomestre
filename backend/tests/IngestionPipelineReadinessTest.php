<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/ingestion/IngestionPipeline.php';

function ingestionAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function ingestionItem(string $version = '1', array $payload = []): CanonicalIngestionItem
{
    return new CanonicalIngestionItem(
        'question',
        'fixture',
        'question',
        'question-001',
        $version,
        'event-' . $version,
        $payload ?: ['statement' => 'Conteudo sintetico de teste'],
        ['reference' => 'fixture://question-001', 'secret' => 'must-not-survive'],
    );
}

function ingestionOrchestrator(
    IngestionPersistencePort $store,
    ?TaxonomyResolver $taxonomyResolver = null,
): IngestionOrchestrator {
    return new IngestionOrchestrator(
        $store,
        taxonomyResolver: $taxonomyResolver ?? new TaxonomyResolver(),
        writerRegistry: new IngestionWriterRegistry(['fixture', 'source-a', 'source-b']),
    );
}

$store = new InMemoryIngestionStore();
$orchestrator = ingestionOrchestrator($store);
$item = ingestionItem('1');

$dryRun = $orchestrator->processOne($item, 'run-dry', true);
ingestionAssert($dryRun['action'] === IngestionPlan::CREATE, 'Dry-run deve planejar CREATE.');
ingestionAssert($store->canonicalCount() === 0, 'Dry-run nao pode persistir entidade canonica.');

$created = $orchestrator->processOne($item, 'run-1', false);
ingestionAssert($created['action'] === IngestionPlan::CREATE, 'Primeiro item deve criar.');
ingestionAssert($store->canonicalCount() === 1 && $store->provenanceCount() === 1, 'CREATE deve persistir uma entidade e provenance.');

$replay = $orchestrator->processOne($item, 'run-2', false);
ingestionAssert($replay['action'] === IngestionPlan::NO_CHANGE, 'Replay identico deve ser NO_CHANGE.');
ingestionAssert($store->canonicalCount() === 1, 'Replay nao pode duplicar entidade.');

$updated = $orchestrator->processOne(ingestionItem('2', [
    'statement' => 'Conteudo atualizado',
    'description' => 'Descricao editorial preservada',
]), 'run-3', false);
ingestionAssert($updated['action'] === IngestionPlan::UPDATE, 'Versao nova deve atualizar.');
ingestionAssert($store->canonicalCount() === 1, 'UPDATE deve preservar identidade canonica.');
ingestionAssert(($store->findBySourceIdentity(ingestionItem('2', [
    'statement' => 'Conteudo atualizado',
    'description' => 'Descricao editorial preservada',
]))['payload']['description'] ?? null) === 'Descricao editorial preservada', 'Campo editorial deve respeitar ownership.');

$sameContentNewVersion = $orchestrator->processOne(ingestionItem('3', [
    'statement' => 'Conteudo atualizado',
    'description' => 'Descricao editorial preservada',
]), 'run-3b', false);
ingestionAssert($sameContentNewVersion['action'] === IngestionPlan::NO_CHANGE, 'Versao nova semanticamente igual deve ser NO_CHANGE.');

$sourceA = new CanonicalIngestionItem('exam', 'source-a', 'exam', 'same-exam-a', '1', 'event-a', [
    'title' => 'Exame compartilhado', 'domainIdentity' => ['officialNumber' => 'EX-001'],
]);
$sourceB = new CanonicalIngestionItem('exam', 'source-b', 'exam', 'same-exam-b', '1', 'event-b', [
    'title' => 'Exame compartilhado', 'domainIdentity' => ['officialNumber' => 'EX-001'],
]);
$orchestrator->processOne($sourceA, 'run-cross-a', false);
$crossSource = $orchestrator->processOne($sourceB, 'run-cross-b', true);
ingestionAssert($crossSource['action'] === IngestionPlan::DUPLICATE, 'Duplicata exata entre fontes deve ser deterministica.');

$unknownTaxonomy = ingestionItem('3', [
    'statement' => 'Item com taxonomia desconhecida',
    'taxonomyReferences' => [['name' => 'Taxonomia ausente']],
]);
$review = $orchestrator->processOne($unknownTaxonomy, 'run-4', true);
ingestionAssert($review['action'] === IngestionPlan::REVIEW_REQUIRED, 'Taxonomia desconhecida deve ir para revisao.');

$taxonomyResolver = new TaxonomyResolver(static fn (array $reference): string => (string) ($reference['decision'] ?? ''));
$taxonomyOrchestrator = ingestionOrchestrator(new InMemoryIngestionStore(), $taxonomyResolver);
$exactTaxonomy = ingestionItem('taxonomy-exact', [
    'statement' => 'Exact taxonomy',
    'taxonomyReferences' => [['decision' => TaxonomyResolutionPolicy::EXACT_MATCH, 'canonicalId' => 'taxonomy:1']],
]);
ingestionAssert($taxonomyOrchestrator->processOne($exactTaxonomy, 'run-taxonomy-exact', true)['action'] === IngestionPlan::CREATE, 'Taxonomia exata deve resolver.');
$aliasTaxonomy = ingestionItem('taxonomy-alias', [
    'statement' => 'Alias taxonomy',
    'taxonomyReferences' => [['decision' => TaxonomyResolutionPolicy::ALIAS_MATCH, 'aliasOf' => 'taxonomy:1']],
]);
ingestionAssert($taxonomyOrchestrator->processOne($aliasTaxonomy, 'run-taxonomy-alias', true)['action'] === IngestionPlan::CREATE, 'Alias conhecido deve resolver.');

$unknownWriter = new CanonicalIngestionItem('question', 'unknown-writer', 'question', 'q-unknown', '1', 'event-unknown', ['statement' => 'Unknown writer']);
ingestionAssert($orchestrator->processOne($unknownWriter, 'run-unknown-writer', true)['reasonCodes'] === ['unknown_ingestion_writer'], 'Writer desconhecido deve falhar fechado.');

$invalidResult = $orchestrator->processOne(new CanonicalIngestionItem(
    'question', 'fixture', 'question', 'question-002', '1', 'event-invalid', [], []
), 'run-5', false);
ingestionAssert($invalidResult['action'] === IngestionPlan::REJECT, 'Payload vazio deve ser rejeitado.');

$unsafe = ingestionItem('5', ['statement' => 'asset', 'asset' => ['url' => 'https://localhost/private']]);
$unsafeResult = $orchestrator->processOne($unsafe, 'run-6', true);
ingestionAssert($unsafeResult['action'] === IngestionPlan::REJECT, 'Asset local deve ser rejeitado.');
$unsafeHtml = ingestionItem('6', ['statement' => '<script>alert(1)</script>']);
ingestionAssert($orchestrator->processOne($unsafeHtml, 'run-7', true)['action'] === IngestionPlan::REJECT, 'HTML executavel deve ser rejeitado.');

$adapter = new ArraySourceAdapter('fixture', [[
    'domain' => 'question', 'sourceEntityType' => 'question', 'sourceEntityId' => 'q-1',
    'sourceVersion' => '1', 'eventId' => 'e-1', 'payload' => ['statement' => 'fixture'],
]]);
$batch = $adapter->fetchBatch(null, 10);
ingestionAssert(count($batch['items']) === 1 && $batch['hasMore'] === false, 'Adapter fixture deve paginar sem perda.');
ingestionAssert(!isset($batch['items'][0]->sourceMetadata['secret']), 'Metadata sensivel nao pode sobreviver no item.');

$retryAttempts = 0;
$retry = IngestionRetryExecutor::run(static function () use (&$retryAttempts): string {
    $retryAttempts++;
    if ($retryAttempts < 3) throw new RuntimeException('temporary timeout');
    return 'ok';
}, new IngestionRetryPolicy(3, [0]), static function (): void {});
ingestionAssert($retry['status'] === IngestionStateMachine::COMPLETED && $retryAttempts === 3, 'Retry transitorio nao completou corretamente.');

$permanent = IngestionRetryExecutor::run(static function (): void { throw new InvalidArgumentException('bad payload'); }, new IngestionRetryPolicy(5, [0]), static function (): void {});
ingestionAssert($permanent['status'] === IngestionStateMachine::REJECTED && $permanent['attempts'] === 1, 'Falha de validacao nao pode repetir.');

$runTracker = new IngestionRunTracker();
$runTracker->start('run-resume', 'fixture', 'fixture-ingestion.v1');
$runTracker->checkpoint('run-resume', '2');
$runTracker->fail('run-resume', IngestionFailureClassifier::TRANSIENT);
ingestionAssert($runTracker->get('run-resume')['cursor'] === '2', 'Checkpoint deve preservar cursor deterministico.');
ingestionAssert($runTracker->get('run-resume')['status'] === IngestionStateMachine::RETRYABLE_FAILED, 'Falha transitoria deve permitir resume.');

$partialItems = [];
for ($index = 1; $index <= 3; $index++) {
    $partialItems[] = new CanonicalIngestionItem('news', 'fixture', 'news', 'news-' . $index, '1', 'news-event-' . $index, ['title' => 'Noticia ' . $index]);
}
$partialStore = new InMemoryIngestionStore();
$partialRunner = new IngestionBatchRunner($partialStore);
$partialCrashed = false;
try {
    $partialRunner->run($partialItems, ingestionOrchestrator($partialStore), false, 0, static function (int $cursor) use (&$partialCrashed): void {
        if ($cursor === 1) {
            $partialCrashed = true;
            throw new RuntimeException('synthetic crash');
        }
    });
} catch (RuntimeException) {
}
ingestionAssert($partialCrashed && $partialStore->canonicalCount() === 2, 'Falha parcial deve preservar itens ja confirmados.');
$resumed = $partialRunner->run($partialItems, ingestionOrchestrator($partialStore), false, 2);
ingestionAssert($resumed['processed'] === 1 && $partialStore->canonicalCount() === 3, 'Resume deve concluir somente o restante.');

$assetPolicy = new AssetUrlPolicy();
$assetPolicy->validateDownloadedAsset(['size' => 12, 'mimeType' => 'image/png', 'sha256' => str_repeat('a', 64)]);
$ipv6Rejected = false;
try {
    $assetPolicy->validate('https://[::1]/asset');
} catch (InvalidArgumentException) {
    $ipv6Rejected = true;
}
ingestionAssert($ipv6Rejected, 'Asset IPv6 local deve ser rejeitado.');
$redirectRejected = false;
try {
    $assetPolicy->validateRedirectChain(['https://assets.example.test/file', 'https://127.0.0.1/private']);
} catch (InvalidArgumentException) {
    $redirectRejected = true;
}
ingestionAssert($redirectRejected, 'Redirect para destino privado deve falhar fechado.');
$assetRejected = false;
try {
    $assetPolicy->validateDownloadedAsset(['size' => 101, 'mimeType' => 'text/html', 'sha256' => 'bad'], 100);
} catch (InvalidArgumentException) {
    $assetRejected = true;
}
ingestionAssert($assetRejected, 'Asset oversized ou com MIME inseguro deve ser rejeitado.');

$leaseA = $store->acquireLease('fixture', 'lease-a', 60);
$leaseB = $store->acquireLease('fixture', 'lease-b', 60);
ingestionAssert($leaseA && !$leaseB, 'Execucoes sobrepostas devem respeitar lease.');
$store->releaseLease('fixture', 'lease-a');
ingestionAssert($store->acquireLease('fixture', 'lease-b', 60), 'Lease deve ser recuperavel apos liberacao.');

$migration = (string) file_get_contents(dirname(__DIR__) . '/database/migrations/20260828_140000_ingestion_pipeline_foundation.php');
$rollback = (string) file_get_contents(dirname(__DIR__) . '/database/rollbacks/20260828_140000_ingestion_pipeline_foundation.sql');
ingestionAssert(str_contains($migration, 'ingestion_runs') && str_contains($migration, 'ingestion_provenance') && str_contains($migration, 'ingestion_leases'), 'Migration de ingestao incompleta.');
ingestionAssert(!str_contains($migration, 'INSERT INTO questions') && !str_contains($migration, 'UPDATE questions'), 'Migration nao pode fazer backfill canonico.');
ingestionAssert(str_contains($rollback, 'DROP TABLE IF EXISTS ingestion_runs'), 'Rollback deve remover somente infraestrutura de ingestao.');

$adapterSource = (string) file_get_contents(dirname(__DIR__) . '/modules/ingestion/adapters/ArraySourceAdapter.php');
ingestionAssert(!str_contains($adapterSource, 'PDO') && !preg_match('/\b(INSERT|UPDATE|DELETE)\s+INTO?\b/i', $adapterSource), 'Adapter nao pode escrever diretamente no banco.');

fwrite(STDOUT, "IngestionPipelineReadinessTest: PASS\n");
