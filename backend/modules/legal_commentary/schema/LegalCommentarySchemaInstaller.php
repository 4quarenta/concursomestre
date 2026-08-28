<?php

require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';

/**
 * Instala e valida o schema da Lei Comentada.
 *
 * A instalação permanece explícita e fora do repository de runtime para
 * manter a fronteira entre persistência e evolução do schema.
 */
final class LegalCommentarySchemaInstaller
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public static function assertReady(PDO $db): void
    {
        SchemaReadiness::assertTablesAndColumns($db, 'Lei Comentada', [
            'legal_areas' => ['id', 'slug', 'name'],
            'laws' => ['id', 'legal_area_id', 'slug', 'official_url', 'created_by_user_id'],
            'law_sections' => ['id', 'law_id', 'slug', 'assunto_filter_id'],
            'law_articles' => ['id', 'law_id', 'section_id', 'official_text', 'assunto_filter_id', 'official_status'],
            'law_article_blocks' => ['id', 'law_article_id', 'block_uid', 'text'],
            'law_versions' => ['id', 'law_id', 'version_number', 'source_hash'],
            'law_article_versions' => ['id', 'law_version_id', 'article_number', 'change_type'],
            'teacher_comments' => ['id', 'law_article_id', 'body'],
            'article_doutrina' => ['id', 'law_article_id', 'summary'],
            'article_jurisprudence' => ['id', 'law_article_id', 'summary'],
            'article_sumulas' => ['id', 'law_article_id', 'text'],
            'article_exam_tips' => ['id', 'law_article_id', 'body'],
            'law_section_editorials' => ['id', 'law_id', 'section_id'],
            'legal_user_favorites' => ['id', 'user_id', 'target_type', 'target_id'],
            'legal_user_comments' => ['id', 'law_article_id', 'user_id', 'body'],
            'legal_content_reactions' => ['id', 'target_key', 'user_id'],
            'legal_user_progress' => ['id', 'user_id', 'law_id'],
            'legal_user_notes' => ['id', 'user_id', 'law_id', 'law_article_id', 'body'],
            'legal_user_reader_annotations' => ['id', 'user_id', 'law_id', 'law_section_id', 'markup_html'],
            'law_updates' => ['id', 'law_id', 'change_type'],
            'legal_sync_logs' => ['id', 'status', 'started_at'],
            'sync_errors' => ['id', 'message'],
            'legal_ai_batch_runs' => ['id', 'law_id', 'status'],
            'legal_ai_batch_items' => ['id', 'batch_run_id', 'law_article_id', 'status'],
        ]);
    }

    public function install(): void
    {
        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS legal_areas (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                slug VARCHAR(120) NOT NULL UNIQUE,
                name VARCHAR(180) NOT NULL,
                description TEXT NULL,
                color_class VARCHAR(120) NULL,
                icon_name VARCHAR(80) NULL,
                icon_tone VARCHAR(120) NULL,
                sort_order INT NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_legal_areas_sort (sort_order),
                INDEX idx_legal_areas_slug (slug)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS laws (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                legal_area_id BIGINT UNSIGNED NOT NULL,
                law_topic_filter_id BIGINT UNSIGNED NULL,
                slug VARCHAR(160) NOT NULL UNIQUE,
                acronym VARCHAR(40) NULL,
                title VARCHAR(255) NOT NULL,
                short_title VARCHAR(180) NOT NULL,
                law_number VARCHAR(120) NOT NULL,
                law_year VARCHAR(20) NULL,
                published_at DATETIME NULL,
                aliases_json LONGTEXT NULL,
                description TEXT NULL,
                summary TEXT NULL,
                preamble LONGTEXT NULL,
                ementa LONGTEXT NULL,
                status VARCHAR(40) NOT NULL DEFAULT 'active',
                official_url VARCHAR(500) NOT NULL,
                source_name VARCHAR(120) NOT NULL DEFAULT 'Portal do Planalto',
                last_synced_at DATETIME NULL,
                last_updated_at DATETIME NULL,
                is_recently_updated TINYINT(1) NOT NULL DEFAULT 0,
                access_count INT UNSIGNED NOT NULL DEFAULT 0,
                created_by_user_id VARCHAR(64) NULL,
                updated_by_user_id VARCHAR(64) NULL,
                published_by_user_id VARCHAR(64) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_laws_area (legal_area_id),
                INDEX idx_laws_topic_filter (law_topic_filter_id),
                INDEX idx_laws_slug (slug),
                INDEX idx_laws_recent (is_recently_updated, last_updated_at),
                INDEX idx_laws_access (access_count),
                FULLTEXT KEY ft_laws_search (title, short_title, law_number, description, summary, ementa),
                CONSTRAINT fk_laws_legal_area FOREIGN KEY (legal_area_id) REFERENCES legal_areas(id) ON DELETE RESTRICT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS law_sections (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                law_id BIGINT UNSIGNED NOT NULL,
                slug VARCHAR(180) NOT NULL,
                display_title VARCHAR(255) NOT NULL,
                title_label VARCHAR(80) NULL,
                title_name VARCHAR(255) NULL,
                chapter_label VARCHAR(80) NULL,
                chapter_name VARCHAR(255) NULL,
                subtopic_filter_id BIGINT UNSIGNED NULL,
                assunto_filter_id BIGINT UNSIGNED NULL,
                from_article VARCHAR(60) NULL,
                to_article VARCHAR(60) NULL,
                article_count INT UNSIGNED NOT NULL DEFAULT 0,
                sort_order INT NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_law_section_slug (law_id, slug),
                INDEX idx_law_sections_law (law_id, sort_order),
                INDEX idx_law_sections_subtopic (subtopic_filter_id),
                INDEX idx_law_sections_assunto (assunto_filter_id),
                CONSTRAINT fk_law_sections_law FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS law_articles (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                law_id BIGINT UNSIGNED NOT NULL,
                section_id BIGINT UNSIGNED NULL,
                slug VARCHAR(180) NOT NULL,
                article_number VARCHAR(60) NOT NULL,
                title VARCHAR(255) NULL,
                official_text LONGTEXT NOT NULL,
                paragraphs_json LONGTEXT NULL,
                jurisprudence_notes_json LONGTEXT NULL,
                doctrine_json LONGTEXT NULL,
                official_anchor VARCHAR(180) NULL,
                is_recently_changed TINYINT(1) NOT NULL DEFAULT 0,
                related_question_count INT UNSIGNED NOT NULL DEFAULT 0,
                assunto_filter_id BIGINT UNSIGNED NULL,
                sort_order INT NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_law_article_slug (law_id, slug),
                INDEX idx_law_articles_law (law_id, sort_order),
                INDEX idx_law_articles_section (section_id, sort_order),
                INDEX idx_law_articles_assunto (assunto_filter_id),
                FULLTEXT KEY ft_law_articles_search (article_number, title, official_text),
                CONSTRAINT fk_law_articles_law FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE,
                CONSTRAINT fk_law_articles_section FOREIGN KEY (section_id) REFERENCES law_sections(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS law_article_blocks (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                law_article_id BIGINT UNSIGNED NOT NULL,
                block_uid VARCHAR(120) NOT NULL,
                kind VARCHAR(40) NOT NULL,
                label VARCHAR(120) NULL,
                text LONGTEXT NOT NULL,
                parent_block_uid VARCHAR(120) NULL,
                anchor VARCHAR(180) NULL,
                source_note VARCHAR(255) NULL,
                notes_json LONGTEXT NULL,
                is_recently_changed TINYINT(1) NOT NULL DEFAULT 0,
                previous_text LONGTEXT NULL,
                sort_order INT NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_article_block_uid (law_article_id, block_uid),
                INDEX idx_law_article_blocks_article (law_article_id, sort_order),
                CONSTRAINT fk_law_article_blocks_article FOREIGN KEY (law_article_id) REFERENCES law_articles(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS law_versions (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                law_id BIGINT UNSIGNED NOT NULL,
                version_number INT UNSIGNED NOT NULL,
                source_url VARCHAR(500) NOT NULL,
                source_hash CHAR(64) NOT NULL,
                metadata_json LONGTEXT NULL,
                raw_snapshot LONGTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_law_version (law_id, version_number),
                INDEX idx_law_versions_law (law_id, created_at),
                CONSTRAINT fk_law_versions_law FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS law_article_versions (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                law_version_id BIGINT UNSIGNED NOT NULL,
                law_article_id BIGINT UNSIGNED NULL,
                article_number VARCHAR(60) NOT NULL,
                change_type VARCHAR(40) NOT NULL DEFAULT 'unchanged',
                previous_hash CHAR(64) NULL,
                current_hash CHAR(64) NULL,
                previous_text LONGTEXT NULL,
                current_text LONGTEXT NULL,
                blocks_json LONGTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_article_versions_version (law_version_id),
                INDEX idx_article_versions_article (law_article_id),
                CONSTRAINT fk_article_versions_version FOREIGN KEY (law_version_id) REFERENCES law_versions(id) ON DELETE CASCADE,
                CONSTRAINT fk_article_versions_article FOREIGN KEY (law_article_id) REFERENCES law_articles(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS teacher_comments (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                law_article_id BIGINT UNSIGNED NOT NULL,
                title VARCHAR(255) NOT NULL,
                body LONGTEXT NOT NULL,
                importance VARCHAR(20) NULL,
                style VARCHAR(60) NULL,
                rich_blocks_json LONGTEXT NULL,
                keywords_json LONGTEXT NULL,
                avoid_repetition_note TEXT NULL,
                exam_focus_json LONGTEXT NULL,
                pitfalls_json LONGTEXT NULL,
                related_refs_json LONGTEXT NULL,
                author_name VARCHAR(180) NOT NULL,
                author_role VARCHAR(180) NULL,
                reviewed_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_teacher_comments_article (law_article_id),
                CONSTRAINT fk_teacher_comments_article FOREIGN KEY (law_article_id) REFERENCES law_articles(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS article_doutrina (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                law_article_id BIGINT UNSIGNED NOT NULL,
                author_name VARCHAR(180) NULL,
                work_title VARCHAR(255) NULL,
                summary LONGTEXT NOT NULL,
                source_url VARCHAR(500) NULL,
                priority VARCHAR(20) NOT NULL DEFAULT 'medium',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_article_doutrina_article (law_article_id),
                CONSTRAINT fk_article_doutrina_article FOREIGN KEY (law_article_id) REFERENCES law_articles(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS article_jurisprudence (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                law_article_id BIGINT UNSIGNED NOT NULL,
                court VARCHAR(20) NOT NULL,
                precedent_type VARCHAR(120) NOT NULL,
                title VARCHAR(255) NOT NULL,
                summary LONGTEXT NOT NULL,
                exam_impact LONGTEXT NULL,
                is_consolidated TINYINT(1) NOT NULL DEFAULT 0,
                priority VARCHAR(20) NOT NULL DEFAULT 'medium',
                source_url VARCHAR(500) NULL,
                target_json LONGTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_article_jurisprudence_article (law_article_id),
                INDEX idx_article_jurisprudence_court (court),
                CONSTRAINT fk_article_jurisprudence_article FOREIGN KEY (law_article_id) REFERENCES law_articles(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS article_sumulas (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                law_article_id BIGINT UNSIGNED NOT NULL,
                court VARCHAR(20) NOT NULL,
                number VARCHAR(40) NOT NULL,
                text LONGTEXT NOT NULL,
                source_url VARCHAR(500) NULL,
                priority VARCHAR(20) NOT NULL DEFAULT 'medium',
                target_json LONGTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_article_sumulas_article (law_article_id),
                CONSTRAINT fk_article_sumulas_article FOREIGN KEY (law_article_id) REFERENCES law_articles(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS article_exam_tips (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                law_article_id BIGINT UNSIGNED NOT NULL,
                title VARCHAR(255) NOT NULL,
                body LONGTEXT NOT NULL,
                tags_json LONGTEXT NULL,
                target_json LONGTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_article_exam_tips_article (law_article_id),
                CONSTRAINT fk_article_exam_tips_article FOREIGN KEY (law_article_id) REFERENCES law_articles(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS law_section_editorials (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                law_id BIGINT UNSIGNED NOT NULL,
                section_id BIGINT UNSIGNED NOT NULL,
                section_title VARCHAR(255) NOT NULL,
                range_label VARCHAR(120) NOT NULL,
                from_article VARCHAR(60) NULL,
                to_article VARCHAR(60) NULL,
                article_count INT UNSIGNED NOT NULL DEFAULT 0,
                summary LONGTEXT NULL,
                importance VARCHAR(20) NULL,
                style VARCHAR(60) NULL,
                blocks_json LONGTEXT NULL,
                keywords_json LONGTEXT NULL,
                avoid_repetition_note TEXT NULL,
                exam_focus_json LONGTEXT NULL,
                macetes_json LONGTEXT NULL,
                doctrine_json LONGTEXT NULL,
                jurisprudence_json LONGTEXT NULL,
                sumulas_json LONGTEXT NULL,
                highlights_json LONGTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_law_section_editorial_section (law_id, section_id),
                INDEX idx_law_section_editorials_law (law_id),
                INDEX idx_law_section_editorials_section (section_id),
                CONSTRAINT fk_law_section_editorials_law FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE,
                CONSTRAINT fk_law_section_editorials_section FOREIGN KEY (section_id) REFERENCES law_sections(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS legal_user_favorites (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(80) NOT NULL,
                target_type VARCHAR(40) NOT NULL,
                target_id VARCHAR(80) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_legal_favorite (user_id, target_type, target_id),
                INDEX idx_legal_favorites_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS legal_user_comments (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                law_article_id BIGINT UNSIGNED NOT NULL,
                user_id VARCHAR(80) NOT NULL,
                user_name VARCHAR(180) NOT NULL,
                body LONGTEXT NOT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'visible',
                moderation_status VARCHAR(20) NOT NULL DEFAULT 'approved',
                reported_count INT UNSIGNED NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NULL,
                moderated_at DATETIME NULL,
                moderated_by VARCHAR(80) NULL,
                INDEX idx_legal_comments_article (law_article_id, status, moderation_status),
                INDEX idx_legal_comments_user (user_id),
                CONSTRAINT fk_legal_user_comments_article FOREIGN KEY (law_article_id) REFERENCES law_articles(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS legal_comment_reports (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                comment_id BIGINT UNSIGNED NOT NULL,
                user_id VARCHAR(80) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_legal_comment_reporter (comment_id, user_id),
                INDEX idx_legal_comment_reports_user (user_id, created_at),
                CONSTRAINT fk_legal_comment_reports_comment FOREIGN KEY (comment_id) REFERENCES legal_user_comments(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS legal_content_reactions (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                target_key VARCHAR(180) NOT NULL,
                user_id VARCHAR(80) NOT NULL,
                reaction_value ENUM('like', 'dislike') NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_legal_content_reaction (target_key, user_id),
                INDEX idx_legal_content_reactions_target (target_key),
                INDEX idx_legal_content_reactions_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS legal_user_progress (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(80) NOT NULL,
                law_id BIGINT UNSIGNED NOT NULL,
                viewed_article_ids_json LONGTEXT NULL,
                last_article_id VARCHAR(80) NULL,
                last_viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                progress_percent INT NOT NULL DEFAULT 0,
                UNIQUE KEY uniq_legal_progress (user_id, law_id),
                INDEX idx_legal_progress_user (user_id, last_viewed_at),
                CONSTRAINT fk_legal_user_progress_law FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS legal_user_notes (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(80) NOT NULL,
                law_id BIGINT UNSIGNED NOT NULL,
                law_article_id BIGINT UNSIGNED NOT NULL,
                body LONGTEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_legal_user_note (user_id, law_article_id),
                INDEX idx_legal_user_notes_user (user_id, updated_at),
                INDEX idx_legal_user_notes_law (law_id, law_article_id),
                CONSTRAINT fk_legal_user_notes_law FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE,
                CONSTRAINT fk_legal_user_notes_article FOREIGN KEY (law_article_id) REFERENCES law_articles(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS legal_user_reader_annotations (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(80) NOT NULL,
                law_id BIGINT UNSIGNED NOT NULL,
                law_section_id BIGINT UNSIGNED NOT NULL,
                markup_html LONGTEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_legal_user_reader_annotation (user_id, law_section_id),
                INDEX idx_legal_user_reader_annotations_user (user_id, updated_at),
                INDEX idx_legal_user_reader_annotations_law (law_id, law_section_id),
                CONSTRAINT fk_legal_user_reader_annotations_law FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE,
                CONSTRAINT fk_legal_user_reader_annotations_section FOREIGN KEY (law_section_id) REFERENCES law_sections(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS law_updates (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                law_id BIGINT UNSIGNED NOT NULL,
                law_article_id BIGINT UNSIGNED NULL,
                changed_at DATETIME NOT NULL,
                change_type VARCHAR(40) NOT NULL,
                title VARCHAR(255) NOT NULL,
                summary LONGTEXT NOT NULL,
                previous_text LONGTEXT NULL,
                current_text LONGTEXT NULL,
                source_url VARCHAR(500) NOT NULL,
                exam_impact LONGTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_law_updates_law (law_id, changed_at),
                CONSTRAINT fk_law_updates_law FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE,
                CONSTRAINT fk_law_updates_article FOREIGN KEY (law_article_id) REFERENCES law_articles(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS legal_sync_logs (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                law_id BIGINT UNSIGNED NULL,
                status VARCHAR(30) NOT NULL,
                started_at DATETIME NOT NULL,
                finished_at DATETIME NULL,
                source_url VARCHAR(500) NULL,
                message LONGTEXT NOT NULL,
                inserted_articles INT UNSIGNED NOT NULL DEFAULT 0,
                changed_articles INT UNSIGNED NOT NULL DEFAULT 0,
                revoked_articles INT UNSIGNED NOT NULL DEFAULT 0,
                INDEX idx_legal_sync_logs_law (law_id, started_at),
                CONSTRAINT fk_legal_sync_logs_law FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS sync_errors (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                sync_log_id BIGINT UNSIGNED NULL,
                law_id BIGINT UNSIGNED NULL,
                source_url VARCHAR(500) NULL,
                error_code VARCHAR(80) NULL,
                message LONGTEXT NOT NULL,
                context_json LONGTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_sync_errors_law (law_id, created_at),
                CONSTRAINT fk_sync_errors_log FOREIGN KEY (sync_log_id) REFERENCES legal_sync_logs(id) ON DELETE SET NULL,
                CONSTRAINT fk_sync_errors_law FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS legal_ai_batch_runs (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                law_id BIGINT UNSIGNED NOT NULL,
                triggered_by VARCHAR(80) NULL,
                requested_scope VARCHAR(40) NOT NULL DEFAULT 'article-full',
                status VARCHAR(20) NOT NULL DEFAULT 'running',
                total_articles INT UNSIGNED NOT NULL DEFAULT 0,
                processed_articles INT UNSIGNED NOT NULL DEFAULT 0,
                successful_articles INT UNSIGNED NOT NULL DEFAULT 0,
                failed_articles INT UNSIGNED NOT NULL DEFAULT 0,
                partial_articles INT UNSIGNED NOT NULL DEFAULT 0,
                last_error LONGTEXT NULL,
                started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                finished_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_legal_ai_batch_runs_law (law_id, started_at),
                CONSTRAINT fk_legal_ai_batch_runs_law FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS legal_ai_batch_items (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                batch_run_id BIGINT UNSIGNED NOT NULL,
                law_article_id BIGINT UNSIGNED NOT NULL,
                article_number VARCHAR(60) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                stage_a_status VARCHAR(20) NOT NULL DEFAULT 'pending',
                stage_b_status VARCHAR(20) NOT NULL DEFAULT 'pending',
                stage_c_status VARCHAR(20) NOT NULL DEFAULT 'pending',
                error_message LONGTEXT NULL,
                warnings_json LONGTEXT NULL,
                result_json LONGTEXT NULL,
                attempts_json LONGTEXT NULL,
                started_at DATETIME NULL,
                finished_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_legal_ai_batch_item (batch_run_id, law_article_id),
                INDEX idx_legal_ai_batch_items_run (batch_run_id, status),
                INDEX idx_legal_ai_batch_items_article (law_article_id),
                CONSTRAINT fk_legal_ai_batch_items_run FOREIGN KEY (batch_run_id) REFERENCES legal_ai_batch_runs(id) ON DELETE CASCADE,
                CONSTRAINT fk_legal_ai_batch_items_article FOREIGN KEY (law_article_id) REFERENCES law_articles(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->applySchemaCompatibilityMigration();
        $this->seedDefaultAreas();
        $this->normalizeInitialImportUpdateFlags();
    }

    private function applySchemaCompatibilityMigration(): void
    {
        $this->ensureLawPublishedAtDateTime();
        $this->ensureColumnExists('laws', 'last_imported_at', 'last_imported_at DATETIME NULL AFTER source_name');
        $this->ensureColumnExists('laws', 'sync_status', "sync_status VARCHAR(30) NOT NULL DEFAULT 'success' AFTER is_recently_updated");
        $this->ensureColumnExists('laws', 'sync_message', 'sync_message LONGTEXT NULL AFTER sync_status');
        $this->ensureColumnExists('laws', 'preamble', 'preamble LONGTEXT NULL AFTER summary');
        $this->ensureColumnExists('laws', 'law_topic_filter_id', 'law_topic_filter_id BIGINT UNSIGNED NULL AFTER legal_area_id');
        $this->ensureColumnExists('laws', 'created_by_user_id', 'created_by_user_id VARCHAR(64) NULL AFTER access_count');
        $this->ensureColumnExists('laws', 'updated_by_user_id', 'updated_by_user_id VARCHAR(64) NULL AFTER created_by_user_id');
        $this->ensureColumnExists('laws', 'published_by_user_id', 'published_by_user_id VARCHAR(64) NULL AFTER updated_by_user_id');
        $this->ensureColumnExists('law_articles', 'section_id', 'section_id BIGINT UNSIGNED NULL AFTER law_id');
        $this->ensureColumnExists('law_articles', 'assunto_filter_id', 'assunto_filter_id BIGINT UNSIGNED NULL AFTER related_question_count');
        $this->ensureColumnExists('law_articles', 'official_status', "official_status VARCHAR(30) NOT NULL DEFAULT 'active' AFTER is_recently_changed");
        $this->ensureColumnExists('law_articles', 'official_status_changed_at', 'official_status_changed_at DATETIME NULL AFTER official_status');
        $this->ensureColumnExists('law_section_editorials', 'section_id', 'section_id BIGINT UNSIGNED NULL AFTER law_id');
        $this->ensureColumnExists('article_sumulas', 'is_binding', 'is_binding TINYINT(1) NOT NULL DEFAULT 0 AFTER text');
        $this->ensureColumnExists('article_jurisprudence', 'target_json', 'target_json LONGTEXT NULL AFTER source_url');
        $this->ensureColumnExists('article_sumulas', 'target_json', 'target_json LONGTEXT NULL AFTER priority');
        $this->ensureColumnExists('article_exam_tips', 'target_json', 'target_json LONGTEXT NULL AFTER tags_json');
        $this->ensureColumnExists('teacher_comments', 'importance', 'importance VARCHAR(20) NULL AFTER body');
        $this->ensureColumnExists('teacher_comments', 'style', 'style VARCHAR(60) NULL AFTER importance');
        $this->ensureColumnExists('teacher_comments', 'rich_blocks_json', 'rich_blocks_json LONGTEXT NULL AFTER style');
        $this->ensureColumnExists('teacher_comments', 'keywords_json', 'keywords_json LONGTEXT NULL AFTER rich_blocks_json');
        $this->ensureColumnExists('teacher_comments', 'avoid_repetition_note', 'avoid_repetition_note TEXT NULL AFTER keywords_json');
        $this->ensureColumnExists('law_section_editorials', 'importance', 'importance VARCHAR(20) NULL AFTER summary');
        $this->ensureColumnExists('law_section_editorials', 'style', 'style VARCHAR(60) NULL AFTER importance');
        $this->ensureColumnExists('law_section_editorials', 'blocks_json', 'blocks_json LONGTEXT NULL AFTER style');
        $this->ensureColumnExists('law_section_editorials', 'keywords_json', 'keywords_json LONGTEXT NULL AFTER blocks_json');
        $this->ensureColumnExists('law_section_editorials', 'avoid_repetition_note', 'avoid_repetition_note TEXT NULL AFTER keywords_json');
        $this->ensureColumnExists('legal_user_comments', 'parent_comment_id', 'parent_comment_id BIGINT UNSIGNED NULL AFTER law_article_id');
        $this->ensureColumnExists('filters', 'taxonomy_level', "taxonomy_level VARCHAR(20) NULL AFTER meta_materia");
        $this->copyArticleAssuntoFromLegacyTopicColumn();
        $this->ensureIndexExists('law_articles', 'idx_law_articles_assunto', 'CREATE INDEX idx_law_articles_assunto ON law_articles (assunto_filter_id)');
        $this->ensureIndexExists('law_articles', 'idx_law_articles_official_status', 'CREATE INDEX idx_law_articles_official_status ON law_articles (law_id, official_status)');
        $this->ensureLegalContentReactionUniquenessWithoutDeletion();
    }

    private function ensureLawPublishedAtDateTime(): void
    {
        $stmt = $this->db->prepare("SHOW COLUMNS FROM laws LIKE 'published_at'");
        $stmt->execute();
        $column = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$column) {
            return;
        }

        $type = strtolower((string) ($column['Type'] ?? ''));
        if ($type === 'date') {
            $this->db->exec('ALTER TABLE laws MODIFY COLUMN published_at DATETIME NULL');
        }
    }

    private function ensureColumnExists(string $table, string $column, string $definition): void
    {
        $allowedTables = [
            'laws',
            'law_articles',
            'article_sumulas',
            'teacher_comments',
            'legal_user_comments',
            'law_section_editorials',
            'filters',
            'article_jurisprudence',
            'article_exam_tips',
        ];
        if (!in_array($table, $allowedTables, true)) {
            return;
        }

        $stmt = $this->db->prepare("SHOW COLUMNS FROM {$table} LIKE :column");
        $stmt->execute([':column' => $column]);

        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
            $this->db->exec("ALTER TABLE {$table} ADD COLUMN {$definition}");
        }
    }

    private function ensureIndexExists(string $table, string $indexName, string $createSql): void
    {
        $allowedTables = ['law_articles', 'law_section_editorials', 'legal_content_reactions'];
        $allowedIndexes = [
            'idx_law_articles_assunto',
            'idx_law_articles_official_status',
            'uniq_law_section_editorial_section',
            'uniq_legal_content_reaction',
        ];
        if (!in_array($table, $allowedTables, true) || !in_array($indexName, $allowedIndexes, true)) {
            return;
        }

        $stmt = $this->db->prepare("SHOW INDEX FROM {$table} WHERE Key_name = :index_name");
        $stmt->execute([':index_name' => $indexName]);

        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
            $this->db->exec($createSql);
        }
    }

    private function ensureLegalContentReactionUniquenessWithoutDeletion(): void
    {
        $duplicates = (int) $this->db->query(
            'SELECT COUNT(*)
             FROM (
                SELECT target_key, user_id
                FROM legal_content_reactions
                GROUP BY target_key, user_id
                HAVING COUNT(*) > 1
             ) duplicate_pairs'
        )->fetchColumn();

        if ($duplicates > 0) {
            return;
        }

        $this->ensureIndexExists(
            'legal_content_reactions',
            'uniq_legal_content_reaction',
            'CREATE UNIQUE INDEX uniq_legal_content_reaction ON legal_content_reactions (target_key, user_id)'
        );
    }

    private function copyArticleAssuntoFromLegacyTopicColumn(): void
    {
        $hasAssunto = $this->columnExists('law_articles', 'assunto_filter_id');
        $hasLegacyTopic = $this->columnExists('law_articles', 'topic_filter_id');
        if (!$hasAssunto || !$hasLegacyTopic) {
            return;
        }

        $this->db->exec(
            'UPDATE law_articles
             SET assunto_filter_id = topic_filter_id
             WHERE assunto_filter_id IS NULL AND topic_filter_id IS NOT NULL'
        );
    }

    private function columnExists(string $table, string $column): bool
    {
        $allowedTables = ['law_articles', 'law_section_editorials'];
        if (!in_array($table, $allowedTables, true)) {
            return false;
        }

        $stmt = $this->db->prepare("SHOW COLUMNS FROM {$table} LIKE :column");
        $stmt->execute([':column' => $column]);
        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function seedDefaultAreas(): void
    {
        $areas = [
            ['constitucional', 'Constitucional', 'Constituicao, direitos fundamentais e organizacao do Estado.', 'Scale', 'text-indigo-600', 10],
            ['penal', 'Penal', 'Crimes, penas e teoria geral aplicada a concursos.', 'Gavel', 'text-rose-600', 20],
            ['administrativo', 'Administrativo', 'Administracao publica, servidores, licitacoes e improbidade.', 'Landmark', 'text-sky-600', 30],
            ['civil', 'Civil', 'Parte geral, obrigacoes, contratos, familia e sucessoes.', 'BookOpen', 'text-emerald-600', 40],
            ['tributario', 'Tributario', 'Sistema tributario, CTN, impostos e processo tributario.', 'Receipt', 'text-amber-600', 50],
            ['processual', 'Processual', 'Processo civil e normas gerais de procedimento.', 'FileText', 'text-violet-600', 60],
            ['processual-penal', 'Processual Penal', 'Inquerito, acao penal, provas, prisao e procedimentos.', 'Shield', 'text-red-600', 70],
            ['legislacao-especial', 'Legislacao Especial', 'Leis especiais recorrentes em editais.', 'Library', 'text-slate-600', 80],
            ['direitos-humanos', 'Direitos Humanos', 'Tratados, garantias fundamentais e sistemas de protecao.', 'HeartHandshake', 'text-pink-600', 90],
            ['trabalho', 'Trabalho', 'Direito material e processual do trabalho.', 'Briefcase', 'text-cyan-600', 100],
            ['ambiental', 'Ambiental', 'Normas ambientais e responsabilidade.', 'Leaf', 'text-green-600', 110],
            ['eleitoral', 'Eleitoral', 'Eleicoes, partidos e justica eleitoral.', 'Vote', 'text-blue-600', 120],
        ];

        $stmt = $this->db->prepare(
            "INSERT IGNORE INTO legal_areas (slug, name, description, icon_name, icon_tone, sort_order)
             VALUES (:slug, :name, :description, :icon_name, :icon_tone, :sort_order)
            "
        );

        foreach ($areas as $area) {
            $stmt->execute([
                ':slug' => $area[0],
                ':name' => $area[1],
                ':description' => $area[2],
                ':icon_name' => $area[3],
                ':icon_tone' => $area[4],
                ':sort_order' => $area[5],
            ]);
        }
    }

    private function normalizeInitialImportUpdateFlags(): void
    {
        $this->db->exec(
            "UPDATE laws l
             LEFT JOIN (
                SELECT law_id, SUM(CASE WHEN version_number > 1 THEN 1 ELSE 0 END) AS tracked_updates
                FROM law_versions
                GROUP BY law_id
             ) v ON v.law_id = l.id
             SET l.is_recently_updated = 0,
                 l.last_updated_at = NULL
             WHERE l.is_recently_updated = 1
               AND COALESCE(v.tracked_updates, 0) = 0"
        );
    }

}
