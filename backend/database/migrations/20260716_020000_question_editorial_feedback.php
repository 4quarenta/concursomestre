<?php

declare(strict_types=1);

/**
 * Move a criacao da tabela de feedback editorial para o pipeline de migrations.
 * Rollback: DROP TABLE question_editorial_feedback;
 */
return static function (PDO $db): void {
    $db->exec(
        "CREATE TABLE IF NOT EXISTS question_editorial_feedback (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            question_id BIGINT UNSIGNED NOT NULL,
            user_id VARCHAR(64) NOT NULL,
            content_type ENUM('teacher', 'detailed') NOT NULL,
            feedback_value ENUM('like', 'dislike') NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_question_editorial_feedback_user (question_id, user_id, content_type),
            INDEX idx_question_editorial_feedback_question (question_id),
            INDEX idx_question_editorial_feedback_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
};
