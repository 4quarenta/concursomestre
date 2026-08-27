<?php

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

declare(strict_types=1);

require_once __DIR__ . '/DatasetResetPolicyV2.php';

final class RealDatasetReadinessReporter
{
    private const OPEN_GATES = [
        'INTERNAL_LINK_GRAPH_REAL_DATA_VALIDATION_REQUIRED',
        'SEO_ORPHAN_REAL_DATA_VALIDATION_REQUIRED',
        'BREADCRUMB_REAL_DATA_VALIDATION_REQUIRED',
        'STRUCTURED_DATA_REAL_DATA_VALIDATION_REQUIRED',
        'BLOG_TAXONOMY_REAL_DATA_VALIDATION',
        'BLOG_TAXONOMY_REAL_DATA_QUALITY_GATE',
        'BLOG_TAXONOMY_REAL_DATA_EXPLAIN_REQUIRED',
        'SITEMAP_REAL_DATA_VALIDATION_REQUIRED',
        'INDEX_POLICY_REAL_DATA_VALIDATION_REQUIRED',
        'ROBOTS_PRODUCTION_VALIDATION_REQUIRED',
        'CANONICAL_HOST_PRODUCTION_VALIDATION_REQUIRED',
        'SITEMAP_PRODUCTION_SCALE_VALIDATION_REQUIRED',
        'SEARCH_ENGINE_SUBMISSION_AFTER_SEO_GO',
        'PERFORMANCE_REAL_DATA_QUERY_VALIDATION_REQUIRED',
        'PERFORMANCE_REAL_DATA_EXPLAIN_REQUIRED',
        'CORE_WEB_VITALS_REAL_USER_VALIDATION_REQUIRED',
        'PRODUCTION_PERFORMANCE_SMOKE_REQUIRED',
        'CDN_CACHE_PRODUCTION_VALIDATION_REQUIRED',
        'FONT_DELIVERY_PRODUCTION_VALIDATION_REQUIRED',
        'IMAGE_DELIVERY_REAL_DATA_VALIDATION_REQUIRED',
    ];

    public function __construct(private readonly PDO $db)
    {
        $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }

    /** @return array<string, mixed> */
    public function report(): array
    {
        $tables = array_values(array_map('strval', $this->db->query(
            'SELECT TABLE_NAME FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = \'BASE TABLE\'
             ORDER BY TABLE_NAME'
        )->fetchAll(PDO::FETCH_COLUMN) ?: []));

        $counts = [];
        foreach (DatasetResetPolicyV2::resetDomains() as $domain => $domainTables) {
            $counts[$domain] = 0;
            foreach ($domainTables as $table) {
                if (in_array($table, $tables, true)) {
                    $counts[$domain] += (int) $this->db->query(
                        'SELECT COUNT(*) FROM ' . $this->quoteIdentifier($table)
                    )->fetchColumn();
                }
            }
        }

        $duplicateFilterSlugs = in_array('filters', $tables, true)
            ? (int) $this->db->query(
                'SELECT COUNT(*) FROM (
                    SELECT type, slug
                    FROM filters
                    WHERE slug IS NOT NULL AND slug <> \'\'
                    GROUP BY type, slug
                    HAVING COUNT(*) > 1
                ) duplicated'
            )->fetchColumn()
            : 0;

        return [
            'mode' => 'read-only',
            'database' => (string) $this->db->query('SELECT DATABASE()')->fetchColumn(),
            'domainCounts' => $counts,
            'duplicateFilterSlugGroups' => $duplicateFilterSlugs,
            'sourceApprovalRequired' => true,
            'rightsApprovalRequired' => true,
            'realDatasetLoaded' => false,
            'realDatasetValidated' => false,
            'openGates' => self::OPEN_GATES,
            'writesExecuted' => 0,
        ];
    }

    /** @return list<string> */
    public static function openGates(): array
    {
        return self::OPEN_GATES;
    }

    private function quoteIdentifier(string $identifier): string
    {
        if (!preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
            throw new InvalidArgumentException('Invalid SQL identifier.');
        }
        return '`' . $identifier . '`';
    }
}
