<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este gerador so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/seo/launch/SeoLaunchMode.php';
require_once __DIR__ . '/../../modules/seo/launch/SeoRuntimeEnvironment.php';
require_once __DIR__ . '/../../modules/seo/launch/SeoProductionPageMap.php';
require_once __DIR__ . '/../../modules/seo/routes/PublicRouteBuilder.php';
require_once __DIR__ . '/../../modules/seo/services/SeoSlugService.php';
require_once __DIR__ . '/../../modules/seo/sitemaps/StaticBlogSitemapGenerator.php';
require_once __DIR__ . '/../../modules/seo/sitemaps/StaticSitemapPublisher.php';
require_once __DIR__ . '/../../modules/seo/sitemaps/StaticSitemapValidator.php';

$launchMode = SeoLaunchMode::fromEnvironment();
$simulation = filter_var(getenv('SEO_SITEMAP_SIMULATION') ?: '0', FILTER_VALIDATE_BOOL);
$runtimeEnvironment = new SeoRuntimeEnvironment();
$environmentDecision = $runtimeEnvironment->evaluate($launchMode);
if (!$simulation && ($environmentDecision['sitemapPublicationAllowed'] ?? false) !== true) {
    fwrite(STDOUT, "Sitemap publication skipped: SEO_LAUNCH_MODE={$launchMode}.\n");
    exit(0);
}
if ($simulation && $launchMode !== SeoLaunchMode::GO_CANDIDATE) {
    throw new RuntimeException('Sitemap simulation is only allowed in GO_CANDIDATE.');
}

$startedAt = microtime(true);
$db = (new Database('read'))->getConnection();
$baseUrl = $runtimeEnvironment->canonicalOrigin();
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
$batchSize = $runtimeEnvironment->maxUrlsPerChild();
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
    $assertSitemapFamily = static function (string $familyId) use ($productionPageMap): void {
        $family = $productionPageMap->family($familyId);
        if (($family['launchStatus'] ?? null) !== 'ACTIVE'
            || ($family['familyEligibility'] ?? null) === 'PERMANENT_NOINDEX'
            || ($family['targetProductionIndexability'] ?? null) !== 'INDEX'
            || ($family['sitemapTarget'] ?? null) !== 'INCLUDE_WHEN_READY') {
            throw new RuntimeException('Familia nao elegivel no Production Page Map: ' . $familyId . '.');
        }
    };
    foreach ([
        'question_detail', 'law_detail', 'law_article_detail', 'exam_detail',
        'contest_detail', 'simulation_detail', 'material_detail', 'board_detail',
        'organization_detail', 'discipline_detail', 'topic_detail', 'subject_detail',
        'career_detail', 'position_detail', 'blog_article',
    ] as $dynamicFamilyId) {
        $assertSitemapFamily($dynamicFamilyId);
    }
    $slugger = new SeoSlugService();
    $escape = static fn (string $value): string => htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    $safeDate = static function (mixed $value): ?string {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }
        $timestamp = strtotime((string) $value);
        return $timestamp === false ? null : gmdate('Y-m-d', $timestamp);
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
    $counts = ['institutional' => 0, 'questions' => 0, 'laws' => 0, 'lawArticles' => 0, 'exams' => 0, 'contests' => 0, 'simulations' => 0, 'materials' => 0, 'boards' => 0, 'organizations' => 0, 'disciplines' => 0, 'topics' => 0, 'subjects' => 0, 'professional' => 0];
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
        $routes->materialsIndex() => ['source' => 'src/app/materiais/page.tsx', 'familyId' => 'materials_hub'],
        $routes->careersIndex() => ['source' => 'src/app/carreiras/page.tsx', 'familyId' => 'careers_hub'],
        $routes->positionsIndex() => ['source' => 'src/app/cargos/page.tsx', 'familyId' => 'positions_hub'],
        '/disciplinas' => ['source' => 'src/app/disciplinas/page.tsx', 'familyId' => 'discipline_hub'],
        '/bancas' => ['source' => 'src/app/bancas/page.tsx', 'familyId' => 'board_hub'],
        $routes->organizationsIndex() => ['source' => 'src/app/orgaos/page.tsx', 'familyId' => 'organizations_hub'],
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
            'lastmod' => null,
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
               AND publish_status IN ('published', 'scheduled')
               AND visibility_status = 'public'
               AND published_sort_at IS NOT NULL
               AND published_sort_at <= NOW()
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
               AND CHAR_LENGTH(slug) <= 190
               AND EXISTS (
                   SELECT 1 FROM contest_organizations co
                   INNER JOIN filters organization ON organization.id = co.organization_filter_id
                       AND organization.type = 'orgao'
                       AND COALESCE(organization.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
                       AND TRIM(organization.name) <> ''
                       AND BINARY organization.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
                       AND CHAR_LENGTH(organization.slug) <= 190
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

    $materialCursor = 0;
    $materialPage = 0;
    while (true) {
        $queryCount++;
        $stmt = $db->prepare(
            "SELECT id, slug, COALESCE(updated_at, published_at, created_at) AS last_modified
               FROM materials
              WHERE id > :cursor
                AND status = 'approved'
                AND publication_status = 'published'
                AND visibility_status = 'public'
                AND rights_status = 'approved'
                AND archived_at IS NULL
                AND (scheduled_at IS NULL OR scheduled_at <= NOW())
                AND TRIM(title) <> ''
                AND BINARY slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
                AND CHAR_LENGTH(slug) <= 190
                AND EXISTS (
                    SELECT 1
                      FROM material_uploads ready_upload
                     WHERE ready_upload.attached_material_id = materials.id
                       AND ready_upload.status = 'attached'
                )
              ORDER BY id
              LIMIT {$batchSize}"
        );
        $stmt->execute([':cursor' => $materialCursor]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if ($rows === []) break;
        $entries = [];
        foreach ($rows as $row) {
            $id = (int) ($row['id'] ?? 0);
            $slug = trim((string) ($row['slug'] ?? ''));
            $materialCursor = max($materialCursor, $id);
            if ($id <= 0 || $slug === '') continue;
            $entries[] = [
                'loc' => $baseUrl . $routes->materialDetail($slug),
                'lastmod' => $safeDate($row['last_modified'] ?? null),
            ];
        }
        if ($entries !== []) {
            $materialPage++;
            $filename = sprintf('materials-%05d.xml', $materialPage);
            $write($stage . '/' . $filename, $buildUrlSet($entries));
            $files[] = ['name' => $filename, 'lastmod' => $maxLastmod($entries)];
            $counts['materials'] += count($entries);
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
               AND BINARY slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
               AND CHAR_LENGTH(slug) <= 160
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

    $lawArticleCursor = 0;
    $lawArticlePage = 0;
    while (true) {
        $queryCount++;
        $stmt = $db->prepare(
            "SELECT a.id, a.slug AS article_slug, l.slug AS law_slug,
                    COALESCE(a.updated_at, a.created_at, l.updated_at, l.published_at) AS last_modified
               FROM law_articles a
               INNER JOIN laws l ON l.id = a.law_id
              WHERE a.id > :cursor
                AND a.official_status IN ('active', 'revoked', 'vetoed')
                AND TRIM(a.article_number) <> ''
                AND TRIM(a.official_text) <> ''
                AND BINARY a.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
                AND CHAR_LENGTH(a.slug) <= 180
                AND BINARY l.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
                AND CHAR_LENGTH(l.slug) <= 160
                AND (l.status IN ('active', 'published', 'revoked')
                     OR (l.status = 'scheduled' AND l.published_at IS NOT NULL AND l.published_at <= NOW()))
              ORDER BY a.id
              LIMIT {$batchSize}"
        );
        $stmt->execute([':cursor' => $lawArticleCursor]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if ($rows === []) break;
        $entries = [];
        foreach ($rows as $row) {
            $id = (int) ($row['id'] ?? 0);
            $lawSlug = trim((string) ($row['law_slug'] ?? ''));
            $articleSlug = trim((string) ($row['article_slug'] ?? ''));
            $lawArticleCursor = max($lawArticleCursor, $id);
            if ($id <= 0 || $lawSlug === '' || $articleSlug === '') continue;
            $entries[] = [
                'loc' => $baseUrl . $routes->lawArticleDetail($lawSlug, $articleSlug),
                'lastmod' => $safeDate($row['last_modified'] ?? null),
            ];
        }
        if ($entries !== []) {
            $lawArticlePage++;
            $filename = sprintf('law-articles-%05d.xml', $lawArticlePage);
            $write($stage . '/' . $filename, $buildUrlSet($entries));
            $files[] = ['name' => $filename, 'lastmod' => $maxLastmod($entries)];
            $counts['lawArticles'] += count($entries);
        }
        if (count($rows) < $batchSize) break;
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
               AND BINARY slug REGEXP '^[a-z0-9-]+$'
               AND CHAR_LENGTH(slug) <= 190
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

    $publicFilterNameClauseFor = static fn (string $alias): string => "TRIM({$alias}.name) <> ''
        AND LOWER(TRIM({$alias}.name)) NOT IN (
            'outros', 'outras', 'diversos', 'diversas', 'geral',
            'nao informado', 'não informado', 'sem classificacao',
            'sem classificação', 'a definir'
        )";
    $publicFilterNameClause = $publicFilterNameClauseFor('f');
    $publicRootNameClause = $publicFilterNameClauseFor('root');
    $publicTopicNameClause = $publicFilterNameClauseFor('topic');
    $publicSubtopicNameClause = $publicFilterNameClauseFor('subtopic');
    $appendFilterSection = static function (
        string $section,
        string $filenamePrefix,
        string $sql,
        callable $pathBuilder
    ) use (
        $db,
        $batchSize,
        $baseUrl,
        $stage,
        $buildUrlSet,
        $write,
        &$files,
        &$counts,
        &$queryCount
    ): void {
        $cursor = 0;
        $page = 0;
        while (true) {
            $queryCount++;
            $stmt = $db->prepare($sql);
            $stmt->execute([':cursor' => $cursor]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            if ($rows === []) break;
            $entries = [];
            foreach ($rows as $row) {
                $id = (int) ($row['id'] ?? 0);
                $slug = trim((string) ($row['slug'] ?? ''));
                $cursor = max($cursor, $id);
                if ($id <= 0 || $slug === '') continue;
                $entries[] = ['loc' => $baseUrl . $pathBuilder($slug), 'lastmod' => null];
            }
            if ($entries !== []) {
                $page++;
                $filename = sprintf('%s-%05d.xml', $filenamePrefix, $page);
                $write($stage . '/' . $filename, $buildUrlSet($entries));
                $files[] = ['name' => $filename, 'lastmod' => null];
                $counts[$section] += count($entries);
            }
            if (count($rows) < $batchSize) break;
        }
    };

    $appendFilterSection(
        'boards',
        'boards',
        "SELECT f.id, f.slug
           FROM filters f
          WHERE f.id > :cursor
            AND f.type = 'banca'
            AND COALESCE(f.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
            AND {$publicFilterNameClause}
            AND CHAR_LENGTH(f.slug) <= 190
            AND BINARY f.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
          ORDER BY f.id
          LIMIT {$batchSize}",
        static fn (string $slug): string => $routes->boardDetail($slug)
    );
    $appendFilterSection(
        'organizations',
        'organizations',
        "SELECT f.id, f.slug
           FROM filters f
          WHERE f.id > :cursor
            AND f.type = 'orgao'
            AND COALESCE(f.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
            AND {$publicFilterNameClause}
            AND CHAR_LENGTH(f.slug) <= 190
            AND BINARY f.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
          ORDER BY f.id
          LIMIT {$batchSize}",
        static fn (string $slug): string => $routes->organizationDetail($slug)
    );
    $appendFilterSection(
        'disciplines',
        'disciplines',
        "SELECT f.id, f.slug
           FROM filters f
          WHERE f.id > :cursor
            AND f.type = 'assunto'
            AND (f.taxonomy_level = 'materia' OR f.meta_materia = 1)
            AND COALESCE(f.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
            AND COALESCE(f.parent_id, 0) = 0
            AND {$publicFilterNameClause}
            AND CHAR_LENGTH(f.slug) <= 80
            AND BINARY f.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
          ORDER BY f.id
          LIMIT {$batchSize}",
        static fn (string $slug): string => $routes->disciplineDetail($slug)
    );
    $appendFilterSection(
        'topics',
        'topics',
        "SELECT f.id, f.slug
           FROM filters f
           INNER JOIN filters root
             ON root.id = f.parent_id
            AND root.type = 'assunto'
            AND (root.taxonomy_level = 'materia' OR root.meta_materia = 1)
            AND COALESCE(root.parent_id, 0) = 0
            AND COALESCE(root.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
            AND {$publicRootNameClause}
            AND CHAR_LENGTH(root.slug) <= 80
            AND BINARY root.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
          WHERE f.id > :cursor
            AND f.type = 'assunto'
            AND f.taxonomy_level = 'topico'
            AND COALESCE(f.meta_materia, 0) = 0
            AND {$publicFilterNameClause}
            AND CHAR_LENGTH(f.slug) <= 80
            AND BINARY f.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
          ORDER BY f.id
          LIMIT {$batchSize}",
        static fn (string $slug): string => $routes->topicDetail($slug)
    );
    $appendFilterSection(
        'subjects',
        'subjects',
        "SELECT f.id, f.slug
           FROM filters f
           INNER JOIN filters subtopic
             ON subtopic.id = f.parent_id
            AND subtopic.type = 'assunto'
            AND subtopic.taxonomy_level = 'subtopico'
            AND COALESCE(subtopic.meta_materia, 0) = 0
            AND {$publicSubtopicNameClause}
            AND CHAR_LENGTH(subtopic.slug) <= 80
            AND BINARY subtopic.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
           INNER JOIN filters topic
             ON topic.id = subtopic.parent_id
            AND topic.type = 'assunto'
            AND topic.taxonomy_level = 'topico'
            AND COALESCE(topic.meta_materia, 0) = 0
            AND {$publicTopicNameClause}
            AND CHAR_LENGTH(topic.slug) <= 80
            AND BINARY topic.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
           INNER JOIN filters root
             ON root.id = topic.parent_id
            AND root.type = 'assunto'
            AND (root.taxonomy_level = 'materia' OR root.meta_materia = 1)
            AND COALESCE(root.parent_id, 0) = 0
            AND COALESCE(root.taxonomy_level, '') NOT IN ('pending', 'internal', 'technical')
            AND {$publicRootNameClause}
            AND CHAR_LENGTH(root.slug) <= 80
            AND BINARY root.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
          WHERE f.id > :cursor
            AND f.type = 'assunto'
            AND f.taxonomy_level = 'assunto'
            AND COALESCE(f.meta_materia, 0) = 0
            AND {$publicFilterNameClause}
            AND CHAR_LENGTH(f.slug) <= 80
            AND BINARY f.slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'
          ORDER BY f.id
          LIMIT {$batchSize}",
        static fn (string $slug): string => $routes->subjectDetail($slug)
    );

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
    foreach ($blogResult['filesList'] ?? [] as $blogFile) {
        if (is_array($blogFile)) $files[] = $blogFile;
    }

    $write($stage . '/sitemap.xml', $buildIndex($files));
    $validator = new StaticSitemapValidator($baseUrl);
    $validation = $validator->validateDirectory($stage, $validateHttp ? $httpValidationOrigin : null);
    $validator->assertValid($validation);

    $status = [
        'scope' => 'static_sitemap_coverage',
        'artifactSet' => 'canonical-sitemap-index',
        'indexPolicyVersion' => 'index-policy-phase-6.v1',
        'generatedAt' => $generatedAt,
        'canonicalBaseUrl' => $baseUrl,
        'sitemapUrl' => $baseUrl . '/sitemap.xml',
        'robotsUrl' => $baseUrl . '/robots.txt',
        'counts' => array_merge($counts, ['blog' => $blogResult['counts']]),
        'totalUrls' => array_sum($counts) + (int) ($blogResult['totalUrls'] ?? 0),
        'files' => count($files),
        'queries' => $queryCount,
        'durationMs' => (int) round((microtime(true) - $startedAt) * 1000),
        'peakMemoryBytes' => memory_get_peak_usage(true),
        'coverage' => [
            'institutional' => ['total' => $counts['institutional'], 'indexed' => $counts['institutional'], 'missing' => 0],
            'questions' => ['total' => $counts['questions'], 'indexed' => $counts['questions'], 'missing' => 0],
            'boards' => ['total' => $counts['boards'], 'indexed' => $counts['boards'], 'missing' => 0],
            'rankings' => ['total' => 0, 'indexed' => 0, 'missing' => 0],
            'materials' => ['total' => $counts['materials'], 'indexed' => $counts['materials'], 'missing' => 0],
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
