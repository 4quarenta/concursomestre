<?php

declare(strict_types=1);

// Reviewed production task: archives old answer attempts in bounded batches.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este arquivador so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';

$apply = false;
$retentionDays = 730;
$batchSize = 1000;
$maxBatches = 25;
foreach (array_slice($argv, 1) as $argument) {
    if ($argument === '--apply') {
        $apply = true;
    } elseif ($argument === '--dry-run') {
        $apply = false;
    } elseif (str_starts_with($argument, '--days=')) {
        $retentionDays = max(90, (int) substr($argument, 7));
    } elseif (str_starts_with($argument, '--batch-size=')) {
        $batchSize = max(10, min(5000, (int) substr($argument, 13)));
    } elseif (str_starts_with($argument, '--max-batches=')) {
        $maxBatches = max(1, min(1000, (int) substr($argument, 14)));
    }
}

$db = (new Database())->getConnection();
$cutoff = date('Y-m-d H:i:s', strtotime('-' . $retentionDays . ' days'));
$columnsStmt = $db->query(
    "SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'user_answers'
     ORDER BY ORDINAL_POSITION"
);
$columns = array_values(array_filter(array_map(
    static fn ($value): string => preg_replace('/[^a-zA-Z0-9_]/', '', (string) $value) ?? '',
    $columnsStmt->fetchAll(PDO::FETCH_COLUMN) ?: []
)));
if ($columns === []) {
    throw new RuntimeException('Tabela user_answers sem colunas detectaveis.');
}
$columnList = implode(', ', array_map(static fn (string $column): string => "`{$column}`", $columns));

$candidateSql = "SELECT ua.id
    FROM user_answers ua FORCE INDEX (idx_user_answers_archive_candidates)
    WHERE ua.created_at < :cutoff
      AND ua.simulation_id IS NULL
    ORDER BY ua.created_at, ua.id
    LIMIT {$batchSize}";

if (!$apply) {
    $preview = $db->prepare($candidateSql);
    $preview->execute([':cutoff' => $cutoff]);
    $ids = array_map('intval', $preview->fetchAll(PDO::FETCH_COLUMN) ?: []);
    fwrite(STDOUT, json_encode([
        'mode' => 'dry-run',
        'retentionDays' => $retentionDays,
        'cutoff' => $cutoff,
        'candidateCountInFirstBatch' => count($ids),
        'sampleIds' => array_slice($ids, 0, 20),
        'policy' => 'all_old_non_simulation_attempts',
    ], JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(0);
}

$archived = 0;
$batches = 0;
while ($batches < $maxBatches) {
    $db->beginTransaction();
    try {
        $claim = $db->prepare($candidateSql . ' FOR UPDATE SKIP LOCKED');
        $claim->execute([':cutoff' => $cutoff]);
        $ids = array_map('intval', $claim->fetchAll(PDO::FETCH_COLUMN) ?: []);
        if ($ids === []) {
            $db->commit();
            break;
        }

        $batchId = sprintf(
            '%08x-%04x-4%03x-%04x-%012x',
            random_int(0, 0xffffffff),
            random_int(0, 0xffff),
            random_int(0, 0x0fff),
            random_int(0x8000, 0xbfff),
            random_int(0, 0xffffffffffff)
        );
        $idList = implode(',', $ids);
        $db->exec(
            "INSERT INTO user_answers_archive ({$columnList}, archived_at, archive_batch_id)
             SELECT {$columnList}, NOW(), " . $db->quote($batchId) . "
             FROM user_answers
             WHERE id IN ({$idList})
             ON DUPLICATE KEY UPDATE
                archived_at = user_answers_archive.archived_at"
        );

        $verified = (int) $db->query(
            "SELECT COUNT(*) FROM user_answers_archive WHERE id IN ({$idList})"
        )->fetchColumn();
        if ($verified !== count($ids)) {
            throw new RuntimeException('Verificacao do lote arquivado falhou; nenhuma resposta foi removida.');
        }

        $deleted = $db->exec("DELETE FROM user_answers WHERE id IN ({$idList})");
        if ($deleted !== count($ids)) {
            throw new RuntimeException('Quantidade removida diverge do lote arquivado.');
        }
        $db->commit();
        $archived += $deleted;
        $batches++;
        fwrite(STDOUT, json_encode([
            'batch' => $batches,
            'batchId' => $batchId,
            'archived' => $deleted,
            'totalArchived' => $archived,
        ], JSON_UNESCAPED_SLASHES) . PHP_EOL);
    } catch (Throwable $exception) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $exception;
    }
}

fwrite(STDOUT, json_encode([
    'status' => 'complete',
    'archived' => $archived,
    'batches' => $batches,
    'cutoff' => $cutoff,
], JSON_UNESCAPED_SLASHES) . PHP_EOL);
