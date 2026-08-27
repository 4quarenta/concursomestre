<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Write sentinel is CLI-only.\n");
}

function writeSentinelEnv(string $key, bool $required = true): string
{
    $value = $_ENV[$key] ?? getenv($key);
    $value = $value === false || $value === null ? '' : trim((string) $value);
    if ($required && $value === '') throw new RuntimeException('Required read-only environment variable missing: ' . $key);
    return $value;
}

function writeSentinelQuote(string $identifier): string
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $identifier)) throw new InvalidArgumentException('Invalid SQL identifier.');
    return '`' . $identifier . '`';
}

/** @return list<string> */
function writeSentinelTables(): array
{
    $policyPath = __DIR__ . '/DatasetResetPolicyV2.php';
    if (is_file($policyPath)) {
        require_once $policyPath;
        $tables = DatasetResetPolicyV2::knownTables();
    } else {
        $tables = array_filter(array_map('trim', explode(',', writeSentinelEnv('DATASET_SENTINEL_TABLES'))));
    }
    $tables = array_values(array_unique(array_map('strval', $tables)));
    sort($tables);
    if ($tables === []) throw new RuntimeException('Sentinel table allowlist is empty.');
    return $tables;
}

/** @return array<string, mixed> */
function writeSentinelCapture(PDO $db, array $tables): array
{
    require_once __DIR__ . '/DatasetResetReadinessReporter.php';
    $database = (string) $db->query('SELECT DATABASE()')->fetchColumn();
    $metadata = $db->prepare(
        "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY, ORDINAL_POSITION
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = :database
          ORDER BY TABLE_NAME, ORDINAL_POSITION"
    );
    $metadata->execute([':database' => $database]);
    $columns = [];
    foreach ($metadata->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $columns[(string) $row['TABLE_NAME']][] = $row;
    }

    $fingerprints = [];
    foreach ($tables as $table) {
        if (!isset($columns[$table])) throw new RuntimeException('Sentinel table missing from target schema: ' . $table);
        $tableColumns = $columns[$table];
        $primary = array_values(array_filter($tableColumns, static fn (array $column): bool => ($column['COLUMN_KEY'] ?? '') === 'PRI'));
        $timeColumns = array_values(array_filter($tableColumns, static fn (array $column): bool => in_array(
            strtolower((string) ($column['COLUMN_NAME'] ?? '')),
            ['created_at', 'updated_at', 'processed_at', 'published_at', 'deleted_at', 'archived_at', 'last_used_at', 'last_login_at', 'available_at', 'locked_at'],
            true
        )));
        $select = ['COUNT(*) AS row_count'];
        foreach ($primary as $index => $column) {
            $name = (string) $column['COLUMN_NAME'];
            $select[] = 'MIN(CAST(' . writeSentinelQuote($name) . ' AS CHAR)) AS pk_' . $index . '_min';
            $select[] = 'MAX(CAST(' . writeSentinelQuote($name) . ' AS CHAR)) AS pk_' . $index . '_max';
        }
        foreach ($timeColumns as $index => $column) {
            $select[] = 'MAX(' . writeSentinelQuote((string) $column['COLUMN_NAME']) . ') AS time_' . $index . '_max';
        }
        $row = $db->query('SELECT ' . implode(', ', $select) . ' FROM ' . writeSentinelQuote($table))->fetch(PDO::FETCH_ASSOC) ?: [];
        $checksumRow = $db->query('CHECKSUM TABLE ' . writeSentinelQuote($table))->fetch(PDO::FETCH_ASSOC) ?: [];
        $metrics = [
            'rowCount' => (int) ($row['row_count'] ?? 0),
            'primaryKeyColumns' => array_values(array_map(static fn (array $column): string => (string) $column['COLUMN_NAME'], $primary)),
            'primaryKeyBounds' => array_filter($row, static fn (string $key): bool => str_starts_with($key, 'pk_'), ARRAY_FILTER_USE_KEY),
            'timestampMaxima' => array_combine(
                array_map(static fn (array $column): string => (string) $column['COLUMN_NAME'], $timeColumns),
                array_map(static fn (int $index): mixed => $row['time_' . $index . '_max'] ?? null, array_keys($timeColumns))
            ) ?: [],
            'tableChecksum' => isset($checksumRow['Checksum']) ? (string) $checksumRow['Checksum'] : null,
        ];
        $metrics['fingerprint'] = hash('sha256', json_encode($metrics, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $fingerprints[$table] = $metrics;
    }
    ksort($fingerprints);

    $targetSnapshot = (new DatasetResetReadinessReporter($db))->snapshot();

    $queueDepths = [];
    foreach ([
        'platform_event_outbox' => 'status',
        'private_ingestion_jobs' => 'status',
        'private_ingestion_requests' => 'status',
        'provider_webhook_events' => 'status',
    ] as $table => $statusColumn) {
        if (!isset($columns[$table]) || !in_array($statusColumn, array_column($columns[$table], 'COLUMN_NAME'), true)) continue;
        $stmt = $db->query('SELECT ' . writeSentinelQuote($statusColumn) . ' AS status, COUNT(*) AS total FROM ' . writeSentinelQuote($table) . ' GROUP BY ' . writeSentinelQuote($statusColumn));
        $queueDepths[$table] = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $queueDepths[$table][(string) ($row['status'] ?? '<null>')] = (int) $row['total'];
        }
        ksort($queueDepths[$table]);
    }

    return [
        'schemaVersion' => 'WRITE_SENTINEL_V1',
        'capturedAt' => gmdate(DATE_ATOM),
        'database' => $database,
        'engineVersion' => (string) $db->query('SELECT VERSION()')->fetchColumn(),
        'readOnlyConnection' => true,
        'tableCount' => count($fingerprints),
        'tables' => $fingerprints,
        'queueDepths' => $queueDepths,
        'globalFingerprint' => hash('sha256', json_encode($fingerprints, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)),
        'targetSnapshotFingerprint' => (string) ($targetSnapshot['snapshotFingerprint'] ?? ''),
    ];
}

try {
    $host = writeSentinelEnv('DB_READ_HOST');
    $port = writeSentinelEnv('DB_READ_PORT', false);
    $database = writeSentinelEnv('DB_READ_NAME');
    $user = writeSentinelEnv('DB_READ_USER');
    $password = writeSentinelEnv('DB_READ_PASSWORD');
    $dsn = 'mysql:host=' . $host . ($port !== '' ? ';port=' . $port : '') . ';dbname=' . $database . ';charset=utf8mb4';
    $db = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => max(1, (int) (writeSentinelEnv('DB_READ_TIMEOUT_SECONDS', false) ?: '15')),
        PDO::ATTR_PERSISTENT => false,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $db->exec("SET time_zone = '-03:00'");
    $grants = $db->query('SHOW GRANTS FOR CURRENT_USER')->fetchAll(PDO::FETCH_COLUMN) ?: [];
    $forbidden = preg_grep('/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRIGGER|EVENT|FILE|GRANT OPTION|ALL PRIVILEGES)\b/i', array_map('strval', $grants));
    if ($forbidden !== []) throw new RuntimeException('Sentinel refuses a credential with write-capable grants.');
    echo json_encode(writeSentinelCapture($db, writeSentinelTables()), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, json_encode(['status' => 'failed', 'message' => $exception->getMessage()], JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}
