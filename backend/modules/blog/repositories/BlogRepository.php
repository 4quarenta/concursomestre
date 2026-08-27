<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../shared/pagination/SignedKeysetCursor.php';
require_once __DIR__ . '/../../seo/sitemaps/StaticSitemapMutationInvalidator.php';

final class BlogRepository
{
    private const DEFAULT_COVER_IMAGE = '/blog/default-cover.webp';
    private const DEFAULT_COVER_ALT = 'Caderno de estudos e notícias do ConcursoMestre.';

    public function __construct(private readonly PDO $db)
    {
    }

    public function listPublic(array $filters, ?string $viewerUserId): array
    {
        $limit = (int) $filters['limit'];
        $cursor = self::decodePublicCursor($filters['cursor'] ?? null);
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
        if (!empty($filters['tagSlug'])) {
            $conditions[] = 'EXISTS ('
                . 'SELECT 1 FROM blog_article_tags bat_filter '
                . 'INNER JOIN blog_tags t_filter ON t_filter.id = bat_filter.tag_id '
                . 'WHERE bat_filter.article_id = a.id AND t_filter.slug = :tag_slug)';
            $params[':tag_slug'] = $filters['tagSlug'];
        }
        if (!empty($filters['authorId'])) {
            $conditions[] = 'a.author_id = :author_id';
            $params[':author_id'] = $filters['authorId'];
        }
        if (!empty($filters['featured'])) {
            $conditions[] = 'a.featured = 1';
        }
        if (!empty($filters['search'])) {
            $search = '%' . $filters['search'] . '%';
            $conditions[] = '(a.title LIKE :public_search_title OR a.excerpt LIKE :public_search_excerpt OR a.body_text LIKE :public_search_body)';
            $params[':public_search_title'] = $search;
            $params[':public_search_excerpt'] = $search;
            $params[':public_search_body'] = $search;
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
                'label' => (string) $row['name'],
                'slug' => (string) $row['slug'],
                'description' => $row['description'] ?: null,
                'imageUrl' => $row['image_url'] ?: null,
                'articleCount' => (int) $row['article_count'],
            ],
            $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []
        );
    }

    public function listTags(bool $publicOnly = true): array
    {
        $having = $publicOnly ? ' HAVING COUNT(DISTINCT a.id) > 0' : '';
        $stmt = $this->db->query(
            "SELECT t.id, t.name, t.slug, t.kind, t.description, t.image_url,
                    COUNT(DISTINCT a.id) AS article_count
             FROM blog_tags t
             LEFT JOIN blog_article_tags bat ON bat.tag_id = t.id
             LEFT JOIN blog_articles a
               ON a.id = bat.article_id
              AND a.deleted_at IS NULL
              AND a.status IN ('published', 'scheduled')
              AND a.published_at IS NOT NULL
              AND a.published_at <= NOW()
             GROUP BY t.id
             {$having}
             ORDER BY t.kind ASC, t.name ASC, t.id ASC"
        );
        return array_map(
            static fn (array $row): array => [
                'id' => (int) $row['id'],
                'label' => (string) $row['name'],
                'slug' => (string) $row['slug'],
                'kind' => (string) ($row['kind'] ?: 'general'),
                'description' => $row['description'] ?: null,
                'imageUrl' => $row['image_url'] ?: null,
                'articleCount' => (int) $row['article_count'],
            ],
            $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []
        );
    }

    public function findPublicTaxonomyBySlug(string $type, string $slug): ?array
    {
        if ($type === 'category') {
            $stmt = $this->db->prepare(
                "SELECT c.id, c.name, c.slug, c.description, c.image_url,
                        COUNT(a.id) AS article_count,
                        MAX(a.published_at) AS last_published_at
                 FROM blog_categories c
                 LEFT JOIN blog_articles a
                   ON a.category_id = c.id
                  AND a.deleted_at IS NULL
                  AND a.status IN ('published', 'scheduled')
                  AND a.published_at IS NOT NULL
                  AND a.published_at <= NOW()
                 WHERE c.slug = :slug
                 GROUP BY c.id, c.name, c.slug, c.description, c.image_url
                 LIMIT 1"
            );
        } elseif ($type === 'tag') {
            $stmt = $this->db->prepare(
                "SELECT t.id, t.name, t.slug, t.kind, t.description, t.image_url,
                        COUNT(DISTINCT a.id) AS article_count,
                        MAX(a.published_at) AS last_published_at
                 FROM blog_tags t
                 LEFT JOIN blog_article_tags bat ON bat.tag_id = t.id
                 LEFT JOIN blog_articles a
                   ON a.id = bat.article_id
                  AND a.deleted_at IS NULL
                  AND a.status IN ('published', 'scheduled')
                  AND a.published_at IS NOT NULL
                  AND a.published_at <= NOW()
                 WHERE t.slug = :slug
                 GROUP BY t.id, t.name, t.slug, t.kind, t.description, t.image_url
                 LIMIT 1"
            );
        } else {
            throw new InvalidArgumentException('Tipo de taxonomia editorial invalido.');
        }
        $stmt->execute([':slug' => $slug]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function listAdmin(array $filters): array
    {
        $limit = (int) $filters['limit'];
        $cursor = SignedKeysetCursor::decodePayload($filters['cursor'] ?? null, 'blog.admin');
        $conditions = ['a.deleted_at IS NULL'];
        $filterParams = [];
        if (!empty($filters['status'])) {
            $conditions[] = 'a.status = :status';
            $filterParams[':status'] = $filters['status'];
        }
        if (!empty($filters['search'])) {
            $conditions[] = '(a.title LIKE :search_title OR a.excerpt LIKE :search_excerpt)';
            $filterParams[':search_title'] = '%' . $filters['search'] . '%';
            $filterParams[':search_excerpt'] = '%' . $filters['search'] . '%';
        }

        $countStmt = $this->db->prepare(
            'SELECT COUNT(*) FROM blog_articles a WHERE ' . implode(' AND ', $conditions)
        );
        $countStmt->execute($filterParams);
        $total = (int) $countStmt->fetchColumn();

        $params = array_merge([
            ':viewer_user_id_empty' => '',
            ':viewer_user_id_exists' => '',
        ], $filterParams);
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
                'total' => $total,
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
        StaticSitemapMutationInvalidator::invalidate('BLOG_CONTENT_MUTATION');
        $this->db->beginTransaction();
        try {
            $category = $article['taxonomy']['category'];
            $categoryId = $category['id'] ?? null;
            if (!$categoryId) {
                $categoryId = $this->upsertCategory((string) $category['label'], $authorId);
            } elseif (!$this->categoryExists((int) $categoryId)) {
                throw new InvalidArgumentException('A categoria selecionada nao existe mais.');
            }

            $publishedAt = null;
            if ($article['status'] === 'published') {
                $publishedAt = $article['id'] ? $this->currentPublishedAt((int) $article['id']) : null;
                $publishedAt = $publishedAt ?: $this->databaseNow();
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

            $this->syncTags($articleId, $article['taxonomy']['tags']);
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
        StaticSitemapMutationInvalidator::invalidate('BLOG_CONTENT_MUTATION');
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
        StaticSitemapMutationInvalidator::invalidate('BLOG_TAXONOMY_MUTATION');
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
        $row = $find->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return [];
        }
        return [
            'id' => (int) $row['id'],
            'label' => (string) $row['name'],
            'slug' => (string) $row['slug'],
            'description' => $row['description'] ?: null,
            'imageUrl' => $row['image_url'] ?: null,
        ];
    }

    public function createTag(array $tag, string $userId): array
    {
        StaticSitemapMutationInvalidator::invalidate('BLOG_TAXONOMY_MUTATION');
        $stmt = $this->db->prepare(
            "INSERT INTO blog_tags (name, slug, kind, description, image_url, created_by)
             VALUES (:name, :slug, :kind, :description, :image_url, :created_by)
             ON DUPLICATE KEY UPDATE
                name = VALUES(name), kind = VALUES(kind),
                description = COALESCE(VALUES(description), description),
                image_url = COALESCE(VALUES(image_url), image_url), updated_at = NOW()"
        );
        $stmt->execute([
            ':name' => $tag['name'],
            ':slug' => $tag['slug'],
            ':kind' => $tag['kind'],
            ':description' => $tag['description'],
            ':image_url' => $tag['imageUrl'],
            ':created_by' => $userId !== '' ? $userId : null,
        ]);
        $find = $this->db->prepare(
            'SELECT id, name, slug, kind, description, image_url FROM blog_tags WHERE slug = :slug LIMIT 1'
        );
        $find->execute([':slug' => $tag['slug']]);
        $row = $find->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return [];
        }
        return [
            'id' => (int) $row['id'],
            'label' => (string) $row['name'],
            'slug' => (string) $row['slug'],
            'kind' => (string) ($row['kind'] ?: 'general'),
            'description' => $row['description'] ?: null,
            'imageUrl' => $row['image_url'] ?: null,
        ];
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

    /** @return array{publishedAt:string,id:int}|null */
    private static function decodePublicCursor(?string $value): ?array
    {
        $payload = SignedKeysetCursor::decodePayload($value, 'blog.public');
        if ($payload === null) {
            return null;
        }

        $publishedAt = trim((string) ($payload['publishedAt'] ?? ''));
        $id = filter_var($payload['id'] ?? null, FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1],
        ]);
        $date = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $publishedAt);
        if ($id === false || $date === false || $date->format('Y-m-d H:i:s') !== $publishedAt) {
            throw new InvalidArgumentException('Cursor de paginacao invalido.');
        }

        return ['publishedAt' => $publishedAt, 'id' => (int) $id];
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
                'coverImageUrl' => trim((string) $row['cover_image_url']) ?: self::DEFAULT_COVER_IMAGE,
                'coverImageAlt' => trim((string) $row['cover_image_alt']) ?: self::DEFAULT_COVER_ALT,
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
                'taxonomy' => [
                    'category' => [
                        'id' => (int) $row['category_id'],
                        'label' => (string) $row['category_name'],
                        'slug' => (string) $row['category_slug'],
                    ],
                    'tags' => $tags[$id] ?? [],
                ],
                'author' => [
                    'id' => (string) $row['author_id'],
                    'name' => (string) $row['resolved_author_name'],
                    'avatarUrl' => $row['author_avatar_url'] ?: null,
                    'role' => (string) $row['resolved_author_role'],
                ],
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
            "SELECT bat.article_id, t.id, t.name, t.slug, t.kind, t.description, t.image_url
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
                'label' => (string) $row['name'],
                'slug' => (string) $row['slug'],
                'kind' => (string) ($row['kind'] ?: 'general'),
                'description' => $row['description'] ?: null,
                'imageUrl' => $row['image_url'] ?: null,
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

    private function syncTags(int $articleId, array $tags): void
    {
        $this->db->prepare('DELETE FROM blog_article_tags WHERE article_id = :article_id')
            ->execute([':article_id' => $articleId]);
        foreach ($tags as $tag) {
            if (!is_array($tag)) {
                continue;
            }
            $existingId = isset($tag['id']) ? (int) $tag['id'] : 0;
            if ($existingId > 0) {
                $existing = $this->db->prepare('SELECT id FROM blog_tags WHERE id = :id LIMIT 1');
                $existing->execute([':id' => $existingId]);
                if ((int) $existing->fetchColumn() > 0) {
                    $this->db->prepare('UPDATE blog_tags SET kind = :kind WHERE id = :id')->execute([
                        ':id' => $existingId,
                        ':kind' => (string) ($tag['kind'] ?? 'general'),
                    ]);
                    $this->db->prepare(
                        'INSERT IGNORE INTO blog_article_tags (article_id, tag_id) VALUES (:article_id, :tag_id)'
                    )->execute([':article_id' => $articleId, ':tag_id' => $existingId]);
                    continue;
                }
            }
            $name = trim((string) ($tag['label'] ?? ''));
            if ($name === '') {
                continue;
            }
            $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name);
            $slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower((string) ($converted ?: $name))) ?? '', '-');
            $savedTag = $this->createTag([
                'name' => $name,
                'slug' => $slug,
                'kind' => (string) ($tag['kind'] ?? 'general'),
                'description' => null,
                'imageUrl' => null,
            ], '');
            $tagId = (int) ($savedTag['id'] ?? 0);
            if ($tagId > 0) {
                $this->db->prepare(
                    'INSERT IGNORE INTO blog_article_tags (article_id, tag_id) VALUES (:article_id, :tag_id)'
                )->execute([':article_id' => $articleId, ':tag_id' => $tagId]);
            }
        }
    }

    private function categoryExists(int $id): bool
    {
        $stmt = $this->db->prepare('SELECT 1 FROM blog_categories WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        return (bool) $stmt->fetchColumn();
    }

    private function currentPublishedAt(int $articleId): ?string
    {
        $stmt = $this->db->prepare('SELECT published_at FROM blog_articles WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $articleId]);
        $value = $stmt->fetchColumn();
        return is_string($value) && $value !== '' ? $value : null;
    }

    private function databaseNow(): string
    {
        $value = $this->db->query("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')")->fetchColumn();
        if (!is_string($value) || $value === '') {
            throw new RuntimeException('Nao foi possivel determinar a data de publicacao.');
        }
        return $value;
    }

    private static function isoDate(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));
        if ($normalized === '') {
            return null;
        }
        try {
            $timezone = new DateTimeZone(function_exists('getAppTimezone') ? getAppTimezone() : 'America/Sao_Paulo');
            return (new DateTimeImmutable($normalized, $timezone))->format(DATE_ATOM);
        } catch (Throwable) {
            return null;
        }
    }
}
