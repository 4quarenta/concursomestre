<?php

declare(strict_types=1);

/**
 * Garante idempotencia das materializacoes Stripe sem executar DDL no request.
 *
 * Rollback manual:
 *   ALTER TABLE transactions DROP INDEX uniq_transactions_provider_invoice;
 *   ALTER TABLE transactions DROP INDEX uniq_transactions_provider_payment_intent;
 */
return static function (PDO $db): void {
    $tableExists = (int) $db->query(
        "SELECT COUNT(*) FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions'"
    )->fetchColumn() > 0;
    if (!$tableExists) {
        return;
    }

    $columnExists = static function (string $column) use ($db): bool {
        $stmt = $db->prepare(
            "SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'transactions'
               AND COLUMN_NAME = :column_name"
        );
        $stmt->execute([':column_name' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    };

    $indexExists = static function (string $index) use ($db): bool {
        $stmt = $db->prepare(
            "SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'transactions'
               AND INDEX_NAME = :index_name"
        );
        $stmt->execute([':index_name' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    };

    $uniqueProviderColumns = [
        'provider_invoice_id' => 'uniq_transactions_provider_invoice',
        'provider_payment_intent_id' => 'uniq_transactions_provider_payment_intent',
    ];

    foreach ($uniqueProviderColumns as $column => $index) {
        if (!$columnExists($column) || $indexExists($index)) {
            continue;
        }

        $db->exec(sprintf(
            "UPDATE transactions SET `%s` = NULL WHERE TRIM(COALESCE(`%s`, '')) = ''",
            $column,
            $column
        ));

        $duplicates = $db->query(sprintf(
            "SELECT `%s` AS provider_identifier, COUNT(*) AS duplicate_count
             FROM transactions
             WHERE `%s` IS NOT NULL
             GROUP BY `%s`
             HAVING COUNT(*) > 1
             LIMIT 10",
            $column,
            $column,
            $column
        ))->fetchAll(PDO::FETCH_ASSOC) ?: [];

        if ($duplicates !== []) {
            throw new RuntimeException(
                'Indice financeiro nao criado: existem identificadores Stripe duplicados em transactions.'
                . ' Corrija os registros comprovadamente duplicados antes de reaplicar a migration. Coluna: '
                . $column
                . '. Amostra: '
                . json_encode($duplicates, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            );
        }

        $db->exec(sprintf(
            'CREATE UNIQUE INDEX `%s` ON transactions (`%s`)',
            $index,
            $column
        ));
    }
};
