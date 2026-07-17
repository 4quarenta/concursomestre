<?php

declare(strict_types=1);

return static function (PDO $db): void {
    $tableExists = static function (string $table) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name'
        );
        $stmt->execute([':table_name' => $table]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $columnExists = static function (string $table, string $column) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    };
    $indexExists = static function (string $table, string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name'
        );
        $stmt->execute([':table_name' => $table, ':index_name' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    };

    if (!$tableExists('provider_webhook_events')) {
        throw new RuntimeException('provider_webhook_events deve existir antes da fila Stripe.');
    }
    if (!$tableExists('transactions')) {
        throw new RuntimeException('transactions deve existir antes das retentativas Stripe.');
    }

    $webhookColumns = [
        'payload_json' => 'MEDIUMTEXT NULL',
        'signature_verified_at' => 'DATETIME NULL',
        'queued_at' => 'DATETIME NULL',
        'claim_token' => 'CHAR(32) NULL',
        'first_received_at' => 'DATETIME NULL',
        'last_received_at' => 'DATETIME NULL',
        'delivery_count' => 'INT UNSIGNED NOT NULL DEFAULT 1',
        'next_retry_at' => 'DATETIME NULL',
        'dead_lettered_at' => 'DATETIME NULL',
        'last_error_code' => 'VARCHAR(80) NULL',
    ];
    foreach ($webhookColumns as $column => $definition) {
        if (!$columnExists('provider_webhook_events', $column)) {
            $db->exec("ALTER TABLE provider_webhook_events ADD COLUMN `{$column}` {$definition}");
        }
    }

    $transactionColumns = [
        'collection_retry_count' => 'SMALLINT UNSIGNED NOT NULL DEFAULT 0',
        'collection_retry_next_at' => 'DATETIME NULL',
        'collection_retry_last_at' => 'DATETIME NULL',
        'collection_retry_last_error' => 'VARCHAR(500) NULL',
    ];
    foreach ($transactionColumns as $column => $definition) {
        if (!$columnExists('transactions', $column)) {
            $db->exec("ALTER TABLE transactions ADD COLUMN `{$column}` {$definition}");
        }
    }

    if (!$indexExists('provider_webhook_events', 'idx_provider_webhook_queue')) {
        $db->exec(
            'CREATE INDEX idx_provider_webhook_queue '
            . 'ON provider_webhook_events (provider, status, next_retry_at, queued_at, id)'
        );
    }
    if (!$indexExists('provider_webhook_events', 'idx_provider_webhook_claim')) {
        $db->exec(
            'CREATE INDEX idx_provider_webhook_claim '
            . 'ON provider_webhook_events (provider, event_id, claim_token)'
        );
    }
    if (!$indexExists('transactions', 'idx_transactions_collection_retry')) {
        $db->exec(
            'CREATE INDEX idx_transactions_collection_retry '
            . 'ON transactions (payment_provider, status, collection_retry_next_at, collection_retry_count)'
        );
    }

    $db->exec(
        'UPDATE provider_webhook_events '
        . 'SET first_received_at = COALESCE(first_received_at, created_at), '
        . 'last_received_at = COALESCE(last_received_at, updated_at, created_at) '
        . 'WHERE first_received_at IS NULL OR last_received_at IS NULL'
    );
};
