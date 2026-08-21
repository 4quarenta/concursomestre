<?php

declare(strict_types=1);

require_once __DIR__ . '/../../legal_commentary/public/PublicLawArticleReadiness.php';

final class LawArticleReadinessReporter
{
    public function __construct(private readonly PDO $db) {}

    /** @return array<string,mixed> */
    public function report(): array
    {
        $totalLaws = (int) $this->db->query('SELECT COUNT(*) FROM laws')->fetchColumn();
        $rows = $this->db->query(
            "SELECT l.id AS law_id, l.slug AS law_slug, l.status AS law_status,
                    l.published_at AS law_published_at, a.id AS article_id,
                    a.slug AS article_slug, a.article_number, a.official_text,
                    a.official_status AS article_status, a.section_id, a.sort_order,
                    l.official_url AS law_official_url,
                    CASE WHEN a.section_id IS NOT NULL AND (s.id IS NULL OR s.law_id <> a.law_id) THEN 1 ELSE 0 END AS malformed_hierarchy
               FROM law_articles a
               LEFT JOIN laws l ON l.id = a.law_id
               LEFT JOIN law_sections s ON s.id = a.section_id
              ORDER BY a.id"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $summary = [
            'total' => count($rows), 'ready' => 0, 'notReady' => 0,
            'revoked' => 0, 'vetoed' => 0, 'missingOfficialText' => 0, 'invalidSlug' => 0,
            'orphanArticles' => 0, 'missingSource' => 0, 'malformedHierarchy' => 0,
        ];
        $reasonCodes = [];
        foreach ($rows as $row) {
            $readiness = PublicLawArticleReadiness::evaluate($row);
            $summary[$readiness['status'] === 'READY' ? 'ready' : 'notReady']++;
            $status = strtolower((string) ($row['article_status'] ?? ''));
            if ($status === 'revoked') $summary['revoked']++;
            if ($status === 'vetoed') $summary['vetoed']++;
            if (trim((string) ($row['official_text'] ?? '')) === '') $summary['missingOfficialText']++;
            if ((int) ($row['law_id'] ?? 0) <= 0) $summary['orphanArticles']++;
            if (trim((string) ($row['law_official_url'] ?? '')) === '') $summary['missingSource']++;
            if ((int) ($row['malformed_hierarchy'] ?? 0) === 1) $summary['malformedHierarchy']++;
            if (in_array('instance_readiness.invalid_slug', $readiness['reasonCodes'], true)) $summary['invalidSlug']++;
            foreach ($readiness['reasonCodes'] as $reason) $reasonCodes[$reason] = ($reasonCodes[$reason] ?? 0) + 1;
        }
        arsort($reasonCodes);

        $duplicates = $this->db->query(
            "SELECT law_id, article_number, COUNT(*) AS occurrences
               FROM law_articles
              GROUP BY law_id, article_number
             HAVING COUNT(*) > 1
              ORDER BY occurrences DESC, law_id, article_number
              LIMIT 100"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $duplicateOrder = $this->db->query(
            "SELECT law_id, sort_order, COUNT(*) AS occurrences
               FROM law_articles
              GROUP BY law_id, sort_order
             HAVING COUNT(*) > 1
              ORDER BY occurrences DESC, law_id, sort_order
              LIMIT 100"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $aliasAudit = $this->db->query(
            "SELECT
                SUM(CASE WHEN aliases_json IS NOT NULL AND TRIM(aliases_json) <> '' AND JSON_VALID(aliases_json) = 0 THEN 1 ELSE 0 END) AS malformed_alias_documents,
                SUM(CASE WHEN JSON_VALID(aliases_json) AND JSON_LENGTH(aliases_json) > 0 THEN 1 ELSE 0 END) AS laws_with_aliases
               FROM laws"
        )->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'version' => 'law-article-readiness.v1',
            'generatedAt' => gmdate('c'),
            'readOnly' => true,
            'canonicalIdentity' => 'laws.id + law_articles.id',
            'canonicalRouteAuthority' => 'laws.slug + law_articles.slug',
            'summary' => ['totalLaws' => $totalLaws] + $summary,
            'reasonCodes' => $reasonCodes,
            'duplicateLabelsWithinLaw' => array_map(static fn(array $row): array => [
                'lawId' => (int) $row['law_id'],
                'articleNumber' => (string) $row['article_number'],
                'occurrences' => (int) $row['occurrences'],
            ], $duplicates),
            'duplicateNormativeOrder' => array_map(static fn(array $row): array => [
                'lawId' => (int) $row['law_id'],
                'sortOrder' => (int) $row['sort_order'],
                'occurrences' => (int) $row['occurrences'],
            ], $duplicateOrder),
            'aliases' => [
                'lawsWithAliases' => (int) ($aliasAudit['laws_with_aliases'] ?? 0),
                'malformedDocuments' => (int) ($aliasAudit['malformed_alias_documents'] ?? 0),
                'articleAliasModelAvailable' => false,
            ],
            'editorialPublication' => [
                'status' => 'NOT_EVALUATED',
                'reason' => 'Existing editorial tables have entitlement controls but no independent publication state.',
            ],
            'realDataGate' => [
                'requiredBeforeSeoGo' => true,
                'checks' => ['duplicate labels', 'missing official text', 'slug compatibility', 'source integrity', 'public status'],
            ],
        ];
    }
}
