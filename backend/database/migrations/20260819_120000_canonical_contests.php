<?php

declare(strict_types=1);

/**
 * Entidade canonica de Concurso e relacoes publicas explicitamente curadas.
 * Nenhum dado sintetico e migrado. A aplicacao depende de revisao editorial.
 *
 * Rollback: backend/database/rollbacks/20260819_120000_canonical_contests.sql
 */
return static function (PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS contests (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(190) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        domain_status ENUM(
            'announced', 'authorized', 'notice_published', 'registration_open',
            'registration_closed', 'exam_scheduled', 'exam_completed',
            'results', 'completed', 'suspended', 'cancelled'
        ) NOT NULL DEFAULT 'announced',
        publication_status ENUM('draft', 'scheduled', 'published', 'archived') NOT NULL DEFAULT 'draft',
        visibility_status ENUM('public', 'internal') NOT NULL DEFAULT 'internal',
        year SMALLINT UNSIGNED NULL,
        board_filter_id INT NULL,
        official_url VARCHAR(1000) NULL,
        announced_at DATETIME NULL,
        notice_published_at DATETIME NULL,
        registration_start_at DATETIME NULL,
        registration_end_at DATETIME NULL,
        exam_start_at DATETIME NULL,
        published_at DATETIME NULL,
        scheduled_at DATETIME NULL,
        archived_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_contests_slug (slug),
        KEY idx_contests_publication (publication_status, visibility_status, archived_at, id),
        KEY idx_contests_open (domain_status, publication_status, visibility_status, archived_at, registration_end_at, registration_start_at, id),
        KEY idx_contests_board (board_filter_id, id),
        CONSTRAINT fk_contests_board FOREIGN KEY (board_filter_id) REFERENCES filters(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS contest_organizations (
        contest_id BIGINT UNSIGNED NOT NULL,
        organization_filter_id INT NOT NULL,
        is_primary TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (contest_id, organization_filter_id),
        KEY idx_contest_organizations_filter (organization_filter_id, contest_id),
        CONSTRAINT fk_contest_organizations_contest FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE RESTRICT,
        CONSTRAINT fk_contest_organizations_filter FOREIGN KEY (organization_filter_id) REFERENCES filters(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS contest_positions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        contest_id BIGINT UNSIGNED NOT NULL,
        role_filter_id INT NOT NULL,
        vacancies INT UNSIGNED NULL,
        reserve_registry TINYINT(1) NOT NULL DEFAULT 0,
        salary_min DECIMAL(12,2) NULL,
        salary_max DECIMAL(12,2) NULL,
        education_level VARCHAR(120) NULL,
        weekly_hours SMALLINT UNSIGNED NULL,
        location_label VARCHAR(190) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_contest_positions_role (contest_id, role_filter_id),
        KEY idx_contest_positions_role (role_filter_id, contest_id),
        CONSTRAINT fk_contest_positions_contest FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE RESTRICT,
        CONSTRAINT fk_contest_positions_role FOREIGN KEY (role_filter_id) REFERENCES filters(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS contest_exams (
        contest_id BIGINT UNSIGNED NOT NULL,
        exam_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (contest_id, exam_id),
        UNIQUE KEY uq_contest_exam_identity (exam_id),
        CONSTRAINT fk_contest_exams_contest FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE RESTRICT,
        CONSTRAINT fk_contest_exams_exam FOREIGN KEY (exam_id) REFERENCES provas(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS contest_documents (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        contest_id BIGINT UNSIGNED NOT NULL,
        document_type ENUM('notice', 'correction', 'communication', 'result', 'other') NOT NULL,
        title VARCHAR(255) NOT NULL,
        public_url VARCHAR(1000) NOT NULL,
        publication_status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
        published_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_contest_documents_public (contest_id, publication_status, published_at, id),
        CONSTRAINT fk_contest_documents_contest FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS contest_aliases (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        contest_id BIGINT UNSIGNED NOT NULL,
        alias VARCHAR(190) NOT NULL,
        normalized_alias VARCHAR(190) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_contest_alias_lookup (normalized_alias),
        KEY idx_contest_alias_contest (contest_id),
        CONSTRAINT fk_contest_alias_contest FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
