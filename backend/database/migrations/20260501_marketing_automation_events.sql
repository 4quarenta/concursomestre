CREATE TABLE IF NOT EXISTS marketing_automation_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    campaign_slug VARCHAR(120) NOT NULL,
    rule_id VARCHAR(120) NOT NULL,
    rule_condition VARCHAR(60) NOT NULL,
    user_id VARCHAR(80) NOT NULL,
    event_key VARCHAR(160) NOT NULL,
    channel VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'claimed',
    delivery_json LONGTEXT NULL,
    error_message VARCHAR(1000) NULL,
    sent_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_marketing_automation_event (campaign_slug, rule_id, user_id, event_key),
    INDEX idx_marketing_automation_status (status, created_at),
    INDEX idx_marketing_automation_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

