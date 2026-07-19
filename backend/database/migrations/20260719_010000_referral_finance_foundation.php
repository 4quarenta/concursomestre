<?php

declare(strict_types=1);

/**
 * Programa financeiro de indicacoes.
 *
 * A migration e estritamente aditiva. Nenhuma indicacao ou transacao antiga
 * gera comissao automaticamente; a origem financeira so passa a existir
 * quando uma captura comprovada for sincronizada pelo runtime ou por um
 * backfill administrativo explicito.
 */
return static function (PDO $db): void {
    $db->exec(
        "CREATE TABLE IF NOT EXISTS referral_commission_entries (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            entry_key VARCHAR(191) NOT NULL,
            referral_id BIGINT UNSIGNED NOT NULL,
            transaction_id INT NOT NULL,
            referrer_id VARCHAR(36) NOT NULL,
            referred_user_id VARCHAR(36) NOT NULL,
            entry_type VARCHAR(24) NOT NULL,
            currency CHAR(3) NOT NULL DEFAULT 'BRL',
            base_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            commission_percent DECIMAL(6,3) NOT NULL DEFAULT 0.000,
            amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            available_at DATETIME NOT NULL,
            payout_item_id BIGINT UNSIGNED NULL,
            occurred_at DATETIME NOT NULL,
            source VARCHAR(80) NOT NULL,
            metadata_json JSON NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_referral_commission_entry_key (entry_key),
            KEY idx_referral_commission_referrer_available (referrer_id, payout_item_id, available_at, id),
            KEY idx_referral_commission_transaction (transaction_id, entry_type),
            KEY idx_referral_commission_referral (referral_id, occurred_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS referral_payout_cycles (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            cycle_key VARCHAR(40) NOT NULL,
            period_start DATETIME NOT NULL,
            period_end DATETIME NOT NULL,
            scheduled_for DATE NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'review',
            total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            approved_by_user_id VARCHAR(36) NULL,
            approved_at DATETIME NULL,
            paid_by_user_id VARCHAR(36) NULL,
            paid_at DATETIME NULL,
            provider_reference VARCHAR(191) NULL,
            notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_referral_payout_cycle_key (cycle_key),
            KEY idx_referral_payout_cycle_status_date (status, scheduled_for, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS referral_payout_items (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            cycle_id BIGINT UNSIGNED NOT NULL,
            referrer_id VARCHAR(36) NOT NULL,
            amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            status VARCHAR(24) NOT NULL DEFAULT 'review',
            approved_by_user_id VARCHAR(36) NULL,
            approved_at DATETIME NULL,
            paid_by_user_id VARCHAR(36) NULL,
            paid_at DATETIME NULL,
            provider_reference VARCHAR(191) NULL,
            notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_referral_payout_cycle_referrer (cycle_id, referrer_id),
            KEY idx_referral_payout_referrer_status (referrer_id, status, id),
            KEY idx_referral_payout_status (status, id),
            CONSTRAINT fk_referral_payout_item_cycle
                FOREIGN KEY (cycle_id) REFERENCES referral_payout_cycles (id)
                ON DELETE RESTRICT ON UPDATE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
};
