-- Columns on reports are created idempotently by
-- AdminReportWorkbenchRepository::ensureInfrastructure().
-- This keeps the migration compatible with MySQL/MariaDB versions that do not
-- support ADD COLUMN IF NOT EXISTS inside a multi-column ALTER TABLE.

CREATE TABLE IF NOT EXISTS report_moderation_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    report_id VARCHAR(64) NOT NULL,
    target_type VARCHAR(40) NOT NULL,
    target_id VARCHAR(255) NOT NULL,
    reason_slug VARCHAR(80) NOT NULL,
    action_slug VARCHAR(100) NOT NULL,
    moderator_user_id VARCHAR(64) NOT NULL,
    status_before VARCHAR(32) NOT NULL,
    status_after VARCHAR(32) NOT NULL,
    content_before_json LONGTEXT NULL,
    content_after_json LONGTEXT NULL,
    justification TEXT NULL,
    internal_note TEXT NULL,
    user_response TEXT NOT NULL,
    email_status VARCHAR(24) NOT NULL DEFAULT 'pending',
    email_error TEXT NULL,
    version_id VARCHAR(80) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_report_moderation_history_report (report_id, created_at),
    INDEX idx_report_moderation_history_target (target_type, target_id, created_at),
    INDEX idx_report_moderation_history_moderator (moderator_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS report_moderation_drafts (
    report_id VARCHAR(64) PRIMARY KEY,
    moderator_user_id VARCHAR(64) NOT NULL,
    action_slug VARCHAR(100) NULL,
    payload_json LONGTEXT NOT NULL,
    user_response TEXT NULL,
    internal_note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_report_moderation_drafts_moderator (moderator_user_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
