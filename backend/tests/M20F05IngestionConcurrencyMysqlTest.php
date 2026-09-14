<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/ingestion/IngestionPipeline.php';

function m20f05MysqlAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function m20f05MysqlConnection(): PDO
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

final class M20F05SyntheticCanonicalPersistence implements CanonicalEntityPersistencePort
{
    public function loadPayload(string $domain, string $canonicalEntityId): ?array
    {
        return null;
    }

    public function persist(CanonicalIngestionItem $item, IngestionPlan $plan, string $canonicalEntityId): array
    {
        return ['canonicalEntityId' => $canonicalEntityId, 'datasetChanged' => true];
    }
}

function m20f05ConcurrentItem(string $runId): CanonicalIngestionItem
{
    return new CanonicalIngestionItem(
        'question',
        'm20f05-fixture',
        'question',
        $runId . '-candidate',
        '1',
        $runId . '-event',
        [
            'statement' => 'M20F05 concurrent synthetic candidate',
            'domainIdentity' => [
                'provider' => 'm20f05-fixture',
                'externalId' => $runId . '-candidate',
            ],
        ],
        ['reference' => 'fixture://m20f05/' . $runId],
    );
}

if (!function_exists('pcntl_fork')) {
    fwrite(STDOUT, json_encode(['status' => 'SKIPPED', 'reason' => 'pcntl_fork unavailable'], JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(0);
}

$runId = 'm20f05-' . substr(hash('sha256', (string) microtime(true)), 0, 12);
$runIds = [$runId . '-worker-a', $runId . '-worker-b'];
$db = null;
$item = m20f05ConcurrentItem($runId);
$barrier = sys_get_temp_dir() . '/cm-' . $runId . '.barrier';
$resultFiles = [
    sys_get_temp_dir() . '/cm-' . $runId . '-a.result',
    sys_get_temp_dir() . '/cm-' . $runId . '-b.result',
];
$children = [];
$errors = [];

try {
    foreach ($runIds as $index => $childRunId) {
        $pid = pcntl_fork();
        if ($pid === -1) {
            throw new RuntimeException('pcntl_fork indisponivel.');
        }
        if ($pid === 0) {
            while (!is_file($barrier)) {
                usleep(1000);
            }
            try {
                $childDb = m20f05MysqlConnection();
                $repository = new PdoIngestionMetadataRepository($childDb, new M20F05SyntheticCanonicalPersistence());
                $orchestrator = new IngestionOrchestrator(
                    $repository,
                    writerRegistry: new IngestionWriterRegistry(['m20f05-fixture']),
                );
                $result = $orchestrator->processOne($item, $childRunId, false);
                $action = (string) ($result['action'] ?? '');
                if (!in_array($action, [IngestionPlan::CREATE, IngestionPlan::NO_CHANGE, IngestionPlan::UPDATE], true)) {
                    throw new RuntimeException('Resultado concorrente inesperado: ' . $action);
                }
                file_put_contents($resultFiles[$index], json_encode(['action' => $action], JSON_THROW_ON_ERROR));
                exit(0);
            } catch (Throwable $exception) {
                fwrite(STDERR, 'M20F05_CONCURRENT_WORKER_ERROR=' . preg_replace('/SQLSTATE\[[^\]]+\]/', 'SQLSTATE[redacted]', $exception->getMessage()) . PHP_EOL);
                exit(1);
            }
        }
        $children[] = $pid;
    }

    file_put_contents($barrier, 'go');
    foreach ($children as $child) {
        pcntl_waitpid($child, $status);
        if (pcntl_wexitstatus($status) !== 0) {
            $errors[] = 'worker_failed';
        }
    }
    m20f05MysqlAssert($errors === [], 'Worker concorrente falhou.');
    $actions = array_map(
        static fn (string $path): string => (string) ((json_decode((string) file_get_contents($path), true)['action'] ?? '')),
        $resultFiles,
    );
    m20f05MysqlAssert(in_array(IngestionPlan::CREATE, $actions, true), 'Concorrencia nao teve worker vencedor.');
    m20f05MysqlAssert(in_array(IngestionPlan::NO_CHANGE, $actions, true), 'Concorrencia nao produziu resultado seguro para o perdedor.');

    $db = m20f05MysqlConnection();
    $db->exec("SET time_zone = '+00:00'");

    $countItems = $db->prepare(
        'SELECT COUNT(*) FROM ingestion_items
         WHERE source_provider = :provider AND source_entity_type = :type AND source_entity_id = :source_id'
    );
    $countItems->execute([
        ':provider' => 'm20f05-fixture',
        ':type' => 'question',
        ':source_id' => $item->sourceEntityId,
    ]);
    $itemCount = (int) $countItems->fetchColumn();

    $countProvenance = $db->prepare(
        'SELECT COUNT(*) FROM ingestion_provenance
         WHERE source_provider = :provider AND source_entity_type = :type AND source_entity_id = :source_id'
    );
    $countProvenance->execute([
        ':provider' => 'm20f05-fixture',
        ':type' => 'question',
        ':source_id' => $item->sourceEntityId,
    ]);
    $provenanceCount = (int) $countProvenance->fetchColumn();

    m20f05MysqlAssert($itemCount === 1, 'Concorrencia criou item de ingestao duplicado.');
    m20f05MysqlAssert($provenanceCount === 1, 'Concorrencia criou referencia de provider duplicada.');

    $result = [
        'status' => 'PASS',
        'runId' => $runId,
        'sourceEntityId' => $item->sourceEntityId,
        'canonicalRows' => $itemCount,
        'providerReferences' => $provenanceCount,
        'duplicateCanonicalEntity' => 0,
        'duplicateProviderReference' => 0,
        'rawDbErrorExposed' => 0,
    ];
    fwrite(STDOUT, json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
} finally {
    @unlink($barrier);
    foreach ($resultFiles as $resultFile) {
        @unlink($resultFile);
    }
    if (!$db instanceof PDO) {
        $db = m20f05MysqlConnection();
    }
    $keys = [$item->idempotencyKey()];
    $placeholders = implode(',', array_fill(0, count($keys), '?'));
    $deleteEvents = $db->prepare("DELETE FROM ingestion_item_events WHERE item_idempotency_key IN ($placeholders)");
    $deleteEvents->execute($keys);
    $deleteProvenance = $db->prepare("DELETE FROM ingestion_provenance WHERE item_idempotency_key IN ($placeholders)");
    $deleteProvenance->execute($keys);
    $deleteItems = $db->prepare("DELETE FROM ingestion_items WHERE idempotency_key IN ($placeholders)");
    $deleteItems->execute($keys);
    foreach ($runIds as $cleanupRunId) {
        $stmt = $db->prepare('DELETE FROM ingestion_runs WHERE run_id = :run_id');
        $stmt->execute([':run_id' => $cleanupRunId]);
    }
    $stmt = $db->prepare('DELETE FROM ingestion_leases WHERE source_key LIKE :prefix');
    $stmt->execute([':prefix' => 'm20f05-fixture%']);
}
