CREATE TABLE IF NOT EXISTS schema_audit_runs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    status VARCHAR(24) NOT NULL DEFAULT 'completed',
    database_name VARCHAR(128) NULL,
    runner_version VARCHAR(40) NOT NULL,
    output_json LONGTEXT NULL,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_schema_audit_runs_created_at (created_at),
    INDEX idx_schema_audit_runs_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schema_backfill_runs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    task_key VARCHAR(120) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'pending',
    dry_run TINYINT(1) NOT NULL DEFAULT 1,
    checkpoint_json LONGTEXT NULL,
    metrics_json LONGTEXT NULL,
    error_message TEXT NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_schema_backfill_runs_task_status (task_key, status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
