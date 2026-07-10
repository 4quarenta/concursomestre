CREATE TABLE IF NOT EXISTS user_study_schedules (
    user_id VARCHAR(36) PRIMARY KEY,
    form_json MEDIUMTEXT NOT NULL,
    plan_json MEDIUMTEXT NULL,
    generated_at DATETIME NULL,
    saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_study_schedules_saved_at (saved_at),
    CONSTRAINT fk_user_study_schedules_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
