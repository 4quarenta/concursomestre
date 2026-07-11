<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';

function jsonPreflightIdentifier(string $identifier): string
{
    if (preg_match('/^[a-z0-9_]+$/i', $identifier) !== 1) {
        throw new InvalidArgumentException('Identificador de schema invalido.');
    }

    return chr(96) . $identifier . chr(96);
}

function jsonPreflightTableAndColumnExist(PDO $db, string $table, string $column): bool
{
    $stmt = $db->prepare(
        'SELECT COUNT(*)
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
           AND COLUMN_NAME = :column_name'
    );
    $stmt->execute([':table_name' => $table, ':column_name' => $column]);
    return (int) $stmt->fetchColumn() > 0;
}

$options = getopt('', ['apply', 'batch-size::', 'output::']);
$apply = isset($options['apply']);
if ($apply && filter_var(getenv('MIGRATIONS_ALLOW_APPLY') ?: 'false', FILTER_VALIDATE_BOOLEAN) !== true) {
    fwrite(STDERR, "Defina MIGRATIONS_ALLOW_APPLY=true para registrar o checkpoint do preflight.\n");
    exit(2);
}

$batchSize = max(25, min(1000, (int) ($options['batch-size'] ?? 250)));
$targets = [
    ['table' => 'questions', 'column' => 'data_json', 'primary_key' => 'id'],
    ['table' => 'provas', 'column' => 'metadata_json', 'primary_key' => 'id'],
    ['table' => 'user_study_schedules', 'column' => 'form_json', 'primary_key' => 'user_id'],
    ['table' => 'user_study_schedules', 'column' => 'plan_json', 'primary_key' => 'user_id'],
    ['table' => 'user_subscriptions', 'column' => 'next_renewal_snapshot_json', 'primary_key' => 'id'],
];

try {
    $db = (new Database())->getConnection();
    $rows = [];

    foreach ($targets as $target) {
        if (!jsonPreflightTableAndColumnExist($db, $target['table'], $target['column'])
            || !jsonPreflightTableAndColumnExist($db, $target['table'], $target['primary_key'])) {
            $rows[] = [...$target, 'status' => 'not_present'];
            continue;
        }

        $table = jsonPreflightIdentifier($target['table']);
        $column = jsonPreflightIdentifier($target['column']);
        $primaryKey = jsonPreflightIdentifier($target['primary_key']);
        $summary = $db->query(
            "SELECT COUNT(*) AS total_rows,
                    SUM(CASE WHEN {$column} IS NOT NULL AND TRIM({$column}) <> '' THEN 1 ELSE 0 END) AS non_empty_rows,
                    SUM(CASE WHEN {$column} IS NOT NULL AND TRIM({$column}) <> '' AND JSON_VALID({$column}) = 0 THEN 1 ELSE 0 END) AS invalid_rows
             FROM {$table}"
        )->fetch(PDO::FETCH_ASSOC) ?: [];
        $sampleRows = $db->query(
            "SELECT {$primaryKey} AS row_id
             FROM {$table}
             WHERE {$column} IS NOT NULL
               AND TRIM({$column}) <> ''
               AND JSON_VALID({$column}) = 0
             ORDER BY {$primaryKey}
             LIMIT {$batchSize}"
        )->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $rows[] = [
            ...$target,
            'status' => ((int) ($summary['invalid_rows'] ?? 0)) === 0 ? 'ready_for_json_constraint' : 'invalid_json_found',
            'total_rows' => (int) ($summary['total_rows'] ?? 0),
            'non_empty_rows' => (int) ($summary['non_empty_rows'] ?? 0),
            'invalid_rows' => (int) ($summary['invalid_rows'] ?? 0),
            'invalid_sample_ids' => array_map('strval', $sampleRows),
        ];
    }

    $result = [
        'generated_at' => gmdate(DATE_ATOM),
        'mode' => $apply ? 'checkpoint' : 'dry-run',
        'batch_size' => $batchSize,
        'targets' => $rows,
        'next_step' => 'Nao converte colunas. Use o resultado para decidir uma migration futura apos limpeza e backup.',
    ];

    if ($apply) {
        $exists = (int) $db->query(
            "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schema_backfill_runs'"
        )->fetchColumn();
        if ($exists === 0) {
            throw new RuntimeException('schema_backfill_runs ausente. Aplique as migrations primeiro.');
        }

        $payload = json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($payload)) {
            throw new RuntimeException('Nao foi possivel serializar checkpoint.');
        }
        $stmt = $db->prepare(
            "INSERT INTO schema_backfill_runs (
                task_key, status, dry_run, checkpoint_json, metrics_json, started_at, completed_at
             ) VALUES (
                'json_column_preflight', 'completed', 0, :checkpoint_json, :metrics_json, UTC_TIMESTAMP(), UTC_TIMESTAMP()
             )"
        );
        $stmt->execute([
            ':checkpoint_json' => $payload,
            ':metrics_json' => $payload,
        ]);
        $result['checkpoint_id'] = (int) $db->lastInsertId();
    }

    $json = json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        throw new RuntimeException('Nao foi possivel serializar resultado.');
    }
    if (isset($options['output']) && is_string($options['output']) && trim($options['output']) !== '') {
        file_put_contents((string) $options['output'], $json . PHP_EOL);
    }
    fwrite(STDOUT, $json . PHP_EOL);
} catch (Throwable $exception) {
    fwrite(STDERR, 'JSON preflight failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
