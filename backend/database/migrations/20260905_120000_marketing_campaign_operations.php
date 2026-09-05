<?php

declare(strict_types=1);

/**
 * Estrutura persistente do dominio de campanhas e segmentos do marketing.
 * Nao duplica planos, cupons, billing ou o ledger first-party de analytics.
 * Rollback: backend/database/rollbacks/20260905_120000_marketing_campaign_operations.sql
 */
return static function (PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS marketing_segments (
        id CHAR(36) NOT NULL PRIMARY KEY,
        name VARCHAR(160) NOT NULL,
        description VARCHAR(500) NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'draft',
        rules_json JSON NOT NULL,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64) NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        KEY idx_marketing_segments_status_updated (status, updated_at),
        KEY idx_marketing_segments_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS marketing_campaigns (
        id CHAR(36) NOT NULL PRIMARY KEY,
        name VARCHAR(180) NOT NULL,
        objective VARCHAR(40) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'draft',
        priority INT NOT NULL DEFAULT 0,
        starts_at DATETIME(6) NULL,
        ends_at DATETIME(6) NULL,
        segment_id CHAR(36) NULL,
        rules_json JSON NOT NULL,
        channels_json JSON NOT NULL,
        placements_json JSON NOT NULL,
        content_json JSON NOT NULL,
        landing_slug VARCHAR(160) NULL,
        offer_json JSON NULL,
        plan_id BIGINT UNSIGNED NULL,
        coupon_code VARCHAR(120) NULL,
        tracking_json JSON NULL,
        frequency_cap INT UNSIGNED NULL,
        cooldown_hours INT UNSIGNED NULL,
        max_impressions INT UNSIGNED NULL,
        mutual_exclusion_group VARCHAR(120) NULL,
        suppress_after_conversion TINYINT(1) NOT NULL DEFAULT 1,
        created_by VARCHAR(64) NOT NULL,
        updated_by VARCHAR(64) NOT NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        KEY idx_marketing_campaigns_status_window (status, starts_at, ends_at),
        KEY idx_marketing_campaigns_segment_status (segment_id, status),
        KEY idx_marketing_campaigns_priority (priority, status)
        /* Segment references are validated by MarketingCampaignService. The
           audited migration principal intentionally has no REFERENCES grant. */
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS marketing_campaign_interactions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        campaign_id CHAR(36) NOT NULL,
        user_id VARCHAR(64) NULL,
        session_key_hash CHAR(64) NULL,
        interaction_type VARCHAR(32) NOT NULL,
        idempotency_key CHAR(64) NOT NULL,
        attribution_json JSON NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE KEY uq_marketing_campaign_interaction (idempotency_key),
        KEY idx_marketing_campaign_interaction_campaign_type (campaign_id, interaction_type, created_at),
        KEY idx_marketing_campaign_interaction_user (user_id, created_at)
        /* Interaction ownership is validated by MarketingCampaignService;
           deletion is restricted to synthetic Macro20F identifiers there. */
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
