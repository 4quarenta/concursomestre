<?php

declare(strict_types=1);

final class StaticBlogSitemapGenerator
{
    public function __construct(
        private readonly PDO $db,
        private readonly string $baseUrl,
        private readonly string $outputDirectory,
        private readonly int $batchSize = 45000
    ) {
    }

    /** @return array{counts:array{articles:int,taxonomies:int},totalUrls:int,files:int,filesList:list<array{name:string,lastmod:?string}>,queryCount:int} */
    public function generate(): array
    {
        $files = [];
        $counts = ['articles' => 0, 'taxonomies' => 0];
        $queryCount = 0;

        if (!$this->tableExists('blog_articles', $queryCount)) {
            return ['counts' => $counts, 'totalUrls' => 0, 'files' => 0, 'filesList' => [], 'queryCount' => $queryCount];
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
                if ($id <= 0 || strlen($slug) > 180 || preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $slug) !== 1) {
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

        // Categorias dependem de quality PASS real. Sem evidencia materializada,
        // o gerador permanece fail-closed e nao as publica por mera contagem.

        return [
            'counts' => $counts,
            'totalUrls' => $counts['articles'] + $counts['taxonomies'],
            'files' => count($files),
            'filesList' => $files,
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
