<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este gerador so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';

$db = (new Database('read'))->getConnection();
$baseUrl = rtrim(trim((string) (getenv('CANONICAL_BASE_URL') ?: 'https://concursomestre.com')), '/');
$outputDir = trim((string) (getenv('SITEMAP_OUTPUT_DIR') ?: dirname(__DIR__, 2) . '/storage/sitemaps'));
$batchSize = 45000;
$generatedAt = gmdate('c');

if (!is_dir($outputDir) && !mkdir($outputDir, 0775, true) && !is_dir($outputDir)) {
    throw new RuntimeException('Nao foi possivel criar o diretorio de sitemaps.');
}

$escape = static fn (string $value): string => htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
$atomicWrite = static function (string $path, string $contents): void {
    $temporary = $path . '.tmp-' . getmypid();
    if (file_put_contents($temporary, $contents, LOCK_EX) === false || !rename($temporary, $path)) {
        @unlink($temporary);
        throw new RuntimeException('Falha ao materializar ' . basename($path));
    }
};
$safeDate = static function (mixed $value): string {
    $timestamp = strtotime((string) $value);
    return gmdate('Y-m-d', $timestamp !== false ? $timestamp : time());
};
$tableExists = static function (string $table) use ($db): bool {
    $stmt = $db->prepare(
        'SELECT 1 FROM information_schema.TABLES '
        . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name LIMIT 1'
    );
    $stmt->execute([':table_name' => $table]);
    return (bool) $stmt->fetchColumn();
};
$buildUrlSet = static function (array $entries) use ($escape): string {
    $lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ];
    foreach ($entries as $entry) {
        $lines[] = '  <url><loc>' . $escape((string) $entry['loc']) . '</loc><lastmod>'
            . $escape((string) $entry['lastmod']) . '</lastmod></url>';
    }
    $lines[] = '</urlset>';
    return implode("\n", $lines) . "\n";
};
$buildNewsUrlSet = static function (array $entries) use ($escape): string {
    $lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            . 'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    ];
    foreach ($entries as $entry) {
        $lines[] = '  <url>';
        $lines[] = '    <loc>' . $escape((string) $entry['loc']) . '</loc>';
        $lines[] = '    <news:news>';
        $lines[] = '      <news:publication><news:name>ConcursoMestre</news:name>'
            . '<news:language>pt</news:language></news:publication>';
        $lines[] = '      <news:publication_date>' . $escape((string) $entry['publishedAt'])
            . '</news:publication_date>';
        $lines[] = '      <news:title>' . $escape((string) $entry['title']) . '</news:title>';
        $lines[] = '    </news:news>';
        $lines[] = '  </url>';
    }
    $lines[] = '</urlset>';
    return implode("\n", $lines) . "\n";
};

$files = [];
$counts = ['articles' => 0, 'taxonomies' => 0, 'news' => 0];
$generatedArticleFiles = [];

if ($tableExists('blog_articles')) {
    $cursor = 0;
    $page = 0;
    while (true) {
        $stmt = $db->prepare(
            "SELECT id, slug, COALESCE(updated_at, published_at, created_at, NOW()) AS last_modified
             FROM blog_articles
             WHERE id > :cursor
               AND deleted_at IS NULL
               AND status IN ('published', 'scheduled')
               AND published_at IS NOT NULL
               AND published_at <= NOW()
             ORDER BY id
             LIMIT {$batchSize}"
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
            if ($id <= 0 || $slug === '') {
                continue;
            }
            $entries[] = [
                'loc' => $baseUrl . '/blog/' . rawurlencode($slug),
                'lastmod' => $safeDate($row['last_modified'] ?? null),
            ];
            $cursor = $id;
        }
        $page++;
        $filename = sprintf('blog-articles-%05d.xml', $page);
        $atomicWrite($outputDir . '/' . $filename, $buildUrlSet($entries));
        $files[] = ['name' => $filename, 'lastmod' => $generatedAt];
        $generatedArticleFiles[$filename] = true;
        $counts['articles'] += count($entries);
        if (count($rows) < $batchSize) {
            break;
        }
    }

    $taxonomyEntries = [];
    if ($tableExists('blog_categories')) {
        $categoryStmt = $db->query(
            "SELECT c.slug, COALESCE(MAX(a.updated_at), c.updated_at) AS last_modified
             FROM blog_categories c
             INNER JOIN blog_articles a ON a.category_id = c.id
                AND a.deleted_at IS NULL
                AND a.status IN ('published', 'scheduled')
                AND a.published_at IS NOT NULL
                AND a.published_at <= NOW()
             GROUP BY c.id, c.slug, c.updated_at"
        );
        foreach ($categoryStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $slug = trim((string) ($row['slug'] ?? ''));
            if ($slug !== '') {
                $taxonomyEntries[] = [
                    'loc' => $baseUrl . '/blog/categoria/' . rawurlencode($slug),
                    'lastmod' => $safeDate($row['last_modified'] ?? null),
                ];
            }
        }
    }

    if ($tableExists('blog_tags') && $tableExists('blog_article_tags')) {
        $tagStmt = $db->query(
            "SELECT t.slug, COALESCE(MAX(a.updated_at), MAX(t.updated_at), MAX(t.created_at)) AS last_modified
             FROM blog_tags t
             INNER JOIN blog_article_tags bat ON bat.tag_id = t.id
             INNER JOIN blog_articles a ON a.id = bat.article_id
                AND a.deleted_at IS NULL
                AND a.status IN ('published', 'scheduled')
                AND a.published_at IS NOT NULL
                AND a.published_at <= NOW()
             GROUP BY t.id, t.slug"
        );
        foreach ($tagStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $slug = trim((string) ($row['slug'] ?? ''));
            if ($slug !== '') {
                $taxonomyEntries[] = [
                    'loc' => $baseUrl . '/blog/tag/' . rawurlencode($slug),
                    'lastmod' => $safeDate($row['last_modified'] ?? null),
                ];
            }
        }
    }

    $authorStmt = $db->query(
        "SELECT author_id, MAX(updated_at) AS last_modified
         FROM blog_articles
         WHERE deleted_at IS NULL
           AND status IN ('published', 'scheduled')
           AND published_at IS NOT NULL
           AND published_at <= NOW()
         GROUP BY author_id"
    );
    foreach ($authorStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $authorId = trim((string) ($row['author_id'] ?? ''));
        if ($authorId !== '') {
            $taxonomyEntries[] = [
                'loc' => $baseUrl . '/blog/autor/' . rawurlencode($authorId),
                'lastmod' => $safeDate($row['last_modified'] ?? null),
            ];
        }
    }
    if ($taxonomyEntries !== []) {
        $taxonomyFile = 'blog-taxonomies-00001.xml';
        $atomicWrite($outputDir . '/' . $taxonomyFile, $buildUrlSet($taxonomyEntries));
        $files[] = ['name' => $taxonomyFile, 'lastmod' => $generatedAt];
        $counts['taxonomies'] = count($taxonomyEntries);
    }

    $newsStmt = $db->query(
        "SELECT slug, title, published_at
         FROM blog_articles
         WHERE deleted_at IS NULL
           AND status IN ('published', 'scheduled')
           AND published_at IS NOT NULL
           AND published_at <= NOW()
           AND published_at >= UTC_TIMESTAMP() - INTERVAL 2 DAY
         ORDER BY published_at DESC, id DESC
         LIMIT 1000"
    );
    $newsEntries = [];
    foreach ($newsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $slug = trim((string) ($row['slug'] ?? ''));
        if ($slug === '') {
            continue;
        }
        $publishedTimestamp = strtotime((string) ($row['published_at'] ?? ''));
        $newsEntries[] = [
            'loc' => $baseUrl . '/blog/' . rawurlencode($slug),
            'title' => (string) ($row['title'] ?? ''),
            'publishedAt' => gmdate('c', $publishedTimestamp !== false ? $publishedTimestamp : time()),
        ];
    }
    $counts['news'] = count($newsEntries);
    $atomicWrite($outputDir . '/google-news.xml', $buildNewsUrlSet($newsEntries));
}

foreach (glob($outputDir . '/blog-articles-*.xml') ?: [] as $existingFile) {
    $name = basename($existingFile);
    if (!isset($generatedArticleFiles[$name])) {
        @unlink($existingFile);
    }
}

if ($files === []) {
    $atomicWrite($outputDir . '/blog-sitemap.xml', $buildUrlSet([]));
    $atomicWrite($outputDir . '/google-news.xml', $buildNewsUrlSet([]));
} else {
    $indexLines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ];
    foreach ($files as $file) {
        $indexLines[] = '  <sitemap><loc>' . $escape($baseUrl . '/sitemaps/' . $file['name'])
            . '</loc><lastmod>' . $escape($file['lastmod']) . '</lastmod></sitemap>';
    }
    $indexLines[] = '</sitemapindex>';
    $atomicWrite($outputDir . '/blog-sitemap.xml', implode("\n", $indexLines) . "\n");
}

$atomicWrite($outputDir . '/blog-sitemap-status.json', json_encode([
    'scope' => 'static_blog_sitemap_coverage',
    'generatedAt' => $generatedAt,
    'canonicalBaseUrl' => $baseUrl,
    'counts' => $counts,
    'totalUrls' => $counts['articles'] + $counts['taxonomies'],
    'files' => count($files),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

fwrite(STDOUT, json_encode([
    'status' => 'complete',
    'outputDir' => $outputDir,
    'counts' => $counts,
    'files' => count($files),
], JSON_UNESCAPED_SLASHES) . PHP_EOL);
