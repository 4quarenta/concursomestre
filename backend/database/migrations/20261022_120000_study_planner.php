<?php
declare(strict_types=1);

// Additive: legacy user_study_schedules snapshots remain untouched.
return static function (PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS study_plan_templates (
        id VARCHAR(32) PRIMARY KEY, version INT NOT NULL DEFAULT 1,
        title VARCHAR(200) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'draft',
        config_json MEDIUMTEXT NOT NULL, updated_at DATETIME NOT NULL,
        INDEX idx_study_templates_status (status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS study_plans (
        id VARCHAR(32) PRIMARY KEY, user_id VARCHAR(36) NOT NULL,
        title VARCHAR(200) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active',
        template_id VARCHAR(32) NULL, template_version INT NULL,
        revision INT NOT NULL DEFAULT 1, config_json MEDIUMTEXT NOT NULL,
        created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
        INDEX idx_study_plans_user (user_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS study_plan_sessions (
        id VARCHAR(32) PRIMARY KEY, plan_id VARCHAR(32) NOT NULL, scheduled_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'planned', payload_json TEXT NOT NULL,
        started_at DATETIME NULL, completed_at DATETIME NULL,
        INDEX idx_study_sessions_plan_date (plan_id, scheduled_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
