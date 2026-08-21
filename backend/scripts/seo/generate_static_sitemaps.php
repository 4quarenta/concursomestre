<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este gerador so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/seo/launch/SeoLaunchMode.php';
require_once __DIR__ . '/../../modules/seo/launch/SeoProductionPageMap.php';
require_once __DIR__ . '/../../modules/seo/routes/PublicRouteBuilder.php';
require_once __DIR__ . '/../../modules/seo/services/SeoSlugService.php';
require_once __DIR__ . '/../../modules/seo/sitemaps/StaticBlogSitemapGenerator.php';
require_once __DIR__ . '/../../modules/seo/sitemaps/StaticSitemapPublisher.php';
require_once __DIR__ . '/../../modules/seo/sitemaps/StaticSitemapValidator.php';

$launchMode = SeoLaunchMode::fromEnvironment();
$simulation = filter_var(getenv('SEO_SITEMAP_SIMULATION') ?: '0', FILTER_VALIDATE_BOOL);
if ($launchMode !== SeoLaunchMode::PRODUCTION && !$simulation) {
    fwrite(STDOUT, "Sitemap publication skipped: SEO_LAUNCH_MODE={$launchMode}.\n");
    exit(0);
}
if ($simulation && $launchMode !== SeoLaunchMode::GO_CANDIDATE) {
    throw new RuntimeException('Sitemap simulation is only allowed in GO_CANDIDATE.');
}

$startedAt = microtime(true);
$db = (new Database('read'))->getConnection();
$baseUrl = rtrim(trim((string) (getenv('CANONICAL_BASE_URL') ?: 'https://concursomestre.com')), '/');
$productionOutputDir = trim((string) (getenv('SITEMAP_OUTPUT_DIR') ?: dirname(__DIR__, 2) . '/storage/sitemaps'));
$simulationOutputDir = trim((string) (getenv('SITEMAP_SIMULATION_OUTPUT_DIR') ?: ''));
if ($simulation && $simulationOutputDir === '') {
    throw new RuntimeException('SITEMAP_SIMULATION_OUTPUT_DIR is required for GO_CANDIDATE simulation.');
}
$outputDir = $simulation ? $simulationOutputDir : $productionOutputDir;
if ($simulation && realpath(dirname($outputDir)) === realpath(dirname($productionOutputDir))
    && basename($outputDir) === basename($productionOutputDir)) {
    throw new RuntimeException('Sitemap simulation cannot target the served production directory.');
}
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
    $productionPageMap = new SeoProductionPageMap();
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
    $counts = ['institutional' => 0, 'questions' => 0, 'laws' => 0, 'exams' => 0, 'contests' => 0, 'simulations' => 0, 'taxonomies' => 0, 'professional' => 0];
    $institutionalSources = [
        '/' => ['source' => 'src/app/page.tsx', 'familyId' => 'home'],
        '/planos' => ['source' => 'src/app/planos/page.tsx', 'familyId' => 'plans'],
        $routes->questionsIndex() => ['source' => 'src/app/questoes/page.tsx', 'familyId' => 'questions_hub'],
        '/faq' => ['source' => 'src/app/faq/page.tsx', 'familyId' => 'faq'],
        '/lei-comentada' => ['source' => 'src/app/lei-comentada/page.tsx', 'familyId' => 'law_hub'],
        '/blog' => ['source' => 'src/app/blog/page.tsx', 'familyId' => 'blog_hub'],
        $routes->examsIndex() => ['source' => 'src/app/provas/page.tsx', 'familyId' => 'exam_hub'],
        $routes->contestsIndex() => ['source' => 'src/app/concursos/page.tsx', 'familyId' => 'contest_hub'],
        $routes->openContests() => ['source' => 'src/app/concursos-abertos/page.tsx', 'familyId' => 'open_contests'],
        $routes->simulationsIndex() => ['source' => 'src/app/simulados/page.tsx', 'familyId' => 'simulations_hub'],
        $routes->careersIndex() => ['source' => 'src/app/carreiras/page.tsx', 'familyId' => 'careers_hub'],
        $routes->positionsIndex() => ['source' => 'src/app/cargos/page.tsx', 'familyId' => 'positions_hub'],
        '/disciplinas' => ['source' => 'src/app/disciplinas/page.tsx', 'familyId' => 'discipline_hub'],
        '/bancas' => ['source' => 'src/app/bancas/page.tsx', 'familyId' => 'board_hub'],
        '/novidades' => ['source' => 'src/app/novidades/page.tsx', 'familyId' => 'news'],
        '/support' => ['source' => 'src/app/support/page.tsx', 'familyId' => 'support'],
        '/elite' => ['source' => 'src/app/elite/page.tsx', 'familyId' => 'elite'],
        '/marketplace' => ['source' => 'src/app/marketplace/page.tsx', 'familyId' => 'marketplace'],
        '/privacy' => ['source' => 'src/app/privacy/page.tsx', 'familyId' => 'privacy'],
        '/terms' => ['source' => 'src/app/terms/page.tsx', 'familyId' => 'terms'],
    ];
    $institutionalEntries = [];
    foreach ($institutionalSources as $path => $candidate) {
        $family = $productionPageMap->family($candidate['familyId']);
        if (($family['launchStatus'] ?? null) !== 'ACTIVE'
            || ($family['targetProductionIndexability'] ?? null) !== 'INDEX'
            || ($family['sitemapTarget'] ?? null) !== 'INCLUDE_WHEN_READY') {
            continue;
        }
        $institutionalEntries[] = [
            'loc' => $baseUrl . $path,
            'lastmod' => $sourceLastmod($candidate['source']),
        ];
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

    $contestCursor = 0;
    $contestPage = 0;
    while (true) {
        $queryCount++;
        $stmt = $db->prepare(
            "SELECT id, slug, updated_at AS last_modified
             FROM contests
             WHERE id > :cursor
               AND publication_status = 'published'
               AND visibility_status = 'public'
               AND archived_at IS NULL
               AND (scheduled_at IS NULL OR scheduled_at <= NOW())
               AND TRIM(title) <> ''
               AND BINARY slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
               AND EXISTS (
                   SELECT 1 FROM contest_organizations co
                   INNER JOIN filters organization ON organization.id = co.organization_filter_id
                       AND organization.type = 'orgao'
                       AND COALESCE(organization.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
                       AND TRIM(organization.name) <> ''
                       AND BINARY organization.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
                   WHERE co.contest_id = contests.id
               )
             ORDER BY id
             LIMIT {$batchSize}"
        );
        $stmt->execute([':cursor' => $contestCursor]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if ($rows === []) break;
        $entries = [];
        foreach ($rows as $row) {
            $id = (int) ($row['id'] ?? 0);
            $slug = trim((string) ($row['slug'] ?? ''));
            $contestCursor = max($contestCursor, $id);
            if ($id <= 0 || $slug === '') continue;
            $entries[] = ['loc' => $baseUrl . $routes->contestDetail($slug), 'lastmod' => $safeDate($row['last_modified'] ?? null)];
        }
        if ($entries !== []) {
            $contestPage++;
            $filename = sprintf('contests-%05d.xml', $contestPage);
            $write($stage . '/' . $filename, $buildUrlSet($entries));
            $files[] = ['name' => $filename, 'lastmod' => $maxLastmod($entries)];
            $counts['contests'] += count($entries);
        }
        if (count($rows) < $batchSize) break;
    }

    $simulationCursor = 0;
    $simulationPage = 0;
    while (true) {
        $queryCount++;
        $stmt = $db->prepare(
            "SELECT id, slug, updated_at AS last_modified
             FROM public_simulations
             WHERE id > :cursor
               AND publication_status = 'published'
               AND visibility_status = 'public'
               AND archived_at IS NULL
               AND (scheduled_at IS NULL OR scheduled_at <= NOW())
               AND TRIM(title) <> ''
               AND BINARY slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
               AND CHAR_LENGTH(slug) <= 190
               AND EXISTS (
                   SELECT 1 FROM public_simulation_questions ready_sq
                   INNER JOIN questions ready_q ON ready_q.id = ready_sq.question_id
                       AND ready_q.publish_status IN ('published', 'scheduled')
                       AND ready_q.visibility_status = 'public'
                       AND ready_q.published_sort_at IS NOT NULL
                       AND ready_q.published_sort_at <= NOW()
                   WHERE ready_sq.simulation_id = public_simulations.id
               )
             ORDER BY id
             LIMIT {$batchSize}"
        );
        $stmt->execute([':cursor' => $simulationCursor]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if ($rows === []) break;
        $entries = [];
        foreach ($rows as $row) {
            $id = (int) ($row['id'] ?? 0);
            $slug = trim((string) ($row['slug'] ?? ''));
            $simulationCursor = max($simulationCursor, $id);
            if ($id <= 0 || $slug === '') continue;
            $entries[] = ['loc' => $baseUrl . $routes->simulationDetail($slug), 'lastmod' => $safeDate($row['last_modified'] ?? null)];
        }
        if ($entries !== []) {
            $simulationPage++;
            $filename = sprintf('simulations-%05d.xml', $simulationPage);
            $write($stage . '/' . $filename, $buildUrlSet($entries));
            $files[] = ['name' => $filename, 'lastmod' => $maxLastmod($entries)];
            $counts['simulations'] += count($entries);
        }
        if (count($rows) < $batchSize) break;
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

    $professionalCursor = 0;
    $professionalPage = 0;
    while (true) {
        $queryCount++;
        $stmt = $db->prepare(
            "SELECT id, type, slug
               FROM filters
              WHERE id > :cursor
                AND type IN ('carreira', 'cargo')
                AND COALESCE(taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
                AND TRIM(name) <> ''
                AND LOWER(TRIM(name)) NOT IN (
                    'outros', 'outras', 'diversos', 'diversas', 'geral',
                    'nao informado', 'não informado', 'sem classificacao',
                    'sem classificação', 'a definir', 'cargo nao identificado',
                    'cargo não identificado'
                )
                AND CHAR_LENGTH(slug) <= 190
                AND BINARY slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
              ORDER BY id
              LIMIT {$batchSize}"
        );
        $stmt->execute([':cursor' => $professionalCursor]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if ($rows === []) break;
        $entries = [];
        foreach ($rows as $row) {
            $id = (int) ($row['id'] ?? 0);
            $slug = trim((string) ($row['slug'] ?? ''));
            $professionalCursor = max($professionalCursor, $id);
            if ($id <= 0 || $slug === '') continue;
            $path = ($row['type'] ?? '') === 'carreira'
                ? $routes->careerDetail($slug)
                : $routes->positionDetail($slug);
            $entries[] = ['loc' => $baseUrl . $path, 'lastmod' => null];
        }
        if ($entries !== []) {
            $professionalPage++;
            $filename = sprintf('professional-%05d.xml', $professionalPage);
            $write($stage . '/' . $filename, $buildUrlSet($entries));
            $files[] = ['name' => $filename, 'lastmod' => null];
            $counts['professional'] += count($entries);
        }
        if (count($rows) < $batchSize) break;
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
