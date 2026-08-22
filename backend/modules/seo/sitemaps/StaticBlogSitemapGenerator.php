<?php

declare(strict_types=1);

require_once __DIR__ . '/../routes/PublicRouteBuilder.php';

final class StaticBlogSitemapGenerator
{
    public function __construct(
        private readonly PDO $db,
        private readonly string $baseUrl,
        private readonly string $outputDirectory,
        private readonly int $batchSize = 45000
    ) {
    }

    /** @return array{counts:array{articles:int,taxonomies:int,news:int},totalUrls:int,files:int,queryCount:int} */
    public function generate(): array
    {
        $files = [];
        $counts = ['articles' => 0, 'taxonomies' => 0, 'news' => 0];
        $queryCount = 0;

        if (!$this->tableExists('blog_articles', $queryCount)) {
            $this->write('blog-sitemap.xml', $this->buildIndex([]));
            $this->write('google-news.xml', $this->buildNewsUrlSet([]));
            return ['counts' => $counts, 'totalUrls' => 0, 'files' => 0, 'queryCount' => $queryCount];
        }

        $cursor = 0;
        $page = 0;
        while (true) {
            $queryCount++;
            $stmt = $this->db->prepare(
                "SELECT id, slug, COALESCE(updated_at, published_at, created_at) AS last_modified
                 FROM blog_articles
                 WHERE id > :cursor
                   AND deleted_at IS NULL
                   AND status IN ('published', 'scheduled')
                   AND published_at IS NOT NULL
                   AND published_at <= NOW()
                 ORDER BY id
                 LIMIT {$this->batchSize}"
            );
            $stmt->execute([':cursor' => $cursor]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            if ($rows === []) {
                break;
            }
            $entries = [];
            foreach ($rows as $row) {
                $id = (int) ($row['id'] ?? 0);
                $slug = trim((string) ($row['slug'] ?? ''));
                $cursor = max($cursor, $id);
                if ($id <= 0 || $slug === '') {
                    continue;
                }
                $entries[] = [
                    'loc' => $this->baseUrl . '/blog/' . rawurlencode($slug),
                    'lastmod' => $this->safeDate($row['last_modified'] ?? null),
                ];
            }
            if ($entries !== []) {
                $page++;
                $filename = sprintf('blog-articles-%05d.xml', $page);
                $this->write($filename, $this->buildUrlSet($entries));
                $files[] = ['name' => $filename, 'lastmod' => $this->maxLastmod($entries)];
                $counts['articles'] += count($entries);
            }
            if (count($rows) < $this->batchSize) {
                break;
            }
        }

        if ($this->tableExists('blog_categories', $queryCount)) {
            $routes = new PublicRouteBuilder();
            $cursor = 0;
            $page = 0;
            while (true) {
                $queryCount++;
                $stmt = $this->db->prepare(
                    "SELECT c.id, c.slug,
                            MAX(COALESCE(a.updated_at, a.published_at, a.created_at)) AS last_modified
                     FROM blog_categories c
                     INNER JOIN blog_articles a
                       ON a.category_id = c.id
                      AND a.deleted_at IS NULL
                      AND a.status IN ('published', 'scheduled')
                      AND a.published_at IS NOT NULL
                      AND a.published_at <= NOW()
                     WHERE c.id > :cursor
                     GROUP BY c.id, c.slug
                     ORDER BY c.id
                     LIMIT {$this->batchSize}"
                );
                $stmt->execute([':cursor' => $cursor]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                if ($rows === []) break;
                $entries = [];
                foreach ($rows as $row) {
                    $id = (int) ($row['id'] ?? 0);
                    $slug = trim((string) ($row['slug'] ?? ''));
                    $cursor = max($cursor, $id);
                    if ($id <= 0 || strlen($slug) > 140 || preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $slug) !== 1) {
                        continue;
                    }
                    $entries[] = [
                        'loc' => $this->baseUrl . $routes->blogCategoryDetail($slug),
                        'lastmod' => $this->safeDate($row['last_modified'] ?? null),
                    ];
                }
                if ($entries !== []) {
                    $page++;
                    $filename = sprintf('blog-categories-%05d.xml', $page);
                    $this->write($filename, $this->buildUrlSet($entries));
                    $files[] = ['name' => $filename, 'lastmod' => $this->maxLastmod($entries)];
                    $counts['taxonomies'] += count($entries);
                }
                if (count($rows) < $this->batchSize) break;
            }
        }

        $queryCount++;
        $stmt = $this->db->query(
            "SELECT a.slug, a.title, a.published_at
             FROM blog_articles a
             LEFT JOIN blog_categories c ON c.id = a.category_id
             WHERE a.deleted_at IS NULL
               AND a.status IN ('published', 'scheduled')
               AND a.published_at IS NOT NULL
               AND a.published_at <= NOW()
               AND a.published_at >= UTC_TIMESTAMP() - INTERVAL 2 DAY
               AND LOWER(COALESCE(c.slug, '')) IN ('noticias', 'concursos', 'editais', 'resultados')
               AND LOWER(a.slug) NOT IN ('hello-world', 'teste', 'post-teste')
             ORDER BY a.published_at DESC, a.id DESC
             LIMIT 1000"
        );
        $newsEntries = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $slug = trim((string) ($row['slug'] ?? ''));
            $publishedAt = $this->safeDateTime($row['published_at'] ?? null);
            if ($slug === '' || $publishedAt === null) {
                continue;
            }
            $newsEntries[] = [
                'loc' => $this->baseUrl . '/blog/' . rawurlencode($slug),
                'title' => (string) ($row['title'] ?? ''),
                'publishedAt' => $publishedAt,
            ];
        }
        $counts['news'] = count($newsEntries);
        $this->write('google-news.xml', $this->buildNewsUrlSet($newsEntries));
        $this->write('blog-sitemap.xml', $this->buildIndex($files));
        $this->write('blog-sitemap-status.json', json_encode([
            'scope' => 'static_blog_sitemap_coverage',
            'canonicalBaseUrl' => $this->baseUrl,
            'counts' => $counts,
            'totalUrls' => $counts['articles'] + $counts['taxonomies'],
            'files' => count($files),
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

        return [
            'counts' => $counts,
            'totalUrls' => $counts['articles'] + $counts['taxonomies'],
            'files' => count($files),
            'queryCount' => $queryCount,
        ];
    }

    private function tableExists(string $table, int &$queryCount): bool
    {
        $queryCount++;
        $stmt = $this->db->prepare(
            'SELECT 1 FROM information_schema.TABLES '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name LIMIT 1'
        );
        $stmt->execute([':table_name' => $table]);
        return (bool) $stmt->fetchColumn();
    }

    private function safeDate(mixed $value): ?string
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }
        $timestamp = strtotime((string) $value);
        return $timestamp === false ? null : gmdate('Y-m-d', $timestamp);
    }

    private function safeDateTime(mixed $value): ?string
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }
        $timestamp = strtotime((string) $value);
        return $timestamp === false ? null : gmdate('c', $timestamp);
    }

    /** @param list<array{loc:string,lastmod:?string}> $entries */
    private function maxLastmod(array $entries): ?string
    {
        $dates = array_values(array_filter(array_column($entries, 'lastmod'), static fn ($date): bool => is_string($date) && $date !== ''));
        return $dates === [] ? null : max($dates);
    }

    /** @param list<array{loc:string,lastmod:?string}> $entries */
    private function buildUrlSet(array $entries): string
    {
        $lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ];
        foreach ($entries as $entry) {
            $line = '  <url><loc>' . $this->escape($entry['loc']) . '</loc>';
            if ($entry['lastmod'] !== null) {
                $line .= '<lastmod>' . $this->escape($entry['lastmod']) . '</lastmod>';
            }
            $lines[] = $line . '</url>';
        }
        $lines[] = '</urlset>';
        return implode("\n", $lines) . "\n";
    }

    /** @param list<array{name:string,lastmod:?string}> $files */
    private function buildIndex(array $files): string
    {
        $lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ];
        foreach ($files as $file) {
            $line = '  <sitemap><loc>' . $this->escape($this->baseUrl . '/sitemaps/' . $file['name']) . '</loc>';
            if ($file['lastmod'] !== null) {
                $line .= '<lastmod>' . $this->escape($file['lastmod']) . '</lastmod>';
            }
            $lines[] = $line . '</sitemap>';
        }
        $lines[] = '</sitemapindex>';
        return implode("\n", $lines) . "\n";
    }

    /** @param list<array{loc:string,title:string,publishedAt:string}> $entries */
    private function buildNewsUrlSet(array $entries): string
    {
        $lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
        ];
        foreach ($entries as $entry) {
            $lines[] = '  <url>';
            $lines[] = '    <loc>' . $this->escape($entry['loc']) . '</loc>';
            $lines[] = '    <news:news>';
            $lines[] = '      <news:publication><news:name>ConcursoMestre</news:name><news:language>pt</news:language></news:publication>';
            $lines[] = '      <news:publication_date>' . $this->escape($entry['publishedAt']) . '</news:publication_date>';
            $lines[] = '      <news:title>' . $this->escape($entry['title']) . '</news:title>';
            $lines[] = '    </news:news>';
            $lines[] = '  </url>';
        }
        $lines[] = '</urlset>';
        return implode("\n", $lines) . "\n";
    }

    private function write(string $filename, string $contents): void
    {
        if (file_put_contents($this->outputDirectory . '/' . $filename, $contents, LOCK_EX) === false) {
            throw new RuntimeException('Falha ao materializar ' . $filename);
        }
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }
}
