<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/taxonomy/KnowledgeTaxonomyHierarchyValidator.php';

final class KnowledgeTaxonomyReadinessReporter
{
    public function __construct(private PDO $db)
    {
    }

    /** @return array<string, mixed> */
    public function generate(int $exampleLimit = 20): array
    {
        $rows = $this->db->query(
            "SELECT f.id, f.name, f.slug, f.type, f.taxonomy_level, f.meta_materia,
                    f.parent_id AS own_parent_id,
                    parent.id AS parent_id, parent.parent_id AS parent_parent_id,
                    parent.type AS parent_type, parent.taxonomy_level AS parent_taxonomy_level,
                    parent.meta_materia AS parent_meta_materia,
                    grandparent.id AS grandparent_id, grandparent.parent_id AS grandparent_parent_id,
                    grandparent.type AS grandparent_type,
                    grandparent.taxonomy_level AS grandparent_taxonomy_level,
                    grandparent.meta_materia AS grandparent_meta_materia,
                    great_grandparent.id AS great_grandparent_id,
                    great_grandparent.parent_id AS great_grandparent_parent_id,
                    great_grandparent.type AS great_grandparent_type,
                    great_grandparent.taxonomy_level AS great_grandparent_taxonomy_level,
                    great_grandparent.meta_materia AS great_grandparent_meta_materia
               FROM filters f
               LEFT JOIN filters parent ON parent.id = f.parent_id
               LEFT JOIN filters grandparent ON grandparent.id = parent.parent_id
               LEFT JOIN filters great_grandparent ON great_grandparent.id = grandparent.parent_id
              WHERE f.type = 'assunto'
                AND (f.taxonomy_level IN ('materia', 'topico', 'subtopico', 'assunto') OR f.meta_materia = 1)
              ORDER BY f.id"
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return self::summarize($rows, $exampleLimit);
    }

    /**
     * @param list<array<string, mixed>> $rows
     * @return array<string, mixed>
     */
    public static function summarize(array $rows, int $exampleLimit = 20): array
    {
        $levels = [];
        foreach (['materia', 'topico', 'subtopico', 'assunto'] as $level) {
            $levels[$level] = ['total' => 0, 'ready' => 0, 'notReady' => 0, 'reasonCodes' => [], 'examples' => []];
        }

        foreach ($rows as $row) {
            $level = !empty($row['meta_materia']) ? 'materia' : strtolower(trim((string) ($row['taxonomy_level'] ?? '')));
            if (!isset($levels[$level])) continue;
            $result = KnowledgeTaxonomyHierarchyValidator::evaluate($row, $level);
            $levels[$level]['total']++;
            if ($result['status'] === 'READY') {
                $levels[$level]['ready']++;
                continue;
            }

            $levels[$level]['notReady']++;
            foreach ($result['reasonCodes'] as $reason) {
                $levels[$level]['reasonCodes'][$reason] = ($levels[$level]['reasonCodes'][$reason] ?? 0) + 1;
            }
            if (count($levels[$level]['examples']) < max(0, $exampleLimit)) {
                $levels[$level]['examples'][] = [
                    'id' => (int) ($row['id'] ?? 0),
                    'slug' => (string) ($row['slug'] ?? ''),
                    'reasonCodes' => $result['reasonCodes'],
                ];
            }
        }

        foreach ($levels as &$summary) {
            arsort($summary['reasonCodes']);
        }
        unset($summary);

        return [
            'report' => 'knowledge_taxonomy_readiness',
            'version' => 1,
            'generatedAt' => gmdate(DATE_ATOM),
            'readOnly' => true,
            'runtimeEnforcement' => false,
            'levels' => $levels,
        ];
    }
}
