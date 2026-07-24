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
$slugify = static function (string $value): string {
    $plain = strip_tags($value);
    $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $plain);
    $normalized = strtolower(is_string($converted) ? $converted : $plain);
    $normalized = preg_replace('/[^a-z0-9]+/', '-', $normalized) ?? '';
    $normalized = trim($normalized, '-');
    return substr($normalized !== '' ? $normalized : 'questao', 0, 100);
};
$atomicWrite = static function (string $path, string $contents): void {
    $temporary = $path . '.tmp-' . getmypid();
    if (file_put_contents($temporary, $contents, LOCK_EX) === false || !rename($temporary, $path)) {
        @unlink($temporary);
        throw new RuntimeException('Falha ao materializar ' . basename($path));
    }
};
$safeDate = static function (mixed $value, ?int $fallback = null): string {
    $timestamp = strtotime((string) $value);
    return gmdate('Y-m-d', $timestamp !== false ? $timestamp : ($fallback ?? time()));
};
$sourceLastmod = static function (string $relativePath) use ($safeDate): string {
    $absolutePath = dirname(__DIR__, 3) . '/' . ltrim($relativePath, '/');
    $mtime = is_file($absolutePath) ? filemtime($absolutePath) : false;
    return $safeDate(null, $mtime !== false ? $mtime : time());
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
$files = [];
$counts = ['institutional' => 0, 'questions' => 0, 'laws' => 0];
$institutionalSources = [
    '/' => 'src/app/page.tsx',
    '/planos' => 'src/app/planos/page.tsx',
    '/practice' => 'src/app/practice/page.tsx',
    '/concursos' => 'src/app/concursos/page.tsx',
    '/faq' => 'src/app/faq/page.tsx',
    '/lei-comentada' => 'src/app/lei-comentada/page.tsx',
    '/blog' => 'src/app/blog/page.tsx',
    '/elite' => 'src/app/elite/page.tsx',
    '/marketplace' => 'src/app/marketplace/page.tsx',
    '/changelog' => 'src/app/changelog/page.tsx',
    '/privacy' => 'src/app/privacy/page.tsx',
    '/terms' => 'src/app/terms/page.tsx',
];
$institutionalEntries = [];
foreach ($institutionalSources as $path => $source) {
    $institutionalEntries[] = [
        'loc' => $baseUrl . $path,
        'lastmod' => $sourceLastmod($source),
    ];
}
$institutionalFile = 'institutional-00001.xml';
$atomicWrite($outputDir . '/' . $institutionalFile, $buildUrlSet($institutionalEntries));
$files[] = ['name' => $institutionalFile, 'lastmod' => $generatedAt];
$counts['institutional'] = count($institutionalEntries);

$cursor = 0;
$page = 0;
while (true) {
    $stmt = $db->prepare(
        "SELECT id,
                COALESCE(NULLIF(enunciado_clean, ''), NULLIF(enunciado, ''), CONCAT('Questao ', id)) AS label,
                COALESCE(updated_at, published_at, created_at, NOW()) AS last_modified
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
        $entries[] = [
            'loc' => $baseUrl . '/question/' . $id . '/' . $slugify((string) ($row['label'] ?? '')),
            'lastmod' => $safeDate($row['last_modified'] ?? null),
        ];
        $cursor = $id;
    }
    $page++;
    $filename = sprintf('questions-%05d.xml', $page);
    $atomicWrite($outputDir . '/' . $filename, $buildUrlSet($entries));
    $files[] = ['name' => $filename, 'lastmod' => $generatedAt];
    $counts['questions'] += count($entries);
    if (count($rows) < $batchSize) {
        break;
    }
}

$lawCursor = 0;
$lawPage = 0;
while (true) {
    $stmt = $db->prepare(
        "SELECT id, slug, COALESCE(updated_at, published_at, created_at, NOW()) AS last_modified
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
        if ($id <= 0 || $slug === '') {
            continue;
        }
        $entries[] = [
            'loc' => $baseUrl . '/lei-comentada/' . rawurlencode($slug),
            'lastmod' => $safeDate($row['last_modified'] ?? null),
        ];
        $lawCursor = $id;
    }
    $lawPage++;
    $filename = sprintf('laws-%05d.xml', $lawPage);
    $atomicWrite($outputDir . '/' . $filename, $buildUrlSet($entries));
    $files[] = ['name' => $filename, 'lastmod' => $generatedAt];
    $counts['laws'] += count($entries);
    if (count($rows) < $batchSize) {
        break;
    }
}

$indexLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
];
foreach ($files as $file) {
    $indexLines[] = '  <sitemap><loc>' . $escape($baseUrl . '/sitemaps/' . $file['name'])
        . '</loc><lastmod>' . $escape($file['lastmod']) . '</lastmod></sitemap>';
}
$indexLines[] = '</sitemapindex>';
$atomicWrite($outputDir . '/sitemap.xml', implode("\n", $indexLines) . "\n");
$atomicWrite(
    $outputDir . '/robots.txt',
    "User-agent: *\nAllow: /\n\n"
        . "Sitemap: {$baseUrl}/sitemap.xml\n"
        . "Sitemap: {$baseUrl}/sitemaps/blog-sitemap.xml\n"
        . "Sitemap: {$baseUrl}/sitemaps/google-news.xml\n"
);
$atomicWrite($outputDir . '/sitemap-status.json', json_encode([
    'scope' => 'static_sitemap_coverage',
    'generatedAt' => $generatedAt,
    'canonicalBaseUrl' => $baseUrl,
    'counts' => $counts,
    'totalUrls' => array_sum($counts),
    'files' => count($files),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

fwrite(STDOUT, json_encode([
    'status' => 'complete',
    'outputDir' => $outputDir,
    'counts' => $counts,
    'files' => count($files),
], JSON_UNESCAPED_SLASHES) . PHP_EOL);
