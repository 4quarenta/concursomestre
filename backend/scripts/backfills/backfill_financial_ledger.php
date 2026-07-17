<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/finance/services/FinancialLedger.php';

$apply = in_array(
    strtolower(trim((string) (getenv('BACKFILL_APPLY') ?: ''))),
    ['1', 'true', 'yes', 'on'],
    true
);
$afterId = max(0, (int) (getenv('BACKFILL_AFTER_ID') ?: 0));
$batchSize = max(1, min(1000, (int) (getenv('BACKFILL_BATCH_SIZE') ?: 250)));

$db = (new Database())->getConnection();
$stmt = $db->prepare(
    "SELECT id
     FROM transactions
     WHERE id > :after_id
       AND status IN ('approved', 'completed', 'refund_requested', 'refunded', 'partially_refunded')
     ORDER BY id ASC
     LIMIT " . ($batchSize + 1)
);
$stmt->bindValue(':after_id', $afterId, PDO::PARAM_INT);
$stmt->execute();
$ids = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN) ?: []);
$hasMore = count($ids) > $batchSize;
$ids = array_slice($ids, 0, $batchSize);
$processed = 0;
$failed = [];

if ($apply) {
    foreach ($ids as $transactionId) {
        try {
            FinancialLedger::syncTransactionById($db, $transactionId, 'financial_ledger_backfill');
            $processed++;
        } catch (Throwable $error) {
            $failed[] = ['transactionId' => $transactionId, 'errorType' => get_class($error)];
        }
    }
}

$nextAfterId = $ids !== [] ? (int) end($ids) : $afterId;
echo json_encode([
    'success' => $failed === [],
    'dryRun' => !$apply,
    'afterId' => $afterId,
    'batchSize' => $batchSize,
    'eligible' => count($ids),
    'processed' => $processed,
    'failed' => $failed,
    'hasMore' => $hasMore,
    'nextAfterId' => $nextAfterId,
    'nextCommand' => $hasMore
        ? 'BACKFILL_AFTER_ID=' . $nextAfterId . ' BACKFILL_BATCH_SIZE=' . $batchSize
            . ($apply ? ' BACKFILL_APPLY=true' : '')
            . ' php backend/scripts/backfills/backfill_financial_ledger.php'
        : null,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;

exit($failed === [] ? 0 : 1);
