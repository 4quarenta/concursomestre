<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../shared/pagination/SignedKeysetCursor.php';

final class BlogRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function listPublic(array $filters, ?string $viewerUserId): array
    {
        $limit = (int) $filters['limit'];
        $cursor = SignedKeysetCursor::decodePayload($filters['cursor'] ?? null, 'blog.public');
        $conditions = [
            "a.deleted_at IS NULL",
            "a.status IN ('published', 'scheduled')",
            'a.published_at IS NOT NULL',
            'a.published_at <= NOW()',
        ];
        $params = [
            ':viewer_user_id_empty' => $viewerUserId ?? '',
            ':viewer_user_id_exists' => $viewerUserId ?? '',
        ];
        if (!empty($filters['categorySlug'])) {
            $conditions[] = 'c.slug = :category_slug';
            $params[':category_slug'] = $filters['categorySlug'];
        }
        if (!empty($filters['authorId'])) {
            $conditions[] = 'a.author_id = :author_id';
            $params[':author_id'] = $filters['authorId'];
        }
        if (!empty($filters['featured'])) {
            $conditions[] = 'a.featured = 1';
        }
        if (is_array($cursor)) {
            $conditions[] = '(a.published_at < :cursor_published_at OR (a.published_at = :cursor_published_at AND a.id < :cursor_id))';
            $params[':cursor_published_at'] = (string) ($cursor['publishedAt'] ?? '');
            $params[':cursor_id'] = (int) ($cursor['id'] ?? 0);
        }

        $sql = $this->articleSelect()
            . ' WHERE ' . implode(' AND ', $conditions)
            . ' ORDER BY a.published_at DESC, a.id DESC LIMIT ' . ($limit + 1);
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $hasMore = count($rows) > $limit;
        if ($hasMore) {
            $rows = array_slice($rows, 0, $limit);
        }
        $items = $this->hydrateArticles($rows);
        $last = $rows !== [] ? $rows[count($rows) - 1] : null;

        return [
            'items' => $items,
            'pageInfo' => [
                'limit' => $limit,
                'hasMore' => $hasMore,
                'nextCursor' => $hasMore && is_array($last)
                    ? SignedKeysetCursor::encodePayload([
                        'publishedAt' => (string) $last['published_at'],
                        'id' => (string) $last['id'],
                    ], 'blog.public')
                    : null,
            ],
        ];
    }

    public function findPublicBySlug(string $slug, ?string $viewerUserId): ?array
    {
        $stmt = $this->db->prepare(
            $this->articleSelect()
            . " WHERE a.slug = :slug
                AND a.deleted_at IS NULL
                AND a.status IN ('published', 'scheduled')
                AND a.published_at IS NOT NULL
                AND a.published_at <= NOW()
              LIMIT 1"
        );
        $stmt->execute([
            ':slug' => $slug,
            ':viewer_user_id_empty' => $viewerUserId ?? '',
            ':viewer_user_id_exists' => $viewerUserId ?? '',
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return null;
        }
        return $this->hydrateArticles([$row], true)[0] ?? null;
    }

    public function listCategories(bool $publicOnly = true): array
    {
        $having = $publicOnly ? ' HAVING COUNT(a.id) > 0' : '';
        $stmt = $this->db->query(
            "SELECT c.id, c.name, c.slug, c.description, c.image_url,
                    COUNT(a.id) AS article_count
             FROM blog_categories c
             LEFT JOIN blog_articles a
               ON a.category_id = c.id
              AND a.deleted_at IS NULL
              AND a.status IN ('published', 'scheduled')
              AND a.published_at IS NOT NULL
              AND a.published_at <= NOW()
             GROUP BY c.id
             {$having}
             ORDER BY c.name ASC, c.id ASC"
        );
        return array_map(
            static fn (array $row): array => [
                'id' => (int) $row['id'],
                'name' => (string) $row['name'],
                'slug' => (string) $row['slug'],
                'description' => $row['description'] ?: null,
                'imageUrl' => $row['image_url'] ?: null,
                'articleCount' => (int) $row['article_count'],
            ],
            $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []
        );
    }

    public function listAdmin(array $filters): array
    {
        $limit = (int) $filters['limit'];
        $cursor = SignedKeysetCursor::decodePayload($filters['cursor'] ?? null, 'blog.admin');
        $conditions = ['a.deleted_at IS NULL'];
        $params = [':viewer_user_id_empty' => '', ':viewer_user_id_exists' => ''];
        if (!empty($filters['status'])) {
            $conditions[] = 'a.status = :status';
            $params[':status'] = $filters['status'];
        }
        if (!empty($filters['search'])) {
            $conditions[] = '(a.title LIKE :search OR a.excerpt LIKE :search)';
            $params[':search'] = '%' . $filters['search'] . '%';
        }
        if (is_array($cursor)) {
            $conditions[] = '(a.updated_at < :cursor_updated_at OR (a.updated_at = :cursor_updated_at AND a.id < :cursor_id))';
            $params[':cursor_updated_at'] = (string) ($cursor['updatedAt'] ?? '');
            $params[':cursor_id'] = (int) ($cursor['id'] ?? 0);
        }
        $stmt = $this->db->prepare(
            $this->articleSelect()
            . ' WHERE ' . implode(' AND ', $conditions)
            . ' ORDER BY a.updated_at DESC, a.id DESC LIMIT ' . ($limit + 1)
        );
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $hasMore = count($rows) > $limit;
        if ($hasMore) {
            $rows = array_slice($rows, 0, $limit);
        }
        $last = $rows !== [] ? $rows[count($rows) - 1] : null;
        return [
            'items' => $this->hydrateArticles($rows),
            'pageInfo' => [
                'limit' => $limit,
                'hasMore' => $hasMore,
                'nextCursor' => $hasMore && is_array($last)
                    ? SignedKeysetCursor::encodePayload([
                        'updatedAt' => (string) $last['updated_at'],
                        'id' => (string) $last['id'],
                    ], 'blog.admin')
                    : null,
            ],
        ];
    }

    public function findAdminById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            $this->articleSelect()
            . ' WHERE a.id = :id AND a.deleted_at IS NULL LIMIT 1'
        );
        $stmt->execute([
            ':id' => $id,
            ':viewer_user_id_empty' => '',
            ':viewer_user_id_exists' => '',
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? ($this->hydrateArticles([$row], true)[0] ?? null) : null;
    }

    public function findAuthorIdentity(string $authorId): ?array
    {
        $stmt = $this->db->prepare('SELECT name, role FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $authorId]);
        $author = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($author) ? $author : null;
    }

    public function save(
        array $article,
        string $authorId,
        string $authorName,
        string $authorRole
    ): array
    {
        $this->db->beginTransaction();
        try {
            $categoryId = $article['categoryId'] ?? null;
            if (!$categoryId) {
                $categoryId = $this->upsertCategory((string) $article['categoryName'], $authorId);
            }

            $publishedAt = null;
            if ($article['status'] === 'published') {
                $publishedAt = $article['id'] ? $this->currentPublishedAt((int) $article['id']) : null;
                $publishedAt = $publishedAt ?: gmdate('Y-m-d H:i:s');
            }
            if ($article['status'] === 'scheduled') {
                $publishedAt = $article['scheduledAt'];
            }

            $params = [
                ':author_id' => $authorId,
                ':author_name' => $authorName,
                ':author_role' => $authorRole,
                ':category_id' => $categoryId,
                ':title' => $article['title'],
                ':slug' => $article['slug'],
                ':excerpt' => $article['excerpt'],
                ':body_html' => $article['bodyHtml'],
                ':body_text' => $article['bodyText'],
                ':reading_minutes' => $article['readingMinutes'],
                ':cover_image_url' => $article['coverImageUrl'],
                ':cover_image_alt' => $article['coverImageAlt'],
                ':status' => $article['status'],
                ':featured' => $article['featured'] ? 1 : 0,
                ':allow_comments' => $article['allowComments'] ? 1 : 0,
                ':source_name' => $article['sourceName'],
                ':source_url' => $article['sourceUrl'],
                ':seo_title' => $article['seoTitle'],
                ':seo_description' => $article['seoDescription'],
                ':canonical_url' => $article['canonicalUrl'],
                ':scheduled_at' => $article['scheduledAt'],
                ':published_at' => $publishedAt,
            ];

            if ($article['id']) {
                $params[':id'] = $article['id'];
                $stmt = $this->db->prepare(
                    "UPDATE blog_articles SET
                        category_id = :category_id,
                        title = :title,
                        slug = :slug,
                        excerpt = :excerpt,
                        body_html = :body_html,
                        body_text = :body_text,
                        reading_minutes = :reading_minutes,
                        cover_image_url = :cover_image_url,
                        cover_image_alt = :cover_image_alt,
                        status = :status,
                        featured = :featured,
                        allow_comments = :allow_comments,
                        source_name = :source_name,
                        source_url = :source_url,
                        seo_title = :seo_title,
                        seo_description = :seo_description,
                        canonical_url = :canonical_url,
                        scheduled_at = :scheduled_at,
                        published_at = :published_at,
                        updated_at = NOW()
                     WHERE id = :id AND deleted_at IS NULL"
                );
                unset($params[':author_id'], $params[':author_name'], $params[':author_role']);
                $stmt->execute($params);
                $articleId = (int) $article['id'];
            } else {
                $stmt = $this->db->prepare(
                    "INSERT INTO blog_articles (
                        author_id, author_name, author_role, category_id,
                        title, slug, excerpt, body_html, body_text, reading_minutes,
                        cover_image_url, cover_image_alt, status, featured, allow_comments,
                        source_name, source_url, seo_title, seo_description, canonical_url,
                        scheduled_at, published_at
                    ) VALUES (
                        :author_id, :author_name, :author_role, :category_id,
                        :title, :slug, :excerpt, :body_html, :body_text, :reading_minutes,
                        :cover_image_url, :cover_image_alt, :status, :featured, :allow_comments,
                        :source_name, :source_url, :seo_title, :seo_description, :canonical_url,
                        :scheduled_at, :published_at
                    )"
                );
                $stmt->execute($params);
                $articleId = (int) $this->db->lastInsertId();
            }

            $this->syncTags($articleId, $article['tags']);
            $this->db->commit();
            return $this->findAdminById($articleId) ?? ['id' => $articleId];
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    public function archive(int $id): bool
    {
        $stmt = $this->db->prepare(
            "UPDATE blog_articles
             SET status = 'archived', deleted_at = NOW(), updated_at = NOW()
             WHERE id = :id AND deleted_at IS NULL"
        );
        $stmt->execute([':id' => $id]);
        return $stmt->rowCount() > 0;
    }

    public function toggleLike(int $articleId, string $userId): array
    {
        $existsStmt = $this->db->prepare(
            'SELECT 1 FROM blog_article_likes WHERE article_id = :article_id AND user_id = :user_id LIMIT 1'
        );
        $existsStmt->execute([':article_id' => $articleId, ':user_id' => $userId]);
        $liked = (bool) $existsStmt->fetchColumn();
        if ($liked) {
            $stmt = $this->db->prepare(
                'DELETE FROM blog_article_likes WHERE article_id = :article_id AND user_id = :user_id'
            );
            $stmt->execute([':article_id' => $articleId, ':user_id' => $userId]);
        } else {
            $stmt = $this->db->prepare(
                'INSERT IGNORE INTO blog_article_likes (article_id, user_id) VALUES (:article_id, :user_id)'
            );
            $stmt->execute([':article_id' => $articleId, ':user_id' => $userId]);
        }
        $countStmt = $this->db->prepare('SELECT COUNT(*) FROM blog_article_likes WHERE article_id = :article_id');
        $countStmt->execute([':article_id' => $articleId]);
        return ['liked' => !$liked, 'likesCount' => (int) $countStmt->fetchColumn()];
    }

    public function articleIsPublic(int $articleId): bool
    {
        $stmt = $this->db->prepare(
            "SELECT 1 FROM blog_articles
             WHERE id = :id AND deleted_at IS NULL AND status IN ('published', 'scheduled')
               AND published_at IS NOT NULL AND published_at <= NOW()
             LIMIT 1"
        );
        $stmt->execute([':id' => $articleId]);
        return (bool) $stmt->fetchColumn();
    }

    public function createCategory(array $category, string $userId): array
    {
        $stmt = $this->db->prepare(
            "INSERT INTO blog_categories (name, slug, description, created_by)
             VALUES (:name, :slug, :description, :created_by)
             ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), updated_at = NOW()"
        );
        $stmt->execute([
            ':name' => $category['name'],
            ':slug' => $category['slug'],
            ':description' => $category['description'],
            ':created_by' => $userId,
        ]);
        $find = $this->db->prepare(
            'SELECT id, name, slug, description, image_url FROM blog_categories WHERE slug = :slug LIMIT 1'
        );
        $find->execute([':slug' => $category['slug']]);
        return $find->fetch(PDO::FETCH_ASSOC) ?: [];
    }

    private function articleSelect(): string
    {
        return "SELECT
                    a.*,
                    c.name AS category_name,
                    c.slug AS category_slug,
                    COALESCE(NULLIF(u.name, ''), a.author_name) AS resolved_author_name,
                    u.photo_url AS author_avatar_url,
                    COALESCE(NULLIF(u.role, ''), a.author_role) AS resolved_author_role,
                    (SELECT COUNT(*) FROM blog_article_likes bl WHERE bl.article_id = a.id) AS likes_count,
                    (SELECT COUNT(*) FROM comments cm
                     WHERE cm.target_type = 'blog_article'
                       AND cm.target_id = CAST(a.id AS CHAR)
                       AND cm.moderation_status = 'approved') AS comments_count,
                    CASE WHEN :viewer_user_id_empty = '' THEN 0 ELSE EXISTS(
                        SELECT 1 FROM blog_article_likes vl
                        WHERE vl.article_id = a.id AND vl.user_id = :viewer_user_id_exists
                    ) END AS is_liked
                FROM blog_articles a
                INNER JOIN blog_categories c ON c.id = a.category_id
                LEFT JOIN users u ON u.id = a.author_id";
    }

    private function hydrateArticles(array $rows, bool $includeBody = false): array
    {
        if ($rows === []) {
            return [];
        }
        $ids = array_map(static fn (array $row): int => (int) $row['id'], $rows);
        $tags = $this->tagsForArticles($ids);
        return array_map(static function (array $row) use ($tags, $includeBody): array {
            $id = (int) $row['id'];
            $article = [
                'id' => $id,
                'title' => (string) $row['title'],
                'slug' => (string) $row['slug'],
                'excerpt' => (string) $row['excerpt'],
                'readingMinutes' => max(1, (int) $row['reading_minutes']),
                'coverImageUrl' => (string) $row['cover_image_url'],
                'coverImageAlt' => (string) $row['cover_image_alt'],
                'status' => (string) $row['status'],
                'featured' => (bool) $row['featured'],
                'allowComments' => (bool) $row['allow_comments'],
                'sourceName' => $row['source_name'] ?: null,
                'sourceUrl' => $row['source_url'] ?: null,
                'seoTitle' => $row['seo_title'] ?: null,
                'seoDescription' => $row['seo_description'] ?: null,
                'canonicalUrl' => $row['canonical_url'] ?: null,
                'scheduledAt' => self::isoDate($row['scheduled_at'] ?? null),
                'publishedAt' => self::isoDate($row['published_at'] ?? null),
                'createdAt' => self::isoDate($row['created_at'] ?? null),
                'updatedAt' => self::isoDate($row['updated_at'] ?? null),
                'category' => [
                    'id' => (int) $row['category_id'],
                    'name' => (string) $row['category_name'],
                    'slug' => (string) $row['category_slug'],
                ],
                'author' => [
                    'id' => (string) $row['author_id'],
                    'name' => (string) $row['resolved_author_name'],
                    'avatarUrl' => $row['author_avatar_url'] ?: null,
                    'role' => (string) $row['resolved_author_role'],
                ],
                'tags' => $tags[$id] ?? [],
                'engagement' => [
                    'likesCount' => (int) $row['likes_count'],
                    'commentsCount' => (int) $row['comments_count'],
                    'isLiked' => (bool) $row['is_liked'],
                ],
            ];
            if ($includeBody) {
                $article['bodyHtml'] = (string) $row['body_html'];
                $article['bodyText'] = (string) $row['body_text'];
            }
            return $article;
        }, $rows);
    }

    private function tagsForArticles(array $ids): array
    {
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->db->prepare(
            "SELECT bat.article_id, t.id, t.name, t.slug
             FROM blog_article_tags bat
             INNER JOIN blog_tags t ON t.id = bat.tag_id
             WHERE bat.article_id IN ({$placeholders})
             ORDER BY t.name ASC"
        );
        $stmt->execute($ids);
        $grouped = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $grouped[(int) $row['article_id']][] = [
                'id' => (int) $row['id'],
                'name' => (string) $row['name'],
                'slug' => (string) $row['slug'],
            ];
        }
        return $grouped;
    }

    private function upsertCategory(string $name, string $authorId): int
    {
        $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name);
        $slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower((string) ($converted ?: $name))) ?? '', '-');
        $category = $this->createCategory([
            'name' => $name,
            'slug' => $slug,
            'description' => null,
        ], $authorId);
        return (int) ($category['id'] ?? 0);
    }

    private function syncTags(int $articleId, array $tagNames): void
    {
        $this->db->prepare('DELETE FROM blog_article_tags WHERE article_id = :article_id')
            ->execute([':article_id' => $articleId]);
        foreach ($tagNames as $name) {
            $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name);
            $slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower((string) ($converted ?: $name))) ?? '', '-');
            $this->db->prepare(
                'INSERT INTO blog_tags (name, slug) VALUES (:name, :slug) '
                . 'ON DUPLICATE KEY UPDATE name = VALUES(name)'
            )->execute([':name' => $name, ':slug' => $slug]);
            $tagIdStmt = $this->db->prepare('SELECT id FROM blog_tags WHERE slug = :slug LIMIT 1');
            $tagIdStmt->execute([':slug' => $slug]);
            $tagId = (int) $tagIdStmt->fetchColumn();
            if ($tagId > 0) {
                $this->db->prepare(
                    'INSERT IGNORE INTO blog_article_tags (article_id, tag_id) VALUES (:article_id, :tag_id)'
                )->execute([':article_id' => $articleId, ':tag_id' => $tagId]);
            }
        }
    }

    private function currentPublishedAt(int $articleId): ?string
    {
        $stmt = $this->db->prepare('SELECT published_at FROM blog_articles WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $articleId]);
        $value = $stmt->fetchColumn();
        return is_string($value) && $value !== '' ? $value : null;
    }

    private static function isoDate(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));
        if ($normalized === '') {
            return null;
        }
        $hasTimezone = preg_match('/(?:Z|[+-]\d{2}:?\d{2})$/', $normalized) === 1;
        $timestamp = strtotime($normalized . ($hasTimezone ? '' : ' UTC'));
        return $timestamp !== false ? gmdate('c', $timestamp) : null;
    }
}
