<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/taxonomy/TaxonomyClassification.php';
require_once dirname(__DIR__) . '/taxonomy/TaxonomyPromotionEligibility.php';

final class TaxonomyDistributionReporter
{
    private int $queryCount = 0;

    public function __construct(private readonly PDO $db)
    {
    }

    /** @return array<string, mixed> */
    public function generate(int $overlapLimit = 100): array
    {
        $startedAt = microtime(true);
        $rows = $this->query(
            "SELECT f.id, f.type, f.name, f.slug, f.parent_id, parent_ref.id AS parent_exists,
                    f.description, f.taxonomy_level, f.meta_materia,
                    COALESCE(qc.public_questions, 0) AS public_questions,
                    COALESCE(ec.public_exams, 0) AS public_exams,
                    COALESCE(lc.public_laws, 0) AS public_laws
               FROM filters f
               LEFT JOIN filters parent_ref ON parent_ref.id = f.parent_id
               LEFT JOIN (
                    SELECT qf.filter_id, COUNT(DISTINCT q.id) AS public_questions
                      FROM question_filters qf
                      INNER JOIN questions q ON q.id = qf.question_id
                       AND q.publish_status IN ('published', 'scheduled')
                       AND q.visibility_status = 'public'
                       AND q.published_sort_at IS NOT NULL
                       AND q.published_sort_at <= NOW()
                     GROUP BY qf.filter_id
               ) qc ON qc.filter_id = f.id
               LEFT JOIN (
                    SELECT pf.filter_id, COUNT(DISTINCT p.id) AS public_exams
                      FROM prova_filters pf
                      INNER JOIN provas p ON p.id = pf.prova_id
                       AND p.archived_at IS NULL
                       AND p.status_editorial = 'published'
                       AND p.visibility_status = 'public'
                       AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())
                     GROUP BY pf.filter_id
               ) ec ON ec.filter_id = f.id
               LEFT JOIN (
                    SELECT links.filter_id, COUNT(DISTINCT links.law_id) AS public_laws
                      FROM (
                           SELECT law_topic_filter_id AS filter_id, id AS law_id FROM laws
                            WHERE law_topic_filter_id IS NOT NULL AND status = 'published'
                           UNION
                           SELECT ls.subtopic_filter_id, ls.law_id FROM law_sections ls
                            INNER JOIN laws l ON l.id = ls.law_id AND l.status = 'published'
                            WHERE ls.subtopic_filter_id IS NOT NULL
                           UNION
                           SELECT ls.assunto_filter_id, ls.law_id FROM law_sections ls
                            INNER JOIN laws l ON l.id = ls.law_id AND l.status = 'published'
                            WHERE ls.assunto_filter_id IS NOT NULL
                           UNION
                           SELECT la.assunto_filter_id, la.law_id FROM law_articles la
                            INNER JOIN laws l ON l.id = la.law_id AND l.status = 'published'
                            WHERE la.assunto_filter_id IS NOT NULL
                      ) links GROUP BY links.filter_id
               ) lc ON lc.filter_id = f.id
              WHERE f.type IN ('assunto', 'materia', 'banca', 'orgao', 'cargo', 'ano')
              ORDER BY f.id"
        );

        $summary = self::summarizeRows($rows);
        $overlap = $this->overlapSamples($rows, max(0, min(500, $overlapLimit)));
        $explain = $this->explainIndexPatterns();

        return [
            'version' => 'taxonomy-distribution-report.v1',
            'mode' => 'read_only',
            'generatedAt' => gmdate('c'),
            'thresholds' => 'TBD',
            'promotionIndexBlocked' => true,
            'families' => $summary['families'],
            'global' => $summary['global'],
            'overlapSamples' => $overlap,
            'explain' => $explain,
            'metrics' => [
                'queryCount' => $this->queryCount,
                'durationMs' => (int) round((microtime(true) - $startedAt) * 1000),
            ],
        ];
    }

    /** @param list<array<string, mixed>> $rows @return array<string, mixed> */
    public static function summarizeRows(array $rows): array
    {
        $families = [];
        $byId = [];
        foreach ($rows as $row) {
            $byId[(int) ($row['id'] ?? 0)] = $row;
        }
        $promotion = new TaxonomyPromotionEligibility();
        $cycles = self::cycleIds($byId);
        foreach ($rows as $row) {
            $classification = TaxonomyClassification::fromFilter($row);
            $family = $classification['kind'];
            $questions = max(0, (int) ($row['public_questions'] ?? 0));
            $exams = max(0, (int) ($row['public_exams'] ?? 0));
            $laws = max(0, (int) ($row['public_laws'] ?? 0));
            $content = $questions + $exams + $laws;
            $entry = $families[$family] ?? self::emptyFamily();
            $entry['total']++;
            $entry['contentBuckets'][self::bucket($content)]++;
            $entry['publicContent']['questions'] += $questions;
            $entry['publicContent']['exams'] += $exams;
            $entry['publicContent']['laws'] += $laws;
            if (trim((string) ($row['description'] ?? '')) !== '') {
                $entry['withDescription']++;
            }
            if ($classification['pending']) {
                $entry['pending']++;
            }
            $parentId = (int) ($row['parent_id'] ?? 0);
            if ($parentId > 0 && empty($row['parent_exists'])) {
                $entry['orphans']++;
            }
            if (isset($cycles[(int) ($row['id'] ?? 0)])) {
                $entry['cycles']++;
            }
            $eligibility = $promotion->evaluate($row, ['calibrationAvailable' => false]);
            foreach ($eligibility['reasonCodes'] as $reason) {
                if ($reason === 'taxonomy.slug_invalid') $entry['invalidSlug']++;
                if ($reason === 'taxonomy.slug_too_long') $entry['slugOver80']++;
                if ($reason === 'taxonomy.placeholder') $entry['placeholders']++;
            }
            $families[$family] = $entry;
        }
        ksort($families);
        return [
            'families' => $families,
            'global' => [
                'total' => count($rows),
                'newIndexUrls' => 0,
                'thresholdsCalibrated' => false,
            ],
        ];
    }

    public static function bucket(int $count): string
    {
        return match (true) {
            $count <= 0 => '0',
            $count <= 4 => '1-4',
            $count <= 9 => '5-9',
            $count <= 49 => '10-49',
            default => '50+',
        };
    }

    /** @return array<string, mixed> */
    private static function emptyFamily(): array
    {
        return [
            'total' => 0,
            'contentBuckets' => ['0' => 0, '1-4' => 0, '5-9' => 0, '10-49' => 0, '50+' => 0],
            'publicContent' => ['questions' => 0, 'exams' => 0, 'laws' => 0],
            'withDescription' => 0,
            'pending' => 0,
            'orphans' => 0,
            'cycles' => 0,
            'invalidSlug' => 0,
            'slugOver80' => 0,
            'placeholders' => 0,
        ];
    }

    /** @param array<int, array<string, mixed>> $byId @return array<int, true> */
    private static function cycleIds(array $byId): array
    {
        $cycles = [];
        foreach ($byId as $id => $row) {
            $path = [];
            $positions = [];
            $current = $id;
            while ($current > 0 && isset($byId[$current])) {
                if (isset($positions[$current])) {
                    foreach (array_slice($path, $positions[$current]) as $cycleId) $cycles[$cycleId] = true;
                    break;
                }
                $positions[$current] = count($path);
                $path[] = $current;
                $current = (int) ($byId[$current]['parent_id'] ?? 0);
            }
        }
        return $cycles;
    }

    /** @param list<array<string, mixed>> $rows @return list<array<string, mixed>> */
    private function overlapSamples(array $rows, int $limit): array
    {
        if ($limit === 0) return [];
        $byParent = [];
        $pairs = [];
        foreach ($rows as $row) {
            $classification = TaxonomyClassification::fromFilter($row);
            if ($classification['knowledgeLevel'] === null) continue;
            $id = (int) ($row['id'] ?? 0);
            $parentId = (int) ($row['parent_id'] ?? 0);
            if ($parentId > 0) {
                $pairs[] = ['kind' => 'parent_child', 'left' => $parentId, 'right' => $id];
                $byParent[$parentId][] = $id;
            }
        }
        foreach ($byParent as $siblings) {
            for ($i = 1; $i < count($siblings); $i++) {
                $pairs[] = ['kind' => 'siblings', 'left' => $siblings[$i - 1], 'right' => $siblings[$i]];
            }
        }
        $pairs = array_slice($pairs, 0, $limit);
        $ids = array_values(array_unique(array_merge(array_column($pairs, 'left'), array_column($pairs, 'right'))));
        if ($ids === []) return [];
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $links = $this->query(
            "SELECT qf.filter_id, qf.question_id
               FROM question_filters qf
               INNER JOIN questions q ON q.id = qf.question_id
                AND q.publish_status IN ('published', 'scheduled')
                AND q.visibility_status = 'public'
                AND q.published_sort_at IS NOT NULL
                AND q.published_sort_at <= NOW()
              WHERE qf.filter_id IN ({$placeholders})",
            $ids
        );
        $sets = [];
        foreach ($links as $link) $sets[(int) $link['filter_id']][(int) $link['question_id']] = true;
        return array_map(static function (array $pair) use ($sets): array {
            $left = array_keys($sets[$pair['left']] ?? []);
            $right = array_keys($sets[$pair['right']] ?? []);
            $union = array_unique(array_merge($left, $right));
            $intersection = array_intersect($left, $right);
            return $pair + [
                'leftCount' => count($left),
                'rightCount' => count($right),
                'jaccard' => $union === [] ? null : round(count($intersection) / count($union), 4),
            ];
        }, $pairs);
    }

    /** @return array<string, mixed> */
    private function explainIndexPatterns(): array
    {
        $queries = [
            'question_filters' => 'EXPLAIN SELECT question_id FROM question_filters WHERE filter_id = 1',
            'prova_filters' => 'EXPLAIN SELECT prova_id FROM prova_filters WHERE filter_id = 1',
            'filters_parent' => 'EXPLAIN SELECT id FROM filters WHERE parent_id = 1',
            'filters_level' => "EXPLAIN SELECT id FROM filters WHERE type = 'assunto' AND taxonomy_level = 'materia'",
        ];
        $result = [];
        foreach ($queries as $name => $sql) {
            $rows = $this->query($sql);
            $result[$name] = array_map(static fn (array $row): array => [
                'type' => $row['type'] ?? null,
                'possibleKeys' => $row['possible_keys'] ?? null,
                'key' => $row['key'] ?? null,
                'rows' => isset($row['rows']) ? (int) $row['rows'] : null,
                'extra' => $row['Extra'] ?? null,
            ], $rows);
        }
        return $result;
    }

    /** @return list<array<string, mixed>> */
    private function query(string $sql, array $params = []): array
    {
        $this->queryCount++;
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
}
