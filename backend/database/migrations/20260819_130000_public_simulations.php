<?php

declare(strict_types=1);

/**
 * Catalogo editorial canonico de Simulados Publicos.
 *
 * A tabela legada `simulations` continua representando tentativas privadas de
 * usuarios. Esta migration nao converte, infere ou publica registros legados.
 *
 * Rollback: backend/database/rollbacks/20260819_130000_public_simulations.sql
 */
return static function (PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS public_simulations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(190) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        instructions TEXT NULL,
        publication_status ENUM('draft', 'scheduled', 'published', 'archived') NOT NULL DEFAULT 'draft',
        visibility_status ENUM('public', 'internal', 'private', 'unlisted') NOT NULL DEFAULT 'internal',
        availability_status ENUM('available', 'unavailable', 'retired') NOT NULL DEFAULT 'unavailable',
        duration_minutes SMALLINT UNSIGNED NULL,
        scheduled_at DATETIME NULL,
        published_at DATETIME NULL,
        archived_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_public_simulations_slug (slug),
        KEY idx_public_simulations_catalog (publication_status, visibility_status, archived_at, scheduled_at, id),
        KEY idx_public_simulations_updated (updated_at, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS public_simulation_questions (
        simulation_id BIGINT UNSIGNED NOT NULL,
        question_id INT NOT NULL,
        position SMALLINT UNSIGNED NOT NULL,
        points DECIMAL(8,3) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (simulation_id, question_id),
        UNIQUE KEY uq_public_simulation_question_position (simulation_id, position),
        KEY idx_public_simulation_questions_question (question_id, simulation_id),
        CONSTRAINT fk_public_simulation_questions_simulation FOREIGN KEY (simulation_id) REFERENCES public_simulations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_public_simulation_questions_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS public_simulation_filters (
        simulation_id BIGINT UNSIGNED NOT NULL,
        filter_id INT NOT NULL,
        relation_type ENUM('discipline', 'topic', 'subject', 'career', 'position', 'board', 'organization') NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (simulation_id, filter_id, relation_type),
        KEY idx_public_simulation_filters_filter (filter_id, relation_type, simulation_id),
        CONSTRAINT fk_public_simulation_filters_simulation FOREIGN KEY (simulation_id) REFERENCES public_simulations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_public_simulation_filters_filter FOREIGN KEY (filter_id) REFERENCES filters(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS public_simulation_contests (
        simulation_id BIGINT UNSIGNED NOT NULL,
        contest_id BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (simulation_id, contest_id),
        KEY idx_public_simulation_contests_contest (contest_id, simulation_id),
        CONSTRAINT fk_public_simulation_contests_simulation FOREIGN KEY (simulation_id) REFERENCES public_simulations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_public_simulation_contests_contest FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS public_simulation_exams (
        simulation_id BIGINT UNSIGNED NOT NULL,
        exam_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (simulation_id, exam_id),
        KEY idx_public_simulation_exams_exam (exam_id, simulation_id),
        CONSTRAINT fk_public_simulation_exams_simulation FOREIGN KEY (simulation_id) REFERENCES public_simulations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_public_simulation_exams_exam FOREIGN KEY (exam_id) REFERENCES provas(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS public_simulation_aliases (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        simulation_id BIGINT UNSIGNED NOT NULL,
        alias VARCHAR(190) NOT NULL,
        normalized_alias VARCHAR(190) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_public_simulation_alias_lookup (normalized_alias),
        KEY idx_public_simulation_alias_simulation (simulation_id),
        CONSTRAINT fk_public_simulation_alias_simulation FOREIGN KEY (simulation_id) REFERENCES public_simulations(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
