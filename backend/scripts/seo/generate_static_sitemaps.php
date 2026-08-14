<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este gerador so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/seo/routes/PublicRouteBuilder.php';
require_once __DIR__ . '/../../modules/seo/services/SeoSlugService.php';
require_once __DIR__ . '/../../modules/seo/sitemaps/StaticBlogSitemapGenerator.php';
require_once __DIR__ . '/../../modules/seo/sitemaps/StaticSitemapPublisher.php';
require_once __DIR__ . '/../../modules/seo/sitemaps/StaticSitemapValidator.php';

$startedAt = microtime(true);
$db = (new Database('read'))->getConnection();
$baseUrl = rtrim(trim((string) (getenv('CANONICAL_BASE_URL') ?: 'https://concursomestre.com')), '/');
$outputDir = trim((string) (getenv('SITEMAP_OUTPUT_DIR') ?: dirname(__DIR__, 2) . '/storage/sitemaps'));
$httpValidationOrigin = trim((string) (getenv('SITEMAP_VALIDATION_ORIGIN') ?: ''));
$validateHttp = filter_var(getenv('SITEMAP_VALIDATE_HTTP') ?: '0', FILTER_VALIDATE_BOOL);
$batchSize = 45000;
$generatedAt = gmdate('c');
$queryCount = 0;

$lockPath = dirname($outputDir) . DIRECTORY_SEPARATOR . '.' . basename($outputDir) . '-generation.lock';
if (!is_dir(dirname($lockPath)) && !mkdir(dirname($lockPath), 0775, true) && !is_dir(dirname($lockPath))) {
    throw new RuntimeException('Nao foi possivel criar o diretorio operacional dos sitemaps.');
}
$lock = fopen($lockPath, 'c');
if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
    throw new RuntimeException('Outra geracao de sitemap ja esta em andamento.');
}

$publisher = new StaticSitemapPublisher($outputDir);
$stage = $publisher->createStagingDirectory();

try {
    if ($validateHttp && $httpValidationOrigin === '') {
        throw new RuntimeException('SITEMAP_VALIDATION_ORIGIN e obrigatoria quando SITEMAP_VALIDATE_HTTP estiver ativo.');
    }

    $routes = new PublicRouteBuilder();
    $slugger = new SeoSlugService();
    $escape = static fn (string $value): string => htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    $safeDate = static function (mixed $value): ?string {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }
        $timestamp = strtotime((string) $value);
        return $timestamp === false ? null : gmdate('Y-m-d', $timestamp);
    };
    $sourceLastmod = static function (string $relativePath): ?string {
        $absolutePath = dirname(__DIR__, 3) . '/' . ltrim($relativePath, '/');
        $mtime = is_file($absolutePath) ? filemtime($absolutePath) : false;
        return $mtime === false ? null : gmdate('Y-m-d', $mtime);
    };
    $write = static function (string $path, string $contents): void {
        if (file_put_contents($path, $contents, LOCK_EX) === false) {
            throw new RuntimeException('Falha ao materializar ' . basename($path));
        }
    };
    $buildUrlSet = static function (array $entries) use ($escape): string {
        $lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ];
        foreach ($entries as $entry) {
            $line = '  <url><loc>' . $escape((string) $entry['loc']) . '</loc>';
            if (($entry['lastmod'] ?? null) !== null) {
                $line .= '<lastmod>' . $escape((string) $entry['lastmod']) . '</lastmod>';
            }
            $lines[] = $line . '</url>';
        }
        $lines[] = '</urlset>';
        return implode("\n", $lines) . "\n";
    };
    $maxLastmod = static function (array $entries): ?string {
        $dates = array_values(array_filter(array_column($entries, 'lastmod'), static fn ($date): bool => is_string($date) && $date !== ''));
        return $dates === [] ? null : max($dates);
    };
    $buildIndex = static function (array $files) use ($baseUrl, $escape): string {
        $lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ];
        foreach ($files as $file) {
            $line = '  <sitemap><loc>' . $escape($baseUrl . '/sitemaps/' . $file['name']) . '</loc>';
            if (($file['lastmod'] ?? null) !== null) {
                $line .= '<lastmod>' . $escape((string) $file['lastmod']) . '</lastmod>';
            }
            $lines[] = $line . '</sitemap>';
        }
        $lines[] = '</sitemapindex>';
        return implode("\n", $lines) . "\n";
    };

    $files = [];
    $counts = ['institutional' => 0, 'questions' => 0, 'laws' => 0, 'exams' => 0, 'taxonomies' => 0];
    $institutionalSources = [
        '/' => 'src/app/page.tsx',
        '/planos' => 'src/app/planos/page.tsx',
        $routes->questionsIndex() => 'src/app/questoes/page.tsx',
        '/concursos' => 'src/app/concursos/page.tsx',
        '/faq' => 'src/app/faq/page.tsx',
        '/lei-comentada' => 'src/app/lei-comentada/page.tsx',
        '/blog' => 'src/app/blog/page.tsx',
        $routes->examsIndex() => 'src/app/provas/page.tsx',
        '/disciplinas' => 'src/app/disciplinas/page.tsx',
        '/bancas' => 'src/app/bancas/page.tsx',
        '/novidades' => 'src/app/novidades/page.tsx',
        '/elite' => 'src/app/elite/page.tsx',
        '/marketplace' => 'src/app/marketplace/page.tsx',
        '/privacy' => 'src/app/privacy/page.tsx',
        '/terms' => 'src/app/terms/page.tsx',
    ];
    $institutionalEntries = [];
    foreach ($institutionalSources as $path => $source) {
        $institutionalEntries[] = ['loc' => $baseUrl . $path, 'lastmod' => $sourceLastmod($source)];
    }
    $filename = 'institutional-00001.xml';
    $write($stage . '/' . $filename, $buildUrlSet($institutionalEntries));
    $files[] = ['name' => $filename, 'lastmod' => $maxLastmod($institutionalEntries)];
    $counts['institutional'] = count($institutionalEntries);

    $cursor = 0;
    $page = 0;
    while (true) {
        $queryCount++;
        $stmt = $db->prepare(
            "SELECT id,
                    COALESCE(NULLIF(enunciado_clean, ''), NULLIF(enunciado, ''), CONCAT('Questao ', id)) AS label,
                    COALESCE(updated_at, published_at, created_at) AS last_modified
             FROM questions
             WHERE id > :cursor
               AND publish_status = 'published'
               AND visibility_status = 'public'
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
            if ($id <= 0) {
                continue;
            }
            $slug = $slugger->slug((string) ($row['label'] ?? ''), 'questao', $id);
            $entries[] = [
                'loc' => $baseUrl . $routes->questionDetail($id, $slug),
                'lastmod' => $safeDate($row['last_modified'] ?? null),
            ];
            $cursor = $id;
        }
        if ($entries !== []) {
            $page++;
            $filename = sprintf('questions-%05d.xml', $page);
            $write($stage . '/' . $filename, $buildUrlSet($entries));
            $files[] = ['name' => $filename, 'lastmod' => $maxLastmod($entries)];
            $counts['questions'] += count($entries);
        }
        if (count($rows) < $batchSize) {
            break;
        }
    }

    $lawCursor = 0;
    $lawPage = 0;
    while (true) {
        $queryCount++;
        $stmt = $db->prepare(
            "SELECT id, slug, COALESCE(updated_at, published_at, created_at) AS last_modified
             FROM laws
             WHERE id > :cursor
               AND slug IS NOT NULL
               AND slug <> ''
               AND (status IN ('active', 'published')
                    OR (status = 'scheduled' AND published_at IS NOT NULL AND published_at <= NOW()))
             ORDER BY id
             LIMIT {$batchSize}"
        );
        $stmt->execute([':cursor' => $lawCursor]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if ($rows === []) {
            break;
        }
        $entries = [];
        foreach ($rows as $row) {
            $id = (int) ($row['id'] ?? 0);
            $slug = trim((string) ($row['slug'] ?? ''));
            $lawCursor = max($lawCursor, $id);
            if ($id <= 0 || $slug === '') {
                continue;
            }
            $entries[] = [
                'loc' => $baseUrl . '/lei-comentada/' . rawurlencode($slug),
                'lastmod' => $safeDate($row['last_modified'] ?? null),
            ];
        }
        if ($entries !== []) {
            $lawPage++;
            $filename = sprintf('laws-%05d.xml', $lawPage);
            $write($stage . '/' . $filename, $buildUrlSet($entries));
            $files[] = ['name' => $filename, 'lastmod' => $maxLastmod($entries)];
            $counts['laws'] += count($entries);
        }
        if (count($rows) < $batchSize) {
            break;
        }
    }

    $examCursor = 0;
    $examPage = 0;
    $seenExamUrls = [];
    while (true) {
        $queryCount++;
        $stmt = $db->prepare(
            "SELECT id, slug, COALESCE(updated_at, created_at) AS last_modified
             FROM provas
             WHERE id > :cursor
               AND archived_at IS NULL
               AND status_editorial = 'published'
               AND visibility_status = 'public'
               AND (scheduled_at IS NULL OR scheduled_at <= NOW())
               AND slug IS NOT NULL
               AND slug <> ''
             ORDER BY id
             LIMIT {$batchSize}"
        );
        $stmt->execute([':cursor' => $examCursor]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if ($rows === []) {
            break;
        }
        $entries = [];
        foreach ($rows as $row) {
            $id = (int) ($row['id'] ?? 0);
            $slug = trim((string) ($row['slug'] ?? ''));
            $examCursor = max($examCursor, $id);
            if ($id <= 0 || $slug === '') {
                continue;
            }
            $examUrl = $baseUrl . $routes->examDetail($slug);
            if (isset($seenExamUrls[$examUrl])) {
                continue;
            }
            $seenExamUrls[$examUrl] = true;
            $entries[] = ['loc' => $examUrl, 'lastmod' => $safeDate($row['last_modified'] ?? null)];
        }
        if ($entries !== []) {
            $examPage++;
            $filename = sprintf('exams-%05d.xml', $examPage);
            $write($stage . '/' . $filename, $buildUrlSet($entries));
            $files[] = ['name' => $filename, 'lastmod' => $maxLastmod($entries)];
            $counts['exams'] += count($entries);
        }
        if (count($rows) < $batchSize) {
            break;
        }
    }

    $queryCount++;
    $taxonomyStmt = $db->query(
        "SELECT f.id, f.type, f.slug
           FROM filters f
          WHERE f.slug IS NOT NULL
            AND f.slug <> ''
            AND f.type = 'banca'
            AND EXISTS (
                SELECT 1
                  FROM question_filters qf
                  INNER JOIN questions q ON q.id = qf.question_id
                 WHERE qf.filter_id = f.id
                   AND q.publish_status IN ('published', 'scheduled')
                   AND q.visibility_status = 'public'
                   AND q.published_sort_at IS NOT NULL
                   AND q.published_sort_at <= NOW()
            )
          ORDER BY f.id"
    );
    $taxonomyEntries = [];
    foreach ($taxonomyStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $slug = trim((string) ($row['slug'] ?? ''));
        if ($slug !== '') {
            $taxonomyEntries[] = ['loc' => $baseUrl . '/bancas/' . rawurlencode($slug), 'lastmod' => null];
        }
    }
    foreach (array_chunk($taxonomyEntries, $batchSize) as $index => $entries) {
        $filename = sprintf('taxonomies-%05d.xml', $index + 1);
        $write($stage . '/' . $filename, $buildUrlSet($entries));
        $files[] = ['name' => $filename, 'lastmod' => null];
        $counts['taxonomies'] += count($entries);
    }

    $blogGenerator = new StaticBlogSitemapGenerator($db, $baseUrl, $stage, $batchSize);
    $blogResult = $blogGenerator->generate();
    $queryCount += (int) ($blogResult['queryCount'] ?? 0);

    $write($stage . '/sitemap.xml', $buildIndex($files));
    $validator = new StaticSitemapValidator($baseUrl);
    $validation = $validator->validateDirectory($stage, $validateHttp ? $httpValidationOrigin : null);
    $validator->assertValid($validation);

    $status = [
        'scope' => 'static_sitemap_coverage',
        'generatedAt' => $generatedAt,
        'canonicalBaseUrl' => $baseUrl,
        'sitemapUrl' => $baseUrl . '/sitemap.xml',
        'robotsUrl' => $baseUrl . '/robots.txt',
        'counts' => array_merge($counts, ['blog' => $blogResult['counts']]),
        'totalUrls' => array_sum($counts) + (int) ($blogResult['totalUrls'] ?? 0),
        'files' => count($files) + (int) ($blogResult['files'] ?? 0),
        'queries' => $queryCount,
        'durationMs' => (int) round((microtime(true) - $startedAt) * 1000),
        'peakMemoryBytes' => memory_get_peak_usage(true),
        'coverage' => [
            'institutional' => ['total' => $counts['institutional'], 'indexed' => $counts['institutional'], 'missing' => 0],
            'questions' => ['total' => $counts['questions'], 'indexed' => $counts['questions'], 'missing' => 0],
            'boards' => ['total' => $counts['taxonomies'], 'indexed' => $counts['taxonomies'], 'missing' => 0],
            'rankings' => ['total' => 0, 'indexed' => 0, 'missing' => 0],
            'materials' => ['total' => 0, 'indexed' => 0, 'missing' => 0],
        ],
        'missingSamples' => [
            'questions' => [],
            'boards' => [],
            'rankings' => [],
            'materials' => [],
        ],
        'note' => 'Cobertura do artefato estatico validado. Indexacao depende de rastreamento externo.',
        'validation' => $validation,
    ];
    $write($stage . '/sitemap-status.json', json_encode($status, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
    $publisher->promote($stage);

    fwrite(STDOUT, json_encode([
        'status' => 'complete',
        'outputDir' => $outputDir,
        'counts' => $status['counts'],
        'totalUrls' => $status['totalUrls'],
        'files' => $status['files'],
        'queries' => $queryCount,
        'durationMs' => $status['durationMs'],
        'peakMemoryBytes' => $status['peakMemoryBytes'],
        'validation' => $validation,
    ], JSON_UNESCAPED_SLASHES) . PHP_EOL);
} catch (Throwable $error) {
    $publisher->discard($stage);
    throw $error;
} finally {
    flock($lock, LOCK_UN);
    fclose($lock);
}
