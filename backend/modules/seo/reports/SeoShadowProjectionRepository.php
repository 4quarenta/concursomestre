<?php

declare(strict_types=1);

/**
 * Le projecoes em lotes. O numero de queries e constante por lote e nunca por
 * entidade: questions usa no maximo seis consultas; os demais recursos, tres.
 */
final class SeoShadowProjectionRepository
{
    private int $queryCount = 0;

    public function __construct(private readonly PDO $db)
    {
    }

    public function queryCount(): int
    {
        return $this->queryCount;
    }

    public static function queryBudgetPerBatch(string $resourceType): int
    {
        return match ($resourceType) {
            'question' => 6,
            'exam', 'taxonomy', 'board' => 3,
            'law' => 2,
            default => throw new InvalidArgumentException('Recurso de shadow report invalido.'),
        };
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function fetchBatch(string $resourceType, int $afterId, int $limit): array
    {
        $limit = max(1, min(1000, $limit));
        return match ($resourceType) {
            'question' => $this->questions($afterId, $limit),
            'exam' => $this->exams($afterId, $limit),
            'taxonomy' => $this->taxonomies($afterId, $limit, false),
            'board' => $this->taxonomies($afterId, $limit, true),
            'law' => $this->laws($afterId, $limit),
            default => throw new InvalidArgumentException('Recurso de shadow report invalido.'),
        };
    }

    /** @return list<array<string, mixed>> */
    private function questions(int $afterId, int $limit): array
    {
        $rows = $this->query(
            "SELECT q.id, q.enunciado_clean, q.intro_text, q.publish_status, q.visibility_status,
                    q.scheduled_at, q.published_at, q.updated_at, q.created_at, q.prova_id,
                    q.tipo, q.import_fingerprint, p.nome AS exam_name, p.ano AS exam_year
             FROM questions q
             LEFT JOIN provas p ON p.id = q.prova_id
             WHERE q.id > :after_id
             ORDER BY q.id ASC
             LIMIT {$limit}",
            [':after_id' => $afterId]
        );
        $ids = $this->ids($rows);
        if ($ids === []) {
            return [];
        }
        [$in, $params] = $this->inClause($ids);

        $options = $this->mapById($this->query(
            "SELECT question_id AS id, COUNT(*) AS option_count,
                    SUM(CASE WHEN TRIM(COALESCE(body_clean, body, '')) <> '' THEN 1 ELSE 0 END) AS nonempty_option_count
             FROM question_options WHERE question_id IN ({$in}) GROUP BY question_id",
            $params
        ));
        $assets = $this->mapById($this->query(
            "SELECT parent_id AS id, COUNT(*) AS asset_count,
                    SUM(CASE WHEN COALESCE(NULLIF(public_url, ''), NULLIF(storage_path, '')) IS NULL
                              OR public_url LIKE 'blob:%' THEN 1 ELSE 0 END) AS broken_asset_count
             FROM (
                SELECT qa.question_id AS parent_id, qa.public_url, qa.storage_path
                  FROM question_assets qa WHERE qa.question_id IN ({$in})
                UNION ALL
                SELECT qo.question_id AS parent_id, qa.public_url, qa.storage_path
                  FROM question_assets qa INNER JOIN question_options qo ON qo.id = qa.option_id
                 WHERE qo.question_id IN ({$in})
                UNION ALL
                SELECT cq.question_id AS parent_id, qa.public_url, qa.storage_path
                  FROM question_assets qa INNER JOIN question_context_questions cq ON cq.context_id = qa.context_id
                 WHERE cq.question_id IN ({$in})
             ) asset_projection GROUP BY parent_id",
            [...$params, ...$params, ...$params]
        ));
        $taxonomyRows = $this->query(
            "SELECT qf.question_id AS id,
                    COUNT(DISTINCT f.id) AS taxonomy_count,
                    MAX(CASE WHEN f.type = 'assunto' AND (f.taxonomy_level = 'materia' OR f.meta_materia = 1) THEN f.name END) AS subject_name,
                    MAX(CASE WHEN f.type = 'assunto' AND f.taxonomy_level = 'topico' THEN f.name END) AS topic_name,
                    MAX(CASE WHEN f.type = 'banca' THEN COALESCE(NULLIF(f.acronym, ''), f.name) END) AS board_name,
                    MAX(CASE WHEN f.type = 'orgao' THEN COALESCE(NULLIF(f.acronym, ''), f.name) END) AS organization_name,
                    MAX(CASE WHEN f.type = 'cargo' THEN f.name END) AS role_name
             FROM question_filters qf INNER JOIN filters f ON f.id = qf.filter_id
             WHERE qf.question_id IN ({$in}) GROUP BY qf.question_id",
            $params
        );
        $taxonomies = $this->mapById($taxonomyRows);
        $contexts = $this->mapById($this->query(
            "SELECT cq.question_id AS id, COUNT(*) AS context_count,
                    SUM(CASE WHEN q.prova_id IS NOT NULL AND c.prova_id <> q.prova_id THEN 1 ELSE 0 END) AS mismatched_context_count
             FROM question_context_questions cq
             INNER JOIN question_contexts c ON c.id = cq.context_id
             INNER JOIN questions q ON q.id = cq.question_id
             WHERE cq.question_id IN ({$in}) GROUP BY cq.question_id",
            $params
        ));
        $duplicates = $this->mapById($this->query(
            "SELECT target.id, COUNT(candidate.id) AS duplicate_count
             FROM questions target
             INNER JOIN questions candidate ON candidate.import_fingerprint = target.import_fingerprint
             WHERE target.id IN ({$in}) AND target.import_fingerprint IS NOT NULL AND target.import_fingerprint <> ''
             GROUP BY target.id",
            $params
        ));

        $projections = [];
        foreach ($rows as $row) {
            $id = (int) $row['id'];
            $option = $options[$id] ?? [];
            $asset = $assets[$id] ?? [];
            $taxonomy = $taxonomies[$id] ?? [];
            $context = $contexts[$id] ?? [];
            $duplicate = $duplicates[$id] ?? [];
            $projections[] = [
                'resourceType' => 'question',
                'resourceId' => (string) $id,
                'existence' => 'exists',
                'routeFamily' => 'question_detail',
                'routeParameters' => [],
                'publicationInput' => $this->publicationInput($row, 'publish_status', 'visibility_status'),
                'publicData' => [
                    'id' => (string) $id,
                    'statement' => (string) ($row['enunciado_clean'] ?? ''),
                    'supportText' => (string) ($row['intro_text'] ?? ''),
                    'subjectName' => $taxonomy['subject_name'] ?? null,
                    'topicName' => $taxonomy['topic_name'] ?? null,
                    'boardName' => $taxonomy['board_name'] ?? null,
                    'organizationName' => $taxonomy['organization_name'] ?? null,
                    'roleName' => $taxonomy['role_name'] ?? null,
                    'year' => $row['exam_year'] ?? null,
                    'publishedAt' => $row['published_at'] ?? null,
                    'updatedAt' => $row['updated_at'] ?? $row['created_at'] ?? null,
                    'breadcrumbs' => [],
                ],
                'qualityEvidence' => [
                    'hasVisual' => (int) ($asset['asset_count'] ?? 0) > 0,
                    'alternativesValid' => (int) ($option['option_count'] ?? 0) >= 2
                        && (int) ($option['option_count'] ?? 0) === (int) ($option['nonempty_option_count'] ?? 0),
                    'taxonomyValid' => (int) ($taxonomy['taxonomy_count'] ?? 0) > 0,
                    'assetsValid' => (int) ($asset['broken_asset_count'] ?? 0) === 0,
                    'contextCoherent' => (int) ($context['mismatched_context_count'] ?? 0) === 0,
                    'exactDuplicateCount' => max(1, (int) ($duplicate['duplicate_count'] ?? 1)),
                ],
            ];
        }
        return $projections;
    }

    /** @return list<array<string, mixed>> */
    private function exams(int $afterId, int $limit): array
    {
        $rows = $this->query(
            "SELECT p.id, p.nome, p.slug, p.ano, p.status_editorial, p.visibility_status,
                    p.scheduled_at, p.published_at, p.updated_at, p.created_at
             FROM provas p WHERE p.id > :after_id ORDER BY p.id ASC LIMIT {$limit}",
            [':after_id' => $afterId]
        );
        $ids = $this->ids($rows);
        if ($ids === []) {
            return [];
        }
        [$in, $params] = $this->inClause($ids);
        $content = $this->mapById($this->query(
            "SELECT p.id,
                    COUNT(DISTINCT q.id) AS public_question_count,
                    COUNT(DISTINCT CASE WHEN pa.archived_at IS NULL AND pa.visibility_status = 'public' THEN pa.id END) AS official_file_count
             FROM provas p
             LEFT JOIN question_provas qp ON qp.prova_id = p.id
             LEFT JOIN questions q ON q.id = qp.question_id AND q.publish_status = 'published' AND q.visibility_status = 'public'
             LEFT JOIN prova_arquivos pa ON pa.prova_id = p.id
             WHERE p.id IN ({$in}) GROUP BY p.id",
            $params
        ));
        $filterRows = $this->query(
            "SELECT pf.prova_id AS id,
                    MAX(CASE WHEN f.type = 'banca' THEN COALESCE(NULLIF(f.acronym, ''), f.name) END) AS board_name,
                    GROUP_CONCAT(DISTINCT CASE WHEN f.type = 'orgao' THEN f.name END SEPARATOR '||') AS organization_names,
                    GROUP_CONCAT(DISTINCT CASE WHEN f.type = 'cargo' THEN f.name END SEPARATOR '||') AS role_names,
                    MAX(CASE WHEN f.type = 'nivel' THEN f.name END) AS level_name,
                    COUNT(DISTINCT CASE WHEN f.type IN ('banca','orgao','cargo','nivel','tipo_prova') THEN f.id END) AS relation_count
             FROM prova_filters pf INNER JOIN filters f ON f.id = pf.filter_id
             WHERE pf.prova_id IN ({$in}) GROUP BY pf.prova_id",
            $params
        );
        $filters = $this->mapById($filterRows);

        return array_map(function (array $row) use ($filters, $content): array {
            $id = (int) $row['id'];
            $filter = $filters[$id] ?? [];
            $counts = $content[$id] ?? [];
            return [
                'resourceType' => 'exam',
                'resourceId' => (string) $id,
                'existence' => 'exists',
                'routeFamily' => 'exam_detail',
                'routeParameters' => [],
                'publicationInput' => $this->publicationInput($row, 'status_editorial', 'visibility_status'),
                'publicData' => [
                    'id' => (string) $id,
                    'displayName' => (string) ($row['nome'] ?? ''),
                    'boardName' => $filter['board_name'] ?? null,
                    'organizationNames' => $this->splitList($filter['organization_names'] ?? null),
                    'roleNames' => $this->splitList($filter['role_names'] ?? null),
                    'year' => $row['ano'] ?? null,
                    'levelName' => $filter['level_name'] ?? null,
                    'publishedAt' => $row['published_at'] ?? null,
                    'updatedAt' => $row['updated_at'] ?? $row['created_at'] ?? null,
                    'breadcrumbs' => [],
                ],
                'qualityEvidence' => [
                    'relationsValid' => (int) ($filter['relation_count'] ?? 0) > 0,
                    'officialFileCount' => (int) ($counts['official_file_count'] ?? 0),
                    'publicQuestionCount' => (int) ($counts['public_question_count'] ?? 0),
                ],
            ];
        }, $rows);
    }

    /** @return list<array<string, mixed>> */
    private function taxonomies(int $afterId, int $limit, bool $boards): array
    {
        $typeClause = $boards ? "f.type = 'banca'" : "f.type <> 'banca'";
        $rows = $this->query(
            "SELECT f.id, f.type, f.name, f.slug, f.acronym, f.parent_id, f.taxonomy_level,
                    f.meta_materia, f.description, f.website, parent.name AS parent_name
             FROM filters f LEFT JOIN filters parent ON parent.id = f.parent_id
             WHERE f.id > :after_id AND {$typeClause}
             ORDER BY f.id ASC LIMIT {$limit}",
            [':after_id' => $afterId]
        );
        $ids = $this->ids($rows);
        if ($ids === []) {
            return [];
        }
        [$in, $params] = $this->inClause($ids);
        $questionCounts = $this->mapById($this->query(
            "SELECT qf.filter_id AS id, COUNT(DISTINCT qf.question_id) AS public_question_count
             FROM question_filters qf INNER JOIN questions q ON q.id = qf.question_id
             WHERE qf.filter_id IN ({$in}) AND q.publish_status = 'published' AND q.visibility_status = 'public'
             GROUP BY qf.filter_id",
            $params
        ));
        $examCounts = $this->mapById($this->query(
            "SELECT pf.filter_id AS id, COUNT(DISTINCT pf.prova_id) AS public_exam_count
             FROM prova_filters pf INNER JOIN provas p ON p.id = pf.prova_id
             WHERE pf.filter_id IN ({$in}) AND p.status_editorial = 'published' AND p.visibility_status = 'public'
             GROUP BY pf.filter_id",
            $params
        ));

        return array_map(function (array $row) use ($boards, $questionCounts, $examCounts): array {
            $id = (int) $row['id'];
            $questionCount = (int) ($questionCounts[$id]['public_question_count'] ?? 0);
            $examCount = (int) ($examCounts[$id]['public_exam_count'] ?? 0);
            if ($boards) {
                return [
                    'resourceType' => 'board',
                    'resourceId' => (string) $id,
                    'existence' => 'exists',
                    'routeFamily' => 'board_detail',
                    'routeParameters' => [],
                    'publicationInput' => $this->implicitPublicInput(),
                    'publicData' => [
                        'id' => (string) $id,
                        'displayName' => (string) ($row['name'] ?? ''),
                        'acronym' => $row['acronym'] ?? null,
                        'fullName' => $row['name'] ?? null,
                        'website' => $row['website'] ?? null,
                        'publicDescription' => $row['description'] ?? '',
                        'publicQuestionCount' => $questionCount,
                        'publicExamCount' => $examCount,
                        'updatedAt' => null,
                        'breadcrumbs' => [],
                    ],
                    'qualityEvidence' => [],
                ];
            }

            $kind = $this->taxonomyKind($row);
            $parentRequired = in_array($kind, ['topic', 'subject'], true);
            return [
                'resourceType' => 'taxonomy',
                'resourceId' => (string) $id,
                'existence' => 'exists',
                'routeFamily' => match ($kind) {
                    'discipline' => 'discipline_detail',
                    'topic' => 'topic_detail',
                    default => 'subject_detail',
                },
                'routeParameters' => [],
                'publicationInput' => $this->implicitPublicInput(),
                'publicData' => [
                    'id' => (string) $id,
                    'displayName' => (string) ($row['name'] ?? ''),
                    'taxonomyKind' => $kind,
                    'publicDescription' => $row['description'] ?? '',
                    'parentName' => $row['parent_name'] ?? null,
                    'rootName' => null,
                    'publicItemCount' => $questionCount + $examCount,
                    'updatedAt' => null,
                    'breadcrumbs' => [],
                ],
                'qualityEvidence' => [
                    'hierarchyValid' => !$parentRequired || (int) ($row['parent_id'] ?? 0) > 0,
                ],
            ];
        }, $rows);
    }

    /** @return list<array<string, mixed>> */
    private function laws(int $afterId, int $limit): array
    {
        $rows = $this->query(
            "SELECT l.id, l.title, l.short_title, l.law_number, l.law_year, l.description, l.summary,
                    l.status, l.published_at, l.updated_at
             FROM laws l WHERE l.id > :after_id ORDER BY l.id ASC LIMIT {$limit}",
            [':after_id' => $afterId]
        );
        $ids = $this->ids($rows);
        if ($ids === []) {
            return [];
        }
        [$in, $params] = $this->inClause($ids);
        $counts = $this->mapById($this->query(
            "SELECT l.id, COUNT(DISTINCT a.id) AS article_count,
                    COUNT(DISTINCT tc.law_article_id) AS commented_article_count
             FROM laws l LEFT JOIN law_articles a ON a.law_id = l.id
             LEFT JOIN teacher_comments tc ON tc.law_article_id = a.id
             WHERE l.id IN ({$in}) GROUP BY l.id",
            $params
        ));

        return array_map(function (array $row) use ($counts): array {
            $id = (int) $row['id'];
            $lawCounts = $counts[$id] ?? [];
            return [
                'resourceType' => 'law',
                'resourceId' => (string) $id,
                'existence' => 'exists',
                'routeFamily' => 'law_detail',
                'routeParameters' => [],
                'publicationInput' => [
                    'status' => $row['status'] ?? 'unpublished',
                    'visibility' => 'public',
                    'scheduledAt' => $row['published_at'] ?? null,
                    'provenanceStatus' => 'known',
                    'rightsStatus' => 'not_evaluable',
                ],
                'publicData' => [
                    'id' => (string) $id,
                    'displayName' => (string) ($row['title'] ?? ''),
                    'shortName' => $row['short_title'] ?? null,
                    'publicDescription' => $row['description'] ?? $row['summary'] ?? '',
                    'commentaryExcerpt' => '',
                    'identifier' => trim((string) ($row['law_number'] ?? '') . ' ' . (string) ($row['law_year'] ?? '')),
                    'jurisdiction' => null,
                    'articleCount' => (int) ($lawCounts['article_count'] ?? 0),
                    'publishedAt' => $row['published_at'] ?? null,
                    'updatedAt' => $row['updated_at'] ?? null,
                    'breadcrumbs' => [],
                ],
                'qualityEvidence' => [
                    'editorialContextValid' => (int) ($lawCounts['commented_article_count'] ?? 0) > 0,
                ],
            ];
        }, $rows);
    }

    /** @param array<string, mixed> $row
     *  @return array<string, mixed>
     */
    private function publicationInput(array $row, string $statusKey, string $visibilityKey): array
    {
        return [
            'status' => $row[$statusKey] ?? 'unpublished',
            'visibility' => $row[$visibilityKey] ?? 'restricted',
            'scheduledAt' => $row['scheduled_at'] ?? null,
            'provenanceStatus' => 'unknown',
            'rightsStatus' => 'not_evaluable',
        ];
    }

    /** @return array<string, mixed> */
    private function implicitPublicInput(): array
    {
        return [
            'status' => 'published',
            'visibility' => 'public',
            'provenanceStatus' => 'unknown',
            'rightsStatus' => 'not_evaluable',
        ];
    }

    /** @param array<string, mixed> $row */
    private function taxonomyKind(array $row): string
    {
        $level = strtolower(trim((string) ($row['taxonomy_level'] ?? '')));
        if (!empty($row['meta_materia']) || $level === 'materia' || $row['type'] === 'materia') {
            return 'discipline';
        }
        if ($level === 'topico') {
            return 'topic';
        }
        return match ((string) ($row['type'] ?? '')) {
            'orgao' => 'organization',
            'cargo' => 'role',
            'ano' => 'year',
            default => 'subject',
        };
    }

    /** @return list<array<string, mixed>> */
    private function query(string $sql, array $params = []): array
    {
        $this->queryCount++;
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /** @param list<array<string, mixed>> $rows
     *  @return list<int>
     */
    private function ids(array $rows): array
    {
        return array_values(array_filter(array_map(static fn (array $row): int => (int) ($row['id'] ?? 0), $rows)));
    }

    /** @param list<int> $ids
     *  @return array{0:string,1:list<int>}
     */
    private function inClause(array $ids): array
    {
        return [implode(',', array_fill(0, count($ids), '?')), array_values($ids)];
    }

    /** @param list<array<string, mixed>> $rows
     *  @return array<int, array<string, mixed>>
     */
    private function mapById(array $rows): array
    {
        $mapped = [];
        foreach ($rows as $row) {
            $mapped[(int) ($row['id'] ?? 0)] = $row;
        }
        return $mapped;
    }

    /** @return list<string> */
    private function splitList(mixed $value): array
    {
        if (!is_string($value) || trim($value) === '') {
            return [];
        }
        return array_values(array_unique(array_filter(array_map('trim', explode('||', $value)))));
    }
}
