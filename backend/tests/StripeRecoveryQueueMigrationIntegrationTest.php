<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

function stripeQueueMigrationAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function stripeQueueSchemaHash(PDO $db): string
{
    $tables = ['provider_webhook_events', 'transactions'];
    $placeholders = implode(',', array_fill(0, count($tables), '?'));
    $snapshot = [];
    foreach ([
        "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
         FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME IN ({$placeholders}) ORDER BY TABLE_NAME, ORDINAL_POSITION",
        "SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
         FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME IN ({$placeholders}) ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX",
    ] as $sql) {
        $stmt = $db->prepare($sql);
        $stmt->execute($tables);
        $snapshot[] = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
    return hash('sha256', (string) json_encode($snapshot));
}

try {
    $db = (new Database())->getConnection();
    $migration = require __DIR__ . '/../database/migrations/20260717_020000_stripe_recovery_queue.php';
    stripeQueueMigrationAssert(is_callable($migration), 'Migration financeira nao retornou callable.');
    $migration($db);
    $firstHash = stripeQueueSchemaHash($db);
    $migration($db);
    $secondHash = stripeQueueSchemaHash($db);
    stripeQueueMigrationAssert($firstHash === $secondHash, 'Segundo up alterou novamente o schema.');

    foreach ([
        ['provider_webhook_events', 'payload_json'],
        ['provider_webhook_events', 'claim_token'],
        ['provider_webhook_events', 'next_retry_at'],
        ['provider_webhook_events', 'dead_lettered_at'],
        ['transactions', 'collection_retry_count'],
        ['transactions', 'collection_retry_next_at'],
    ] as [$table, $column]) {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        stripeQueueMigrationAssert((int) $stmt->fetchColumn() === 1, "Coluna ausente: {$table}.{$column}");
    }

    echo json_encode([
        'test' => 'StripeRecoveryQueueMigrationIntegrationTest',
        'status' => 'PASS',
        'schemaHash' => $secondHash,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, json_encode([
        'test' => 'StripeRecoveryQueueMigrationIntegrationTest',
        'status' => 'FAIL',
        'message' => $error->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
}
