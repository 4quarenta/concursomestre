<?php

declare(strict_types=1);

/**
 * Plataforma editorial do blog publico.
 *
 * Rollback documentado em:
 * backend/database/rollbacks/20260723_010000_blog_content_platform.sql
 */
return static function (PDO $db): void {
    $columnType = static function (string $table, string $column) use ($db): ?string {
        $stmt = $db->prepare(
            'SELECT COLUMN_TYPE FROM information_schema.COLUMNS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND COLUMN_NAME = :column_name'
        );
        $stmt->execute([':table_name' => $table, ':column_name' => $column]);
        $value = $stmt->fetchColumn();
        return is_string($value) ? $value : null;
    };
    $indexExists = static function (string $table, string $index) use ($db): bool {
        $stmt = $db->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name AND INDEX_NAME = :index_name'
        );
        $stmt->execute([':table_name' => $table, ':index_name' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    };

    $db->exec(
        "CREATE TABLE IF NOT EXISTS blog_categories (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            slug VARCHAR(140) NOT NULL,
            description VARCHAR(500) NULL,
            image_url VARCHAR(1000) NULL,
            seo_title VARCHAR(180) NULL,
            seo_description VARCHAR(320) NULL,
            created_by VARCHAR(64) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_blog_categories_slug (slug),
            INDEX idx_blog_categories_name (name, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS blog_tags (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            slug VARCHAR(120) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_blog_tags_slug (slug),
            INDEX idx_blog_tags_name (name, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS blog_articles (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            author_id VARCHAR(64) NOT NULL,
            author_name VARCHAR(120) NOT NULL,
            author_role VARCHAR(32) NOT NULL,
            category_id BIGINT UNSIGNED NOT NULL,
            title VARCHAR(220) NOT NULL,
            slug VARCHAR(240) NOT NULL,
            excerpt VARCHAR(600) NOT NULL,
            body_html LONGTEXT NOT NULL,
            body_text LONGTEXT NOT NULL,
            reading_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 1,
            cover_image_url VARCHAR(1000) NOT NULL,
            cover_image_alt VARCHAR(255) NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'draft',
            featured TINYINT(1) NOT NULL DEFAULT 0,
            allow_comments TINYINT(1) NOT NULL DEFAULT 1,
            source_name VARCHAR(180) NULL,
            source_url VARCHAR(1000) NULL,
            seo_title VARCHAR(180) NULL,
            seo_description VARCHAR(320) NULL,
            canonical_url VARCHAR(1000) NULL,
            scheduled_at DATETIME NULL,
            published_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            deleted_at DATETIME NULL,
            UNIQUE KEY uq_blog_articles_slug (slug),
            INDEX idx_blog_articles_public (status, published_at, id),
            INDEX idx_blog_articles_category_public (category_id, status, published_at, id),
            INDEX idx_blog_articles_author_public (author_id, status, published_at, id),
            INDEX idx_blog_articles_featured (featured, status, published_at, id),
            CONSTRAINT fk_blog_articles_category
                FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS blog_article_tags (
            article_id BIGINT UNSIGNED NOT NULL,
            tag_id BIGINT UNSIGNED NOT NULL,
            PRIMARY KEY (article_id, tag_id),
            INDEX idx_blog_article_tags_tag (tag_id, article_id),
            CONSTRAINT fk_blog_article_tags_article
                FOREIGN KEY (article_id) REFERENCES blog_articles(id) ON DELETE CASCADE,
            CONSTRAINT fk_blog_article_tags_tag
                FOREIGN KEY (tag_id) REFERENCES blog_tags(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS blog_article_likes (
            article_id BIGINT UNSIGNED NOT NULL,
            user_id VARCHAR(64) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (article_id, user_id),
            INDEX idx_blog_article_likes_user (user_id, created_at, article_id),
            CONSTRAINT fk_blog_article_likes_article
                FOREIGN KEY (article_id) REFERENCES blog_articles(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $targetType = strtolower((string) ($columnType('comments', 'target_type') ?? ''));
    if ($targetType !== '' && !str_starts_with($targetType, 'varchar')) {
        $db->exec("ALTER TABLE comments MODIFY target_type VARCHAR(40) NOT NULL");
    }
    if (!$indexExists('comments', 'idx_comments_target_moderation_created')) {
        $db->exec(
            'CREATE INDEX idx_comments_target_moderation_created '
            . 'ON comments (target_type, target_id, moderation_status, created_at, id)'
        );
    }
};
