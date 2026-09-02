<?php

require_once __DIR__ . '/LegalCommentaryCommunityReadRepository.php';
require_once __DIR__ . '/LegalCommentaryArticleReadRepository.php';
require_once __DIR__ . '/../schema/LegalCommentarySchemaInstaller.php';
require_once __DIR__ . '/../../seo/sitemaps/StaticSitemapMutationInvalidator.php';

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

/**
 * Repositorio persistente do modulo Lei Comentada.
 *
 * A camada publica e o admin usam as mesmas tabelas para evitar mock/localStorage.
 *
 * @since 1.0.0
 */
class LegalCommentaryRepository
{
    private PDO $db;
    private array $contentReactionSummaryCache = [];
    private LegalCommentaryCommunityReadRepository $communityReads;
    private LegalCommentaryArticleReadRepository $articleReads;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->communityReads = new LegalCommentaryCommunityReadRepository($db);
        $this->articleReads = new LegalCommentaryArticleReadRepository($db);
    }

    public function getConnection(): PDO
    {
        return $this->db;
    }

    /**
     * Runtime paths are read/write only. Schema creation belongs exclusively
     * to the explicit database migration for this module.
     */
    private function assertSchemaReady(): void
    {
        LegalCommentarySchemaInstaller::assertReady($this->db);
    }

    private function jsonEncode($value): ?string
    {
        if ($value === null) {
            return null;
        }

        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function jsonDecode($value, $fallback = [])
    {
        if (!is_string($value) || trim($value) === '') {
            return $fallback;
        }

        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : $fallback;
    }

    private function normalizeDateTime($value): ?string
    {
        if (!$value) {
            return null;
        }

        try {
            return (new DateTime((string) $value))->format(DateTime::ATOM);
        } catch (Throwable $e) {
            return null;
        }
    }

    private function normalizeDate($value): string
    {
        if (!$value) {
            return '';
        }

        try {
            return (new DateTime((string) $value))->format('Y-m-d');
        } catch (Throwable $e) {
            return '';
        }
    }

    private function fetchAreas(): array
    {
        $stmt = $this->db->query(
            "SELECT
                a.*,
                COUNT(l.id) AS total_laws
             FROM legal_areas a
             LEFT JOIN laws l ON l.legal_area_id = a.id
             GROUP BY a.id
             ORDER BY a.sort_order, a.name"
        );

        return array_map([$this, 'mapArea'], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    private function fetchFavoriteTargets(?string $userId): array
    {
        if (!$userId) {
            return [];
        }

        $stmt = $this->db->prepare(
            "SELECT target_type, target_id
             FROM legal_user_favorites
             WHERE user_id = :user_id"
        );
        $stmt->execute([':user_id' => $userId]);

        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[(string) $row['target_type'] . ':' . (string) $row['target_id']] = true;
        }

        return $map;
    }

    private function fetchProgressByLaw(?string $userId): array
    {
        if (!$userId) {
            return [];
        }

        $stmt = $this->db->prepare(
            "SELECT p.*, COALESCE(article_counts.total_articles, 0) AS total_articles
             FROM legal_user_progress p
             LEFT JOIN (
                SELECT law_id, COUNT(*) AS total_articles
                FROM law_articles
                GROUP BY law_id
             ) article_counts ON article_counts.law_id = p.law_id
             WHERE p.user_id = :user_id"
        );
        $stmt->execute([':user_id' => $userId]);

        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[(string) $row['law_id']] = $this->mapProgress($row);
        }

        return $map;
    }

    private function lawStatsSql(): string
    {
        return "
            SELECT
                l.*,
                a.slug AS area_slug,
                a.name AS area_name,
                a.description AS area_description,
                a.color_class AS area_color_class,
                a.icon_name AS area_icon_name,
                a.icon_tone AS area_icon_tone,
                a.sort_order AS area_sort_order,
                law_topic.id AS law_topic_id,
                law_topic.name AS law_topic_name,
                law_topic.slug AS law_topic_slug,
                law_topic.meta_materia AS law_topic_is_materia,
                law_topic.taxonomy_level AS law_topic_taxonomy_level,
                law_subject.id AS law_subject_filter_id,
                law_subject.name AS law_subject_name,
                law_subject.slug AS law_subject_slug,
                COUNT(DISTINCT ar.id) AS article_count,
                COUNT(DISTINCT tc.law_article_id) AS commented_article_count,
                COUNT(DISTINCT aj.id) AS jurisprudence_count,
                COUNT(DISTINCT aet.id) AS exam_tip_count
            FROM laws l
            INNER JOIN legal_areas a ON a.id = l.legal_area_id
            LEFT JOIN filters law_topic ON law_topic.id = l.law_topic_filter_id
            LEFT JOIN filters law_subject ON law_subject.id = (
                CASE
                    WHEN law_topic.meta_materia = 1 THEN law_topic.id
                    WHEN law_topic.parent_id IS NOT NULL THEN law_topic.parent_id
                    ELSE NULL
                END
            )
            LEFT JOIN law_articles ar ON ar.law_id = l.id
            LEFT JOIN teacher_comments tc ON tc.law_article_id = ar.id
            LEFT JOIN article_jurisprudence aj ON aj.law_article_id = ar.id
            LEFT JOIN article_exam_tips aet ON aet.law_article_id = ar.id
        ";
    }

    private function lawStatsGroupBySql(): string
    {
        return "
            GROUP BY
                l.id,
                a.id,
                a.slug,
                a.name,
                a.description,
                a.color_class,
                a.icon_name,
                a.icon_tone,
                a.sort_order,
                law_topic.id,
                law_topic.name,
                law_topic.slug,
                law_topic.meta_materia,
                law_topic.taxonomy_level,
                law_subject.id,
                law_subject.name,
                law_subject.slug
        ";
    }

    private function fetchLawRows(?string $query = null, bool $publicOnly = false): array
    {
        $params = [];
        $whereParts = [];

        if ($publicOnly) {
            $whereParts[] = "(l.status IN ('active', 'published') OR (l.status = 'scheduled' AND l.published_at IS NOT NULL AND l.published_at <= NOW()))";
        }

        if ($query !== null && trim($query) !== '') {
            $whereParts[] = "(
                l.title LIKE :query OR
                l.short_title LIKE :query OR
                l.law_number LIKE :query OR
                l.acronym LIKE :query OR
                l.description LIKE :query OR
                l.summary LIKE :query OR
                l.ementa LIKE :query OR
                law_topic.name LIKE :query OR
                law_subject.name LIKE :query OR
                a.name LIKE :query
            )";
            $params[':query'] = '%' . trim($query) . '%';
        }

        $where = empty($whereParts) ? '' : 'WHERE ' . implode(' AND ', $whereParts);

        $stmt = $this->db->prepare(
            $this->lawStatsSql() . "
            $where
            " . $this->lawStatsGroupBySql() . "
            ORDER BY a.sort_order, l.access_count DESC, l.short_title
        "
        );
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function fetchHome(?string $userId = null): array
    {
        $this->assertSchemaReady();

        $areas = $this->fetchAreas();
        $favorites = $this->fetchFavoriteTargets($userId);
        $progressByLaw = $this->fetchProgressByLaw($userId);
        $laws = array_map(function ($row) use ($favorites, $progressByLaw) {
            return $this->mapLawSummary($row, $favorites, $progressByLaw);
        }, $this->fetchLawRows(null, true));

        $lawsByArea = [];
        foreach ($areas as $area) {
            $areaLaws = array_values(array_filter($laws, fn ($law) => (string) $law['areaId'] === (string) $area['id']));
            if (!empty($areaLaws)) {
                $lawsByArea[] = [
                    'area' => $area,
                    'laws' => $areaLaws,
                ];
            }
        }

        $mostAccessed = $laws;
        usort($mostAccessed, fn ($a, $b) => ((int) $b['accessCount']) <=> ((int) $a['accessCount']));

        $recentlyStudied = array_filter($laws, fn ($law) => ($law['progressPercent'] ?? 0) > 0);
        $recentlyStudied = array_values($recentlyStudied);
        $favoriteItems = $this->fetchFavoriteItems($userId, $laws);

        return [
            'areas' => $areas,
            'lawsByArea' => $lawsByArea,
            'mostAccessed' => array_slice($mostAccessed, 0, 6),
            'favoriteLaws' => array_values(array_slice(array_filter($laws, fn ($law) => !empty($law['isFavorite'])), 0, 6)),
            'favoriteItems' => $favoriteItems,
            'recentlyStudied' => array_slice($recentlyStudied, 0, 6),
            'recentlyUpdated' => array_values(array_slice(array_filter($laws, fn ($law) => !empty($law['isRecentlyUpdated'])), 0, 8)),
            'totals' => [
                'laws' => count($laws),
                'articles' => array_sum(array_map(fn ($law) => (int) $law['articleCount'], $laws)),
                'commentedArticles' => array_sum(array_map(fn ($law) => (int) $law['commentedArticleCount'], $laws)),
                'updatedRecently' => count(array_filter($laws, fn ($law) => !empty($law['isRecentlyUpdated']))),
            ],
        ];
    }

    private function fetchFavoriteItems(?string $userId, array $mappedLaws): array
    {
        if (!$userId) {
            return [];
        }

        $lawsById = [];
        foreach ($mappedLaws as $law) {
            $lawsById[(string) ($law['id'] ?? '')] = $law;
        }

        $items = [];

        $lawStmt = $this->db->prepare(
            "SELECT target_id, created_at
             FROM legal_user_favorites
             WHERE user_id = :user_id AND target_type = 'law'
             ORDER BY created_at DESC, id DESC
             LIMIT 101"
        );
        $lawStmt->execute([':user_id' => $userId]);
        foreach ($lawStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $law = $lawsById[(string) $row['target_id']] ?? null;
            if (!$law) {
                continue;
            }

            $items[] = [
                'id' => 'law:' . (string) $law['id'],
                'type' => 'law',
                'targetId' => (string) $law['id'],
                'lawId' => (string) $law['id'],
                'lawSlug' => (string) $law['slug'],
                'lawTitle' => (string) ($law['shortTitle'] ?? $law['title'] ?? 'Lei Comentada'),
                'title' => (string) ($law['shortTitle'] ?? $law['title'] ?? 'Lei Comentada'),
                'subtitle' => 'Lei completa',
                'description' => (string) ($law['description'] ?? $law['summary'] ?? $law['ementa'] ?? ''),
                'href' => '/lei-comentada/' . rawurlencode((string) $law['slug']),
                'articleCount' => (int) ($law['articleCount'] ?? 0),
                'progressPercent' => (int) ($law['progressPercent'] ?? 0),
                'createdAt' => $this->normalizeDateTime($row['created_at'] ?? null) ?? '',
            ];
        }

        $sectionStmt = $this->db->prepare(
            "SELECT f.target_id, f.created_at,
                    s.id AS section_id, s.display_title, s.title_label, s.title_name,
                    s.chapter_label, s.chapter_name, s.from_article, s.to_article,
                    l.id AS law_id, l.slug AS law_slug, l.title AS law_title,
                    l.short_title AS law_short_title
             FROM legal_user_favorites f
             INNER JOIN law_sections s ON s.id = CAST(f.target_id AS UNSIGNED)
             INNER JOIN laws l ON l.id = s.law_id
             WHERE f.user_id = :user_id AND f.target_type = 'section'
             ORDER BY f.created_at DESC, f.id DESC
             LIMIT 101"
        );
        $sectionStmt->execute([':user_id' => $userId]);
        foreach ($sectionStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $sectionTitle = trim((string) ($row['display_title'] ?? ''));
            if ($sectionTitle === '') {
                $sectionTitle = implode(' - ', array_values(array_filter([
                    trim((string) ($row['chapter_label'] ?? '')),
                    trim((string) ($row['chapter_name'] ?? '')),
                    trim((string) ($row['title_label'] ?? '')),
                    trim((string) ($row['title_name'] ?? '')),
                ]))) ?: 'Secao da lei';
            }

            $items[] = [
                'id' => 'section:' . (string) $row['section_id'],
                'type' => 'section',
                'targetId' => (string) $row['section_id'],
                'lawId' => (string) $row['law_id'],
                'lawSlug' => (string) $row['law_slug'],
                'lawTitle' => (string) ($row['law_short_title'] ?: $row['law_title']),
                'title' => $sectionTitle,
                'subtitle' => 'Secao salva',
                'description' => trim(implode(' a ', array_values(array_filter([
                    (string) ($row['from_article'] ?? ''),
                    (string) ($row['to_article'] ?? ''),
                ])))),
                'href' => '/lei-comentada/' . rawurlencode((string) $row['law_slug'])
                    . '?lawId=' . rawurlencode((string) $row['law_id'])
                    . '&sectionId=' . rawurlencode((string) $row['section_id'])
                    . '&view=pdf',
                'createdAt' => $this->normalizeDateTime($row['created_at'] ?? null) ?? '',
            ];
        }

        $articleStmt = $this->db->prepare(
            "SELECT f.target_id, f.created_at,
                    a.id AS article_id, a.article_number, a.title AS article_title,
                    a.section_id, l.id AS law_id, l.slug AS law_slug,
                    l.title AS law_title, l.short_title AS law_short_title
             FROM legal_user_favorites f
             INNER JOIN law_articles a ON a.id = CAST(f.target_id AS UNSIGNED)
             INNER JOIN laws l ON l.id = a.law_id
             WHERE f.user_id = :user_id AND f.target_type = 'article'
             ORDER BY f.created_at DESC, f.id DESC
             LIMIT 101"
        );
        $articleStmt->execute([':user_id' => $userId]);
        foreach ($articleStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $articleNumber = (string) ($row['article_number'] ?? '');
            $items[] = [
                'id' => 'article:' . (string) $row['article_id'],
                'type' => 'article',
                'targetId' => (string) $row['article_id'],
                'lawId' => (string) $row['law_id'],
                'lawSlug' => (string) $row['law_slug'],
                'lawTitle' => (string) ($row['law_short_title'] ?: $row['law_title']),
                'title' => trim('Art. ' . $articleNumber . ' ' . (string) ($row['article_title'] ?? '')),
                'subtitle' => 'Artigo salvo',
                'description' => (string) ($row['law_short_title'] ?: $row['law_title']),
                'href' => '/lei-comentada/' . rawurlencode((string) $row['law_slug'])
                    . '?lawId=' . rawurlencode((string) $row['law_id'])
                    . '&sectionId=' . rawurlencode((string) ($row['section_id'] ?? ''))
                    . '&articleId=' . rawurlencode((string) $row['article_id'])
                    . '&view=pdf',
                'createdAt' => $this->normalizeDateTime($row['created_at'] ?? null) ?? '',
            ];
        }

        usort($items, static fn ($left, $right) => strcmp((string) ($right['createdAt'] ?? ''), (string) ($left['createdAt'] ?? '')));

        return array_slice($items, 0, 100);
    }

    public function search(string $query, ?string $userId = null): array
    {
        $this->assertSchemaReady();

        $normalizedQuery = trim($query);
        if ($normalizedQuery === '') {
            return [];
        }

        $favorites = $this->fetchFavoriteTargets($userId);
        $progressByLaw = $this->fetchProgressByLaw($userId);
        $results = [];

        foreach ($this->fetchLawRows($normalizedQuery, true) as $row) {
            $law = $this->mapLawSummary($row, $favorites, $progressByLaw);
            $results[] = [
                'id' => 'law-' . $law['id'],
                'type' => 'law',
                'title' => $law['shortTitle'],
                'excerpt' => $law['summary'],
                'areaName' => (string) $row['area_name'],
                'lawSlug' => $law['slug'],
            ];
        }

        $stmt = $this->db->prepare(
            "SELECT ar.*, l.slug AS law_slug, l.short_title AS law_short_title, la.name AS area_name
             FROM law_articles ar
             INNER JOIN laws l ON l.id = ar.law_id
             INNER JOIN legal_areas la ON la.id = l.legal_area_id
             WHERE ar.article_number LIKE :query
                OR ar.title LIKE :query
                OR ar.official_text LIKE :query
             ORDER BY l.access_count DESC, ar.sort_order
             LIMIT 30"
        );
        $stmt->execute([':query' => '%' . $normalizedQuery . '%']);

        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $results[] = [
                'id' => 'article-' . (string) $row['id'],
                'type' => 'article',
                'title' => (string) $row['law_short_title'] . ', art. ' . (string) $row['article_number'],
                'excerpt' => (string) ($row['title'] ?: mb_substr((string) $row['official_text'], 0, 180)),
                'areaName' => (string) $row['area_name'],
                'lawSlug' => (string) $row['law_slug'],
                'articleId' => (string) $row['id'],
            ];
        }

        $stmt = $this->db->prepare(
            "SELECT tc.*, ar.id AS article_id, l.slug AS law_slug, la.name AS area_name
             FROM teacher_comments tc
             INNER JOIN law_articles ar ON ar.id = tc.law_article_id
             INNER JOIN laws l ON l.id = ar.law_id
             INNER JOIN legal_areas la ON la.id = l.legal_area_id
             WHERE tc.title LIKE :query OR tc.body LIKE :query
             ORDER BY tc.updated_at DESC
             LIMIT 20"
        );
        $stmt->execute([':query' => '%' . $normalizedQuery . '%']);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $results[] = [
                'id' => 'teacher-' . (string) $row['id'],
                'type' => 'teacher_comment',
                'title' => (string) $row['title'],
                'excerpt' => mb_substr((string) $row['body'], 0, 180),
                'areaName' => (string) $row['area_name'],
                'lawSlug' => (string) $row['law_slug'],
                'articleId' => (string) $row['article_id'],
            ];
        }

        return array_slice($results, 0, 40);
    }

    public function fetchLawDetail(string $identifier, ?string $userId = null, bool $incrementAccess = false): ?array
    {
        $this->assertSchemaReady();

        $stmt = $this->db->prepare(
            $this->lawStatsSql() . "
             WHERE l.slug = :identifier
                OR l.id = :numeric_id
             " . $this->lawStatsGroupBySql() . "
              LIMIT 1"
        );
        $stmt->execute([
            ':identifier' => $identifier,
            ':numeric_id' => ctype_digit($identifier) ? (int) $identifier : 0,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }

        if ($incrementAccess) {
            $this->db->prepare('UPDATE laws SET access_count = access_count + 1 WHERE id = :id')
                ->execute([':id' => (int) $row['id']]);
            $row['access_count'] = ((int) $row['access_count']) + 1;
        }

        $favorites = $this->fetchFavoriteTargets($userId);
        $progressByLaw = $this->fetchProgressByLaw($userId);
        $law = $this->mapLawSummary($row, $favorites, $progressByLaw);
        $sectionRows = $this->articleReads->fetchSectionRows((int) $row['id']);
        $articleRows = $this->articleReads->fetchArticleRows((int) $row['id']);
        $articleIds = array_map(fn ($article) => (string) $article['id'], $articleRows);
        $progress = $progressByLaw[(string) $row['id']] ?? null;

        $articleBlockRows = $this->articleReads->fetchArticleBlockRows($articleIds);
        $teacherRows = $this->articleReads->fetchRowsForArticles('teacher_comments', $articleIds);
        $jurisprudenceRows = $this->articleReads->fetchRowsForArticles('article_jurisprudence', $articleIds);
        $examTipRows = $this->articleReads->fetchRowsForArticles('article_exam_tips', $articleIds);
        $sumulaRows = $this->articleReads->fetchRowsForArticles('article_sumulas', $articleIds);
        $blocksByArticle = $this->articleReads->groupRowsByColumn($articleBlockRows, 'law_article_id');
        $teacherByArticle = $this->articleReads->groupRowsByColumn($teacherRows, 'law_article_id');
        $jurisprudenceByArticle = $this->articleReads->groupRowsByColumn($jurisprudenceRows, 'law_article_id');
        $examTipsByArticle = $this->articleReads->groupRowsByColumn($examTipRows, 'law_article_id');
        $sumulasByArticle = $this->articleReads->groupRowsByColumn($sumulaRows, 'law_article_id');

        $mappedTeacherComments = array_map(fn ($item) => $this->mapTeacherComment($item, $favorites, $userId), $teacherRows);
        $mappedJurisprudence = array_map(fn ($item) => $this->mapJurisprudence($item, $favorites, $userId), $jurisprudenceRows);
        $mappedExamTips = array_map(fn ($item) => $this->mapExamTip($item, $userId), $examTipRows);
        $mappedSumulas = array_map(fn ($item) => $this->mapSumula($item, $userId), $sumulaRows);

        $articles = array_map(function ($articleRow) use ($favorites, $progress, $blocksByArticle, $teacherByArticle, $jurisprudenceByArticle, $examTipsByArticle, $sumulasByArticle, $userId) {
            $article = $this->mapArticle($articleRow, $favorites, $progress, $blocksByArticle[(string) $articleRow['id']] ?? []);
            $articleTeacherComments = array_map(
                fn ($item) => $this->mapTeacherComment($item, $favorites, $userId),
                $teacherByArticle[(string) $articleRow['id']] ?? []
            );
            $articleJurisprudence = array_map(
                fn ($item) => $this->mapJurisprudence($item, $favorites, $userId),
                $jurisprudenceByArticle[(string) $articleRow['id']] ?? []
            );
            $articleExamTips = array_map(fn ($item) => $this->mapExamTip($item, $userId), $examTipsByArticle[(string) $articleRow['id']] ?? []);
            $articleSumulas = array_map(fn ($item) => $this->mapSumula($item, $userId), $sumulasByArticle[(string) $articleRow['id']] ?? []);

            $article['syllabi'] = $articleSumulas;
            $article['sumulas'] = $articleSumulas;
            $article['comentarios'] = $articleTeacherComments;
            $article['jurisprudencia'] = $articleJurisprudence;
            $article['macete'] = $articleExamTips[0]['body'] ?? ($article['examTip'] ?? null);
            $article['examTip'] = $article['macete'];
            return $article;
        }, $articleRows);

        $userCommentRows = $this->communityReads->fetchUserComments($articleIds, $userId, 200);
        $hasMoreUserComments = count($userCommentRows) > 200;
        if ($hasMoreUserComments) {
            $userCommentRows = array_slice($userCommentRows, 0, 200);
        }

        return array_merge($law, [
            'area' => $this->mapArea([
                'id' => $row['legal_area_id'],
                'slug' => $row['area_slug'],
                'name' => $row['area_name'],
                'description' => $row['area_description'],
                'color_class' => $row['area_color_class'],
                'icon_name' => $row['area_icon_name'],
                'icon_tone' => $row['area_icon_tone'],
                'sort_order' => $row['area_sort_order'],
                'total_laws' => 0,
            ]),
            'sections' => array_map(
                fn(array $sectionRow): array => $this->mapSection($sectionRow, $favorites),
                $sectionRows
            ),
            'articles' => $articles,
            'teacherComments' => $mappedTeacherComments,
            'jurisprudence' => $mappedJurisprudence,
            'examTips' => $mappedExamTips,
            'sumulas' => $mappedSumulas,
            'userComments' => array_map([$this, 'mapUserComment'], $userCommentRows),
            'userCommentsPageInfo' => [
                'limit' => 200,
                'hasMore' => $hasMoreUserComments,
            ],
            'updates' => array_map([$this, 'mapUpdate'], $this->articleReads->fetchLawUpdates((int) $row['id'])),
            'progress' => $progress,
            'sectionEditorials' => array_map(
                fn ($item) => $this->mapSectionEditorial($item, $userId),
                $this->articleReads->fetchSectionEditorialRows((int) $row['id'])
            ),
        ]);
    }

    public function fetchLawOutline(string $identifier, ?string $userId = null): ?array
    {
        $this->assertSchemaReady();

        $stmt = $this->db->prepare(
            "SELECT l.id, l.slug, l.title, l.short_title, l.law_number, l.status, l.published_at
             FROM laws l
             WHERE l.slug = :identifier
                OR l.id = :numeric_id
             LIMIT 1"
        );
        $stmt->execute([
            ':identifier' => $identifier,
            ':numeric_id' => ctype_digit($identifier) ? (int) $identifier : 0,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }

        $sectionRows = $this->articleReads->fetchSectionRows((int) $row['id']);
        $articleStmt = $this->db->prepare(
            "SELECT id, law_id, section_id, article_number
             FROM law_articles
             WHERE law_id = :law_id
             ORDER BY sort_order, id"
        );
        $articleStmt->execute([':law_id' => (int) $row['id']]);
        $articleRows = $articleStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $favorites = $this->fetchFavoriteTargets($userId);

        return [
            'id' => (string) $row['id'],
            'slug' => (string) $row['slug'],
            'title' => (string) $row['title'],
            'shortTitle' => (string) $row['short_title'],
            'number' => (string) $row['law_number'],
            'status' => (string) ($row['status'] ?? 'active'),
            'date' => $this->normalizeDate($row['published_at'] ?? null),
            'publishedAt' => $this->normalizeDateTime($row['published_at'] ?? null) ?? '',
            'published_at' => $this->normalizeDateTime($row['published_at'] ?? null) ?? '',
            'sections' => array_map(
                fn(array $sectionRow): array => $this->mapSection($sectionRow, $favorites),
                $sectionRows
            ),
            'articles' => array_map(
                fn(array $articleRow): array => $this->mapOutlineArticle($articleRow, $favorites),
                $articleRows
            ),
            'outlineOnly' => true,
        ];
    }

    public function hasFavorite(string $userId, string $targetType, string $targetId): bool
    {
        $this->assertSchemaReady();

        $stmt = $this->db->prepare(
            "SELECT 1 FROM legal_user_favorites
             WHERE user_id = :user_id AND target_type = :target_type AND target_id = :target_id
             LIMIT 1"
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':target_type' => $targetType,
            ':target_id' => $targetId,
        ]);

        return (bool) $stmt->fetchColumn();
    }

    public function toggleFavorite(string $userId, string $targetType, string $targetId): array
    {
        $this->assertSchemaReady();

        $stmt = $this->db->prepare(
            "SELECT id FROM legal_user_favorites
             WHERE user_id = :user_id AND target_type = :target_type AND target_id = :target_id
             LIMIT 1"
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':target_type' => $targetType,
            ':target_id' => $targetId,
        ]);

        $existingId = $stmt->fetchColumn();
        if ($existingId) {
            $this->db->prepare('DELETE FROM legal_user_favorites WHERE id = :id')
                ->execute([':id' => (int) $existingId]);
            return ['isFavorite' => false];
        }

        $stmt = $this->db->prepare(
            "INSERT INTO legal_user_favorites (user_id, target_type, target_id)
             VALUES (:user_id, :target_type, :target_id)"
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':target_type' => $targetType,
            ':target_id' => $targetId,
        ]);

        return ['isFavorite' => true];
    }

    public function fetchUserNotes(string $userId): array
    {
        $this->assertSchemaReady();

        $stmt = $this->db->prepare(
            "SELECT
                note.id,
                note.law_id,
                note.law_article_id,
                note.body,
                note.created_at,
                note.updated_at,
                law.slug AS law_slug,
                law.title AS law_title,
                law.short_title AS law_short_title,
                area.name AS area_name,
                article.article_number,
                article.title AS article_title
             FROM legal_user_notes note
             INNER JOIN laws law ON law.id = note.law_id
             INNER JOIN law_articles article ON article.id = note.law_article_id AND article.law_id = law.id
             INNER JOIN legal_areas area ON area.id = law.legal_area_id
             WHERE note.user_id = :user_id
             ORDER BY note.updated_at DESC, note.id DESC"
        );
        $stmt->execute([':user_id' => $userId]);

        return array_map([$this, 'mapUserNote'], $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    public function saveUserNote(string $userId, array $payload): array
    {
        $this->assertSchemaReady();

        $lawId = (int) ($payload['lawId'] ?? $payload['law_id'] ?? 0);
        $articleId = (int) ($payload['articleId'] ?? $payload['article_id'] ?? 0);
        $body = trim((string) ($payload['body'] ?? $payload['note'] ?? ''));

        if ($lawId <= 0 || $articleId <= 0) {
            throw new InvalidArgumentException('Informe a lei e o artigo da anotacao.');
        }
        if (mb_strlen($body) > 10000) {
            throw new InvalidArgumentException('A anotacao pode ter no maximo 10.000 caracteres.');
        }

        $articleStmt = $this->db->prepare(
            'SELECT id FROM law_articles WHERE id = :article_id AND law_id = :law_id LIMIT 1'
        );
        $articleStmt->execute([':article_id' => $articleId, ':law_id' => $lawId]);
        if (!(int) $articleStmt->fetchColumn()) {
            throw new InvalidArgumentException('O artigo nao pertence a lei informada.');
        }

        if ($body === '') {
            $this->deleteUserNoteByArticle($userId, $articleId);
            return ['deleted' => true, 'articleId' => (string) $articleId];
        }

        $stmt = $this->db->prepare(
            "INSERT INTO legal_user_notes (user_id, law_id, law_article_id, body)
             VALUES (:user_id, :law_id, :law_article_id, :body)
             ON DUPLICATE KEY UPDATE body = VALUES(body), updated_at = NOW()"
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':law_id' => $lawId,
            ':law_article_id' => $articleId,
            ':body' => $body,
        ]);

        $note = $this->fetchUserNoteByArticle($userId, $articleId);
        if ($note === null) {
            throw new RuntimeException('Nao foi possivel recarregar a anotacao apos salvar.');
        }

        return ['deleted' => false, 'note' => $note];
    }

    public function deleteUserNoteByArticle(string $userId, int $articleId): bool
    {
        $this->assertSchemaReady();

        $stmt = $this->db->prepare(
            'DELETE FROM legal_user_notes WHERE user_id = :user_id AND law_article_id = :article_id'
        );
        $stmt->execute([':user_id' => $userId, ':article_id' => $articleId]);

        return $stmt->rowCount() > 0;
    }

    private function fetchUserNoteByArticle(string $userId, int $articleId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT
                note.id,
                note.law_id,
                note.law_article_id,
                note.body,
                note.created_at,
                note.updated_at,
                law.slug AS law_slug,
                law.title AS law_title,
                law.short_title AS law_short_title,
                area.name AS area_name,
                article.article_number,
                article.title AS article_title
             FROM legal_user_notes note
             INNER JOIN laws law ON law.id = note.law_id
             INNER JOIN law_articles article ON article.id = note.law_article_id AND article.law_id = law.id
             INNER JOIN legal_areas area ON area.id = law.legal_area_id
             WHERE note.user_id = :user_id AND note.law_article_id = :article_id
             LIMIT 1"
        );
        $stmt->execute([':user_id' => $userId, ':article_id' => $articleId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $this->mapUserNote($row) : null;
    }

    private function mapUserNote(array $row): array
    {
        return [
            'id' => (string) ($row['id'] ?? ''),
            'lawId' => (string) ($row['law_id'] ?? ''),
            'articleId' => (string) ($row['law_article_id'] ?? ''),
            'note' => (string) ($row['body'] ?? ''),
            'updatedAt' => $this->normalizeDateTime($row['updated_at'] ?? null),
            'lawSlug' => (string) ($row['law_slug'] ?? ''),
            'lawTitle' => (string) ($row['law_title'] ?? ''),
            'lawShortTitle' => (string) ($row['law_short_title'] ?? ''),
            'areaName' => (string) ($row['area_name'] ?? ''),
            'articleNumber' => (string) ($row['article_number'] ?? ''),
            'articleTitle' => (string) ($row['article_title'] ?? ''),
        ];
    }

    public function fetchReaderAnnotation(string $userId, int $lawId, int $sectionId): ?array
    {
        $this->assertSchemaReady();

        $stmt = $this->db->prepare(
            'SELECT id, law_id, law_section_id, markup_html, updated_at
             FROM legal_user_reader_annotations
             WHERE user_id = :user_id AND law_id = :law_id AND law_section_id = :section_id
             LIMIT 1'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':law_id' => $lawId,
            ':section_id' => $sectionId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $this->mapReaderAnnotation($row) : null;
    }

    public function saveReaderAnnotation(string $userId, array $payload): array
    {
        $this->assertSchemaReady();

        $lawId = (int) ($payload['lawId'] ?? $payload['law_id'] ?? 0);
        $sectionId = (int) ($payload['sectionId'] ?? $payload['section_id'] ?? 0);
        $markupHtml = $this->sanitizeReaderMarkup((string) ($payload['markupHtml'] ?? $payload['markup_html'] ?? ''));

        if ($lawId <= 0 || $sectionId <= 0) {
            throw new InvalidArgumentException('Informe a lei e a secao das marcacoes.');
        }
        if (mb_strlen($markupHtml) > 100000) {
            throw new InvalidArgumentException('As marcacoes desta secao excedem o limite de 100.000 caracteres.');
        }

        $sectionStmt = $this->db->prepare(
            'SELECT id FROM law_sections WHERE id = :section_id AND law_id = :law_id LIMIT 1'
        );
        $sectionStmt->execute([':section_id' => $sectionId, ':law_id' => $lawId]);
        if (!(int) $sectionStmt->fetchColumn()) {
            throw new InvalidArgumentException('A secao nao pertence a lei informada.');
        }

        if ($markupHtml === '') {
            $this->deleteReaderAnnotation($userId, $lawId, $sectionId);
            return ['deleted' => true, 'sectionId' => (string) $sectionId];
        }

        $stmt = $this->db->prepare(
            "INSERT INTO legal_user_reader_annotations (user_id, law_id, law_section_id, markup_html)
             VALUES (:user_id, :law_id, :section_id, :markup_html)
             ON DUPLICATE KEY UPDATE markup_html = VALUES(markup_html), updated_at = NOW()"
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':law_id' => $lawId,
            ':section_id' => $sectionId,
            ':markup_html' => $markupHtml,
        ]);

        $annotation = $this->fetchReaderAnnotation($userId, $lawId, $sectionId);
        if ($annotation === null) {
            throw new RuntimeException('Nao foi possivel recarregar as marcacoes apos salvar.');
        }

        return ['deleted' => false, 'annotation' => $annotation];
    }

    public function deleteReaderAnnotation(string $userId, int $lawId, int $sectionId): bool
    {
        $this->assertSchemaReady();

        $stmt = $this->db->prepare(
            'DELETE FROM legal_user_reader_annotations
             WHERE user_id = :user_id AND law_id = :law_id AND law_section_id = :section_id'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':law_id' => $lawId,
            ':section_id' => $sectionId,
        ]);

        return $stmt->rowCount() > 0;
    }

    private function mapReaderAnnotation(array $row): array
    {
        return [
            'id' => (string) ($row['id'] ?? ''),
            'lawId' => (string) ($row['law_id'] ?? ''),
            'sectionId' => (string) ($row['law_section_id'] ?? ''),
            'markupHtml' => (string) ($row['markup_html'] ?? ''),
            'updatedAt' => $this->normalizeDateTime($row['updated_at'] ?? null),
        ];
    }

    private function sanitizeReaderMarkup(string $markupHtml): string
    {
        $allowedTags = '<p><br><strong><b><em><i><u><span><div><ul><ol><li><mark>';
        $clean = strip_tags(trim($markupHtml), $allowedTags);
        $clean = preg_replace('/\s+on[a-z]+\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+)/iu', '', $clean) ?? '';
        $clean = preg_replace('/\s+(?:href|src)\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+)/iu', '', $clean) ?? '';
        $clean = preg_replace('/(?:javascript:|data:text\/html|expression\s*\(|@import|url\s*\()/iu', '', $clean) ?? '';

        return trim($clean);
    }

    public function recordLawView(string $userId, string $lawId): void
    {
        $this->assertSchemaReady();

        $stmt = $this->db->prepare(
            "INSERT INTO legal_user_progress (user_id, law_id, viewed_article_ids_json, last_viewed_at, progress_percent)
             VALUES (:user_id, :law_id, '[]', NOW(), 0)
             ON DUPLICATE KEY UPDATE last_viewed_at = NOW()"
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':law_id' => (int) $lawId,
        ]);
    }

    public function recordArticleView(string $userId, string $lawId, string $articleId): array
    {
        $this->assertSchemaReady();
        $startedTransaction = !$this->db->inTransaction();

        try {
            if ($startedTransaction) {
                $this->db->beginTransaction();
            }

            $seedStmt = $this->db->prepare(
                "INSERT INTO legal_user_progress (user_id, law_id, viewed_article_ids_json, last_viewed_at, progress_percent)
                 VALUES (:user_id, :law_id, '[]', NOW(), 0)
                 ON DUPLICATE KEY UPDATE last_viewed_at = last_viewed_at"
            );
            $seedStmt->execute([
                ':user_id' => $userId,
                ':law_id' => (int) $lawId,
            ]);

            $progressStmt = $this->db->prepare(
                "SELECT *
                 FROM legal_user_progress
                 WHERE user_id = :user_id AND law_id = :law_id
                 LIMIT 1
                 FOR UPDATE"
            );
            $progressStmt->execute([
                ':user_id' => $userId,
                ':law_id' => (int) $lawId,
            ]);
            $existing = $progressStmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $viewed = $this->jsonDecode($existing['viewed_article_ids_json'] ?? null, []);
            $viewed[] = (string) $articleId;
            $viewed = array_values(array_unique(array_map('strval', $viewed)));

            $countStmt = $this->db->prepare('SELECT COUNT(*) FROM law_articles WHERE law_id = :law_id');
            $countStmt->execute([':law_id' => (int) $lawId]);
            $totalArticles = max(1, (int) $countStmt->fetchColumn());
            $progressPercent = min(100, (int) round((count($viewed) / $totalArticles) * 100));

            $stmt = $this->db->prepare(
                "UPDATE legal_user_progress
                 SET viewed_article_ids_json = :viewed_article_ids_json,
                     last_article_id = :last_article_id,
                     last_viewed_at = NOW(),
                     progress_percent = :progress_percent
                 WHERE user_id = :user_id
                   AND law_id = :law_id"
            );
            $stmt->execute([
                ':user_id' => $userId,
                ':law_id' => (int) $lawId,
                ':viewed_article_ids_json' => $this->jsonEncode($viewed),
                ':last_article_id' => (string) $articleId,
                ':progress_percent' => $progressPercent,
            ]);

            if ($startedTransaction) {
                $this->db->commit();
            }

            return [
                'viewedArticleIds' => $viewed,
                'progressPercent' => $progressPercent,
            ];
        } catch (Throwable $e) {
            if ($startedTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }

            throw $e;
        }
    }

    public function createUserComment(string $userId, string $userName, string $articleId, string $body, ?string $parentCommentId = null): array
    {
        $this->assertSchemaReady();

        $trimmedBody = trim($body);
        if ($trimmedBody === '') {
            throw new InvalidArgumentException('Escreva um comentario antes de enviar.');
        }

        $parentId = null;
        $normalizedParentId = trim((string) $parentCommentId);
        if ($normalizedParentId !== '') {
            $parent = $this->fetchUserCommentById((int) $normalizedParentId, false);
            if (!$parent || (string) ($parent['law_article_id'] ?? '') !== (string) ((int) $articleId)) {
                throw new InvalidArgumentException('Comentario pai invalido para esta secao.');
            }

            $parentId = (int) $normalizedParentId;
        }

        $stmt = $this->db->prepare(
            "INSERT INTO legal_user_comments (law_article_id, parent_comment_id, user_id, user_name, body, status, moderation_status)
             VALUES (:law_article_id, :parent_comment_id, :user_id, :user_name, :body, 'visible', 'approved')"
        );
        $stmt->execute([
            ':law_article_id' => (int) $articleId,
            ':parent_comment_id' => $parentId,
            ':user_id' => $userId,
            ':user_name' => $userName,
            ':body' => $trimmedBody,
        ]);

        return $this->fetchUserCommentById((int) $this->db->lastInsertId());
    }

    public function updateUserComment(string $userId, string $commentId, string $body): array
    {
        $this->assertSchemaReady();
        $comment = $this->fetchUserCommentById((int) $commentId, false);
        if (!$comment) {
            throw new RuntimeException('Comentario nao encontrado.');
        }
        if ((string) $comment['user_id'] !== $userId) {
            throw new RuntimeException('Voce so pode editar o proprio comentario.');
        }

        $this->db->prepare(
            "UPDATE legal_user_comments
             SET body = :body, updated_at = NOW()
             WHERE id = :id"
        )->execute([
            ':body' => trim($body),
            ':id' => (int) $commentId,
        ]);

        return $this->fetchUserCommentById((int) $commentId);
    }

    public function deleteUserComment(string $userId, string $commentId): void
    {
        $this->assertSchemaReady();
        $comment = $this->fetchUserCommentById((int) $commentId, false);
        if (!$comment) {
            throw new RuntimeException('Comentario nao encontrado.');
        }
        if ((string) $comment['user_id'] !== $userId) {
            throw new RuntimeException('Voce so pode excluir o proprio comentario.');
        }

        $this->db->prepare(
            "UPDATE legal_user_comments
             SET status = 'deleted', updated_at = NOW()
             WHERE id = :id"
        )->execute([':id' => (int) $commentId]);
    }

    public function reportUserComment(string $userId, string $commentId): array
    {
        $this->assertSchemaReady();

        $normalizedUserId = trim($userId);
        $normalizedCommentId = (int) $commentId;
        if ($normalizedUserId === '' || $normalizedCommentId <= 0) {
            throw new InvalidArgumentException('Comentario invalido para denuncia.');
        }

        $comment = $this->fetchUserCommentById($normalizedCommentId, false);
        if (!$comment) {
            throw new InvalidArgumentException('Comentario nao encontrado.');
        }
        if ((string) ($comment['user_id'] ?? '') === $normalizedUserId) {
            throw new DomainException('Voce nao pode denunciar o proprio comentario.');
        }

        $insert = $this->db->prepare(
            "INSERT IGNORE INTO legal_comment_reports (comment_id, user_id)
             VALUES (:comment_id, :user_id)"
        );
        $insert->execute([
            ':comment_id' => $normalizedCommentId,
            ':user_id' => $normalizedUserId,
        ]);
        if ($insert->rowCount() === 0) {
            return ['reported' => true, 'duplicate' => true];
        }

        $this->db->prepare(
            "UPDATE legal_user_comments
             SET status = 'reported', reported_count = reported_count + 1, updated_at = NOW()
             WHERE id = :id"
        )->execute([':id' => $normalizedCommentId]);

        return ['reported' => true, 'duplicate' => false];
    }

    public function setContentReaction(string $userId, string $targetKey, ?string $reactionValue): array
    {
        $this->assertSchemaReady();

        $normalizedTargetKey = trim($targetKey);
        if ($normalizedTargetKey === '') {
            throw new InvalidArgumentException('Informe o item avaliado.');
        }

        if (strlen($normalizedTargetKey) > 180) {
            $normalizedTargetKey = substr($normalizedTargetKey, 0, 180);
        }

        $normalizedReaction = $reactionValue !== null ? strtolower(trim($reactionValue)) : null;
        if ($normalizedReaction !== null && !in_array($normalizedReaction, ['like', 'dislike'], true)) {
            throw new InvalidArgumentException('Reacao invalida.');
        }

        if ($normalizedReaction === null || $normalizedReaction === '') {
            $stmt = $this->db->prepare(
                'DELETE FROM legal_content_reactions WHERE target_key = :target_key AND user_id = :user_id'
            );
            $stmt->execute([
                ':target_key' => $normalizedTargetKey,
                ':user_id' => $userId,
            ]);

            return $this->fetchContentReactionSummary($normalizedTargetKey, $userId);
        }

        $deletePreviousStmt = $this->db->prepare(
            'DELETE FROM legal_content_reactions WHERE target_key = :target_key AND user_id = :user_id'
        );
        $deletePreviousStmt->execute([
            ':target_key' => $normalizedTargetKey,
            ':user_id' => $userId,
        ]);

        $stmt = $this->db->prepare(
            "INSERT INTO legal_content_reactions (target_key, user_id, reaction_value)
             VALUES (:target_key, :user_id, :reaction_value)
             ON DUPLICATE KEY UPDATE reaction_value = VALUES(reaction_value), updated_at = NOW()"
        );
        $stmt->execute([
            ':target_key' => $normalizedTargetKey,
            ':user_id' => $userId,
            ':reaction_value' => $normalizedReaction,
        ]);

        return $this->fetchContentReactionSummary($normalizedTargetKey, $userId);
    }

    public function fetchContentReactionSummary(string $targetKey, ?string $userId = null): array
    {
        $this->assertSchemaReady();

        $normalizedTargetKey = trim($targetKey);
        if ($normalizedTargetKey !== '') {
            $this->deduplicateContentReactionsForTarget($normalizedTargetKey);
        }

        $stmt = $this->db->prepare(
            "SELECT
                SUM(CASE WHEN reaction_value = 'like' THEN 1 ELSE 0 END) AS likes,
                SUM(CASE WHEN reaction_value = 'dislike' THEN 1 ELSE 0 END) AS dislikes
             FROM legal_content_reactions
             WHERE target_key = :target_key"
        );
        $stmt->execute([':target_key' => $normalizedTargetKey]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $userReaction = null;
        if ($userId !== null && trim($userId) !== '') {
            $viewerStmt = $this->db->prepare(
                'SELECT reaction_value
                 FROM legal_content_reactions
                 WHERE target_key = :target_key
                   AND user_id = :user_id
                 LIMIT 1'
            );
            $viewerStmt->execute([
                ':target_key' => $normalizedTargetKey,
                ':user_id' => $userId,
            ]);
            $viewerReaction = (string) ($viewerStmt->fetchColumn() ?: '');
            $userReaction = in_array($viewerReaction, ['like', 'dislike'], true) ? $viewerReaction : null;
        }

        return [
            'targetKey' => $normalizedTargetKey,
            'likes' => (int) ($row['likes'] ?? 0),
            'dislikes' => (int) ($row['dislikes'] ?? 0),
            'userReaction' => $userReaction,
        ];
    }

    private function deduplicateContentReactionsForTarget(string $targetKey): void
    {
        $stmt = $this->db->prepare(
            'DELETE duplicate_reactions
             FROM legal_content_reactions duplicate_reactions
             INNER JOIN legal_content_reactions kept_reactions
                ON kept_reactions.target_key = duplicate_reactions.target_key
               AND kept_reactions.user_id = duplicate_reactions.user_id
               AND kept_reactions.id > duplicate_reactions.id
             WHERE duplicate_reactions.target_key = :target_key'
        );
        $stmt->execute([':target_key' => $targetKey]);
    }

    private function withContentReaction(array $payload, string $targetKey, ?string $viewerUserId = null): array
    {
        $normalizedTargetKey = trim($targetKey);
        if ($normalizedTargetKey === '') {
            return $payload;
        }

        $cacheKey = $normalizedTargetKey . ':' . ($viewerUserId ?? '');
        if (!array_key_exists($cacheKey, $this->contentReactionSummaryCache)) {
            $this->contentReactionSummaryCache[$cacheKey] = $this->fetchContentReactionSummary($normalizedTargetKey, $viewerUserId);
        }

        $summary = $this->contentReactionSummaryCache[$cacheKey];
        $payload['reactionKey'] = (string) ($summary['targetKey'] ?? $normalizedTargetKey);
        $payload['likes'] = (int) ($summary['likes'] ?? 0);
        $payload['dislikes'] = (int) ($summary['dislikes'] ?? 0);
        $payload['userReaction'] = in_array(($summary['userReaction'] ?? null), ['like', 'dislike'], true)
            ? (string) $summary['userReaction']
            : null;

        return $payload;
    }

    private function fetchUserCommentById(int $id, bool $mapped = true): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT luc.*,
                    u.plan AS user_plan,
                    u.role AS user_role,
                    u.photo_url AS user_avatar
             FROM legal_user_comments luc
             LEFT JOIN users u ON u.id = luc.user_id
             WHERE luc.id = :id
             LIMIT 1"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        return $mapped ? $this->mapUserComment($row) : $row;
    }

    public function fetchAdminAreas(): array
    {
        $this->assertSchemaReady();
        return $this->fetchAreas();
    }

    public function fetchAdminList(?string $query = null, int $limit = 31, ?int $cursorId = null): array
    {
        $this->assertSchemaReady();
        $favorites = []; $progress = [];
        $safeLimit = max(1, min(101, $limit)); $params = []; $whereParts = [];
        if ($query !== null && trim($query) !== '') {
            $whereParts[] = "(
                l.title LIKE :query OR l.short_title LIKE :query OR l.law_number LIKE :query OR
                l.acronym LIKE :query OR l.description LIKE :query OR l.summary LIKE :query OR
                l.ementa LIKE :query OR law_topic.name LIKE :query OR law_subject.name LIKE :query OR
                a.name LIKE :query
            )";
            $params[':query'] = '%' . trim($query) . '%';
        }
        if ($cursorId !== null && $cursorId > 0) {
            $whereParts[] = 'l.id < :cursor_id'; $params[':cursor_id'] = $cursorId;
        }
        $where = $whereParts === [] ? '' : 'WHERE ' . implode(' AND ', $whereParts);
        $stmt = $this->db->prepare($this->lawStatsSql() . "
            {$where}
            " . $this->lawStatsGroupBySql() . "
            ORDER BY l.id DESC
            LIMIT {$safeLimit}"
        );
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return array_map(function ($row) use ($favorites, $progress) {
            return $this->mapLawSummary($row, $favorites, $progress);
        }, $rows);
    }

    public function saveAdminPayload(array $payload, bool $preserveUnmatched = false): array
    {
        $this->assertSchemaReady();
        StaticSitemapMutationInvalidator::invalidate('LAW_CONTENT_MUTATION');
        $this->db->beginTransaction();

        try {
            $lawId = $this->upsertLaw($payload);
            $sectionIdMap = $this->syncSections(
                $lawId,
                is_array($payload['sections'] ?? null) ? $payload['sections'] : [],
                is_array($payload['articles'] ?? null) ? $payload['articles'] : [],
                $preserveUnmatched
            );
            $articleIdMap = $this->syncArticles($lawId, $payload['articles'] ?? [], $sectionIdMap, $preserveUnmatched);
            $this->syncNestedContent($articleIdMap, $payload['teacherComments'] ?? [], 'teacher_comments');
            $this->syncNestedContent($articleIdMap, $payload['jurisprudence'] ?? [], 'article_jurisprudence');
            $this->syncNestedContent($articleIdMap, $payload['examTips'] ?? [], 'article_exam_tips');
            $this->syncNestedContent($articleIdMap, $payload['sumulas'] ?? [], 'article_sumulas');
            if (array_key_exists('sectionEditorials', $payload)) {
                $this->syncSectionEditorials(
                    $lawId,
                    is_array($payload['sectionEditorials']) ? $payload['sectionEditorials'] : [],
                    $sectionIdMap,
                    $preserveUnmatched
                );
            }
            $this->db->commit();

            return $this->fetchLawDetail((string) $lawId, null, false) ?: ['id' => (string) $lawId];
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    public function deleteLaw(int $lawId, string $adminUserId = '', string $adminRole = ''): void
    {
        $this->assertSchemaReady();
        $ownership = $this->findLawOwnership($lawId);
        if ($ownership === null) {
            throw new InvalidArgumentException('Lei nao encontrada.');
        }

        if (strtolower(trim($adminRole)) !== 'admin') {
            $creatorId = trim((string) ($ownership['created_by_user_id'] ?? ''));
            if ($adminUserId === '' || $creatorId === '' || !hash_equals($creatorId, $adminUserId)) {
                throw new DomainException('Staff so pode excluir leis criadas por ele.');
            }
        }

        StaticSitemapMutationInvalidator::invalidate('LAW_CONTENT_MUTATION');
        $stmt = $this->db->prepare('DELETE FROM laws WHERE id = :id');
        $stmt->execute([':id' => $lawId]);
    }

    private function findLawOwnership(int $lawId): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id, created_by_user_id, updated_by_user_id, published_by_user_id
             FROM laws
             WHERE id = :id
             LIMIT 1'
        );
        $stmt->execute([':id' => $lawId]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function replaceArticleEditorialContent(int $lawId, int $articleId, array $editorial): array
    {
        $this->assertSchemaReady();

        if ($lawId <= 0 || $articleId <= 0) {
            throw new InvalidArgumentException('Lei ou artigo invalido para persistir o editorial.');
        }

        $stmt = $this->db->prepare(
            "SELECT id
             FROM law_articles
             WHERE id = :article_id AND law_id = :law_id
             LIMIT 1"
        );
        $stmt->execute([
            ':article_id' => $articleId,
            ':law_id' => $lawId,
        ]);

        if (!(int) $stmt->fetchColumn()) {
            throw new InvalidArgumentException('Artigo nao encontrado para atualizar o editorial.');
        }

        StaticSitemapMutationInvalidator::invalidate('LAW_CONTENT_MUTATION');
        $this->db->beginTransaction();

        try {
            $this->db->prepare(
                "UPDATE law_articles
                 SET doctrine_json = :doctrine_json,
                     jurisprudence_notes_json = :jurisprudence_notes_json,
                     updated_at = NOW()
                 WHERE id = :article_id AND law_id = :law_id"
            )->execute([
                ':doctrine_json' => $this->jsonEncode($editorial['doctrine'] ?? []),
                ':jurisprudence_notes_json' => $this->jsonEncode($editorial['jurisprudenceNotes'] ?? []),
                ':article_id' => $articleId,
                ':law_id' => $lawId,
            ]);

            $articleIdMap = [(string) $articleId => $articleId];
            $this->syncNestedContent($articleIdMap, $editorial['teacherComments'] ?? [], 'teacher_comments');
            $this->syncNestedContent($articleIdMap, $editorial['jurisprudence'] ?? [], 'article_jurisprudence');
            $this->syncNestedContent($articleIdMap, $editorial['examTips'] ?? [], 'article_exam_tips');
            $this->syncNestedContent($articleIdMap, $editorial['sumulas'] ?? [], 'article_sumulas');

            $this->db->commit();
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }

        return $this->fetchArticleEditorialSnapshot($lawId, $articleId);
    }

    public function replaceSectionEditorialContent(int $lawId, array $editorial): array
    {
        $this->assertSchemaReady();

        if ($lawId <= 0) {
            throw new InvalidArgumentException('Lei invalida para persistir a analise do capitulo.');
        }

        $sectionId = (int) ($editorial['sectionId'] ?? $editorial['section_id'] ?? 0);
        if ($sectionId <= 0) {
            throw new InvalidArgumentException('Informe o capitulo para persistir a analise.');
        }

        StaticSitemapMutationInvalidator::invalidate('LAW_CONTENT_MUTATION');
        $this->upsertSectionEditorial($lawId, $editorial);

        $stmt = $this->db->prepare(
            "SELECT *
             FROM law_section_editorials
             WHERE law_id = :law_id AND section_id = :section_id
             LIMIT 1"
        );
        $stmt->execute([
            ':law_id' => $lawId,
            ':section_id' => $sectionId,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            throw new RuntimeException('Analise do capitulo nao foi encontrada apos salvar.');
        }

        return $this->mapSectionEditorial($row);
    }

    public function fetchArticleEditorialSnapshot(int $lawId, int $articleId): array
    {
        $this->assertSchemaReady();

        $articleStmt = $this->db->prepare(
            "SELECT *
             FROM law_articles
             WHERE id = :article_id AND law_id = :law_id
             LIMIT 1"
        );
        $articleStmt->execute([
            ':article_id' => $articleId,
            ':law_id' => $lawId,
        ]);
        $articleRow = $articleStmt->fetch(PDO::FETCH_ASSOC);

        if (!$articleRow) {
            throw new InvalidArgumentException('Artigo nao encontrado para montar o editorial.');
        }

        $favorites = [];
        $teacherRows = $this->articleReads->fetchRowsForArticles('teacher_comments', [(string) $articleId]);
        $jurisprudenceRows = $this->articleReads->fetchRowsForArticles('article_jurisprudence', [(string) $articleId]);
        $examTipRows = $this->articleReads->fetchRowsForArticles('article_exam_tips', [(string) $articleId]);
        $sumulaRows = $this->articleReads->fetchRowsForArticles('article_sumulas', [(string) $articleId]);

        return [
            'articleId' => (string) $articleId,
            'articleNumber' => (string) ($articleRow['article_number'] ?? ''),
            'teacherComments' => array_map(fn ($item) => $this->mapTeacherComment($item, $favorites), $teacherRows),
            'jurisprudenceNotes' => $this->jsonDecode($articleRow['jurisprudence_notes_json'] ?? null, []),
            'jurisprudence' => array_map(fn ($item) => $this->mapJurisprudence($item, $favorites), $jurisprudenceRows),
            'examTips' => array_map([$this, 'mapExamTip'], $examTipRows),
            'sumulas' => array_map([$this, 'mapSumula'], $sumulaRows),
            'doctrine' => $this->jsonDecode($articleRow['doctrine_json'] ?? null, []),
        ];
    }

    public function createAiBatchRun(int $lawId, ?string $adminUserId = null, array $articleIds = []): array
    {
        $this->assertSchemaReady();

        $articleRows = $this->articleReads->fetchBatchArticleRows($lawId, $articleIds);
        if (empty($articleRows)) {
            throw new InvalidArgumentException('Nenhum artigo valido foi encontrado para iniciar o lote.');
        }

        $this->db->beginTransaction();

        try {
            $stmt = $this->db->prepare(
                "INSERT INTO legal_ai_batch_runs (
                    law_id, triggered_by, requested_scope, status, total_articles, started_at
                ) VALUES (
                    :law_id, :triggered_by, 'article-full', 'running', :total_articles, NOW()
                )"
            );
            $stmt->execute([
                ':law_id' => $lawId,
                ':triggered_by' => $this->nullableString($adminUserId),
                ':total_articles' => count($articleRows),
            ]);
            $runId = (int) $this->db->lastInsertId();

            $itemStmt = $this->db->prepare(
                "INSERT INTO legal_ai_batch_items (
                    batch_run_id, law_article_id, article_number, status
                ) VALUES (
                    :batch_run_id, :law_article_id, :article_number, 'pending'
                )"
            );

            foreach ($articleRows as $row) {
                $itemStmt->execute([
                    ':batch_run_id' => $runId,
                    ':law_article_id' => (int) $row['id'],
                    ':article_number' => (string) $row['article_number'],
                ]);
            }

            $this->db->commit();
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }

        return $this->fetchAiBatchRun($runId) ?: ['id' => (string) $runId];
    }

    public function fetchAiBatchRun(int $runId): ?array
    {
        $this->assertSchemaReady();

        $stmt = $this->db->prepare(
            "SELECT *
             FROM legal_ai_batch_runs
             WHERE id = :id
             LIMIT 1"
        );
        $stmt->execute([':id' => $runId]);
        $runRow = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$runRow) {
            return null;
        }

        return $this->mapAiBatchRun($runRow);
    }

    public function fetchLatestAiBatchRunForLaw(int $lawId): ?array
    {
        $this->assertSchemaReady();

        $stmt = $this->db->prepare(
            "SELECT *
             FROM legal_ai_batch_runs
             WHERE law_id = :law_id
             ORDER BY started_at DESC, id DESC
             LIMIT 1"
        );
        $stmt->execute([':law_id' => $lawId]);
        $runRow = $stmt->fetch(PDO::FETCH_ASSOC);

        return $runRow ? $this->mapAiBatchRun($runRow) : null;
    }

    public function createRetryAiBatchRun(int $sourceRunId, ?string $adminUserId = null): array
    {
        $this->assertSchemaReady();

        $stmt = $this->db->prepare(
            "SELECT law_id
             FROM legal_ai_batch_runs
             WHERE id = :id
             LIMIT 1"
        );
        $stmt->execute([':id' => $sourceRunId]);
        $lawId = (int) $stmt->fetchColumn();

        if ($lawId <= 0) {
            throw new InvalidArgumentException('Lote original nao encontrado para reprocessamento.');
        }

        $itemStmt = $this->db->prepare(
            "SELECT law_article_id
             FROM legal_ai_batch_items
             WHERE batch_run_id = :batch_run_id
               AND status = 'failed'
             ORDER BY id"
        );
        $itemStmt->execute([':batch_run_id' => $sourceRunId]);
        $articleIds = array_map('intval', $itemStmt->fetchAll(PDO::FETCH_COLUMN) ?: []);

        if (empty($articleIds)) {
            throw new InvalidArgumentException('Nao ha artigos falhados para reprocessar neste lote.');
        }

        return $this->createAiBatchRun($lawId, $adminUserId, $articleIds);
    }

    public function stopAiBatchRun(int $runId): ?array
    {
        $this->assertSchemaReady();

        $stmt = $this->db->prepare(
            "SELECT id
             FROM legal_ai_batch_runs
             WHERE id = :id
             LIMIT 1"
        );
        $stmt->execute([':id' => $runId]);
        if (!(int) $stmt->fetchColumn()) {
            return null;
        }

        $this->db->beginTransaction();

        try {
            $this->db->prepare(
                "UPDATE legal_ai_batch_items
                 SET status = 'stopped',
                     finished_at = NOW(),
                     updated_at = NOW()
                 WHERE batch_run_id = :batch_run_id
                   AND status IN ('pending', 'running')"
            )->execute([':batch_run_id' => $runId]);

            $countsStmt = $this->db->prepare(
                "SELECT
                    COUNT(*) AS total_articles,
                    SUM(CASE WHEN status IN ('success', 'partial', 'failed', 'stopped') THEN 1 ELSE 0 END) AS processed_articles,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successful_articles,
                    SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) AS partial_articles,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_articles
                 FROM legal_ai_batch_items
                 WHERE batch_run_id = :batch_run_id"
            );
            $countsStmt->execute([':batch_run_id' => $runId]);
            $counts = $countsStmt->fetch(PDO::FETCH_ASSOC) ?: [];

            $this->db->prepare(
                "UPDATE legal_ai_batch_runs
                 SET status = 'stopped',
                     total_articles = :total_articles,
                     processed_articles = :processed_articles,
                     successful_articles = :successful_articles,
                     failed_articles = :failed_articles,
                     partial_articles = :partial_articles,
                     finished_at = NOW(),
                     updated_at = NOW()
                 WHERE id = :id"
            )->execute([
                ':total_articles' => (int) ($counts['total_articles'] ?? 0),
                ':processed_articles' => (int) ($counts['processed_articles'] ?? 0),
                ':successful_articles' => (int) ($counts['successful_articles'] ?? 0),
                ':failed_articles' => (int) ($counts['failed_articles'] ?? 0),
                ':partial_articles' => (int) ($counts['partial_articles'] ?? 0),
                ':id' => $runId,
            ]);

            $this->db->commit();
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }

        return $this->fetchAiBatchRun($runId);
    }

    public function markAiBatchItemRunning(int $runId, int $articleId): void
    {
        $this->assertSchemaReady();

        $this->db->prepare(
            "UPDATE legal_ai_batch_items
             SET status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
             WHERE batch_run_id = :batch_run_id AND law_article_id = :law_article_id"
        )->execute([
            ':batch_run_id' => $runId,
            ':law_article_id' => $articleId,
        ]);

        $this->db->prepare(
            "UPDATE legal_ai_batch_runs
             SET status = 'running', updated_at = NOW()
             WHERE id = :id"
        )->execute([':id' => $runId]);
    }

    public function recordAiBatchItemResult(int $runId, int $articleId, array $result): array
    {
        $this->assertSchemaReady();

        $this->db->beginTransaction();

        try {
            $status = (string) ($result['status'] ?? 'partial');
            $stageAStatus = (string) ($result['stageAStatus'] ?? 'skipped');
            $stageBStatus = (string) ($result['stageBStatus'] ?? 'skipped');
            $stageCStatus = (string) ($result['stageCStatus'] ?? 'skipped');
            $error = $this->nullableString($result['error'] ?? null);

            $this->db->prepare(
                "UPDATE legal_ai_batch_items
                 SET status = :status,
                     stage_a_status = :stage_a_status,
                     stage_b_status = :stage_b_status,
                     stage_c_status = :stage_c_status,
                     error_message = :error_message,
                     warnings_json = :warnings_json,
                     result_json = :result_json,
                     attempts_json = :attempts_json,
                     started_at = COALESCE(started_at, NOW()),
                     finished_at = NOW(),
                     updated_at = NOW()
                 WHERE batch_run_id = :batch_run_id
                   AND law_article_id = :law_article_id"
            )->execute([
                ':status' => $status,
                ':stage_a_status' => $stageAStatus,
                ':stage_b_status' => $stageBStatus,
                ':stage_c_status' => $stageCStatus,
                ':error_message' => $error,
                ':warnings_json' => $this->jsonEncode($result['warnings'] ?? []),
                ':result_json' => $this->jsonEncode($result['result'] ?? []),
                ':attempts_json' => $this->jsonEncode($result['attempts'] ?? []),
                ':batch_run_id' => $runId,
                ':law_article_id' => $articleId,
            ]);

            $countsStmt = $this->db->prepare(
                "SELECT
                    COUNT(*) AS total_articles,
                    SUM(CASE WHEN status IN ('success', 'partial', 'failed') THEN 1 ELSE 0 END) AS processed_articles,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successful_articles,
                    SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) AS partial_articles,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_articles,
                    SUM(CASE WHEN status IN ('pending', 'running') THEN 1 ELSE 0 END) AS open_items
                 FROM legal_ai_batch_items
                 WHERE batch_run_id = :batch_run_id"
            );
            $countsStmt->execute([':batch_run_id' => $runId]);
            $counts = $countsStmt->fetch(PDO::FETCH_ASSOC) ?: [];

            $runStatus = 'running';
            if ((int) ($counts['open_items'] ?? 0) === 0) {
                if ((int) ($counts['failed_articles'] ?? 0) > 0) {
                    $runStatus = 'partial';
                } elseif ((int) ($counts['partial_articles'] ?? 0) > 0) {
                    $runStatus = 'partial';
                } else {
                    $runStatus = 'completed';
                }
            }

            $this->db->prepare(
                "UPDATE legal_ai_batch_runs
                 SET status = :status,
                     total_articles = :total_articles,
                     processed_articles = :processed_articles,
                     successful_articles = :successful_articles,
                     failed_articles = :failed_articles,
                     partial_articles = :partial_articles,
                     last_error = :last_error,
                     finished_at = CASE WHEN :is_finished = 1 THEN NOW() ELSE finished_at END,
                     updated_at = NOW()
                 WHERE id = :id"
            )->execute([
                ':status' => $runStatus,
                ':total_articles' => (int) ($counts['total_articles'] ?? 0),
                ':processed_articles' => (int) ($counts['processed_articles'] ?? 0),
                ':successful_articles' => (int) ($counts['successful_articles'] ?? 0),
                ':failed_articles' => (int) ($counts['failed_articles'] ?? 0),
                ':partial_articles' => (int) ($counts['partial_articles'] ?? 0),
                ':last_error' => $error,
                ':is_finished' => (int) ((int) ($counts['open_items'] ?? 0) === 0),
                ':id' => $runId,
            ]);

            $this->db->commit();
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }

        return $this->fetchAiBatchRun($runId) ?: ['id' => (string) $runId];
    }

    public function findLawIdByOfficialUrl(string $url): ?int
    {
        $this->assertSchemaReady();

        $stmt = $this->db->prepare(
            "SELECT id
             FROM laws
             WHERE official_url = :official_url
             LIMIT 1"
        );
        $stmt->execute([':official_url' => trim($url)]);
        $id = (int) $stmt->fetchColumn();

        return $id > 0 ? $id : null;
    }

    public function fetchCatalogSnapshotByOfficialUrl(): array
    {
        $this->assertSchemaReady();

        $stmt = $this->db->query(
            "SELECT
                id,
                official_url,
                short_title,
                last_synced_at,
                last_updated_at
            FROM laws"
        );

        $snapshot = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $url = trim((string) ($row['official_url'] ?? ''));
            if ($url === '') {
                continue;
            }

            $snapshot[$url] = [
                'lawId' => (string) ($row['id'] ?? ''),
                'platformTitle' => (string) ($row['short_title'] ?? ''),
                'lastSyncedAt' => $this->normalizeDateTime($row['last_synced_at'] ?? null),
                'lastUpdatedAt' => $this->normalizeDateTime($row['last_updated_at'] ?? null),
            ];
        }

        return $snapshot;
    }

    public function resolveAreaIdBySlug(string $slug): int
    {
        return $this->resolveAreaId($slug);
    }

    public function ensureLegalTaxonomies(string $subjectName, ?string $topicName = null): array
    {
        $this->assertSchemaReady();

        $subjectId = $this->findOrCreateAssunto($subjectName, null, true, null, 'materia');
        $topicId = null;

        if ($topicName !== null && trim($topicName) !== '') {
            $topicId = $this->findOrCreateAssunto($topicName, $subjectId, false, $subjectName, 'topico');
        }

        return [
            'subjectId' => $subjectId,
            'topicId' => $topicId,
        ];
    }

    public function ensureLegalTaxonomyHierarchy(
        string $subjectName,
        string $lawTopicName,
        ?string $subtopicName = null,
        ?string $assuntoName = null
    ): array
    {
        $this->assertSchemaReady();

        $subjectId = $this->findOrCreateAssunto($subjectName, null, true, null, 'materia');
        $lawTopicId = $this->findOrCreateAssunto($lawTopicName, $subjectId, false, $subjectName, 'topico');
        $subtopicId = null;
        $assuntoId = null;
        $assuntoParentId = $lawTopicId;

        if ($subtopicName !== null && trim($subtopicName) !== '') {
            $subtopicContext = trim($subjectName . ' ' . $lawTopicName);
            $subtopicId = $this->findOrCreateAssunto($subtopicName, $lawTopicId, false, $subtopicContext, 'subtopico');
            $assuntoParentId = $subtopicId;
        }

        if ($assuntoName !== null && trim($assuntoName) !== '') {
            $assuntoContext = trim($subjectName . ' ' . $lawTopicName);
            $assuntoId = $this->findOrCreateAssunto($assuntoName, $assuntoParentId, false, $assuntoContext, 'assunto');
        }

        return [
            'subjectId' => $subjectId,
            'lawTopicId' => $lawTopicId,
            'subtopicId' => $subtopicId,
            'assuntoId' => $assuntoId,
        ];
    }

    public function recordSyncLog(
        ?int $lawId,
        string $status,
        string $message,
        ?string $sourceUrl = null,
        int $insertedArticles = 0,
        int $changedArticles = 0,
        int $revokedArticles = 0
    ): void {
        $this->assertSchemaReady();

        $stmt = $this->db->prepare(
            "INSERT INTO legal_sync_logs (
                law_id,
                status,
                started_at,
                finished_at,
                source_url,
                message,
                inserted_articles,
                changed_articles,
                revoked_articles
            ) VALUES (
                :law_id,
                :status,
                NOW(),
                NOW(),
                :source_url,
                :message,
                :inserted_articles,
                :changed_articles,
                :revoked_articles
            )"
        );
        $stmt->execute([
            ':law_id' => $lawId,
            ':status' => $status,
            ':source_url' => $sourceUrl,
            ':message' => $message,
            ':inserted_articles' => max(0, $insertedArticles),
            ':changed_articles' => max(0, $changedArticles),
            ':revoked_articles' => max(0, $revokedArticles),
        ]);
    }

    public function fetchAdminUpdateSnapshot(string $identifier): array
    {
        $law = $this->fetchLawDetail($identifier, null, false);
        if (!$law) {
            throw new RuntimeException('Lei nao encontrada.', 404);
        }

        return [
            'law' => $law,
            'updates' => $law['updates'] ?? [],
            'syncLogs' => $this->fetchSyncLogs((int) $law['id']),
        ];
    }

    public function fetchSyncLogs(?int $lawId = null, int $limit = 80): array
    {
        $this->assertSchemaReady();

        if ($lawId !== null && $lawId > 0) {
            $stmt = $this->db->prepare(
                "SELECT *
                 FROM legal_sync_logs
                 WHERE law_id = :law_id
                 ORDER BY started_at DESC
                 LIMIT {$limit}"
            );
            $stmt->execute([':law_id' => $lawId]);
        } else {
            $stmt = $this->db->query(
                "SELECT *
                 FROM legal_sync_logs
                 ORDER BY started_at DESC
                 LIMIT {$limit}"
            );
        }

        return array_map([$this, 'mapSyncLog'], $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    public function recordSyncOutcome(?array $previousLaw, array $savedLaw, string $sourceUrl, string $rawSnapshot, array $syncStats): void
    {
        $this->assertSchemaReady();

        $lawId = (int) ($savedLaw['id'] ?? 0);
        if ($lawId <= 0) {
            return;
        }

        $insertedArticles = (int) ($syncStats['insertedArticles'] ?? 0);
        $changedArticles = (int) ($syncStats['changedArticles'] ?? 0);
        $revokedArticles = (int) ($syncStats['revokedArticles'] ?? 0);
        $isInitialImport = $previousLaw === null || !$this->lawHasVersionHistory($lawId);
        $hasTrackedChanges = !$isInitialImport && ($insertedArticles > 0 || $changedArticles > 0 || $revokedArticles > 0);
        $shouldRecordVersion = $isInitialImport || $hasTrackedChanges;
        $message = $hasTrackedChanges
            ? "Sincronizacao registrada: {$insertedArticles} artigo(s) novo(s), {$changedArticles} alterado(s), {$revokedArticles} revogado(s)."
            : ($isInitialImport
                ? 'Importacao inicial registrada como versao base da lei.'
                : 'Sincronizacao concluida sem alteracoes no texto oficial.');

        $this->db->beginTransaction();

        try {
            $this->db->prepare(
                "UPDATE laws
                 SET last_imported_at = COALESCE(last_imported_at, NOW()),
                     last_synced_at = NOW(),
                     last_updated_at = CASE WHEN :has_tracked_changes = 1 THEN NOW() ELSE last_updated_at END,
                     is_recently_updated = :is_recently_updated,
                     sync_status = 'success',
                     sync_message = :sync_message
                 WHERE id = :id"
            )->execute([
                ':has_tracked_changes' => $hasTrackedChanges ? 1 : 0,
                ':is_recently_updated' => $hasTrackedChanges ? 1 : 0,
                ':sync_message' => $message,
                ':id' => $lawId,
            ]);

            $this->db->prepare('UPDATE law_articles SET is_recently_changed = 0 WHERE law_id = :law_id')
                ->execute([':law_id' => $lawId]);

            if (!$shouldRecordVersion) {
                $this->db->commit();
                return;
            }

            $versionNumber = $this->nextLawVersionNumber($lawId);
            $versionStmt = $this->db->prepare(
                "INSERT INTO law_versions (
                    law_id,
                    version_number,
                    source_url,
                    source_hash,
                    metadata_json,
                    raw_snapshot
                ) VALUES (
                    :law_id,
                    :version_number,
                    :source_url,
                    :source_hash,
                    :metadata_json,
                    :raw_snapshot
                )"
            );
            $versionStmt->execute([
                ':law_id' => $lawId,
                ':version_number' => $versionNumber,
                ':source_url' => $sourceUrl,
                ':source_hash' => hash('sha256', $rawSnapshot),
                ':metadata_json' => $this->jsonEncode([
                    'title' => $savedLaw['shortTitle'] ?? $savedLaw['title'] ?? '',
                    'number' => $savedLaw['number'] ?? '',
                    'year' => $savedLaw['year'] ?? '',
                    'sync' => $syncStats,
                ]),
                ':raw_snapshot' => $rawSnapshot,
            ]);
            $lawVersionId = (int) $this->db->lastInsertId();

            $previousByKey = $this->indexArticlesBySyncKey($previousLaw['articles'] ?? []);
            $currentByKey = $this->indexArticlesBySyncKey($savedLaw['articles'] ?? []);

            foreach ($currentByKey as $articleKey => $currentArticle) {
                $number = trim((string) ($currentArticle['number'] ?? $currentArticle['article_number'] ?? $articleKey));
                $previousArticle = $previousByKey[$articleKey] ?? null;
                $previousHash = $previousArticle ? $this->hashArticlePayload($previousArticle) : null;
                $currentHash = $this->hashArticlePayload($currentArticle);
                $changeType = $isInitialImport ? 'baseline' : 'unchanged';

                if (!$isInitialImport && $previousArticle === null) {
                    $changeType = 'created';
                } elseif (!$isInitialImport && $previousHash !== $currentHash) {
                    $changeType = 'changed';
                }

                if (!$isInitialImport && $changeType === 'unchanged') {
                    continue;
                }

                $this->recordArticleVersion(
                    $lawVersionId,
                    (int) ($currentArticle['id'] ?? 0),
                    $number,
                    $changeType,
                    $previousHash,
                    $currentHash,
                    $previousArticle ? $this->articleTextFromPayload($previousArticle) : null,
                    $this->articleTextFromPayload($currentArticle),
                    $currentArticle['blocks'] ?? []
                );

                if (!$isInitialImport && ($changeType === 'created' || $changeType === 'changed')) {
                    $this->db->prepare('UPDATE law_articles SET is_recently_changed = 1 WHERE id = :id')
                        ->execute([':id' => (int) ($currentArticle['id'] ?? 0)]);

                    $this->recordLawUpdateEvent(
                        $lawId,
                        (int) ($currentArticle['id'] ?? 0),
                        $changeType,
                        'Art. ' . $number,
                        $this->buildChangeSummary($changeType, $number),
                        $previousArticle ? $this->articleTextFromPayload($previousArticle) : null,
                        $this->articleTextFromPayload($currentArticle),
                        $sourceUrl
                    );

                    if ($changeType === 'changed') {
                        $this->recordEditorialReviewRequiredForChangedArticle($lawId, $currentArticle, $number, $sourceUrl);
                    }
                }
            }

            if (!$isInitialImport) {
                foreach ($previousByKey as $articleKey => $previousArticle) {
                    if (isset($currentByKey[$articleKey])) {
                        continue;
                    }

                    $number = trim((string) ($previousArticle['number'] ?? $previousArticle['article_number'] ?? $articleKey));
                    $previousText = $this->articleTextFromPayload($previousArticle);
                    $this->recordArticleVersion(
                        $lawVersionId,
                        null,
                        $number,
                        'revoked',
                        $this->hashArticlePayload($previousArticle),
                        null,
                        $previousText,
                        null,
                        []
                    );
                    $this->recordLawUpdateEvent(
                        $lawId,
                        null,
                        'revoked',
                        'Art. ' . $number,
                        $this->buildChangeSummary('revoked', $number),
                        $previousText,
                        null,
                        $sourceUrl
                    );
                }
            }

            $this->db->commit();
            if ($hasTrackedChanges) {
                $this->notifyInterestedUsersAboutLawUpdate($lawId, $savedLaw, $syncStats);
            }
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function recordSyncFailure(?int $lawId, string $sourceUrl, Throwable $error): void
    {
        $this->assertSchemaReady();

        $this->recordSyncLog(
            $lawId,
            'failed',
            $error->getMessage(),
            $sourceUrl,
            0,
            0,
            0
        );

        $this->db->prepare(
            "INSERT INTO sync_errors (law_id, source_url, error_code, message, context_json)
             VALUES (:law_id, :source_url, :error_code, :message, :context_json)"
        )->execute([
            ':law_id' => $lawId,
            ':source_url' => $sourceUrl,
            ':error_code' => (string) $error->getCode(),
            ':message' => $error->getMessage(),
            ':context_json' => $this->jsonEncode([
                'file' => $error->getFile(),
                'line' => $error->getLine(),
            ]),
        ]);
    }

    public function fetchSyncCandidates(int $limit = 10): array
    {
        $this->assertSchemaReady();

        $safeLimit = max(1, min($limit, 50));
        $stmt = $this->db->query(
            "SELECT id, slug, short_title, title, official_url, last_imported_at, last_synced_at
             FROM laws
             WHERE status = 'active'
               AND official_url LIKE '%planalto.gov.br%'
             ORDER BY COALESCE(last_synced_at, last_imported_at, created_at) ASC, id ASC
             LIMIT {$safeLimit}"
        );

        return $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
    }

    private function lawHasVersionHistory(int $lawId): bool
    {
        $stmt = $this->db->prepare(
            "SELECT 1
             FROM law_versions
             WHERE law_id = :law_id
             LIMIT 1"
        );
        $stmt->execute([':law_id' => $lawId]);

        return (bool) $stmt->fetchColumn();
    }

    private function nextLawVersionNumber(int $lawId): int
    {
        $stmt = $this->db->prepare(
            "SELECT COALESCE(MAX(version_number), 0) + 1
             FROM law_versions
             WHERE law_id = :law_id"
        );
        $stmt->execute([':law_id' => $lawId]);

        return max(1, (int) $stmt->fetchColumn());
    }

    private function indexArticlesByNumber(array $articles): array
    {
        $indexed = [];
        foreach ($articles as $article) {
            $number = trim((string) ($article['number'] ?? $article['article_number'] ?? ''));
            if ($number !== '') {
                $indexed[$number] = $article;
            }
        }

        return $indexed;
    }

    private function indexArticlesBySyncKey(array $articles): array
    {
        $indexed = [];
        foreach ($articles as $article) {
            $key = trim((string) ($article['slug'] ?? ''));
            if ($key === '') {
                $key = trim((string) ($article['number'] ?? $article['article_number'] ?? ''));
            }

            if ($key !== '') {
                $indexed[$key] = $article;
            }
        }

        return $indexed;
    }

    private function hashArticlePayload(array $article): string
    {
        return hash('sha256', $this->articleTextFromPayload($article));
    }

    private function articleTextFromPayload(array $article): string
    {
        $blocks = $article['blocks'] ?? [];
        if (is_array($blocks) && !empty($blocks)) {
            $parts = [];
            foreach ($blocks as $block) {
                $kind = trim((string) ($block['kind'] ?? ''));
                $marker = trim((string) ($block['marker'] ?? ''));
                $label = trim((string) ($block['label'] ?? ''));
                $text = trim((string) ($block['text'] ?? ''));
                if ($label !== '' || $text !== '') {
                    $parts[] = trim($kind . ' ' . $marker . ' ' . $label . ' ' . $text);
                }
            }

            return preg_replace('/\s+/', ' ', implode("\n", $parts)) ?: '';
        }

        return preg_replace('/\s+/', ' ', trim((string) ($article['text'] ?? $article['official_text'] ?? ''))) ?: '';
    }

    private function recordArticleVersion(
        int $lawVersionId,
        ?int $articleId,
        string $articleNumber,
        string $changeType,
        ?string $previousHash,
        ?string $currentHash,
        ?string $previousText,
        ?string $currentText,
        array $blocks
    ): void {
        $stmt = $this->db->prepare(
            "INSERT INTO law_article_versions (
                law_version_id,
                law_article_id,
                article_number,
                change_type,
                previous_hash,
                current_hash,
                previous_text,
                current_text,
                blocks_json
            ) VALUES (
                :law_version_id,
                :law_article_id,
                :article_number,
                :change_type,
                :previous_hash,
                :current_hash,
                :previous_text,
                :current_text,
                :blocks_json
            )"
        );
        $stmt->execute([
            ':law_version_id' => $lawVersionId,
            ':law_article_id' => $articleId !== null && $articleId > 0 ? $articleId : null,
            ':article_number' => $articleNumber,
            ':change_type' => $changeType,
            ':previous_hash' => $previousHash,
            ':current_hash' => $currentHash,
            ':previous_text' => $previousText,
            ':current_text' => $currentText,
            ':blocks_json' => $this->jsonEncode($blocks),
        ]);
    }

    private function recordLawUpdateEvent(
        int $lawId,
        ?int $articleId,
        string $changeType,
        string $title,
        string $summary,
        ?string $previousText,
        ?string $currentText,
        string $sourceUrl
    ): void {
        $stmt = $this->db->prepare(
            "INSERT INTO law_updates (
                law_id,
                law_article_id,
                changed_at,
                change_type,
                title,
                summary,
                previous_text,
                current_text,
                source_url,
                exam_impact
            ) VALUES (
                :law_id,
                :law_article_id,
                NOW(),
                :change_type,
                :title,
                :summary,
                :previous_text,
                :current_text,
                :source_url,
                NULL
            )"
        );
        $stmt->execute([
            ':law_id' => $lawId,
            ':law_article_id' => $articleId !== null && $articleId > 0 ? $articleId : null,
            ':change_type' => $changeType,
            ':title' => $title,
            ':summary' => $summary,
            ':previous_text' => $previousText,
            ':current_text' => $currentText,
            ':source_url' => $sourceUrl,
        ]);
    }

    private function recordEditorialReviewRequiredForChangedArticle(int $lawId, array $article, string $number, string $sourceUrl): void
    {
        $articleId = (int) ($article['id'] ?? 0);
        if ($articleId <= 0) {
            return;
        }

        $labels = $this->getArticleEditorialReviewLabels($article);
        if (empty($labels)) {
            return;
        }

        $this->recordLawUpdateEvent(
            $lawId,
            $articleId,
            'editorial_review_required',
            'Revisao editorial do Art. ' . $number,
            'O texto oficial do artigo mudou. Revise ' . implode(', ', $labels) . ' vinculados a este artigo para evitar conteudo desatualizado.',
            null,
            null,
            $sourceUrl
        );
    }

    private function getArticleEditorialReviewLabels(array $article): array
    {
        $labels = [];

        if (
            $this->hasEditorialPayload($article['comentarios'] ?? [])
            || $this->hasEditorialPayload($article['teacherComments'] ?? [])
        ) {
            $labels[] = 'comentarios do professor';
        }

        if (
            $this->hasEditorialPayload($article['macete'] ?? null)
            || $this->hasEditorialPayload($article['examTip'] ?? null)
            || $this->hasEditorialPayload($article['examTips'] ?? [])
        ) {
            $labels[] = 'macetes';
        }

        if (
            $this->hasEditorialPayload($article['doutrina'] ?? [])
            || $this->hasEditorialPayload($article['doctrine'] ?? [])
        ) {
            $labels[] = 'doutrina';
        }

        if (
            $this->hasEditorialPayload($article['jurisprudencia'] ?? [])
            || $this->hasEditorialPayload($article['jurisprudence'] ?? [])
            || $this->hasEditorialPayload($article['jurisprudenceNotes'] ?? [])
        ) {
            $labels[] = 'jurisprudencia';
        }

        if (
            $this->hasEditorialPayload($article['sumulas'] ?? [])
            || $this->hasEditorialPayload($article['syllabi'] ?? [])
        ) {
            $labels[] = 'sumulas';
        }

        return array_values(array_unique($labels));
    }

    private function hasEditorialPayload(mixed $value): bool
    {
        if ($value === null) {
            return false;
        }

        if (is_string($value) || is_numeric($value)) {
            return trim(strip_tags((string) $value)) !== '';
        }

        if (!is_array($value)) {
            return false;
        }

        foreach ($value as $key => $item) {
            if (in_array((string) $key, ['target', 'id', 'articleId', 'lawArticleId', 'blockId'], true)) {
                continue;
            }

            if ($this->hasEditorialPayload($item)) {
                return true;
            }
        }

        return false;
    }

    private function buildChangeSummary(string $changeType, string $number): string
    {
        return match ($changeType) {
            'created' => 'Artigo ' . $number . ' incluido no texto oficial sincronizado.',
            'revoked' => 'Artigo ' . $number . ' deixou de aparecer no texto oficial sincronizado.',
            default => 'Artigo ' . $number . ' teve alteracao no texto oficial sincronizado.',
        };
    }

    private function notifyInterestedUsersAboutLawUpdate(int $lawId, array $savedLaw, array $syncStats): void
    {
        require_once __DIR__ . '/../../../config/notification_helper.php';

        $lawSlug = trim((string) ($savedLaw['slug'] ?? ''));
        $lawTitle = trim((string) ($savedLaw['shortTitle'] ?? $savedLaw['title'] ?? 'Lei Comentada'));
        $inserted = (int) ($syncStats['insertedArticles'] ?? 0);
        $changed = (int) ($syncStats['changedArticles'] ?? 0);
        $revoked = (int) ($syncStats['revokedArticles'] ?? 0);
        $messageParts = [];

        if ($inserted > 0) {
            $messageParts[] = $inserted . ' artigo(s) novo(s)';
        }
        if ($changed > 0) {
            $messageParts[] = $changed . ' artigo(s) alterado(s)';
        }
        if ($revoked > 0) {
            $messageParts[] = $revoked . ' artigo(s) removido(s) do texto oficial';
        }

        $message = $lawTitle . ' teve atualizacao posterior a sua inclusao na plataforma: '
            . implode(', ', $messageParts) . '.';
        $link = $lawSlug !== '' ? '/lei-comentada/' . rawurlencode($lawSlug) : '/lei-comentada';

        foreach ($this->fetchInterestedUserIdsForLaw($lawId, $lawSlug) as $userId) {
            createNotification(
                $this->db,
                $userId,
                'Lei atualizada: ' . $lawTitle,
                $message,
                'info',
                'legal_updates',
                $link
            );
        }
    }

    private function fetchInterestedUserIdsForLaw(int $lawId, string $lawSlug): array
    {
        $targetIds = array_values(array_filter(array_unique([(string) $lawId, $lawSlug])));
        $favoriteLawPlaceholders = [];
        $params = [':law_id' => $lawId];

        foreach ($targetIds as $index => $targetId) {
            $placeholder = ':target_' . $index;
            $favoriteLawPlaceholders[] = $placeholder;
            $params[$placeholder] = $targetId;
        }

        $lawFavoriteCondition = empty($favoriteLawPlaceholders)
            ? '1 = 0'
            : 'f.target_id IN (' . implode(', ', $favoriteLawPlaceholders) . ')';

        $sql = "
            SELECT DISTINCT user_id
            FROM (
                SELECT p.user_id
                FROM legal_user_progress p
                WHERE p.law_id = :law_id

                UNION

                SELECT f.user_id
                FROM legal_user_favorites f
                WHERE f.target_type = 'law'
                  AND {$lawFavoriteCondition}

                UNION

                SELECT af.user_id
                FROM legal_user_favorites af
                INNER JOIN law_articles la ON la.id = CAST(af.target_id AS UNSIGNED)
                WHERE af.target_type = 'article'
                  AND la.law_id = :law_id
            ) interested
            INNER JOIN users u ON u.id = interested.user_id
            WHERE COALESCE(u.status, 'active') NOT IN ('deleted', 'pending_deletion', 'banned', 'suspended')
            LIMIT 1000
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return array_values(array_filter(array_map(
            static fn ($value): string => trim((string) $value),
            $stmt->fetchAll(PDO::FETCH_COLUMN) ?: []
        )));
    }

    private function upsertLaw(array $payload): int
    {
        $areaId = (int) ($payload['legalAreaId'] ?? $payload['legal_area_id'] ?? 0);
        if ($areaId <= 0) {
            $candidateAreaId = (int) ($payload['areaId'] ?? 0);
            if ($candidateAreaId > 0 && $this->legalAreaExists($candidateAreaId)) {
                $areaId = $candidateAreaId;
            }
        }
        if ($areaId <= 0) {
            $areaSlug = (string) ($payload['areaSlug'] ?? 'constitucional');
            $areaId = $this->resolveAreaId($areaSlug);
        }

        $id = (int) ($payload['id'] ?? 0);
        $title = $this->boundedRequiredString($payload['title'] ?? $payload['shortTitle'] ?? '', '', 255);
        $shortTitle = $this->boundedRequiredString($payload['shortTitle'] ?? $title, $title, 180);
        $slug = $this->slugify((string) ($payload['slug'] ?? $shortTitle), 160);

        if ($title === '' || $shortTitle === '' || $slug === '') {
            throw new InvalidArgumentException('Informe o nome da lei e o slug antes de salvar.');
        }

        $existingIdForSlug = $this->findLawIdBySlug($slug);
        if ($existingIdForSlug > 0) {
            if ($id <= 0) {
                $id = $existingIdForSlug;
            } elseif ($existingIdForSlug !== $id) {
                throw new InvalidArgumentException('Ja existe outra lei comentada com este slug.');
            }
        }

        $actorId = trim((string) ($payload['_admin_user_id'] ?? ''));
        $actorRole = strtolower(trim((string) ($payload['_admin_user_role'] ?? '')));
        if ($id > 0 && $actorId !== '' && $actorRole !== 'admin') {
            $ownership = $this->findLawOwnership($id);
            $ownerId = trim((string) ($ownership['created_by_user_id'] ?? ''));
            if ($ownerId === '' || $ownerId !== $actorId) {
                throw new DomainException('Staff so pode alterar leis criadas por ele.');
            }
        }

        $fields = [
            ':legal_area_id' => $areaId,
            ':law_topic_filter_id' => $this->nullableInt($payload['lawTopicFilterId'] ?? $payload['law_topic_filter_id'] ?? null),
            ':slug' => $slug,
            ':acronym' => $this->boundedString($payload['acronym'] ?? null, 40),
            ':title' => $title,
            ':short_title' => $shortTitle,
            ':law_number' => $this->boundedRequiredString($payload['number'] ?? $payload['law_number'] ?? '', '', 120),
            ':law_year' => $this->boundedString($payload['year'] ?? null, 20),
            ':published_at' => $this->nullableDateTime($payload['publishedAt'] ?? $payload['published_at'] ?? $payload['date'] ?? null),
            ':aliases_json' => $this->jsonEncode($payload['aliases'] ?? []),
            ':description' => $this->nullableString($payload['description'] ?? null),
            ':summary' => $this->nullableString($payload['summary'] ?? null),
            ':preamble' => $this->nullableString($payload['preamble'] ?? null),
            ':ementa' => $this->nullableString($payload['ementa'] ?? null),
            ':status' => $this->boundedString($payload['status'] ?? 'active', 40) ?: 'active',
            ':official_url' => $this->boundedRequiredString($payload['officialUrl'] ?? $payload['official_url'] ?? '', '', 500),
            ':source_name' => $this->boundedRequiredString($payload['sourceName'] ?? 'Portal do Planalto', 'Portal do Planalto', 120),
            ':last_synced_at' => $this->nullableDateTime($payload['lastSyncedAt'] ?? null),
            ':last_updated_at' => $this->nullableDateTime($payload['lastUpdatedAt'] ?? null),
            ':is_recently_updated' => !empty($payload['isRecentlyUpdated']) ? 1 : 0,
            ':access_count' => max(0, (int) ($payload['accessCount'] ?? 0)),
            ':updated_by_user_id' => $this->nullableString($payload['_admin_user_id'] ?? null),
            ':published_by_user_id' => $this->nullableString($payload['_admin_user_id'] ?? null),
        ];

        if ($fields[':law_number'] === '') {
            throw new InvalidArgumentException('Informe o numero da lei.');
        }
        if ($fields[':official_url'] === '') {
            throw new InvalidArgumentException('Informe o link oficial do Planalto.');
        }

        if ($id > 0) {
            $fields[':id'] = $id;
            $stmt = $this->db->prepare(
                "UPDATE laws
                 SET legal_area_id = :legal_area_id,
                     law_topic_filter_id = :law_topic_filter_id,
                     slug = :slug,
                     acronym = :acronym,
                     title = :title,
                     short_title = :short_title,
                     law_number = :law_number,
                     law_year = :law_year,
                     published_at = :published_at,
                     aliases_json = :aliases_json,
                     description = :description,
                     summary = :summary,
                     preamble = :preamble,
                     ementa = :ementa,
                     status = :status,
                     official_url = :official_url,
                     source_name = :source_name,
                     last_synced_at = :last_synced_at,
                     last_updated_at = :last_updated_at,
                     is_recently_updated = :is_recently_updated,
                     access_count = :access_count,
                     updated_by_user_id = :updated_by_user_id,
                     published_by_user_id = COALESCE(:published_by_user_id, published_by_user_id)
                 WHERE id = :id"
            );
            $stmt->execute($fields);
            return $id;
        }

        $stmt = $this->db->prepare(
            "INSERT INTO laws (
                legal_area_id, law_topic_filter_id, slug, acronym, title, short_title, law_number, law_year,
                published_at, aliases_json, description, summary, preamble, ementa, status,
                official_url, source_name, last_synced_at, last_updated_at,
                is_recently_updated, access_count, created_by_user_id, updated_by_user_id, published_by_user_id
            ) VALUES (
                :legal_area_id, :law_topic_filter_id, :slug, :acronym, :title, :short_title, :law_number, :law_year,
                :published_at, :aliases_json, :description, :summary, :preamble, :ementa, :status,
                :official_url, :source_name, :last_synced_at, :last_updated_at,
                :is_recently_updated, :access_count, :created_by_user_id, :updated_by_user_id, :published_by_user_id
            )"
        );
        $fields[':created_by_user_id'] = $fields[':updated_by_user_id'];
        $stmt->execute($fields);

        return (int) $this->db->lastInsertId();
    }

    private function findLawIdBySlug(string $slug): int
    {
        $normalizedSlug = trim($slug);
        if ($normalizedSlug === '') {
            return 0;
        }

        $stmt = $this->db->prepare('SELECT id FROM laws WHERE slug = :slug LIMIT 1');
        $stmt->execute([':slug' => $normalizedSlug]);

        return (int) $stmt->fetchColumn();
    }

    private function syncArticles(int $lawId, array $articles, array $sectionIdMap = [], bool $preserveUnmatched = false): array
    {
        $incomingIds = [];
        $map = [];
        $seenPayloadSlugs = [];
        $existingBySlug = [];
        $sectionAssuntoFilterMap = $this->articleReads->fetchSectionAssuntoFilterMap($lawId);

        $existingStmt = $this->db->prepare('SELECT id, slug FROM law_articles WHERE law_id = :law_id');
        $existingStmt->execute([':law_id' => $lawId]);
        foreach ($existingStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $existingBySlug[(string) $row['slug']] = (int) $row['id'];
        }

        foreach ($articles as $index => $article) {
            $id = (int) ($article['id'] ?? 0);
            $number = $this->boundedRequiredString($article['number'] ?? $article['article_number'] ?? '', '', 60);
            $slug = $this->buildArticleSlug($article, $index);
            $text = trim((string) ($article['text'] ?? $article['official_text'] ?? ''));
            $sectionId = $this->resolveArticleSectionId($article, $sectionIdMap);
            $articleAssuntoFilterId = $sectionId !== null
                ? ($sectionAssuntoFilterMap[(int) $sectionId] ?? null)
                : null;

            if ($number === '' || $text === '') {
                continue;
            }

            if (isset($seenPayloadSlugs[$slug])) {
                throw new InvalidArgumentException('Existem artigos duplicados no payload: ' . $number . ' (' . $slug . ').');
            }
            $seenPayloadSlugs[$slug] = true;

            if ($id <= 0 && isset($existingBySlug[$slug])) {
                $id = $existingBySlug[$slug];
            }
            if ($id > 0 && isset($existingBySlug[$slug]) && $existingBySlug[$slug] !== $id) {
                throw new InvalidArgumentException('O artigo ' . $number . ' conflita com outro artigo ja salvo no acervo.');
            }

            $blocks = $article['blocks'] ?? [[
                'id' => $slug . '-caput',
                'kind' => 'caput',
                'label' => 'Art. ' . $number,
                'text' => $text,
            ]];

            $fields = [
                ':law_id' => $lawId,
                ':section_id' => $sectionId,
                ':slug' => $slug,
                ':article_number' => $number,
                ':title' => $this->boundedString($article['title'] ?? null, 255),
                ':official_text' => $text,
                ':paragraphs_json' => $this->jsonEncode($article['paragraphs'] ?? []),
                ':jurisprudence_notes_json' => $this->jsonEncode($article['jurisprudenceNotes'] ?? []),
                ':doctrine_json' => $this->jsonEncode($article['doctrine'] ?? []),
                ':official_anchor' => $this->boundedString($article['officialAnchor'] ?? null, 180),
                ':is_recently_changed' => !empty($article['isRecentlyChanged']) ? 1 : 0,
                ':official_status' => 'active',
                ':official_status_changed_at' => null,
                ':related_question_count' => max(0, (int) ($article['relatedQuestionCount'] ?? 0)),
                ':assunto_filter_id' => $this->nullableInt($articleAssuntoFilterId),
                ':sort_order' => (int) ($article['sortOrder'] ?? $index),
            ];

            if ($id > 0) {
                $fields[':id'] = $id;
                $stmt = $this->db->prepare(
                    "UPDATE law_articles
                     SET law_id = :law_id,
                         section_id = :section_id,
                         slug = :slug,
                         article_number = :article_number,
                         title = :title,
                         official_text = :official_text,
                         paragraphs_json = :paragraphs_json,
                         jurisprudence_notes_json = :jurisprudence_notes_json,
                         doctrine_json = :doctrine_json,
                         official_anchor = :official_anchor,
                         is_recently_changed = :is_recently_changed,
                         official_status = :official_status,
                         official_status_changed_at = :official_status_changed_at,
                         related_question_count = :related_question_count,
                         assunto_filter_id = :assunto_filter_id,
                         sort_order = :sort_order
                     WHERE id = :id AND law_id = :law_id"
                );
                $stmt->execute($fields);
            } else {
                $stmt = $this->db->prepare(
                    "INSERT INTO law_articles (
                        law_id, section_id, slug, article_number, title, official_text, paragraphs_json,
                        jurisprudence_notes_json, doctrine_json,
                        official_anchor, is_recently_changed, official_status, official_status_changed_at, related_question_count,
                        assunto_filter_id, sort_order
                    ) VALUES (
                        :law_id, :section_id, :slug, :article_number, :title, :official_text, :paragraphs_json,
                        :jurisprudence_notes_json, :doctrine_json,
                        :official_anchor, :is_recently_changed, :official_status, :official_status_changed_at, :related_question_count,
                        :assunto_filter_id, :sort_order
                    )"
                );
                $stmt->execute($fields);
                $id = (int) $this->db->lastInsertId();
            }

            $incomingIds[] = $id;
            $map[(string) ($article['id'] ?? $id)] = $id;
            $map[$slug] = $id;
            $this->syncArticleBlocks($id, is_array($blocks) ? $blocks : []);
        }

        if (!empty($incomingIds) && !$preserveUnmatched) {
            $placeholders = implode(',', array_fill(0, count($incomingIds), '?'));
            $this->db->prepare("DELETE FROM law_articles WHERE law_id = ? AND id NOT IN ($placeholders)")
                ->execute(array_merge([$lawId], $incomingIds));
        } elseif (!empty($incomingIds)) {
            $placeholders = implode(',', array_fill(0, count($incomingIds), '?'));
            $this->db->prepare(
                "UPDATE law_articles
                 SET official_status = CASE WHEN official_status = 'active' THEN 'needs_review' ELSE official_status END,
                     official_status_changed_at = CASE WHEN official_status = 'active' THEN NOW() ELSE official_status_changed_at END
                 WHERE law_id = ? AND id NOT IN ($placeholders)"
            )->execute(array_merge([$lawId], $incomingIds));
        }

        return $map;
    }

    private function resolveArticleSectionId(array $article, array $sectionIdMap): ?int
    {
        foreach (['sectionId', 'section_id', 'sectionSlug', 'section_slug'] as $key) {
            $raw = trim((string) ($article[$key] ?? ''));
            if ($raw === '') {
                continue;
            }

            if (ctype_digit($raw) && isset($sectionIdMap[$raw])) {
                return (int) $sectionIdMap[$raw];
            }

            if (ctype_digit($raw) && (int) $raw > 0) {
                return (int) $raw;
            }

            if (isset($sectionIdMap[$raw])) {
                return (int) $sectionIdMap[$raw];
            }

            $slug = $this->slugify($raw);
            if (isset($sectionIdMap[$slug])) {
                return (int) $sectionIdMap[$slug];
            }
        }

        return null;
    }

    private function syncArticleBlocks(int $articleId, array $blocks): void
    {
        $incomingUids = [];

        foreach ($blocks as $index => $block) {
            if (!is_array($block)) {
                continue;
            }

            $uid = $this->boundedRequiredString($block['id'] ?? $block['blockUid'] ?? $block['block_uid'] ?? '', '', 120);
            $kind = $this->boundedRequiredString($block['kind'] ?? 'note', 'note', 40);
            $text = trim((string) ($block['text'] ?? ''));

            if ($uid === '') {
                $uid = $this->slugify($kind . '-' . ($block['label'] ?? '') . '-' . ($index + 1), 120);
            }
            if ($text === '') {
                continue;
            }

            $stmt = $this->db->prepare(
                "INSERT INTO law_article_blocks (
                    law_article_id, block_uid, kind, label, text, parent_block_uid, anchor,
                    source_note, notes_json, is_recently_changed, previous_text, sort_order
                ) VALUES (
                    :law_article_id, :block_uid, :kind, :label, :text, :parent_block_uid, :anchor,
                    :source_note, :notes_json, :is_recently_changed, :previous_text, :sort_order
                )
                ON DUPLICATE KEY UPDATE
                    kind = VALUES(kind),
                    label = VALUES(label),
                    text = VALUES(text),
                    parent_block_uid = VALUES(parent_block_uid),
                    anchor = VALUES(anchor),
                    source_note = VALUES(source_note),
                    notes_json = VALUES(notes_json),
                    is_recently_changed = VALUES(is_recently_changed),
                    previous_text = VALUES(previous_text),
                    sort_order = VALUES(sort_order),
                    updated_at = NOW()"
            );
            $stmt->execute([
                ':law_article_id' => $articleId,
                ':block_uid' => $uid,
                ':kind' => $kind,
                ':label' => $this->boundedString($block['label'] ?? null, 120),
                ':text' => $text,
                ':parent_block_uid' => $this->boundedString($block['parentBlockId'] ?? $block['parent_block_uid'] ?? null, 120),
                ':anchor' => $this->boundedString($block['anchor'] ?? null, 180),
                ':source_note' => $this->boundedString($block['sourceNote'] ?? $block['source_note'] ?? null, 255),
                ':notes_json' => $this->jsonEncode(is_array($block['notes'] ?? null) ? $block['notes'] : []),
                ':is_recently_changed' => !empty($block['isRecentlyChanged']) ? 1 : 0,
                ':previous_text' => $this->nullableString($block['previousText'] ?? $block['previous_text'] ?? null),
                ':sort_order' => (int) ($block['sortOrder'] ?? $block['sort_order'] ?? $index),
            ]);
            $incomingUids[] = $uid;
        }

        if (empty($incomingUids)) {
            $this->db->prepare('DELETE FROM law_article_blocks WHERE law_article_id = :article_id')
                ->execute([':article_id' => $articleId]);
            return;
        }

        $placeholders = [];
        $params = [':article_id' => $articleId];
        foreach (array_values(array_unique($incomingUids)) as $index => $uid) {
            $placeholder = ':block_uid_' . $index;
            $placeholders[] = $placeholder;
            $params[$placeholder] = $uid;
        }

        $this->db->prepare(
            'DELETE FROM law_article_blocks WHERE law_article_id = :article_id AND block_uid NOT IN (' . implode(',', $placeholders) . ')'
        )->execute($params);
    }

    private function buildArticleSlug(array $article, int $index): string
    {
        $slug = trim((string) ($article['slug'] ?? ''));
        if ($slug !== '') {
            return $this->slugify($slug, 180);
        }

        $number = trim((string) ($article['number'] ?? $article['article_number'] ?? ''));
        if ($number !== '') {
            return 'art-' . $this->slugify($this->normalizeArticleNumberForSlug($number), 176);
        }

        return 'art-' . $this->slugify((string) ($index + 1), 176);
    }

    private function normalizeArticleNumberForSlug(string $number): string
    {
        $ordinal = html_entity_decode('&#186;', ENT_QUOTES, 'UTF-8');
        $number = trim((string) preg_replace('/\s+/u', '', $number));
        $number = preg_replace('/(?<=\d)(?:\x{00B0}|o)(?=(?:-[A-Z])?$)/u', $ordinal, $number) ?: $number;

        return $number !== '' ? $number : 'sem-numero';
    }

    private function syncSections(int $lawId, array $sections, array $articles = [], bool $preserveUnmatched = false): array
    {
        $incomingIds = [];
        $map = [];
        $seenSlugs = [];
        $existingBySlug = [];

        $existingStmt = $this->db->prepare('SELECT id, slug FROM law_sections WHERE law_id = :law_id');
        $existingStmt->execute([':law_id' => $lawId]);
        foreach ($existingStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $existingBySlug[(string) $row['slug']] = (int) $row['id'];
        }

        foreach ($sections as $index => $section) {
            if (!is_array($section)) {
                continue;
            }

            $displayTitle = $this->boundedRequiredString($section['displayTitle'] ?? $section['display_title'] ?? $section['sectionTitle'] ?? $section['title'] ?? '', '', 255);
            if ($displayTitle === '') {
                $displayTitle = 'CAPITULO ' . ($index + 1);
            }

            $slug = $this->buildSectionSlug($section, $displayTitle, $index);
            if (isset($seenSlugs[$slug])) {
                throw new InvalidArgumentException('Existem secoes duplicadas no payload: ' . $displayTitle . '.');
            }
            $seenSlugs[$slug] = true;

            $id = (int) ($section['id'] ?? $section['sectionId'] ?? $section['section_id'] ?? 0);
            if ($id <= 0 && isset($existingBySlug[$slug])) {
                $id = $existingBySlug[$slug];
            }

            $fields = [
                ':law_id' => $lawId,
                ':slug' => $slug,
                ':display_title' => $displayTitle,
                ':title_label' => $this->boundedString($section['titleLabel'] ?? $section['title_label'] ?? null, 80),
                ':title_name' => $this->boundedString($section['titleName'] ?? $section['title_name'] ?? $section['subtopicName'] ?? null, 255),
                ':chapter_label' => $this->boundedString($section['chapterLabel'] ?? $section['chapter_label'] ?? null, 80),
                ':chapter_name' => $this->boundedString($section['chapterName'] ?? $section['chapter_name'] ?? $section['assuntoName'] ?? null, 255),
                ':subtopic_filter_id' => $this->nullableInt($section['subtopicFilterId'] ?? $section['subtopic_filter_id'] ?? null),
                ':assunto_filter_id' => $this->nullableInt($section['assuntoFilterId'] ?? $section['assunto_filter_id'] ?? null),
                ':from_article' => $this->boundedString($section['fromArticle'] ?? $section['from_article'] ?? null, 60),
                ':to_article' => $this->boundedString($section['toArticle'] ?? $section['to_article'] ?? null, 60),
                ':article_count' => max(0, (int) ($section['articleCount'] ?? $section['article_count'] ?? count($section['articleIds'] ?? []))),
                ':sort_order' => (int) ($section['sortOrder'] ?? $section['sort_order'] ?? $index),
            ];

            if ($id > 0) {
                $fields[':id'] = $id;
                $stmt = $this->db->prepare(
                    "UPDATE law_sections
                     SET slug = :slug,
                         display_title = :display_title,
                         title_label = :title_label,
                         title_name = :title_name,
                         chapter_label = :chapter_label,
                         chapter_name = :chapter_name,
                         subtopic_filter_id = :subtopic_filter_id,
                         assunto_filter_id = :assunto_filter_id,
                         from_article = :from_article,
                         to_article = :to_article,
                         article_count = :article_count,
                         sort_order = :sort_order
                     WHERE id = :id AND law_id = :law_id"
                );
                $stmt->execute($fields);
            } else {
                $stmt = $this->db->prepare(
                    "INSERT INTO law_sections (
                        law_id, slug, display_title, title_label, title_name, chapter_label, chapter_name,
                        subtopic_filter_id, assunto_filter_id, from_article, to_article, article_count, sort_order
                    ) VALUES (
                        :law_id, :slug, :display_title, :title_label, :title_name, :chapter_label, :chapter_name,
                        :subtopic_filter_id, :assunto_filter_id, :from_article, :to_article, :article_count, :sort_order
                    )"
                );
                $stmt->execute($fields);
                $id = (int) $this->db->lastInsertId();
            }

            $incomingIds[] = $id;
            foreach ($this->sectionIdentityCandidates($section, $slug, $id) as $candidate) {
                $map[$candidate] = $id;
            }
        }

        if (!empty($incomingIds) && !$preserveUnmatched) {
            $placeholders = implode(',', array_fill(0, count($incomingIds), '?'));
            $this->db->prepare("DELETE FROM law_sections WHERE law_id = ? AND id NOT IN ($placeholders)")
                ->execute(array_merge([$lawId], $incomingIds));
        } elseif (empty($articles) && !$preserveUnmatched) {
            $this->db->prepare('DELETE FROM law_sections WHERE law_id = :law_id')->execute([':law_id' => $lawId]);
        }

        return $map;
    }

    private function buildSectionSlug(array $section, string $displayTitle, int $index): string
    {
        foreach (['slug', 'sectionSlug', 'section_slug'] as $key) {
            $value = trim((string) ($section[$key] ?? ''));
            if ($value !== '') {
                return $this->slugify($value, 180);
            }
        }

        $from = trim((string) ($section['fromArticle'] ?? $section['from_article'] ?? ''));
        $to = trim((string) ($section['toArticle'] ?? $section['to_article'] ?? ''));
        $range = trim($from . '-' . $to, '-');
        $base = trim($displayTitle . ' ' . $range);

        return $this->slugify($base !== '' ? $base : 'capitulo-' . ($index + 1), 180);
    }

    private function sectionIdentityCandidates(array $section, string $slug, int $id): array
    {
        $candidates = [(string) $id, $slug];
        foreach (['id', 'sectionId', 'section_id', 'slug', 'sectionSlug', 'section_slug'] as $key) {
            $value = trim((string) ($section[$key] ?? ''));
            if ($value !== '') {
                $candidates[] = $value;
                $candidates[] = $this->slugify($value);
            }
        }

        return array_values(array_unique(array_filter($candidates, static fn ($value) => $value !== '')));
    }

    private function syncSectionEditorials(int $lawId, array $items, array $sectionIdMap = [], bool $preserveUnmatched = false): void
    {
        $incomingSectionIds = [];

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $sectionId = $this->resolveEditorialSectionId($item, $sectionIdMap);
            if ($sectionId === null) {
                continue;
            }

            $this->upsertSectionEditorial($lawId, $item, $sectionIdMap);
            $incomingSectionIds[] = $sectionId;
        }

        if (empty($incomingSectionIds) && !$preserveUnmatched) {
            $this->db->prepare('DELETE FROM law_section_editorials WHERE law_id = :law_id')
                ->execute([':law_id' => $lawId]);
            return;
        }

        if ($preserveUnmatched) {
            return;
        }

        $placeholders = [];
        $params = [':law_id' => $lawId];
        foreach (array_values(array_unique($incomingSectionIds)) as $index => $sectionId) {
            $placeholder = ':section_id_' . $index;
            $placeholders[] = $placeholder;
            $params[$placeholder] = $sectionId;
        }

        $this->db->prepare(
            'DELETE FROM law_section_editorials WHERE law_id = :law_id AND section_id NOT IN (' . implode(',', $placeholders) . ')'
        )->execute($params);
    }

    private function upsertSectionEditorial(int $lawId, array $item, array $sectionIdMap = []): void
    {
        $sectionId = $this->resolveEditorialSectionId($item, $sectionIdMap);
        if ($lawId <= 0 || $sectionId === null) {
            return;
        }

        $stmt = $this->db->prepare(
            "INSERT INTO law_section_editorials (
                law_id,
                section_id,
                section_title,
                range_label,
                from_article,
                to_article,
                article_count,
                summary,
                importance,
                style,
                blocks_json,
                keywords_json,
                avoid_repetition_note,
                exam_focus_json,
                macetes_json,
                doctrine_json,
                jurisprudence_json,
                sumulas_json,
                highlights_json
            ) VALUES (
                :law_id,
                :section_id,
                :section_title,
                :range_label,
                :from_article,
                :to_article,
                :article_count,
                :summary,
                :importance,
                :style,
                :blocks_json,
                :keywords_json,
                :avoid_repetition_note,
                :exam_focus_json,
                :macetes_json,
                :doctrine_json,
                :jurisprudence_json,
                :sumulas_json,
                :highlights_json
            )
            ON DUPLICATE KEY UPDATE
                section_title = VALUES(section_title),
                range_label = VALUES(range_label),
                from_article = VALUES(from_article),
                to_article = VALUES(to_article),
                article_count = VALUES(article_count),
                summary = VALUES(summary),
                importance = VALUES(importance),
                style = VALUES(style),
                blocks_json = VALUES(blocks_json),
                keywords_json = VALUES(keywords_json),
                avoid_repetition_note = VALUES(avoid_repetition_note),
                exam_focus_json = VALUES(exam_focus_json),
                macetes_json = VALUES(macetes_json),
                doctrine_json = VALUES(doctrine_json),
                jurisprudence_json = VALUES(jurisprudence_json),
                sumulas_json = VALUES(sumulas_json),
                highlights_json = VALUES(highlights_json),
                updated_at = NOW()"
        );

        $stmt->execute([
            ':law_id' => $lawId,
            ':section_id' => $sectionId,
            ':section_title' => $this->boundedRequiredString($item['sectionTitle'] ?? $item['section_title'] ?? $item['title'] ?? 'Capitulo da lei', 'Capitulo da lei', 255),
            ':range_label' => $this->boundedRequiredString($item['rangeLabel'] ?? $item['range_label'] ?? '', '', 120),
            ':from_article' => $this->boundedString($item['fromArticle'] ?? $item['from_article'] ?? null, 60),
            ':to_article' => $this->boundedString($item['toArticle'] ?? $item['to_article'] ?? null, 60),
            ':article_count' => max(0, (int) ($item['articleCount'] ?? $item['article_count'] ?? 0)),
            ':summary' => $this->nullableString($item['summary'] ?? null),
            ':importance' => $this->boundedString($item['importance'] ?? null, 20),
            ':style' => $this->boundedString($item['style'] ?? null, 60),
            ':blocks_json' => $this->jsonEncode(is_array($item['blocks'] ?? null) ? $item['blocks'] : []),
            ':keywords_json' => $this->jsonEncode($this->normalizeStringList($item['keywords'] ?? [])),
            ':avoid_repetition_note' => $this->nullableString($item['avoidRepetitionNote'] ?? $item['avoid_repetition_note'] ?? null),
            ':exam_focus_json' => $this->jsonEncode($this->normalizeStringList($item['examFocus'] ?? $item['exam_focus'] ?? [])),
            ':macetes_json' => $this->jsonEncode($this->normalizeStringList($item['macetes'] ?? [])),
            ':doctrine_json' => $this->jsonEncode($this->normalizeStringList($item['doctrine'] ?? $item['doutrina'] ?? [])),
            ':jurisprudence_json' => $this->jsonEncode(is_array($item['jurisprudence'] ?? null) ? $item['jurisprudence'] : []),
            ':sumulas_json' => $this->jsonEncode(is_array($item['sumulas'] ?? null) ? $item['sumulas'] : []),
            ':highlights_json' => $this->jsonEncode(is_array($item['highlights'] ?? null) ? $item['highlights'] : []),
        ]);
    }

    private function resolveEditorialSectionId(array $item, array $sectionIdMap): ?int
    {
        foreach (['sectionId', 'section_id'] as $key) {
            $raw = trim((string) ($item[$key] ?? ''));
            if ($raw === '') {
                continue;
            }

            if (ctype_digit($raw) && isset($sectionIdMap[$raw])) {
                return (int) $sectionIdMap[$raw];
            }

            if (ctype_digit($raw) && (int) $raw > 0) {
                return (int) $raw;
            }

            if (isset($sectionIdMap[$raw])) {
                return (int) $sectionIdMap[$raw];
            }

            $slug = $this->slugify($raw);
            if (isset($sectionIdMap[$slug])) {
                return (int) $sectionIdMap[$slug];
            }
        }

        return null;
    }

    private function normalizeStringList($value): array
    {
        if (!is_array($value)) {
            $text = $this->stringifyScalar($value);
            return $text !== '' ? [$text] : [];
        }

        return array_values(array_filter(array_map(
            fn ($item): string => $this->stringifyScalar($item),
            $value
        )));
    }

    private function syncNestedContent(array $articleIdMap, array $items, string $table): void
    {
        $allowedTables = ['teacher_comments', 'article_jurisprudence', 'article_exam_tips', 'article_sumulas'];
        if (!in_array($table, $allowedTables, true)) {
            return;
        }

        $existingArticleIds = array_values(array_unique(array_map('intval', array_values($articleIdMap))));
        if (!empty($existingArticleIds)) {
            $placeholders = implode(',', array_fill(0, count($existingArticleIds), '?'));
            $this->db->prepare("DELETE FROM {$table} WHERE law_article_id IN ($placeholders)")
                ->execute($existingArticleIds);
        }

        foreach ($items as $item) {
            $rawArticleId = (string) ($item['articleId'] ?? $item['law_article_id'] ?? '');
            $articleId = $articleIdMap[$rawArticleId] ?? (ctype_digit($rawArticleId) ? (int) $rawArticleId : 0);
            if ($articleId <= 0) {
                continue;
            }

            if ($table === 'teacher_comments') {
                $stmt = $this->db->prepare(
                    "INSERT INTO teacher_comments (
                        law_article_id, title, body, importance, style, rich_blocks_json,
                        keywords_json, avoid_repetition_note, exam_focus_json, pitfalls_json,
                        related_refs_json, author_name, author_role, reviewed_at
                    ) VALUES (
                        :law_article_id, :title, :body, :importance, :style, :rich_blocks_json,
                        :keywords_json, :avoid_repetition_note, :exam_focus_json, :pitfalls_json,
                        :related_refs_json, :author_name, :author_role, :reviewed_at
                    )"
                );
                $stmt->execute([
                    ':law_article_id' => $articleId,
                    ':title' => $this->boundedRequiredString($item['title'] ?? 'Comentario do professor', 'Comentario do professor', 255),
                    ':body' => trim((string) ($item['body'] ?? '')),
                    ':importance' => $this->boundedString($item['importance'] ?? null, 20),
                    ':style' => $this->boundedString($item['style'] ?? null, 60),
                    ':rich_blocks_json' => $this->jsonEncode(is_array($item['richBlocks'] ?? null) ? $item['richBlocks'] : (is_array($item['blocks'] ?? null) ? $item['blocks'] : [])),
                    ':keywords_json' => $this->jsonEncode($this->normalizeStringList($item['keywords'] ?? [])),
                    ':avoid_repetition_note' => $this->nullableString($item['avoidRepetitionNote'] ?? $item['avoid_repetition_note'] ?? null),
                    ':exam_focus_json' => $this->jsonEncode($item['examFocus'] ?? []),
                    ':pitfalls_json' => $this->jsonEncode($item['pitfalls'] ?? []),
                    ':related_refs_json' => $this->jsonEncode($item['relatedRefs'] ?? []),
                    ':author_name' => $this->boundedRequiredString($item['authorName'] ?? 'Equipe editorial', 'Equipe editorial', 180),
                    ':author_role' => $this->boundedString($item['authorRole'] ?? null, 180),
                    ':reviewed_at' => $this->nullableDateTime($item['reviewedAt'] ?? null) ?: date('Y-m-d H:i:s'),
                ]);
            } elseif ($table === 'article_jurisprudence') {
                $stmt = $this->db->prepare(
                    "INSERT INTO article_jurisprudence (
                        law_article_id, court, precedent_type, title, summary,
                        exam_impact, is_consolidated, priority, source_url, target_json
                    ) VALUES (
                        :law_article_id, :court, :precedent_type, :title, :summary,
                        :exam_impact, :is_consolidated, :priority, :source_url, :target_json
                    )"
                );
                $stmt->execute([
                    ':law_article_id' => $articleId,
                    ':court' => $this->boundedRequiredString($item['court'] ?? 'STJ', 'STJ', 20),
                    ':precedent_type' => $this->boundedRequiredString($item['precedentType'] ?? 'Jurisprudencia', 'Jurisprudencia', 120),
                    ':title' => $this->boundedRequiredString($item['title'] ?? 'Entendimento relevante', 'Entendimento relevante', 255),
                    ':summary' => trim((string) ($item['summary'] ?? '')),
                    ':exam_impact' => $this->nullableString($item['examImpact'] ?? null),
                    ':is_consolidated' => !empty($item['isConsolidated']) ? 1 : 0,
                    ':priority' => $this->boundedRequiredString($item['priority'] ?? 'medium', 'medium', 20),
                    ':source_url' => $this->boundedString($item['sourceUrl'] ?? null, 500),
                    ':target_json' => $this->jsonEncode(is_array($item['target'] ?? null) ? $item['target'] : []),
                ]);
            } elseif ($table === 'article_exam_tips') {
                $stmt = $this->db->prepare(
                    "INSERT INTO article_exam_tips (law_article_id, title, body, tags_json, target_json)
                     VALUES (:law_article_id, :title, :body, :tags_json, :target_json)"
                );
                $stmt->execute([
                    ':law_article_id' => $articleId,
                    ':title' => $this->boundedRequiredString($item['title'] ?? 'Macete para prova', 'Macete para prova', 255),
                    ':body' => trim((string) ($item['body'] ?? '')),
                    ':tags_json' => $this->jsonEncode($item['tags'] ?? []),
                    ':target_json' => $this->jsonEncode(is_array($item['target'] ?? null) ? $item['target'] : []),
                ]);
            } elseif ($table === 'article_sumulas') {
                $stmt = $this->db->prepare(
                    "INSERT INTO article_sumulas (law_article_id, court, number, text, is_binding, source_url, priority, target_json)
                     VALUES (:law_article_id, :court, :number, :text, :is_binding, :source_url, :priority, :target_json)"
                );
                $stmt->execute([
                    ':law_article_id' => $articleId,
                    ':court' => $this->boundedRequiredString($item['court'] ?? 'STJ', 'STJ', 20),
                    ':number' => $this->boundedRequiredString($item['number'] ?? '', '', 40),
                    ':text' => trim((string) ($item['text'] ?? '')),
                    ':is_binding' => !empty($item['isBinding']) || !empty($item['vinculante']) ? 1 : 0,
                    ':source_url' => $this->boundedString($item['sourceUrl'] ?? null, 500),
                    ':priority' => $this->boundedRequiredString($item['priority'] ?? 'medium', 'medium', 20),
                    ':target_json' => $this->jsonEncode(is_array($item['target'] ?? null) ? $item['target'] : []),
                ]);
            }
        }
    }

    private function resolveAreaId(string $slug): int
    {
        $stmt = $this->db->prepare('SELECT id FROM legal_areas WHERE slug = :slug LIMIT 1');
        $stmt->execute([':slug' => $slug]);
        $id = (int) $stmt->fetchColumn();

        if ($id <= 0) {
            throw new InvalidArgumentException('Area juridica invalida.');
        }

        return $id;
    }

    private function legalAreaExists(int $areaId): bool
    {
        if ($areaId <= 0) {
            return false;
        }

        $stmt = $this->db->prepare('SELECT id FROM legal_areas WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $areaId]);

        return (bool) $stmt->fetchColumn();
    }

    private function findOrCreateAssunto(
        string $name,
        ?int $parentId,
        bool $isMateria,
        ?string $subjectContext = null,
        ?string $taxonomyLevel = null
    ): int
    {
        $normalizedName = trim($name);
        if ($normalizedName === '') {
            throw new InvalidArgumentException('Nome da taxonomia juridica invalido.');
        }

        $normalizedTaxonomyLevel = $taxonomyLevel !== null
            ? strtolower(trim($taxonomyLevel))
            : null;

        if ($parentId === null) {
            $stmt = $this->db->prepare(
                "SELECT id
                 FROM filters
                 WHERE type = 'assunto'
                   AND parent_id IS NULL
                   AND LOWER(name) = LOWER(:name)
                   AND (
                        :taxonomy_level IS NULL
                        OR taxonomy_level = :taxonomy_level
                        OR taxonomy_level IS NULL
                   )
                 LIMIT 1"
            );
            $stmt->execute([
                ':name' => $normalizedName,
                ':taxonomy_level' => $normalizedTaxonomyLevel,
            ]);
        } else {
            $stmt = $this->db->prepare(
                "SELECT id
                 FROM filters
                 WHERE type = 'assunto'
                   AND parent_id = :parent_id
                   AND LOWER(name) = LOWER(:name)
                   AND (
                        :taxonomy_level IS NULL
                        OR taxonomy_level = :taxonomy_level
                        OR taxonomy_level IS NULL
                   )
                 LIMIT 1"
            );
            $stmt->execute([
                ':parent_id' => $parentId,
                ':name' => $normalizedName,
                ':taxonomy_level' => $normalizedTaxonomyLevel,
            ]);
        }

        $existingId = (int) $stmt->fetchColumn();
        if ($existingId > 0) {
            return $existingId;
        }

        $slugSeed = $subjectContext && !$isMateria
            ? $subjectContext . '-' . $normalizedName
            : $normalizedName;

        $slugBase = 'assunto-' . $this->slugify($slugSeed, 220);
        $slug = $slugBase;
        $suffix = 2;

        while ($this->filterSlugExists($slug)) {
            $suffixText = '-' . $suffix;
            $slug = mb_substr($slugBase, 0, 255 - mb_strlen($suffixText, 'UTF-8'), 'UTF-8') . $suffixText;
            $suffix += 1;
        }

        $stmt = $this->db->prepare(
            "INSERT INTO filters (
                type,
                name,
                slug,
                parent_id,
                description,
                website,
                meta_materia,
                taxonomy_level,
                meta_carreira
            ) VALUES (
                'assunto',
                :name,
                :slug,
                :parent_id,
                :description,
                NULL,
                :meta_materia,
                :taxonomy_level,
                0
            )"
        );
        $stmt->execute([
            ':name' => $normalizedName,
            ':slug' => $slug,
            ':parent_id' => $parentId,
            ':description' => $isMateria
                ? 'Materia juridica criada automaticamente pela sincronizacao da Lei Comentada.'
                : 'Assunto juridico criado automaticamente pela sincronizacao da Lei Comentada.',
            ':meta_materia' => $isMateria ? 1 : 0,
            ':taxonomy_level' => $normalizedTaxonomyLevel,
        ]);

        return (int) $this->db->lastInsertId();
    }

    private function filterSlugExists(string $slug): bool
    {
        $stmt = $this->db->prepare('SELECT id FROM filters WHERE slug = :slug LIMIT 1');
        $stmt->execute([':slug' => $slug]);
        return (bool) $stmt->fetchColumn();
    }

    private function slugify(string $value, int $maxLength = 255): string
    {
        $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        if (class_exists('Transliterator')) {
            $transliterator = Transliterator::create('Any-Latin; Latin-ASCII; [:Nonspacing Mark:] Remove; Lower()');
            $value = $transliterator ? $transliterator->transliterate($value) : $value;
        } else {
            $value = strtr($value, $this->latinAccentMap());
            $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
        }
        $value = strtolower((string) preg_replace('/[^A-Za-z0-9]+/', '-', $value));
        $slug = trim($value, '-') ?: 'lei-comentada';
        if ($maxLength > 0 && mb_strlen($slug, 'UTF-8') > $maxLength) {
            $slug = trim(mb_substr($slug, 0, $maxLength, 'UTF-8'), '-');
        }

        return $slug !== '' ? $slug : 'lei-comentada';
    }

    private function latinAccentMap(): array
    {
        return [
            html_entity_decode('&#193;', ENT_QUOTES, 'UTF-8') => 'A',
            html_entity_decode('&#192;', ENT_QUOTES, 'UTF-8') => 'A',
            html_entity_decode('&#194;', ENT_QUOTES, 'UTF-8') => 'A',
            html_entity_decode('&#195;', ENT_QUOTES, 'UTF-8') => 'A',
            html_entity_decode('&#196;', ENT_QUOTES, 'UTF-8') => 'A',
            html_entity_decode('&#197;', ENT_QUOTES, 'UTF-8') => 'A',
            html_entity_decode('&#225;', ENT_QUOTES, 'UTF-8') => 'a',
            html_entity_decode('&#224;', ENT_QUOTES, 'UTF-8') => 'a',
            html_entity_decode('&#226;', ENT_QUOTES, 'UTF-8') => 'a',
            html_entity_decode('&#227;', ENT_QUOTES, 'UTF-8') => 'a',
            html_entity_decode('&#228;', ENT_QUOTES, 'UTF-8') => 'a',
            html_entity_decode('&#229;', ENT_QUOTES, 'UTF-8') => 'a',
            html_entity_decode('&#201;', ENT_QUOTES, 'UTF-8') => 'E',
            html_entity_decode('&#200;', ENT_QUOTES, 'UTF-8') => 'E',
            html_entity_decode('&#202;', ENT_QUOTES, 'UTF-8') => 'E',
            html_entity_decode('&#203;', ENT_QUOTES, 'UTF-8') => 'E',
            html_entity_decode('&#233;', ENT_QUOTES, 'UTF-8') => 'e',
            html_entity_decode('&#232;', ENT_QUOTES, 'UTF-8') => 'e',
            html_entity_decode('&#234;', ENT_QUOTES, 'UTF-8') => 'e',
            html_entity_decode('&#235;', ENT_QUOTES, 'UTF-8') => 'e',
            html_entity_decode('&#205;', ENT_QUOTES, 'UTF-8') => 'I',
            html_entity_decode('&#204;', ENT_QUOTES, 'UTF-8') => 'I',
            html_entity_decode('&#206;', ENT_QUOTES, 'UTF-8') => 'I',
            html_entity_decode('&#207;', ENT_QUOTES, 'UTF-8') => 'I',
            html_entity_decode('&#237;', ENT_QUOTES, 'UTF-8') => 'i',
            html_entity_decode('&#236;', ENT_QUOTES, 'UTF-8') => 'i',
            html_entity_decode('&#238;', ENT_QUOTES, 'UTF-8') => 'i',
            html_entity_decode('&#239;', ENT_QUOTES, 'UTF-8') => 'i',
            html_entity_decode('&#211;', ENT_QUOTES, 'UTF-8') => 'O',
            html_entity_decode('&#210;', ENT_QUOTES, 'UTF-8') => 'O',
            html_entity_decode('&#212;', ENT_QUOTES, 'UTF-8') => 'O',
            html_entity_decode('&#213;', ENT_QUOTES, 'UTF-8') => 'O',
            html_entity_decode('&#214;', ENT_QUOTES, 'UTF-8') => 'O',
            html_entity_decode('&#243;', ENT_QUOTES, 'UTF-8') => 'o',
            html_entity_decode('&#242;', ENT_QUOTES, 'UTF-8') => 'o',
            html_entity_decode('&#244;', ENT_QUOTES, 'UTF-8') => 'o',
            html_entity_decode('&#245;', ENT_QUOTES, 'UTF-8') => 'o',
            html_entity_decode('&#246;', ENT_QUOTES, 'UTF-8') => 'o',
            html_entity_decode('&#218;', ENT_QUOTES, 'UTF-8') => 'U',
            html_entity_decode('&#217;', ENT_QUOTES, 'UTF-8') => 'U',
            html_entity_decode('&#219;', ENT_QUOTES, 'UTF-8') => 'U',
            html_entity_decode('&#220;', ENT_QUOTES, 'UTF-8') => 'U',
            html_entity_decode('&#250;', ENT_QUOTES, 'UTF-8') => 'u',
            html_entity_decode('&#249;', ENT_QUOTES, 'UTF-8') => 'u',
            html_entity_decode('&#251;', ENT_QUOTES, 'UTF-8') => 'u',
            html_entity_decode('&#252;', ENT_QUOTES, 'UTF-8') => 'u',
            html_entity_decode('&#199;', ENT_QUOTES, 'UTF-8') => 'C',
            html_entity_decode('&#231;', ENT_QUOTES, 'UTF-8') => 'c',
            html_entity_decode('&#209;', ENT_QUOTES, 'UTF-8') => 'N',
            html_entity_decode('&#241;', ENT_QUOTES, 'UTF-8') => 'n',
        ];
    }

    private function stringifyScalar($value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        if (is_scalar($value)) {
            return trim((string) $value);
        }

        if (is_array($value)) {
            foreach (['text', 'content', 'body', 'title', 'label', 'name', 'value'] as $key) {
                if (array_key_exists($key, $value)) {
                    $candidate = $this->stringifyScalar($value[$key]);
                    if ($candidate !== '') {
                        return $candidate;
                    }
                }
            }
        }

        $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return is_string($json) ? trim($json) : '';
    }

    private function boundedString($value, int $maxLength): ?string
    {
        $value = $this->stringifyScalar($value);
        if ($value === '') {
            return null;
        }

        return mb_substr($value, 0, $maxLength, 'UTF-8');
    }

    private function boundedRequiredString($value, string $fallback, int $maxLength): string
    {
        $normalized = $this->boundedString($value, $maxLength);
        if ($normalized !== null && $normalized !== '') {
            return $normalized;
        }

        return mb_substr(trim($fallback), 0, $maxLength, 'UTF-8');
    }

    private function nullableString($value): ?string
    {
        $value = $this->stringifyScalar($value);
        return $value === '' ? null : $value;
    }

    private function nullableInt($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        $intValue = (int) $value;
        return $intValue > 0 ? $intValue : null;
    }

    private function nullableDate($value): ?string
    {
        if (!$value) {
            return null;
        }

        try {
            return (new DateTime((string) $value))->format('Y-m-d');
        } catch (Throwable $e) {
            return null;
        }
    }

    private function nullableDateTime($value): ?string
    {
        if (!$value) {
            return null;
        }

        try {
            return (new DateTime((string) $value))->format('Y-m-d H:i:s');
        } catch (Throwable $e) {
            return null;
        }
    }

    private function mapArea(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'slug' => (string) $row['slug'],
            'name' => (string) $row['name'],
            'nome' => (string) $row['name'],
            'description' => (string) ($row['description'] ?? ''),
            'colorClass' => $row['color_class'] ?? null,
            'cor' => $row['color_class'] ?? null,
            'iconName' => $row['icon_name'] ?? null,
            'icone' => $row['icon_name'] ?? null,
            'iconTone' => (string) ($row['icon_tone'] ?? 'text-indigo-600'),
            'order' => (int) ($row['sort_order'] ?? 0),
            'totalLaws' => (int) ($row['total_laws'] ?? 0),
            'totalLeis' => (int) ($row['total_laws'] ?? 0),
        ];
    }

    private function mapLawSummary(array $row, array $favorites, array $progressByLaw): array
    {
        $id = (string) $row['id'];
        $progress = $progressByLaw[$id] ?? null;
        $lastSyncedAt = $this->normalizeDateTime($row['last_synced_at'] ?? null) ?? '';
        $lastImportedAt = $this->normalizeDateTime($row['last_imported_at'] ?? null) ?? $lastSyncedAt;
        $lastUpdatedAt = $this->normalizeDateTime($row['last_updated_at'] ?? null);
        $isRecentlyUpdated = (bool) ($row['is_recently_updated'] ?? false);
        $articleCount = (int) ($row['article_count'] ?? 0);
        $commentedArticleCount = (int) ($row['commented_article_count'] ?? 0);
        $syncStatus = (string) ($row['sync_status'] ?? 'success');
        $lawTopicId = $row['law_topic_id'] !== null ? (string) $row['law_topic_id'] : ($row['law_topic_filter_id'] !== null ? (string) $row['law_topic_filter_id'] : null);
        $lawTopicName = trim((string) ($row['law_topic_name'] ?? ''));
        $lawTopicSlug = trim((string) ($row['law_topic_slug'] ?? ''));
        $subjectFilterId = $row['law_subject_filter_id'] !== null
            ? (string) $row['law_subject_filter_id']
            : (!empty($row['law_topic_is_materia']) && $lawTopicId !== null ? $lawTopicId : null);
        $subjectName = trim((string) ($row['law_subject_name'] ?? ''));
        if ($subjectName === '' && !empty($row['law_topic_is_materia'])) {
            $subjectName = $lawTopicName;
        }
        $subjectSlug = trim((string) ($row['law_subject_slug'] ?? ''));
        if ($subjectSlug === '' && !empty($row['law_topic_is_materia'])) {
            $subjectSlug = $lawTopicSlug;
        }
        if ($subjectName === '' && $lawTopicName !== '') {
            $subjectName = $lawTopicName;
            $subjectSlug = $lawTopicSlug;
            $subjectFilterId = $subjectFilterId ?? $lawTopicId;
        }
        $subjectSummary = $subjectName !== ''
            ? [
                'id' => $subjectFilterId,
                'slug' => $subjectSlug !== '' ? $subjectSlug : null,
                'name' => $subjectName,
                'nome' => $subjectName,
                'materia' => true,
                'meta_materia' => true,
                'taxonomyLevel' => 'materia',
                'taxonomy_level' => 'materia',
            ]
            : null;
        $topicSummary = $lawTopicName !== ''
            ? [
                'id' => $lawTopicId,
                'slug' => $lawTopicSlug !== '' ? $lawTopicSlug : null,
                'name' => $lawTopicName,
                'nome' => $lawTopicName,
                'materia' => !empty($row['law_topic_is_materia']),
                'meta_materia' => !empty($row['law_topic_is_materia']),
                'taxonomyLevel' => (string) ($row['law_topic_taxonomy_level'] ?? 'topico'),
                'taxonomy_level' => (string) ($row['law_topic_taxonomy_level'] ?? 'topico'),
                'parentId' => $subjectFilterId,
                'parent_id' => $subjectFilterId,
            ]
            : null;

        return [
            'id' => $id,
            'slug' => (string) $row['slug'],
            'areaId' => (string) $row['legal_area_id'],
            'lawTopicFilterId' => $row['law_topic_filter_id'] !== null ? (string) $row['law_topic_filter_id'] : null,
            'lawTopicName' => $lawTopicName !== '' ? $lawTopicName : null,
            'lawTopicSlug' => $lawTopicSlug !== '' ? $lawTopicSlug : null,
            'topicName' => $lawTopicName !== '' ? $lawTopicName : null,
            'topicSlug' => $lawTopicSlug !== '' ? $lawTopicSlug : null,
            'subjectFilterId' => $subjectFilterId,
            'subjectName' => $subjectName !== '' ? $subjectName : null,
            'materiaName' => $subjectName !== '' ? $subjectName : null,
            'disciplinaName' => $subjectName !== '' ? $subjectName : null,
            'subject' => $subjectSummary,
            'subjects' => $subjectSummary !== null ? [$subjectSummary] : [],
            'materia' => $subjectSummary,
            'materias' => $subjectSummary !== null ? [$subjectSummary] : [],
            'disciplina' => $subjectSummary,
            'disciplinas' => $subjectSummary !== null ? [$subjectSummary] : [],
            'disciplines' => $subjectSummary !== null ? [$subjectSummary] : [],
            'assuntos' => array_values(array_filter([$subjectSummary, $topicSummary])),
            'acronym' => $row['acronym'] ?? null,
            'sigla' => $row['acronym'] ?? null,
            'title' => (string) $row['title'],
            'shortTitle' => (string) $row['short_title'],
            'nome' => (string) $row['short_title'],
            'number' => (string) $row['law_number'],
            'numero' => (string) $row['law_number'],
            'year' => $row['law_year'] ?? null,
            'ano' => $row['law_year'] ?? null,
            'date' => $this->normalizeDate($row['published_at'] ?? null),
            'publishedAt' => $this->normalizeDateTime($row['published_at'] ?? null) ?? '',
            'published_at' => $this->normalizeDateTime($row['published_at'] ?? null) ?? '',
            'aliases' => $this->jsonDecode($row['aliases_json'] ?? null, []),
            'description' => $row['description'] ?? '',
            'descricao' => $row['description'] ?? '',
            'summary' => (string) ($row['summary'] ?? $row['description'] ?? ''),
            'preamble' => (string) ($row['preamble'] ?? ''),
            'ementa' => $row['ementa'] ?? '',
            'status' => (string) ($row['status'] ?? 'active'),
            'officialUrl' => (string) $row['official_url'],
            'urlPlanalto' => (string) $row['official_url'],
            'sourceName' => (string) ($row['source_name'] ?? 'Portal do Planalto'),
            'lastImportedAt' => $lastImportedAt,
            'lastSyncedAt' => $lastSyncedAt,
            'lastUpdatedAt' => $lastUpdatedAt,
            'ultimaImportacao' => $lastImportedAt,
            'ultimaSincronizacao' => $lastSyncedAt,
            'ultimaAtualizacao' => $lastUpdatedAt,
            'syncStatus' => $syncStatus,
            'statusSincronizacao' => $syncStatus,
            'syncMessage' => (string) ($row['sync_message'] ?? ''),
            'isRecentlyUpdated' => $isRecentlyUpdated,
            'atualizacaoPendente' => $isRecentlyUpdated,
            'articleCount' => $articleCount,
            'totalArtigos' => $articleCount,
            'commentedArticleCount' => $commentedArticleCount,
            'artigosComentados' => $commentedArticleCount,
            'jurisprudenceCount' => (int) ($row['jurisprudence_count'] ?? 0),
            'examTipCount' => (int) ($row['exam_tip_count'] ?? 0),
            'accessCount' => (int) ($row['access_count'] ?? 0),
            'progress' => $progress,
            'progressPercent' => $progress['progressPercent'] ?? 0,
            'isFavorite' => !empty($favorites['law:' . $id]),
        ];
    }

    private function mapSection(array $row, array $favorites = []): array
    {
        $id = (string) ($row['id'] ?? '');
        $displayTitle = trim((string) ($row['display_title'] ?? ''));
        $titleParts = array_values(array_filter([
            trim((string) ($row['title_label'] ?? '')),
            trim((string) ($row['title_name'] ?? '')),
        ]));
        $chapterParts = array_values(array_filter([
            trim((string) ($row['chapter_label'] ?? '')),
            trim((string) ($row['chapter_name'] ?? '')),
        ]));
        $fallbackTitle = implode(' - ', $chapterParts) ?: implode(' - ', $titleParts) ?: 'Capitulo da lei';

        return [
            'id' => $id,
            'lawId' => (string) ($row['law_id'] ?? ''),
            'slug' => (string) ($row['slug'] ?? ''),
            'title' => $displayTitle !== '' ? $displayTitle : $fallbackTitle,
            'displayTitle' => $displayTitle !== '' ? $displayTitle : $fallbackTitle,
            'titleLabel' => (string) ($row['title_label'] ?? ''),
            'titleName' => (string) ($row['title_name'] ?? ''),
            'chapterLabel' => (string) ($row['chapter_label'] ?? ''),
            'chapterName' => (string) ($row['chapter_name'] ?? ''),
            'subtopicFilterId' => $row['subtopic_filter_id'] !== null ? (string) $row['subtopic_filter_id'] : null,
            'assuntoFilterId' => $row['assunto_filter_id'] !== null ? (string) $row['assunto_filter_id'] : null,
            'fromArticle' => $row['from_article'] !== null ? (string) $row['from_article'] : null,
            'toArticle' => $row['to_article'] !== null ? (string) $row['to_article'] : null,
            'articleCount' => (int) ($row['article_count'] ?? 0),
            'sortOrder' => (int) ($row['sort_order'] ?? 0),
            'isFavorite' => !empty($favorites['section:' . $id]),
        ];
    }

    private function mapArticleBlock(array $row): array
    {
        $id = (string) ($row['block_uid'] ?? $row['id'] ?? '');

        return [
            'id' => $id,
            'blockUid' => $id,
            'kind' => (string) ($row['kind'] ?? 'note'),
            'label' => (string) ($row['label'] ?? ''),
            'text' => (string) ($row['text'] ?? ''),
            'parentBlockId' => $row['parent_block_uid'] !== null ? (string) $row['parent_block_uid'] : null,
            'anchor' => $row['anchor'] !== null ? (string) $row['anchor'] : null,
            'sourceNote' => $row['source_note'] !== null ? (string) $row['source_note'] : null,
            'notes' => $this->jsonDecode($row['notes_json'] ?? null, []),
            'isRecentlyChanged' => (bool) ($row['is_recently_changed'] ?? false),
            'previousText' => $row['previous_text'] !== null ? (string) $row['previous_text'] : null,
            'sortOrder' => (int) ($row['sort_order'] ?? 0),
        ];
    }

    private function mapArticle(array $row, array $favorites, ?array $progress, array $blockRows = []): array
    {
        $id = (string) $row['id'];
        $blocks = array_map(fn(array $blockRow): array => $this->mapArticleBlock($blockRow), $blockRows);

        if (empty($blocks)) {
            $blocks = [[
                'id' => $id . '-caput',
                'blockUid' => $id . '-caput',
                'kind' => 'caput',
                'label' => 'Art. ' . (string) $row['article_number'],
                'text' => (string) $row['official_text'],
                'parentBlockId' => null,
                'anchor' => null,
                'sourceNote' => null,
                'notes' => [],
                'isRecentlyChanged' => (bool) ($row['is_recently_changed'] ?? false),
                'previousText' => null,
                'sortOrder' => 0,
            ]];
        }

        return [
            'id' => $id,
            'lawId' => (string) $row['law_id'],
            'sectionId' => $row['section_id'] !== null ? (string) $row['section_id'] : null,
            'slug' => (string) $row['slug'],
            'number' => (string) $row['article_number'],
            'numero' => (string) $row['article_number'],
            'title' => $row['title'] ?? null,
            'titulo' => $row['title'] ?? null,
            'text' => (string) $row['official_text'],
            'texto' => (string) $row['official_text'],
            'paragraphs' => $this->jsonDecode($row['paragraphs_json'] ?? null, []),
            'paragrafos' => $this->jsonDecode($row['paragraphs_json'] ?? null, []),
            'jurisprudenceNotes' => $this->jsonDecode($row['jurisprudence_notes_json'] ?? null, []),
            'syllabi' => [],
            'sumulas' => [],
            'doctrine' => $this->jsonDecode($row['doctrine_json'] ?? null, []),
            'doutrina' => $this->jsonDecode($row['doctrine_json'] ?? null, []),
            'examTip' => null,
            'macete' => null,
            'relatedQuestionCount' => (int) ($row['related_question_count'] ?? 0),
            'questoesRelacionadas' => (int) ($row['related_question_count'] ?? 0),
            'blocks' => $blocks,
            'officialAnchor' => $row['official_anchor'] ?? null,
            'officialStatus' => (string) ($row['official_status'] ?? 'active'),
            'isRecentlyChanged' => (bool) ($row['is_recently_changed'] ?? false),
            'isFavorite' => !empty($favorites['article:' . $id]),
            'readAt' => in_array($id, $progress['viewedArticleIds'] ?? [], true) ? ($progress['lastViewedAt'] ?? null) : null,
            'assuntoFilterId' => ($row['effective_assunto_filter_id'] ?? $row['assunto_filter_id']) !== null ? (string) ($row['effective_assunto_filter_id'] ?? $row['assunto_filter_id']) : null,
        ];
    }

    private function mapOutlineArticle(array $row, array $favorites = []): array
    {
        $id = (string) $row['id'];
        return [
            'id' => $id,
            'lawId' => (string) $row['law_id'],
            'sectionId' => $row['section_id'] !== null ? (string) $row['section_id'] : null,
            'number' => (string) $row['article_number'],
            'numero' => (string) $row['article_number'],
            'isFavorite' => !empty($favorites['article:' . $id]),
        ];
    }

    private function mapSectionEditorial(array $row, ?string $viewerUserId = null): array
    {
        $id = isset($row['id']) ? (string) $row['id'] : '';
        return $this->withContentReaction([
            'id' => $id,
            'lawId' => isset($row['law_id']) ? (string) $row['law_id'] : '',
            'sectionId' => isset($row['section_id']) && $row['section_id'] !== null ? (string) $row['section_id'] : null,
            'sectionTitle' => (string) ($row['section_title'] ?? ''),
            'rangeLabel' => (string) ($row['range_label'] ?? ''),
            'fromArticle' => $row['from_article'] ?? null,
            'toArticle' => $row['to_article'] ?? null,
            'articleCount' => (int) ($row['article_count'] ?? 0),
            'summary' => (string) ($row['summary'] ?? ''),
            'importance' => (string) ($row['importance'] ?? ''),
            'style' => (string) ($row['style'] ?? ''),
            'blocks' => $this->jsonDecode($row['blocks_json'] ?? null, []),
            'keywords' => $this->jsonDecode($row['keywords_json'] ?? null, []),
            'avoidRepetitionNote' => (string) ($row['avoid_repetition_note'] ?? ''),
            'examFocus' => $this->jsonDecode($row['exam_focus_json'] ?? null, []),
            'macetes' => $this->jsonDecode($row['macetes_json'] ?? null, []),
            'doctrine' => $this->jsonDecode($row['doctrine_json'] ?? null, []),
            'doutrina' => $this->jsonDecode($row['doctrine_json'] ?? null, []),
            'jurisprudence' => $this->jsonDecode($row['jurisprudence_json'] ?? null, []),
            'jurisprudencia' => $this->jsonDecode($row['jurisprudence_json'] ?? null, []),
            'sumulas' => $this->jsonDecode($row['sumulas_json'] ?? null, []),
            'highlights' => $this->jsonDecode($row['highlights_json'] ?? null, []),
        ], 'section-editorial:' . $id, $viewerUserId);
    }

    private function mapTeacherComment(array $row, array $favorites, ?string $viewerUserId = null): array
    {
        $id = (string) $row['id'];
        return $this->withContentReaction([
            'id' => $id,
            'articleId' => (string) $row['law_article_id'],
            'title' => (string) $row['title'],
            'body' => (string) $row['body'],
            'texto' => (string) $row['body'],
            'importance' => (string) ($row['importance'] ?? ''),
            'style' => (string) ($row['style'] ?? ''),
            'richBlocks' => $this->jsonDecode($row['rich_blocks_json'] ?? null, []),
            'blocks' => $this->jsonDecode($row['rich_blocks_json'] ?? null, []),
            'keywords' => $this->jsonDecode($row['keywords_json'] ?? null, []),
            'avoidRepetitionNote' => (string) ($row['avoid_repetition_note'] ?? ''),
            'examFocus' => $this->jsonDecode($row['exam_focus_json'] ?? null, []),
            'pitfalls' => $this->jsonDecode($row['pitfalls_json'] ?? null, []),
            'relatedRefs' => $this->jsonDecode($row['related_refs_json'] ?? null, []),
            'authorName' => (string) $row['author_name'],
            'autor' => (string) $row['author_name'],
            'authorRole' => $row['author_role'] ?? null,
            'cargo' => $row['author_role'] ?? null,
            'reviewedAt' => $this->normalizeDateTime($row['reviewed_at'] ?? null) ?? '',
            'isFavorite' => !empty($favorites['teacher_comment:' . $id]),
        ], 'inline-note:teacher-' . $id, $viewerUserId);
    }

    private function mapJurisprudence(array $row, array $favorites, ?string $viewerUserId = null): array
    {
        $id = (string) $row['id'];
        return $this->withContentReaction([
            'id' => $id,
            'articleId' => (string) $row['law_article_id'],
            'court' => (string) $row['court'],
            'tribunal' => (string) $row['court'],
            'precedentType' => (string) $row['precedent_type'],
            'title' => (string) $row['title'],
            'summary' => (string) $row['summary'],
            'texto' => (string) $row['summary'],
            'examImpact' => (string) ($row['exam_impact'] ?? ''),
            'isConsolidated' => (bool) ($row['is_consolidated'] ?? false),
            'priority' => (string) ($row['priority'] ?? 'medium'),
            'sourceUrl' => $row['source_url'] ?? null,
            'target' => $this->jsonDecode($row['target_json'] ?? null, []),
            'isFavorite' => !empty($favorites['jurisprudence:' . $id]),
        ], 'inline-note:juris-' . $id, $viewerUserId);
    }

    private function mapSumula(array $row, ?string $viewerUserId = null): array
    {
        $id = isset($row['id']) ? (string) $row['id'] : '';
        return $this->withContentReaction([
            'id' => $id,
            'articleId' => isset($row['law_article_id']) ? (string) $row['law_article_id'] : '',
            'court' => (string) $row['court'],
            'tribunal' => (string) $row['court'],
            'number' => (string) $row['number'],
            'numero' => (string) $row['number'],
            'text' => (string) $row['text'],
            'texto' => (string) $row['text'],
            'sourceUrl' => $row['source_url'] ?? null,
            'priority' => (string) ($row['priority'] ?? 'medium'),
            'isBinding' => (bool) ($row['is_binding'] ?? false),
            'vinculante' => (bool) ($row['is_binding'] ?? false),
            'target' => $this->jsonDecode($row['target_json'] ?? null, []),
        ], 'inline-note:sumula-' . $id, $viewerUserId);
    }

    private function mapExamTip(array $row, ?string $viewerUserId = null): array
    {
        $id = (string) $row['id'];
        return $this->withContentReaction([
            'id' => $id,
            'articleId' => (string) $row['law_article_id'],
            'title' => (string) $row['title'],
            'body' => (string) $row['body'],
            'texto' => (string) $row['body'],
            'tags' => $this->jsonDecode($row['tags_json'] ?? null, []),
            'target' => $this->jsonDecode($row['target_json'] ?? null, []),
        ], 'inline-note:tip-' . $id, $viewerUserId);
    }

    private function mapAiBatchRun(array $row): array
    {
        $itemsStmt = $this->db->prepare(
            "SELECT *
             FROM legal_ai_batch_items
             WHERE batch_run_id = :batch_run_id
             ORDER BY id"
        );
        $itemsStmt->execute([':batch_run_id' => (int) $row['id']]);
        $items = array_map([$this, 'mapAiBatchItem'], $itemsStmt->fetchAll(PDO::FETCH_ASSOC) ?: []);

        return [
            'id' => (string) $row['id'],
            'lawId' => (string) $row['law_id'],
            'status' => (string) ($row['status'] ?? 'running'),
            'requestedScope' => (string) ($row['requested_scope'] ?? 'article-full'),
            'totalArticles' => (int) ($row['total_articles'] ?? 0),
            'processedArticles' => (int) ($row['processed_articles'] ?? 0),
            'successfulArticles' => (int) ($row['successful_articles'] ?? 0),
            'failedArticles' => (int) ($row['failed_articles'] ?? 0),
            'partialArticles' => (int) ($row['partial_articles'] ?? 0),
            'lastError' => $row['last_error'] ?? null,
            'startedAt' => $this->normalizeDateTime($row['started_at'] ?? null) ?? '',
            'finishedAt' => $this->normalizeDateTime($row['finished_at'] ?? null),
            'items' => $items,
        ];
    }

    private function mapAiBatchItem(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'articleId' => (string) $row['law_article_id'],
            'articleNumber' => (string) ($row['article_number'] ?? ''),
            'status' => (string) ($row['status'] ?? 'pending'),
            'stageAStatus' => (string) ($row['stage_a_status'] ?? 'pending'),
            'stageBStatus' => (string) ($row['stage_b_status'] ?? 'pending'),
            'stageCStatus' => (string) ($row['stage_c_status'] ?? 'pending'),
            'errorMessage' => $row['error_message'] ?? null,
            'warnings' => $this->jsonDecode($row['warnings_json'] ?? null, []),
            'result' => $this->jsonDecode($row['result_json'] ?? null, []),
            'attempts' => $this->jsonDecode($row['attempts_json'] ?? null, []),
            'startedAt' => $this->normalizeDateTime($row['started_at'] ?? null),
            'finishedAt' => $this->normalizeDateTime($row['finished_at'] ?? null),
        ];
    }

    private function mapUserComment(array $row): array
    {
        $status = (string) ($row['status'] ?? 'visible');
        $moderationStatus = (string) ($row['moderation_status'] ?? 'approved');
        if ($status === 'visible' && $moderationStatus === 'pending') {
            $moderationStatus = 'approved';
        }

        return [
            'id' => (string) $row['id'],
            'articleId' => (string) $row['law_article_id'],
            'parentCommentId' => !empty($row['parent_comment_id']) ? (string) $row['parent_comment_id'] : null,
            'parent_comment_id' => !empty($row['parent_comment_id']) ? (string) $row['parent_comment_id'] : null,
            'userId' => (string) $row['user_id'],
            'userName' => (string) $row['user_name'],
            'userAvatar' => ($row['user_avatar'] ?? null) ?: null,
            'userPlan' => (string) ($row['user_plan'] ?? 'Gratuito'),
            'userRole' => (string) ($row['user_role'] ?? ''),
            'body' => (string) $row['body'],
            'status' => $status,
            'moderationStatus' => $moderationStatus,
            'createdAt' => $this->normalizeDateTime($row['created_at'] ?? null) ?? '',
            'updatedAt' => $this->normalizeDateTime($row['updated_at'] ?? null),
            'reportedCount' => (int) ($row['reported_count'] ?? 0),
            'userHasPendingReport' => !empty($row['user_has_pending_report']) || !empty($row['viewer_report_id']),
            'likes' => (int) ($row['likes'] ?? 0),
            'dislikes' => (int) ($row['dislikes'] ?? 0),
            'userReaction' => in_array(($row['user_reaction'] ?? null), ['like', 'dislike'], true) ? (string) $row['user_reaction'] : null,
        ];
    }

    private function mapProgress(array $row): array
    {
        $viewedArticleIds = array_values(array_unique(array_map('strval', $this->jsonDecode($row['viewed_article_ids_json'] ?? null, []))));
        $totalArticles = max(0, (int) ($row['total_articles'] ?? 0));
        $storedPercent = (int) ($row['progress_percent'] ?? 0);
        $progressPercent = $storedPercent;
        if ($totalArticles > 0) {
            $progressPercent = min(100, (int) round((min(count($viewedArticleIds), $totalArticles) / $totalArticles) * 100));
        }

        return [
            'id' => (string) $row['id'],
            'userId' => (string) $row['user_id'],
            'lawId' => (string) $row['law_id'],
            'viewedArticleIds' => $viewedArticleIds,
            'lastArticleId' => $row['last_article_id'] !== null ? (string) $row['last_article_id'] : null,
            'lastViewedAt' => $this->normalizeDateTime($row['last_viewed_at'] ?? null) ?? '',
            'progressPercent' => $progressPercent,
        ];
    }

    private function mapUpdate(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'lawId' => (string) $row['law_id'],
            'articleId' => $row['law_article_id'] !== null ? (string) $row['law_article_id'] : null,
            'changedAt' => $this->normalizeDateTime($row['changed_at'] ?? null) ?? '',
            'changeType' => (string) $row['change_type'],
            'title' => (string) $row['title'],
            'summary' => (string) $row['summary'],
            'previousText' => $row['previous_text'] ?? null,
            'currentText' => $row['current_text'] ?? null,
            'sourceUrl' => (string) $row['source_url'],
            'examImpact' => $row['exam_impact'] ?? null,
        ];
    }

    private function mapSyncLog(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'lawId' => $row['law_id'] !== null ? (string) $row['law_id'] : null,
            'status' => (string) $row['status'],
            'startedAt' => $this->normalizeDateTime($row['started_at'] ?? null) ?? '',
            'finishedAt' => $this->normalizeDateTime($row['finished_at'] ?? null),
            'sourceUrl' => $row['source_url'] ?? null,
            'message' => (string) $row['message'],
            'insertedArticles' => (int) ($row['inserted_articles'] ?? 0),
            'changedArticles' => (int) ($row['changed_articles'] ?? 0),
            'revokedArticles' => (int) ($row['revoked_articles'] ?? 0),
        ];
    }
}
