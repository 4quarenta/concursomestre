<?php

declare(strict_types=1);

/**
 * Rehearsal concorrente descartavel. O processo pai cria o banco local e
 * dispara dois processos PHP sincronizados por barreira para o mesmo caso.
 */
function marketingConcurrencyAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function marketingConcurrencyPdo(string $host, int $port, string $user, string $password, ?string $database = null): PDO
{
    $dsn = "mysql:host={$host};port={$port};charset=utf8mb4" . ($database ? ";dbname={$database}" : '');
    $pdo = new PDO($dsn, $user, $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

function marketingConcurrencyRunWorker(string $configPath): never
{
    $config = json_decode((string) file_get_contents($configPath), true, 512, JSON_THROW_ON_ERROR);
    require_once dirname(__DIR__) . '/modules/marketing/repositories/MarketingCampaignRepository.php';
    require_once dirname(__DIR__) . '/modules/marketing/services/MarketingCampaignService.php';
    $ready = $config['ready'] . '-' . $config['worker'];
    $result = $config['result'] . '-' . $config['worker'];
    file_put_contents($ready, 'ready', LOCK_EX);
    while (!is_file($config['start'])) usleep(1000);

    try {
        if ($config['action'] === 'conversion') {
            $db = marketingConcurrencyPdo($config['host'], $config['port'], $config['user'], $config['password'], $config['database']);
            $stmt = $db->prepare("INSERT INTO analytics_lifecycle_events (event_name, user_id, session_key, metadata_json) VALUES ('signup_completed', NULL, :session_key, :metadata)");
            $stmt->execute([':session_key' => $config['session'], ':metadata' => json_encode(['campaignId' => $config['campaign_id'], 'm20f02' => true], JSON_THROW_ON_ERROR)]);
            $payload = ['ok' => true, 'recorded' => true];
        } elseif ($config['action'] === 'list') {
            $db = marketingConcurrencyPdo($config['host'], $config['port'], $config['user'], $config['password'], $config['database']);
            $service = new MarketingCampaignService(new MarketingCampaignRepository($db));
            $items = $service->listPublicCampaigns(null, $config['session']);
            $payload = ['ok' => true, 'ids' => array_values(array_map(static fn(array $item): string => (string) $item['id'], $items))];
        } else {
            $db = marketingConcurrencyPdo($config['host'], $config['port'], $config['user'], $config['password'], $config['database']);
            $service = new MarketingCampaignService(new MarketingCampaignRepository($db));
            $interaction = $service->recordInteraction([
                'campaignId' => $config['campaign_id'], 'interactionType' => $config['action'],
                'sessionKey' => $config['session'], 'idempotencyKey' => $config['idempotency'],
            ]);
            $payload = ['ok' => true, 'recorded' => $interaction['recorded']];
        }
    } catch (Throwable $error) {
        $payload = ['ok' => false, 'error' => $error->getMessage()];
    }
    file_put_contents($result, json_encode($payload, JSON_THROW_ON_ERROR), LOCK_EX);
    exit($payload['ok'] ? 0 : 1);
}

if (getenv('M20F02_CONCURRENCY_WORKER') === '1') {
    marketingConcurrencyRunWorker((string) getenv('M20F02_CONCURRENCY_CONFIG'));
}

$host = (string) (getenv('MARKETING_TEST_DB_HOST') ?: '127.0.0.1');
marketingConcurrencyAssert(in_array($host, ['127.0.0.1', 'localhost', '::1'], true), 'Este rehearsal aceita somente banco local descartavel.');
$port = (int) (getenv('MARKETING_TEST_DB_PORT') ?: 3306);
$user = (string) (getenv('MARKETING_TEST_DB_USER') ?: 'root');
$password = (string) (getenv('MARKETING_TEST_DB_PASSWORD') ?: '');
$databaseName = 'm20f02_concurrency_test_' . bin2hex(random_bytes(5));
$server = marketingConcurrencyPdo($host, $port, $user, $password);
$server->exec('CREATE DATABASE `' . $databaseName . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$db = marketingConcurrencyPdo($host, $port, $user, $password, $databaseName);

require_once dirname(__DIR__) . '/modules/marketing/repositories/MarketingCampaignRepository.php';
require_once dirname(__DIR__) . '/modules/marketing/services/MarketingCampaignService.php';

$temporaryFiles = [];
try {
    $baseMigration = require dirname(__DIR__) . '/database/migrations/20260905_120000_marketing_campaign_operations.php';
    $governanceMigration = require dirname(__DIR__) . '/database/migrations/20260906_120000_marketing_governance_enforcement.php';
    $baseMigration($db);
    $governanceMigration($db);
    $db->exec("CREATE TABLE users (id VARCHAR(64) PRIMARY KEY, created_at DATETIME(6) NOT NULL, plan VARCHAR(80) NULL, role VARCHAR(40) NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->exec("CREATE TABLE analytics_lifecycle_events (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, event_name VARCHAR(80) NOT NULL, user_id VARCHAR(80) NULL, session_key VARCHAR(255) NULL, metadata_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $service = new MarketingCampaignService(new MarketingCampaignRepository($db));
    $operator = 'm20f02-concurrency-admin';
    $save = static function (string $id, array $overrides = []) use ($service, $operator): array {
        return $service->saveCampaign(array_merge([
            'id' => $id, 'name' => $id, 'objective' => 'CRIAR_CONTA', 'status' => 'active', 'priority' => 10,
            'channels' => ['in_app'], 'placements' => ['topbar'], 'content' => ['headline' => 'Synthetic concurrency campaign'],
        ], $overrides), $operator);
    };

    $runPair = static function (string $campaignId, string $session, string $actionA, string $actionB, ?string $fixedKey = null) use ($host, $port, $user, $password, $databaseName, &$temporaryFiles): array {
        $root = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'm20f02-concurrency-' . bin2hex(random_bytes(6));
        $start = $root . '-start';
        $configPath = $root . '-config.json';
        $temporaryFiles[] = $start;
        $temporaryFiles[] = $configPath;
        $configs = [];
        foreach ([$actionA, $actionB] as $index => $action) {
            $configs[$index] = [
                'host' => $host, 'port' => $port, 'user' => $user, 'password' => $password, 'database' => $databaseName,
                'campaign_id' => $campaignId, 'session' => $session, 'action' => $action,
                'idempotency' => $fixedKey ?: ($campaignId . '-key-' . $index . '-' . bin2hex(random_bytes(3))),
                'start' => $start, 'ready' => $root . '-ready', 'result' => $root . '-result', 'worker' => (string) $index,
            ];
        }
        $children = [];
        foreach ($configs as $config) {
            $workerConfig = $configPath . '-' . $config['worker'];
            file_put_contents($workerConfig, json_encode($config, JSON_THROW_ON_ERROR), LOCK_EX);
            $temporaryFiles[] = $workerConfig;
            $baseEnvironment = getenv();
            $env = array_merge(is_array($baseEnvironment) ? $baseEnvironment : [], ['M20F02_CONCURRENCY_WORKER' => '1', 'M20F02_CONCURRENCY_CONFIG' => $workerConfig]);
            $pipes = [];
            // A forma string evita que o proc_open do Windows interprete o caminho
            // do script como parte do executavel e o worker falhe antes do PDO.
            $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__);
            $process = proc_open($command, [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes, null, $env);
            marketingConcurrencyAssert(is_resource($process), 'Nao foi possivel iniciar worker concorrente.');
            $children[] = ['process' => $process, 'pipes' => $pipes, 'worker' => $config['worker']];
        }
        $deadline = microtime(true) + 10;
        while ((!is_file($root . '-ready-0') || !is_file($root . '-ready-1')) && microtime(true) < $deadline) usleep(1000);
        marketingConcurrencyAssert(is_file($root . '-ready-0') && is_file($root . '-ready-1'), 'Workers nao alcancaram a barreira.');
        file_put_contents($start, 'go', LOCK_EX);
        foreach ($children as $child) {
            foreach ($child['pipes'] as $pipe) stream_set_blocking($pipe, false);
            proc_close($child['process']);
        }
        $results = [];
        foreach ([0, 1] as $index) {
            $path = $root . '-result-' . $index;
            marketingConcurrencyAssert(is_file($path), 'Worker nao produziu resultado.');
            $results[] = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
            $temporaryFiles[] = $path;
        }
        return $results;
    };

    $campaignA = 'm20f02-c-max-' . bin2hex(random_bytes(4));
    $save($campaignA, ['max_impressions' => 1]);
    $resultsA = $runPair($campaignA, 'concurrency-max', 'impression', 'impression');
    $countA = (int) $db->query("SELECT COUNT(1) FROM marketing_campaign_interactions WHERE campaign_id = '{$campaignA}' AND interaction_type = 'impression'")->fetchColumn();
    marketingConcurrencyAssert($countA === 1, 'Concorrencia de max_impressions ultrapassou o limite. count=' . $countA . ' results=' . json_encode($resultsA));

    $campaignB = 'm20f02-c-cap-' . bin2hex(random_bytes(4));
    $save($campaignB, ['frequency_cap' => 1, 'frequency_cap_window' => 'session']);
    $runPair($campaignB, 'concurrency-cap', 'impression', 'impression');
    $countB = (int) $db->query("SELECT COUNT(1) FROM marketing_campaign_interactions WHERE campaign_id = '{$campaignB}' AND interaction_type = 'impression'")->fetchColumn();
    marketingConcurrencyAssert($countB === 1, 'Concorrencia de frequency_cap ultrapassou o limite.');

    $campaignC = 'm20f02-c-idempotency-' . bin2hex(random_bytes(4));
    $save($campaignC);
    $resultsC = $runPair($campaignC, 'concurrency-idempotency', 'impression', 'impression', 'same-concurrency-key');
    $countC = (int) $db->query("SELECT COUNT(1) FROM marketing_campaign_interactions WHERE campaign_id = '{$campaignC}'")->fetchColumn();
    marketingConcurrencyAssert($countC === 1 && count(array_filter($resultsC, static fn(array $result): bool => ($result['recorded'] ?? false) === true)) === 1, 'Replay concorrente nao foi idempotente. count=' . $countC . ' results=' . json_encode($resultsC));

    $campaignD = 'm20f02-c-dismissal-' . bin2hex(random_bytes(4));
    $save($campaignD);
    $runPair($campaignD, 'concurrency-dismissal', 'impression', 'dismissal');
    $typesD = $db->query("SELECT interaction_type FROM marketing_campaign_interactions WHERE campaign_id = '{$campaignD}'")->fetchAll(PDO::FETCH_COLUMN);
    marketingConcurrencyAssert(count(array_filter($typesD, static fn(string $type): bool => $type === 'impression')) === 1, 'Corrida impression/dismissal perdeu o estado de exibicao.');
    marketingConcurrencyAssert(count(array_filter($typesD, static fn(string $type): bool => $type === 'dismissal')) <= 1, 'Corrida impression/dismissal criou dismissal duplicado.');

    $campaignEHigh = 'm20f02-c-group-hi-' . bin2hex(random_bytes(4));
    $campaignELow = 'm20f02-c-group-lo-' . bin2hex(random_bytes(4));
    $save($campaignEHigh, ['priority' => 20, 'mutual_exclusion_group' => 'm20f02-concurrency-group']);
    $save($campaignELow, ['priority' => 10, 'mutual_exclusion_group' => 'm20f02-concurrency-group']);
    $resultsE = $runPair($campaignEHigh, 'concurrency-group', 'list', 'list');
    foreach ($resultsE as $result) marketingConcurrencyAssert(($result['ids'][0] ?? null) === $campaignEHigh, 'Selecao concorrente nao preservou vencedor deterministico.');

    $campaignF = 'm20f02-c-conversion-' . bin2hex(random_bytes(4));
    $save($campaignF);
    $runPair($campaignF, 'concurrency-conversion', 'impression', 'conversion');
    marketingConcurrencyAssert(count(array_filter($service->listPublicCampaigns(null, 'concurrency-conversion'), static fn(array $item): bool => $item['id'] === $campaignF)) === 0, 'Conversao concorrente nao suprimiu campanha depois do commit.');

    echo "Marketing campaign governance concurrency MySQL integration: PASS\n";
} finally {
    foreach ($temporaryFiles as $path) if (is_file($path)) @unlink($path);
    $server->exec('DROP DATABASE IF EXISTS `' . $databaseName . '`');
}
