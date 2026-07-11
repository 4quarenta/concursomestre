<?php

declare(strict_types=1);

/**
 * Foundation for the financial ledger.
 *
 * The migration is deliberately additive. Operational records in
 * transactions remain intact while the ledger receives immutable capture and
 * refund entries that can be reconciled independently from UI status labels.
 */
return static function (PDO $db): void {
    $quote = static function (string $identifier): string {
        if (preg_match('/^[a-z0-9_]+$/i', $identifier) !== 1) {
            throw new InvalidArgumentException('Identificador de schema financeiro invalido.');
        }

        return chr(96) . $identifier . chr(96);
    };

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
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table_name
               AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([
            ':table_name' => $table,
            ':column_name' => $column,
        ]);

        return (int) $stmt->fetchColumn() > 0;
    };

    $indexExists = static function (string $table, string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table_name
               AND INDEX_NAME = :index_name'
        );
        $stmt->execute([
            ':table_name' => $table,
            ':index_name' => $index,
        ]);

        return (int) $stmt->fetchColumn() > 0;
    };

    $ensureColumn = static function (string $table, string $column, string $definition) use ($db, $quote, $tableExists, $columnExists): void {
        if ($tableExists($table) && !$columnExists($table, $column)) {
            $db->exec('ALTER TABLE ' . $quote($table) . ' ADD COLUMN ' . $quote($column) . ' ' . $definition);
        }
    };

    $ensureIndex = static function (string $table, string $index, string $columns) use ($db, $quote, $tableExists, $indexExists): void {
        if ($tableExists($table) && !$indexExists($table, $index)) {
            $db->exec('CREATE INDEX ' . $quote($index) . ' ON ' . $quote($table) . ' (' . $columns . ')');
        }
    };

    foreach ([
        'payment_provider' => "VARCHAR(50) NOT NULL DEFAULT 'stripe'",
        'provider_payment_intent_id' => 'VARCHAR(255) NULL',
        'provider_invoice_id' => 'VARCHAR(255) NULL',
        'provider_refund_id' => 'VARCHAR(255) NULL',
        'provider_customer_id' => 'VARCHAR(255) NULL',
        'provider_refund_details_json' => 'LONGTEXT NULL',
        'refunded_amount' => 'DECIMAL(10,2) NULL',
        'refunded_at' => 'DATETIME NULL',
        'user_subscription_id' => 'INT NULL',
        'plan_id' => 'INT NULL',
        'plan_name' => 'VARCHAR(255) NULL',
        'installments' => 'INT NULL DEFAULT 1',
        'payer_email' => 'VARCHAR(255) NULL',
        'type' => "VARCHAR(20) NULL DEFAULT 'material'",
    ] as $column => $definition) {
        $ensureColumn('transactions', $column, $definition);
    }

    foreach ([
        'payment_provider' => "VARCHAR(50) NOT NULL DEFAULT 'stripe'",
        'provider_subscription_id' => 'VARCHAR(255) NULL',
        'provider_customer_id' => 'VARCHAR(255) NULL',
        'provider_checkout_session_id' => 'VARCHAR(255) NULL',
        'provider_current_period_start' => 'DATETIME NULL',
        'provider_current_period_end' => 'DATETIME NULL',
        'provider_last_webhook_event_at' => 'DATETIME NULL',
        'provider_schedule_id' => 'VARCHAR(255) NULL',
        'cancel_at_period_end' => 'TINYINT(1) NOT NULL DEFAULT 0',
        'antifraud_blocked' => 'TINYINT(1) NOT NULL DEFAULT 0',
        'antifraud_reason' => 'TEXT NULL',
        'renewal_iteration' => 'INT NOT NULL DEFAULT 0',
        'superseded_by_subscription_id' => 'INT NULL',
        'next_renewal_amount' => 'DECIMAL(10,2) NULL',
        'next_renewal_date' => 'DATETIME NULL',
        'next_renewal_price_source' => 'VARCHAR(50) NULL',
        'next_renewal_cycle_label' => 'VARCHAR(80) NULL',
        'next_renewal_snapshot_json' => 'LONGTEXT NULL',
        'renewal_reminder_sent_for' => 'VARCHAR(80) NULL',
        'renewal_reminder_sent_at' => 'DATETIME NULL',
    ] as $column => $definition) {
        $ensureColumn('user_subscriptions', $column, $definition);
    }

    $ensureColumn('users', 'stripe_customer_id', 'VARCHAR(255) NULL');
    $ensureColumn('plans', 'stripe_product_id', 'VARCHAR(255) NULL');
    foreach ([
        'payment_provider' => "VARCHAR(50) NOT NULL DEFAULT 'stripe'",
        'stripe_payment_method_id' => 'VARCHAR(255) NULL',
        'provider_customer_id' => 'VARCHAR(255) NULL',
    ] as $column => $definition) {
        $ensureColumn('user_cards', $column, $definition);
    }

    $ensureIndex('transactions', 'idx_transactions_user_subscription', 'user_subscription_id');
    $ensureIndex('transactions', 'idx_transactions_plan_id', 'plan_id');
    $ensureIndex('transactions', 'idx_transactions_financial_state', 'status, created_at');
    $ensureIndex('user_subscriptions', 'idx_user_subscriptions_provider_subscription', 'provider_subscription_id');
    $ensureIndex('user_subscriptions', 'idx_user_subscriptions_user_status', 'user_id, status');
    $ensureIndex('user_cards', 'idx_user_cards_provider', 'payment_provider');
    $ensureIndex('user_cards', 'idx_user_cards_stripe_pm', 'stripe_payment_method_id');

    $db->exec(
        "CREATE TABLE IF NOT EXISTS coupon_reservations (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            coupon_code VARCHAR(80) NOT NULL,
            user_id VARCHAR(64) NOT NULL,
            checkout_attempt_id VARCHAR(120) NOT NULL,
            provider VARCHAR(40) NOT NULL DEFAULT 'stripe',
            provider_session_id VARCHAR(255) NULL,
            provider_subscription_id VARCHAR(255) NULL,
            provider_invoice_id VARCHAR(255) NULL,
            status VARCHAR(40) NOT NULL DEFAULT 'reserved',
            reserved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            consumed_at DATETIME NULL,
            released_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_coupon_reservation_attempt (coupon_code, user_id, checkout_attempt_id, provider),
            INDEX idx_coupon_reservations_active (coupon_code, status, expires_at),
            INDEX idx_coupon_reservations_provider_session (provider_session_id),
            INDEX idx_coupon_reservations_provider_subscription (provider_subscription_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS stripe_testing_matrix_runs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            run_id VARCHAR(64) NOT NULL,
            scenario_id VARCHAR(120) NOT NULL,
            scenario_label VARCHAR(255) NOT NULL,
            category_id VARCHAR(80) NOT NULL,
            stripe_reference VARCHAR(255) NULL,
            platform_flow VARCHAR(80) NULL,
            platform_status VARCHAR(40) NOT NULL,
            execution_result VARCHAR(20) NOT NULL,
            evidence_json LONGTEXT NULL,
            notes TEXT NULL,
            executed_by_admin_id VARCHAR(64) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_stripe_testing_run_id (run_id),
            INDEX idx_stripe_testing_runs_scenario (scenario_id),
            INDEX idx_stripe_testing_runs_result (execution_result),
            INDEX idx_stripe_testing_runs_admin (executed_by_admin_id),
            INDEX idx_stripe_testing_runs_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS financial_ledger_entries (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            entry_key VARCHAR(191) NOT NULL,
            transaction_id INT NULL,
            user_subscription_id INT NULL,
            transaction_type VARCHAR(20) NOT NULL DEFAULT 'unknown',
            entry_type VARCHAR(30) NOT NULL,
            payment_provider VARCHAR(50) NOT NULL DEFAULT 'stripe',
            provider_reference VARCHAR(255) NULL,
            provider_refund_id VARCHAR(255) NULL,
            currency CHAR(3) NOT NULL DEFAULT 'BRL',
            gross_amount DECIMAL(10,2) NOT NULL,
            fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            net_amount DECIMAL(10,2) NOT NULL,
            occurred_at DATETIME NOT NULL,
            source VARCHAR(40) NOT NULL DEFAULT 'runtime',
            metadata_json LONGTEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_financial_ledger_entry_key (entry_key),
            INDEX idx_financial_ledger_occurred (occurred_at, entry_type),
            INDEX idx_financial_ledger_transaction (transaction_id, entry_type),
            INDEX idx_financial_ledger_subscription (user_subscription_id, occurred_at),
            INDEX idx_financial_ledger_provider_reference (payment_provider, provider_reference)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    if (!$tableExists('transactions')) {
        return;
    }

    $db->exec(
        "INSERT IGNORE INTO financial_ledger_entries (
            entry_key, transaction_id, user_subscription_id, transaction_type, entry_type,
            payment_provider, provider_reference, provider_refund_id, currency,
            gross_amount, fee_amount, net_amount, occurred_at, source, metadata_json
        )
        SELECT
            CONCAT('transaction:', t.id, ':capture'),
            t.id,
            t.user_subscription_id,
            COALESCE(NULLIF(t.type, ''), 'unknown'),
            'capture',
            COALESCE(NULLIF(t.payment_provider, ''), 'stripe'),
            COALESCE(NULLIF(t.provider_invoice_id, ''), NULLIF(t.provider_payment_intent_id, ''), NULLIF(t.external_id, ''), CONCAT('transaction:', t.id)),
            NULL,
            'BRL',
            ROUND(COALESCE(t.amount, 0), 2),
            ROUND(COALESCE(t.platform_fee, 0), 2),
            ROUND(COALESCE(t.amount, 0) - COALESCE(t.platform_fee, 0), 2),
            COALESCE(t.created_at, NOW()),
            'migration_backfill',
            NULL
        FROM transactions t
        WHERE COALESCE(t.amount, 0) > 0
          AND (
              t.status IN ('approved', 'completed', 'refund_requested', 'refunded', 'partially_refunded')
              OR COALESCE(t.provider_refund_id, '') <> ''
              OR t.refunded_at IS NOT NULL
          )"
    );

    $db->exec(
        "INSERT IGNORE INTO financial_ledger_entries (
            entry_key, transaction_id, user_subscription_id, transaction_type, entry_type,
            payment_provider, provider_reference, provider_refund_id, currency,
            gross_amount, fee_amount, net_amount, occurred_at, source, metadata_json
        )
        SELECT
            CONCAT('transaction:', t.id, ':refund'),
            t.id,
            t.user_subscription_id,
            COALESCE(NULLIF(t.type, ''), 'unknown'),
            'refund',
            COALESCE(NULLIF(t.payment_provider, ''), 'stripe'),
            COALESCE(NULLIF(t.provider_invoice_id, ''), NULLIF(t.provider_payment_intent_id, ''), NULLIF(t.external_id, ''), CONCAT('transaction:', t.id)),
            NULLIF(t.provider_refund_id, ''),
            'BRL',
            -ROUND(COALESCE(NULLIF(t.refunded_amount, 0), t.amount, 0), 2),
            -ROUND(
                COALESCE(t.platform_fee, 0)
                * COALESCE(NULLIF(t.refunded_amount, 0), t.amount, 0)
                / NULLIF(t.amount, 0),
                2
            ),
            -ROUND(
                COALESCE(NULLIF(t.refunded_amount, 0), t.amount, 0)
                - (
                    COALESCE(t.platform_fee, 0)
                    * COALESCE(NULLIF(t.refunded_amount, 0), t.amount, 0)
                    / NULLIF(t.amount, 0)
                ),
                2
            ),
            COALESCE(t.refunded_at, t.created_at, NOW()),
            'migration_backfill',
            NULL
        FROM transactions t
        WHERE COALESCE(t.amount, 0) > 0
          AND (
              t.status IN ('refunded', 'partially_refunded')
              OR COALESCE(t.provider_refund_id, '') <> ''
              OR t.refunded_at IS NOT NULL
          )"
    );
};
