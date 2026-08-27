<?php

declare(strict_types=1);

final class StaticSitemapValidator
{
    private const MAX_URLS_PER_FILE = 45000;
    private const MAX_FILE_BYTES = 52428800;
    private const LEGACY_PATHS = ['~^/practice/?$~', '~^/questions/?$~', '~^/question(?:/|$)~', '~^/blog/provas(?:/|$)~'];
    private const PRIVATE_PATHS = [
        '/admin', '/api', '/auth', '/checkout', '/dashboard', '/notifications',
        '/partner-dashboard', '/profile', '/read', '/simulation', '/subscription',
    ];
    private const PERMANENT_NOINDEX_PATHS = [
        '/marketplace', '/search', '/setup', '/blog/tag',
    ];

    private string $canonicalOrigin;

    public function __construct(string $canonicalBaseUrl)
    {
        $parts = parse_url(rtrim($canonicalBaseUrl, '/'));
        if (!is_array($parts) || ($parts['scheme'] ?? null) !== 'https' || empty($parts['host'])) {
            throw new InvalidArgumentException('Host canonico HTTPS invalido para sitemap.');
        }
        $this->canonicalOrigin = 'https://' . strtolower((string) $parts['host']);
    }

    /** @return array<string, mixed> */
    public function validateDirectory(string $directory, ?string $httpOrigin = null): array
    {
        $issues = [];
        $entries = [];
        $sectionCounts = [];
        $regularUrls = [];
        $indexes = ['sitemap.xml'];
        $indexedFiles = [];

        foreach ($indexes as $indexName) {
            $indexPath = $directory . DIRECTORY_SEPARATOR . $indexName;
            if (!is_file($indexPath)) {
                $issues[] = ['type' => 'missing_index', 'file' => $indexName];
                continue;
            }
            foreach ($this->readIndexFiles($indexPath, $issues) as $filename) {
                $indexedFiles[] = $filename;
                $filePath = $directory . DIRECTORY_SEPARATOR . $filename;
                if (!is_file($filePath)) {
                    $issues[] = ['type' => 'missing_section', 'file' => $filename];
                    continue;
                }
                foreach ($this->readUrlSet($filePath, $filename, $issues) as $entry) {
                    $entries[] = $entry;
                    $sectionCounts[$entry['section']] = ($sectionCounts[$entry['section']] ?? 0) + 1;
                    $regularUrls[] = $entry['url'];
                }
            }
        }

        foreach (glob($directory . DIRECTORY_SEPARATOR . '*.xml') ?: [] as $xmlPath) {
            $filename = basename($xmlPath);
            if ($filename !== 'sitemap.xml' && !in_array($filename, $indexedFiles, true)) {
                $issues[] = ['type' => 'unreferenced_sitemap_file', 'file' => $filename];
            }
        }

        $duplicates = array_filter(array_count_values($regularUrls), static fn (int $count): bool => $count > 1);
        foreach (array_keys($duplicates) as $url) {
            $issues[] = ['type' => 'duplicate_url', 'url' => $url];
        }

        foreach ($entries as $entry) {
            $this->validateEntry($entry, $issues);
        }

        $http = $httpOrigin !== null && trim($httpOrigin) !== ''
            ? $this->validateHttp($entries, rtrim($httpOrigin, '/'))
            : [
                'executed' => false,
                'total' => 0,
                'status200' => 0,
                'redirects' => 0,
                'status4xx' => 0,
                'status5xx' => 0,
                'noindex' => 0,
                'canonicalMismatch' => 0,
                'issues' => [],
            ];
        foreach ($http['issues'] as $issue) {
            $issues[] = $issue;
        }

        return [
            'valid' => $issues === [],
            'totalUrls' => count($regularUrls),
            'allEntriesIncludingNews' => count($entries),
            'sectionCounts' => $sectionCounts,
            'duplicates' => count($duplicates),
            'http' => $http,
            'issues' => array_slice($issues, 0, 200),
        ];
    }

    /** @return array<string, mixed> */
    public function validateForPromotion(string $directory, string $httpOrigin): array
    {
        if (trim($httpOrigin) === '') {
            throw new InvalidArgumentException('Promotion exige origem HTTP para validacao semantica.');
        }
        $report = $this->validateDirectory($directory, $httpOrigin);
        if (($report['http']['executed'] ?? false) !== true) {
            throw new RuntimeException('Validacao HTTP obrigatoria nao foi executada.');
        }
        $this->assertValid($report);
        return $report;
    }

    /** @param array<string, mixed> $report */
    public function assertValid(array $report): void
    {
        if (($report['valid'] ?? false) !== true) {
            $first = $report['issues'][0] ?? ['type' => 'unknown'];
            throw new RuntimeException('Validacao do sitemap falhou: ' . json_encode($first, JSON_UNESCAPED_SLASHES));
        }
    }

    /** @param list<array<string, mixed>> $issues @return list<string> */
    private function readIndexFiles(string $path, array &$issues): array
    {
        if ((int) filesize($path) > self::MAX_FILE_BYTES) {
            $issues[] = ['type' => 'sitemap_file_too_large', 'file' => basename($path)];
        }
        $xml = $this->loadXml($path, $issues);
        if ($xml === null || $xml->documentElement?->localName !== 'sitemapindex') {
            $issues[] = ['type' => 'invalid_sitemap_index', 'file' => basename($path)];
            return [];
        }
        $files = [];
        $xpath = new DOMXPath($xml);
        foreach ($xpath->query('//*[local-name()="sitemap"]/*[local-name()="loc"]') ?: [] as $node) {
            $url = trim($node->textContent);
            $parts = parse_url($url);
            $file = basename((string) ($parts['path'] ?? ''));
            $origin = is_array($parts) && isset($parts['scheme'], $parts['host'])
                ? strtolower((string) $parts['scheme']) . '://' . strtolower((string) $parts['host'])
                : '';
            if ($file === '' || !preg_match('/^[a-z0-9][a-z0-9-]*\.xml$/', $file)) {
                $issues[] = ['type' => 'invalid_index_location', 'url' => $url];
                continue;
            }
            if ($origin !== $this->canonicalOrigin
                || (string) ($parts['path'] ?? '') !== '/sitemaps/' . $file
                || isset($parts['query'])
                || isset($parts['fragment'])) {
                $issues[] = ['type' => 'non_canonical_index_location', 'url' => $url];
            }
            $files[] = $file;
        }
        if (count($files) > 50000) {
            $issues[] = ['type' => 'too_many_sitemaps_in_index', 'count' => count($files)];
        }
        if (count($files) !== count(array_unique($files))) {
            $issues[] = ['type' => 'duplicate_sitemap_file'];
        }
        return array_values(array_unique($files));
    }

    /** @param list<array<string, mixed>> $issues @return list<array{url:string,lastmod:?string,section:string}> */
    private function readUrlSet(string $path, string $filename, array &$issues): array
    {
        if ((int) filesize($path) > self::MAX_FILE_BYTES) {
            $issues[] = ['type' => 'sitemap_file_too_large', 'file' => $filename];
        }
        $xml = $this->loadXml($path, $issues);
        if ($xml === null || $xml->documentElement?->localName !== 'urlset') {
            $issues[] = ['type' => 'invalid_urlset', 'file' => $filename];
            return [];
        }
        $entries = [];
        $xpath = new DOMXPath($xml);
        foreach ($xpath->query('//*[local-name()="url"]') ?: [] as $urlNode) {
            $locNode = $xpath->query('./*[local-name()="loc"]', $urlNode)?->item(0);
            $lastmodNode = $xpath->query('./*[local-name()="lastmod"]', $urlNode)?->item(0);
            $url = trim($locNode?->textContent ?? '');
            if ($url === '') {
                $issues[] = ['type' => 'missing_location', 'file' => $filename];
                continue;
            }
            $entries[] = [
                'url' => $url,
                'lastmod' => $lastmodNode ? trim($lastmodNode->textContent) : null,
                'section' => preg_replace('/-\d+\.xml$/', '', $filename) ?: $filename,
            ];
        }
        if (count($entries) > self::MAX_URLS_PER_FILE) {
            $issues[] = ['type' => 'too_many_urls', 'file' => $filename, 'count' => count($entries)];
        }
        return $entries;
    }

    /** @param list<array<string, mixed>> $issues */
    private function loadXml(string $path, array &$issues): ?DOMDocument
    {
        $previous = libxml_use_internal_errors(true);
        $xml = new DOMDocument();
        $loaded = $xml->load($path, LIBXML_NONET | LIBXML_NOBLANKS);
        if (!$loaded) {
            $issues[] = ['type' => 'invalid_xml', 'file' => basename($path)];
            $xml = null;
        }
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        return $xml;
    }

    /** @param array{url:string,lastmod:?string,section:string} $entry @param list<array<string, mixed>> $issues */
    private function validateEntry(array $entry, array &$issues): void
    {
        $parts = parse_url($entry['url']);
        $origin = is_array($parts) && isset($parts['scheme'], $parts['host'])
            ? strtolower($parts['scheme']) . '://' . strtolower($parts['host'])
            : '';
        $path = is_array($parts) ? (string) ($parts['path'] ?? '') : '';
        if ($origin !== $this->canonicalOrigin || isset($parts['query']) || isset($parts['fragment'])) {
            $issues[] = ['type' => 'non_canonical_url', 'url' => $entry['url']];
        }
        foreach (self::LEGACY_PATHS as $pattern) {
            if (preg_match($pattern, $path) === 1) {
                $issues[] = ['type' => 'legacy_url', 'url' => $entry['url']];
            }
        }
        foreach (self::PRIVATE_PATHS as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix . '/')) {
                $issues[] = ['type' => 'private_url', 'url' => $entry['url']];
            }
        }
        foreach (self::PERMANENT_NOINDEX_PATHS as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix . '/')) {
                $issues[] = ['type' => 'permanent_noindex_url', 'url' => $entry['url']];
            }
        }
        if ($entry['lastmod'] !== null && strtotime($entry['lastmod']) === false) {
            $issues[] = ['type' => 'invalid_lastmod', 'url' => $entry['url']];
        } elseif ($entry['lastmod'] !== null && $entry['lastmod'] > gmdate('Y-m-d')) {
            $issues[] = ['type' => 'future_lastmod', 'url' => $entry['url'], 'lastmod' => $entry['lastmod']];
        }
        if ($entry['section'] === 'questions' && preg_match('~^/questoes/[1-9][0-9]*/[^/]+$~', $path) !== 1) {
            $issues[] = ['type' => 'invalid_question_route', 'url' => $entry['url']];
        }
        if ($entry['section'] === 'exams' && preg_match('~^/provas/[^/]+$~', $path) !== 1) {
            $issues[] = ['type' => 'invalid_exam_route', 'url' => $entry['url']];
        }
    }

    /** @param list<array{url:string,lastmod:?string,section:string}> $entries @return array<string, mixed> */
    private function validateHttp(array $entries, string $httpOrigin): array
    {
        $report = [
            'executed' => true,
            'total' => count($entries),
            'status200' => 0,
            'redirects' => 0,
            'status4xx' => 0,
            'status5xx' => 0,
            'noindex' => 0,
            'canonicalMismatch' => 0,
            'issues' => [],
        ];

        foreach (array_chunk($entries, 12) as $batch) {
            $multi = curl_multi_init();
            $handles = [];
            foreach ($batch as $index => $entry) {
                $parts = parse_url($entry['url']);
                $requestUrl = $httpOrigin . (string) ($parts['path'] ?? '/');
                $handle = curl_init($requestUrl);
                $responseHeaders = [];
                curl_setopt_array($handle, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_FOLLOWLOCATION => false,
                    CURLOPT_CONNECTTIMEOUT => 10,
                    CURLOPT_TIMEOUT => 30,
                    CURLOPT_USERAGENT => 'ConcursoMestre-SitemapValidator/1.0',
                    CURLOPT_HTTPHEADER => ['Accept: text/html,application/xhtml+xml'],
                    CURLOPT_HEADERFUNCTION => static function ($curl, string $line) use (&$responseHeaders): int {
                        $length = strlen($line);
                        $parts = explode(':', $line, 2);
                        if (count($parts) === 2) {
                            $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
                        }
                        return $length;
                    },
                ]);
                curl_multi_add_handle($multi, $handle);
                $handles[$index] = [$handle, $entry, &$responseHeaders];
            }
            do {
                $status = curl_multi_exec($multi, $active);
                if ($active) {
                    curl_multi_select($multi, 1.0);
                }
            } while ($active && $status === CURLM_OK);

            foreach ($handles as [$handle, $entry, $responseHeaders]) {
                $body = (string) curl_multi_getcontent($handle);
                $statusCode = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
                if ($statusCode === 200) {
                    $report['status200']++;
                    [$canonical, $robots] = $this->readHtmlSeo($body);
                    if ($canonical === null || $this->normalizeUrl($canonical) !== $this->normalizeUrl($entry['url'])) {
                        $report['canonicalMismatch']++;
                        $report['issues'][] = ['type' => 'canonical_mismatch', 'url' => $entry['url'], 'actual' => $canonical];
                    }
                    $xRobots = (string) ($responseHeaders['x-robots-tag'] ?? '');
                    $metaNoindex = $robots !== null && preg_match('/(?:^|[,\s])noindex(?:[,\s]|$)/i', $robots) === 1;
                    $headerNoindex = preg_match('/(?:^|[,\s])noindex(?:[,\s]|$)/i', $xRobots) === 1;
                    $metaIndex = $robots !== null && !$metaNoindex && preg_match('/(?:^|[,\s])index(?:[,\s]|$)/i', $robots) === 1;
                    $headerIndex = !$headerNoindex && preg_match('/(?:^|[,\s])index(?:[,\s]|$)/i', $xRobots) === 1;
                    if (($metaIndex && $headerNoindex) || ($headerIndex && $metaNoindex)) {
                        $report['issues'][] = [
                            'type' => 'robots_directive_conflict',
                            'url' => $entry['url'],
                            'meta' => $robots,
                            'header' => $xRobots,
                        ];
                    }
                    if ($metaNoindex || $headerNoindex) {
                        $report['noindex']++;
                        $report['issues'][] = ['type' => 'noindex', 'url' => $entry['url']];
                    }
                } elseif ($statusCode >= 300 && $statusCode < 400) {
                    $report['redirects']++;
                    $report['issues'][] = ['type' => 'redirect', 'url' => $entry['url'], 'status' => $statusCode];
                } elseif ($statusCode >= 400 && $statusCode < 500) {
                    $report['status4xx']++;
                    $report['issues'][] = ['type' => 'http_4xx', 'url' => $entry['url'], 'status' => $statusCode];
                } else {
                    $report['status5xx']++;
                    $report['issues'][] = ['type' => 'http_5xx', 'url' => $entry['url'], 'status' => $statusCode];
                }
                curl_multi_remove_handle($multi, $handle);
                curl_close($handle);
            }
            curl_multi_close($multi);
        }
        return $report;
    }

    /** @return array{0:?string,1:?string} */
    private function readHtmlSeo(string $html): array
    {
        $previous = libxml_use_internal_errors(true);
        $document = new DOMDocument();
        if (!$document->loadHTML($html, LIBXML_NONET | LIBXML_NOWARNING | LIBXML_NOERROR)) {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
            return [null, null];
        }
        $canonical = null;
        foreach ($document->getElementsByTagName('link') as $link) {
            if (strtolower($link->getAttribute('rel')) === 'canonical') {
                $canonical = trim($link->getAttribute('href')) ?: null;
                break;
            }
        }
        $robots = null;
        foreach ($document->getElementsByTagName('meta') as $meta) {
            if (strtolower($meta->getAttribute('name')) === 'robots') {
                $robots = trim($meta->getAttribute('content')) ?: null;
                break;
            }
        }
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        return [$canonical, $robots];
    }

    private function normalizeUrl(string $url): string
    {
        $parts = parse_url($url);
        if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return $url;
        }
        $path = (string) ($parts['path'] ?? '/');
        if ($path !== '/') {
            $path = rtrim($path, '/');
        }
        return strtolower((string) $parts['scheme']) . '://' . strtolower((string) $parts['host']) . $path;
    }
}
