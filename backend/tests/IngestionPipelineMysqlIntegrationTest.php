<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/ingestion/IngestionPipeline.php';

ini_set('log_errors', '1');
ini_set('error_log', (string) (getenv('INGESTION_TEST_ERROR_LOG') ?: sys_get_temp_dir() . '/cm-ingestion-test.log'));

function mysqlIngestionAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function mysqlIngestionConnection(): PDO
{
    $host = (string) (getenv('DB_HOST') ?: '127.0.0.1');
    $port = (string) (getenv('DB_PORT') ?: '3306');
    $name = (string) (getenv('DB_NAME') ?: 'concursomestre');
    $user = (string) (getenv('DB_USER') ?: 'root');
    $password = (string) (getenv('DB_PASSWORD') ?: '');
    return new PDO(
        "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
        $user,
        $password,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false],
    );
}

final class SyntheticCanonicalEntityPersistence implements CanonicalEntityPersistencePort
{
    public function __construct(
        private readonly PDO $db,
        private readonly bool $failAfterWrite = false,
    ) {
    }

    public function loadPayload(string $domain, string $canonicalEntityId): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT payload_json FROM ingestion_fixture_entities WHERE canonical_entity_id = :id AND domain = :domain'
        );
        $stmt->execute([':id' => $canonicalEntityId, ':domain' => $domain]);
        $value = $stmt->fetchColumn();
        if (!is_string($value)) {
            return null;
        }
        $decoded = json_decode($value, true, 64, JSON_THROW_ON_ERROR);
        return is_array($decoded) ? $decoded : null;
    }

    public function persist(CanonicalIngestionItem $item, IngestionPlan $plan, string $canonicalEntityId): array
    {
        $payload = $plan->mergedPayload !== [] ? $plan->mergedPayload : $item->payload;
        $stmt = $this->db->prepare(
            'INSERT INTO ingestion_fixture_entities
             (canonical_entity_id, domain, source_entity_id, payload_json, content_hash)
             VALUES (:id, :domain, :source_id, :payload, :content_hash)
             ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json),
                content_hash = VALUES(content_hash), updated_at = UTC_TIMESTAMP(6)'
        );
        $stmt->execute([
            ':id' => $canonicalEntityId,
            ':domain' => $item->domain,
            ':source_id' => $item->sourceEntityId,
            ':payload' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            ':content_hash' => hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)),
        ]);
        if ($this->failAfterWrite) {
            throw new RuntimeException('synthetic failure after canonical write');
        }
        return ['canonicalEntityId' => $canonicalEntityId, 'datasetChanged' => true];
    }
}

function mysqlIngestionItem(
    string $sourceId,
    string $version,
    array $payload,
    string $provider = 'fixture-a',
    string $domain = 'question',
): CanonicalIngestionItem {
    return new CanonicalIngestionItem(
        $domain,
        $provider,
        $domain,
        $sourceId,
        $version,
        $sourceId . '-event-' . $version,
        $payload,
        ['reference' => 'fixture://' . $sourceId, 'secret' => 'discard-me'],
    );
}

function mysqlIngestionOrchestrator(PDO $db, ?CanonicalEntityPersistencePort $canonical = null): IngestionOrchestrator
{
    return new IngestionOrchestrator(
        new PdoIngestionMetadataRepository($db, $canonical ?? new SyntheticCanonicalEntityPersistence($db)),
        writerRegistry: new IngestionWriterRegistry(['fixture-a', 'fixture-b', 'performance-fixture']),
    );
}

$db = mysqlIngestionConnection();
$db->exec("SET time_zone = '+00:00'");
$db->exec('INSERT IGNORE INTO seo_dataset_revisions (id, revision) VALUES (1, 0)');
$db->exec("CREATE TABLE ingestion_fixture_entities (
    canonical_entity_id VARCHAR(190) NOT NULL PRIMARY KEY,
    domain VARCHAR(80) NOT NULL,
    source_entity_id VARCHAR(190) NOT NULL,
    payload_json JSON NOT NULL,
    content_hash CHAR(64) NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    KEY idx_ingestion_fixture_source (domain, source_entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
$db->exec("CREATE TRIGGER trg_ingestion_fixture_revision_ai AFTER INSERT ON ingestion_fixture_entities
    FOR EACH ROW UPDATE seo_dataset_revisions SET revision = revision + 1 WHERE id = 1");
$db->exec("CREATE TRIGGER trg_ingestion_fixture_revision_au AFTER UPDATE ON ingestion_fixture_entities
    FOR EACH ROW UPDATE seo_dataset_revisions SET revision = revision + 1 WHERE id = 1");

$repository = new PdoIngestionMetadataRepository($db, new SyntheticCanonicalEntityPersistence($db));
$orchestrator = new IngestionOrchestrator(
    $repository,
    writerRegistry: new IngestionWriterRegistry(['fixture-a', 'fixture-b', 'performance-fixture']),
);
$runner = new IngestionBatchRunner($repository);
$createItem = mysqlIngestionItem('question-create', '1', [
    'statement' => 'Synthetic question A',
    'description' => 'Editorial seed',
    'domainIdentity' => ['fixtureKey' => 'question-create'],
]);
$revisionBefore = (int) $db->query('SELECT revision FROM seo_dataset_revisions WHERE id = 1')->fetchColumn();
$createResult = $runner->run([$createItem], $orchestrator, false);
mysqlIngestionAssert($createResult['results'][0]['action'] === IngestionPlan::CREATE, 'CREATE outcome invalido.');
mysqlIngestionAssert((int) $db->query("SELECT COUNT(*) FROM ingestion_fixture_entities WHERE source_entity_id='question-create'")->fetchColumn() === 1, 'Canonical CREATE ausente.');
$revisionAfterCreate = (int) $db->query('SELECT revision FROM seo_dataset_revisions WHERE id = 1')->fetchColumn();
mysqlIngestionAssert($revisionAfterCreate > $revisionBefore, 'Mutation nao atualizou dataset revision.');

$replayResult = $runner->run([$createItem], $orchestrator, false);
mysqlIngestionAssert($replayResult['results'][0]['action'] === IngestionPlan::NO_CHANGE, 'Replay deve ser NO_CHANGE.');
mysqlIngestionAssert((int) $db->query("SELECT COUNT(*) FROM ingestion_fixture_entities WHERE source_entity_id='question-create'")->fetchColumn() === 1, 'Replay duplicou canonical.');
$revisionAfterReplay = (int) $db->query('SELECT revision FROM seo_dataset_revisions WHERE id = 1')->fetchColumn();
mysqlIngestionAssert($revisionAfterReplay === $revisionAfterCreate, 'NO_CHANGE causou revision churn.');

$manualPayload = ['statement' => 'Synthetic question A', 'description' => 'Manual editorial override', 'domainIdentity' => ['fixtureKey' => 'question-create']];
$manual = $db->prepare('UPDATE ingestion_fixture_entities SET payload_json = :payload WHERE source_entity_id = :source_id');
$manual->execute([
    ':payload' => json_encode($manualPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
    ':source_id' => 'question-create',
]);
$updateItem = mysqlIngestionItem('question-create', '2', [
    'statement' => 'Synthetic question A updated',
    'description' => 'Source attempted overwrite',
    'domainIdentity' => ['fixtureKey' => 'question-create'],
]);
$updateResult = $runner->run([$updateItem], $orchestrator, false);
mysqlIngestionAssert($updateResult['results'][0]['action'] === IngestionPlan::UPDATE, 'Source version update deve ser UPDATE.');
$updatedPayload = (new SyntheticCanonicalEntityPersistence($db))->loadPayload('question', (string) $updateResult['results'][0]['canonicalEntityId']);
mysqlIngestionAssert(($updatedPayload['statement'] ?? null) === 'Synthetic question A updated', 'SOURCE_OWNED nao atualizou.');
mysqlIngestionAssert(($updatedPayload['description'] ?? null) === 'Manual editorial override', 'EDITORIAL_OWNED foi sobrescrito.');

$sameContentItem = mysqlIngestionItem('question-create', '3', $updatedPayload ?? []);
$revisionBeforeSameContent = (int) $db->query('SELECT revision FROM seo_dataset_revisions WHERE id = 1')->fetchColumn();
$sameContentResult = $runner->run([$sameContentItem], $orchestrator, false);
mysqlIngestionAssert($sameContentResult['results'][0]['action'] === IngestionPlan::NO_CHANGE, 'Versao semanticamente igual deve ser NO_CHANGE.');
mysqlIngestionAssert((int) $db->query('SELECT revision FROM seo_dataset_revisions WHERE id = 1')->fetchColumn() === $revisionBeforeSameContent, 'Same-content causou revision churn.');

$exactA = mysqlIngestionItem('exam-source-a', '1', ['title' => 'Synthetic exam', 'domainIdentity' => ['official' => 'SYN-1']], 'fixture-a', 'exam');
$exactB = mysqlIngestionItem('exam-source-b', '1', ['title' => 'Synthetic exam', 'domainIdentity' => ['official' => 'SYN-1']], 'fixture-b', 'exam');
$runner->run([$exactA], $orchestrator, false);
$duplicateResult = $runner->run([$exactB], $orchestrator, false);
mysqlIngestionAssert($duplicateResult['results'][0]['action'] === IngestionPlan::DUPLICATE, 'Cross-source exact duplicate policy falhou.');
$duplicateCanonicalId = (string) $duplicateResult['results'][0]['canonicalEntityId'];
$provenance = $db->prepare('SELECT COUNT(*) FROM ingestion_provenance WHERE canonical_entity_id = :id');
$provenance->execute([':id' => $duplicateCanonicalId]);
mysqlIngestionAssert((int) $provenance->fetchColumn() === 2, 'Multi-source provenance foi sobrescrita.');

$ambiguous = mysqlIngestionItem('exam-source-c', '1', ['title' => 'Different synthetic exam', 'domainIdentity' => ['official' => 'SYN-1']], 'fixture-b', 'exam');
$ambiguousResult = $orchestrator->processOne($ambiguous, 'ambiguous-run-000000000000000000001', true);
mysqlIngestionAssert($ambiguousResult['action'] === IngestionPlan::REVIEW_REQUIRED, 'Ambiguous duplicate deve exigir revisao.');

$rollbackItem = mysqlIngestionItem('rollback-item', '1', ['statement' => 'Rollback synthetic']);
$failingRepository = new PdoIngestionMetadataRepository($db, new SyntheticCanonicalEntityPersistence($db, true));
$failingOrchestrator = new IngestionOrchestrator(
    $failingRepository,
    writerRegistry: new IngestionWriterRegistry(['fixture-a']),
);
try {
    $failingOrchestrator->processOne($rollbackItem, 'rollback-run-0000000000000000000001', false);
    throw new RuntimeException('Synthetic transactional failure was not raised.');
} catch (RuntimeException $exception) {
    mysqlIngestionAssert($exception->getMessage() === 'synthetic failure after canonical write', 'Falha transacional inesperada.');
}
mysqlIngestionAssert((int) $db->query("SELECT COUNT(*) FROM ingestion_fixture_entities WHERE source_entity_id='rollback-item'")->fetchColumn() === 0, 'Partial canonical persistence detectada.');
mysqlIngestionAssert((int) $db->query("SELECT COUNT(*) FROM ingestion_items WHERE source_entity_id='rollback-item'")->fetchColumn() === 0, 'Partial metadata persistence detectada.');

$leaseOne = $repository->acquireLease('stale-source', 'lease-one', 60);
$leaseTwo = $repository->acquireLease('stale-source', 'lease-two', 60);
mysqlIngestionAssert($leaseOne && !$leaseTwo, 'Lease concorrente nao foi bloqueado.');
$db->exec("UPDATE ingestion_leases SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE source_key='stale-source'");
mysqlIngestionAssert($repository->acquireLease('stale-source', 'lease-two', 60), 'Stale lease nao foi recuperado.');
$repository->releaseLease('stale-source', 'lease-two');

$concurrentItem = mysqlIngestionItem('concurrent-item', '1', ['statement' => 'Concurrent synthetic item']);
$barrier = sys_get_temp_dir() . '/cm-ingestion-barrier-' . bin2hex(random_bytes(6));
$children = [];
for ($worker = 0; $worker < 2; $worker++) {
    $pid = pcntl_fork();
    if ($pid === -1) {
        throw new RuntimeException('pcntl_fork indisponivel.');
    }
    if ($pid === 0) {
        while (!is_file($barrier)) {
            usleep(1000);
        }
        $childDb = mysqlIngestionConnection();
        $childRepository = new PdoIngestionMetadataRepository($childDb, new SyntheticCanonicalEntityPersistence($childDb));
        $childOrchestrator = new IngestionOrchestrator(
            $childRepository,
            writerRegistry: new IngestionWriterRegistry(['fixture-a']),
        );
        try {
            $childOrchestrator->processOne($concurrentItem, 'concurrency-run-' . $worker, false);
            exit(0);
        } catch (Throwable $exception) {
            fwrite(STDERR, 'CONCURRENT_WORKER_ERROR=' . $exception->getMessage() . PHP_EOL);
            exit(1);
        }
    }
    $children[] = $pid;
}
file_put_contents($barrier, 'go');
foreach ($children as $child) {
    pcntl_waitpid($child, $status);
    mysqlIngestionAssert(pcntl_wexitstatus($status) === 0, 'Worker concorrente falhou.');
}
@unlink($barrier);
$db = mysqlIngestionConnection();
$repository = new PdoIngestionMetadataRepository($db, new SyntheticCanonicalEntityPersistence($db));
$orchestrator = new IngestionOrchestrator(
    $repository,
    writerRegistry: new IngestionWriterRegistry(['fixture-a', 'fixture-b', 'performance-fixture']),
);
$runner = new IngestionBatchRunner($repository);
mysqlIngestionAssert((int) $db->query("SELECT COUNT(*) FROM ingestion_fixture_entities WHERE source_entity_id='concurrent-item'")->fetchColumn() === 1, 'Concorrencia criou canonical duplicado.');
mysqlIngestionAssert((int) $db->query("SELECT COUNT(*) FROM ingestion_items WHERE source_entity_id='concurrent-item'")->fetchColumn() === 1, 'Concorrencia criou item idempotente duplicado.');

$performance = [];
foreach ([100, 1000] as $size) {
    $items = [];
    for ($index = 0; $index < $size; $index++) {
        $items[] = mysqlIngestionItem('perf-' . $size . '-' . $index, '1', ['title' => 'Synthetic news ' . $index], 'performance-fixture', 'news');
    }
    $questionsBefore = (int) $db->query("SHOW SESSION STATUS LIKE 'Questions'")->fetch(PDO::FETCH_ASSOC)['Value'];
    $started = hrtime(true);
    $runner->run($items, $orchestrator, false);
    $durationMs = (hrtime(true) - $started) / 1_000_000;
    $questionsAfter = (int) $db->query("SHOW SESSION STATUS LIKE 'Questions'")->fetch(PDO::FETCH_ASSOC)['Value'];
    $performance[(string) $size] = [
        'durationMs' => round($durationMs, 2),
        'throughputPerSecond' => round($size / max(0.001, $durationMs / 1000), 2),
        'sessionQuestions' => max(0, $questionsAfter - $questionsBefore - 1),
        'peakMemoryBytes' => memory_get_peak_usage(true),
    ];
}

$inMemoryPerformance = [];
foreach ([100, 1000, 10000] as $size) {
    $memoryStore = new InMemoryIngestionStore();
    $memoryOrchestrator = new IngestionOrchestrator(
        $memoryStore,
        writerRegistry: new IngestionWriterRegistry(['performance-fixture']),
    );
    $items = [];
    for ($index = 0; $index < $size; $index++) {
        $items[] = mysqlIngestionItem('memory-perf-' . $size . '-' . $index, '1', ['title' => 'Synthetic memory news ' . $index], 'performance-fixture', 'news');
    }
    $started = hrtime(true);
    $memoryOrchestrator->processBatch($items, false, 'memory-performance-' . $size);
    $durationMs = (hrtime(true) - $started) / 1_000_000;
    $inMemoryPerformance[(string) $size] = [
        'durationMs' => round($durationMs, 2),
        'throughputPerSecond' => round($size / max(0.001, $durationMs / 1000), 2),
        'canonicalRows' => $memoryStore->canonicalCount(),
        'peakMemoryBytes' => memory_get_peak_usage(true),
    ];
}

$allCanonical = (int) $db->query('SELECT COUNT(*) FROM ingestion_fixture_entities')->fetchColumn();
$withProvenance = (int) $db->query(
    'SELECT COUNT(DISTINCT canonical_entity_id) FROM ingestion_provenance'
)->fetchColumn();
mysqlIngestionAssert($withProvenance === $allCanonical, 'Provenance coverage nao alcancou todos os canonicals sinteticos.');
mysqlIngestionAssert((int) $db->query("SELECT COUNT(*) FROM ingestion_provenance WHERE source_reference LIKE '%secret%' OR source_reference LIKE '%token%'")->fetchColumn() === 0, 'Secret detectado em provenance.');

$metrics = $orchestrator->processBatch([
    mysqlIngestionItem('metric-create', '1', ['statement' => 'Metric create']),
    new CanonicalIngestionItem('question', 'unknown-writer', 'question', 'metric-reject', '1', 'metric-reject-1', ['statement' => 'Metric reject']),
], true, 'metrics-run-000000000000000000000001');
mysqlIngestionAssert($metrics['metrics']['received'] === 2 && $metrics['metrics']['created'] === 1 && $metrics['metrics']['rejected'] === 1, 'Metricas de ingestao incompletas.');

$result = [
    'status' => 'PASS',
    'mysqlVersion' => (string) $db->query('SELECT VERSION()')->fetchColumn(),
    'canonicalRows' => $allCanonical,
    'provenanceCoverage' => '100%',
    'concurrentCanonicalRows' => 1,
    'revisionAfterCreate' => $revisionAfterCreate,
    'revisionAfterReplay' => $revisionAfterReplay,
    'performance' => $performance,
    'inMemoryPerformance' => $inMemoryPerformance,
];

$db->exec('DROP TRIGGER trg_ingestion_fixture_revision_au');
$db->exec('DROP TRIGGER trg_ingestion_fixture_revision_ai');
$db->exec('DROP TABLE ingestion_fixture_entities');
fwrite(STDOUT, json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
