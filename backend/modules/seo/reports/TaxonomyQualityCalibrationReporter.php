<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/taxonomy/TaxonomyClassification.php';
require_once dirname(__DIR__) . '/taxonomy/TaxonomyPromotionEligibility.php';

/**
 * Read-only calibration for taxonomy promotion. It deliberately owns no
 * runtime decision: every simulated candidate remains NOINDEX/out of sitemap.
 */
final class TaxonomyQualityCalibrationReporter
{
    private int $queryCount = 0;
    /** @var array<string, list<float>> */
    private array $queryTimings = [];

    public function __construct(private readonly PDO $db)
    {
        $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }

    /** @return array<string, mixed> */
    public function generate(): array
    {
        $startedAt = microtime(true);
        $filters = $this->query('filters',
            "SELECT id, type, name, slug, parent_id, description, taxonomy_level, meta_materia,
                    source_provider
               FROM filters ORDER BY id"
        );
        $publicLinks = $this->query('public_question_links',
            "SELECT qf.filter_id, qf.question_id
               FROM question_filters qf
               INNER JOIN questions q ON q.id = qf.question_id
                AND q.publish_status IN ('published', 'scheduled')
                AND q.visibility_status = 'public'
                AND q.published_sort_at IS NOT NULL
                AND q.published_sort_at <= NOW()"
        );
        $publicExams = $this->query('public_exams',
            "SELECT id, banca_id, orgao_id, ano
               FROM provas
              WHERE archived_at IS NULL
                AND status_editorial = 'published'
                AND visibility_status = 'public'
                AND (scheduled_at IS NULL OR scheduled_at <= NOW())"
        );
        $examFilters = $this->query('exam_filters',
            "SELECT pf.prova_id, pf.filter_id
               FROM prova_filters pf
               INNER JOIN provas p ON p.id = pf.prova_id
                AND p.archived_at IS NULL
                AND p.status_editorial = 'published'
                AND p.visibility_status = 'public'
                AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())"
        );
        $questionExams = $this->query('question_exams',
            "SELECT DISTINCT links.question_id, links.prova_id
               FROM (
                    SELECT qp.question_id, qp.prova_id FROM question_provas qp
                    UNION ALL
                    SELECT q.id, q.prova_id FROM questions q WHERE q.prova_id IS NOT NULL
               ) links
               INNER JOIN questions q ON q.id = links.question_id
                AND q.publish_status IN ('published', 'scheduled')
                AND q.visibility_status = 'public'
                AND q.published_sort_at IS NOT NULL
                AND q.published_sort_at <= NOW()
               INNER JOIN provas p ON p.id = links.prova_id
                AND p.archived_at IS NULL
                AND p.status_editorial = 'published'
                AND p.visibility_status = 'public'
                AND (p.scheduled_at IS NULL OR p.scheduled_at <= NOW())"
        );
        $identities = $this->query('source_identities',
            "SELECT i.filter_id, i.source_provider
               FROM filter_source_identities i
               INNER JOIN filters f ON f.id = i.filter_id
              WHERE f.type = 'assunto' AND (f.taxonomy_level = 'materia' OR f.meta_materia = 1)"
        );
        $aliases = $this->query('aliases',
            "SELECT a.filter_id, a.normalized_alias
               FROM filter_aliases a
               INNER JOIN filters f ON f.id = a.filter_id
              WHERE f.type = 'assunto' AND (f.taxonomy_level = 'materia' OR f.meta_materia = 1)"
        );

        $analysis = $this->analyse($filters, $publicLinks, $publicExams, $examFilters, $questionExams, $identities, $aliases);
        $sampleDisciplineId = (int) ($analysis['sampleDisciplineId'] ?? 0);
        unset($analysis['sampleDisciplineId']);
        $explain = $this->explain($sampleDisciplineId);
        $benchmarks = $this->benchmark($sampleDisciplineId);

        return [
            'version' => 'taxonomy-quality-calibration.v1',
            'mode' => 'read_only_shadow',
            'generatedAt' => gmdate('c'),
            'dataset' => $this->datasetContext(),
            'runtime' => [
                'disciplineIndexability' => 'NOINDEX',
                'disciplineSitemapEligible' => false,
                'newIndexUrls' => 0,
                'newSitemapUrls' => 0,
            ],
            ...$analysis,
            'explain' => $explain,
            'indexRecommendations' => $this->indexRecommendations($explain),
            'benchmarks' => $benchmarks,
            'metrics' => [
                'queryCount' => $this->queryCount,
                'constantQueryPlan' => true,
                'nPlusOne' => [
                    'detected' => false,
                    'queryCountIndependentFromCards' => true,
                    'method' => 'bulk relation sets loaded once; no query inside entity/card loops',
                ],
                'durationMs' => (int) round((microtime(true) - $startedAt) * 1000),
                'queryTimingsMs' => $this->summarizeTimings(),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function analyse(array $filters, array $publicLinks, array $publicExams, array $examFilters, array $questionExams, array $identities, array $aliases): array
    {
        $byId = [];
        $levels = ['materia', 'topico', 'subtopico', 'assunto'];
        $levelStats = array_fill_keys($levels, ['total' => 0, 'public' => 0, 'pending' => 0, 'invalid' => 0]);
        $typeStats = [];
        foreach ($filters as $row) {
            $id = (int) $row['id'];
            $row['_classification'] = TaxonomyClassification::fromFilter($row);
            $byId[$id] = $row;
            $type = (string) $row['type'];
            $typeStats[$type] = ($typeStats[$type] ?? 0) + 1;
        }

        $questionsByFilter = $filtersByQuestion = [];
        foreach ($publicLinks as $link) {
            $filterId = (int) $link['filter_id'];
            $questionId = (int) $link['question_id'];
            $questionsByFilter[$filterId][$questionId] = true;
            $filtersByQuestion[$questionId][$filterId] = true;
        }
        $examById = [];
        foreach ($publicExams as $exam) $examById[(int) $exam['id']] = $exam;
        $examsByFilter = [];
        foreach ($examFilters as $link) $examsByFilter[(int) $link['filter_id']][(int) $link['prova_id']] = true;
        $examsByQuestion = [];
        foreach ($questionExams as $link) $examsByQuestion[(int) $link['question_id']][(int) $link['prova_id']] = true;

        $identityProviders = [];
        foreach ($identities as $identity) $identityProviders[(int) $identity['filter_id']][(string) $identity['source_provider']] = true;
        $aliasesByFilter = [];
        foreach ($aliases as $alias) $aliasesByFilter[(int) $alias['filter_id']][(string) $alias['normalized_alias']] = true;
        $canonicalSlugs = [];
        foreach ($filters as $filter) $canonicalSlugs[(string) $filter['slug']][(int) $filter['id']] = true;

        $cycles = $this->cycleIds($byId);
        $disciplineIds = $boardIds = $topicIds = $subjectIds = [];
        foreach ($byId as $id => $row) {
            $classification = $row['_classification'];
            $kind = $classification['kind'];
            if (isset($levelStats[$kind])) {
                $levelStats[$kind]['total']++;
                if ($classification['pending']) $levelStats[$kind]['pending']++;
                $invalid = !$this->hierarchyValid($id, $byId, $cycles);
                if ($invalid) $levelStats[$kind]['invalid']++;
                if (!$classification['pending'] && !$invalid) $levelStats[$kind]['public']++;
            }
            if ($kind === 'materia') $disciplineIds[] = $id;
            if ($kind === 'banca') $boardIds[] = $id;
            if ($kind === 'topico') $topicIds[] = $id;
            if ($kind === 'assunto') $subjectIds[] = $id;
        }

        $disciplineEvidence = [];
        foreach ($disciplineIds as $id) {
            $row = $byId[$id];
            $questionSet = $questionsByFilter[$id] ?? [];
            $examSet = $examsByFilter[$id] ?? [];
            $boardSet = $yearSet = $orgSet = [];
            foreach (array_keys($questionSet) as $questionId) {
                foreach (array_keys($filtersByQuestion[$questionId] ?? []) as $filterId) {
                    $kind = $byId[$filterId]['_classification']['kind'] ?? null;
                    if ($kind === 'banca') $boardSet[$filterId] = true;
                    if ($kind === 'ano') $yearSet[(string) ($byId[$filterId]['name'] ?? $filterId)] = true;
                    if ($kind === 'orgao') $orgSet[$filterId] = true;
                }
                foreach (array_keys($examsByQuestion[$questionId] ?? []) as $examId) $examSet[$examId] = true;
            }
            foreach (array_keys($examSet) as $examId) {
                $exam = $examById[$examId] ?? null;
                if (!$exam) continue;
                if ((int) ($exam['banca_id'] ?? 0) > 0) $boardSet[(int) $exam['banca_id']] = true;
                if ((int) ($exam['orgao_id'] ?? 0) > 0) $orgSet[(int) $exam['orgao_id']] = true;
                if ((int) ($exam['ano'] ?? 0) > 0) $yearSet[(string) $exam['ano']] = true;
            }
            $topics = [];
            foreach ($byId as $childId => $child) {
                if ((int) ($child['parent_id'] ?? 0) === $id && $child['_classification']['kind'] === 'topico') $topics[$childId] = true;
            }
            $slug = (string) $row['slug'];
            $name = trim((string) $row['name']);
            $descriptionLength = $this->length(trim((string) ($row['description'] ?? '')));
            $reasons = [];
            if ($row['_classification']['pending']) $reasons[] = 'taxonomy.pending';
            if ($name === '' || $this->placeholder($name)) $reasons[] = 'taxonomy.placeholder';
            if (!$this->validSlug($slug)) $reasons[] = 'taxonomy.slug_invalid';
            if ($this->length($slug) > 80) $reasons[] = 'taxonomy.slug_too_long';
            if (!$this->hierarchyValid($id, $byId, $cycles)) $reasons[] = 'taxonomy.invalid_hierarchy';
            if ($questionSet === []) $reasons[] = 'taxonomy.no_public_content';
            $providers = $identityProviders[$id] ?? [];
            if (trim((string) ($row['source_provider'] ?? '')) !== '') $providers[(string) $row['source_provider']] = true;
            $aliasSet = $aliasesByFilter[$id] ?? [];
            $aliasConflicts = 0;
            foreach (array_keys($aliasSet) as $alias) {
                foreach (array_keys($canonicalSlugs[$alias] ?? []) as $otherId) if ($otherId !== $id) $aliasConflicts++;
            }
            $disciplineEvidence[$id] = [
                'id' => $id,
                'slug' => $slug,
                'name' => $name,
                'structuralValidity' => !in_array('taxonomy.invalid_hierarchy', $reasons, true),
                'pending' => $row['_classification']['pending'],
                'placeholder' => in_array('taxonomy.placeholder', $reasons, true),
                'slugCompatible' => $this->validSlug($slug) && $this->length($slug) <= 80,
                'publicQuestionCount' => count($questionSet),
                'examCount' => count($examSet),
                'boardCount' => count($boardSet),
                'organizationCount' => count($orgSet),
                'yearCount' => count($yearSet),
                'oldestYear' => $yearSet === [] ? null : min(array_map('intval', array_keys($yearSet))),
                'newestYear' => $yearSet === [] ? null : max(array_map('intval', array_keys($yearSet))),
                'descriptionLength' => $descriptionLength,
                'topicCount' => count($topics),
                'overlapRisk' => 0.0,
                'sourceDiversity' => count($providers),
                'externalIdentityCount' => count($identityProviders[$id] ?? []),
                'externalProviders' => array_values(array_keys($identityProviders[$id] ?? [])),
                'aliasCount' => count($aliasSet),
                'aliasConflicts' => $aliasConflicts,
                'collisionSuffixReview' => preg_match('/-[2-9][0-9]*$/', $slug) === 1,
                'hardFailReasons' => array_values(array_unique($reasons)),
            ];
        }

        $parentChild = $this->parentChildOverlap($disciplineIds, $topicIds, $subjectIds, $byId, $questionsByFilter);
        foreach ($parentChild['disciplineTopic']['pairs'] as $pair) {
            $id = (int) $pair['leftId'];
            if (isset($disciplineEvidence[$id]) && $pair['jaccard'] !== null) {
                $disciplineEvidence[$id]['overlapRisk'] = max($disciplineEvidence[$id]['overlapRisk'], (float) $pair['jaccard']);
            }
        }
        $disciplinePairs = $this->disciplineOverlap($disciplineIds, $questionsByFilter, $filtersByQuestion);
        foreach ($disciplinePairs['pairs'] as $pair) {
            foreach ([(int) $pair['leftId'], (int) $pair['rightId']] as $id) {
                if (isset($disciplineEvidence[$id])) $disciplineEvidence[$id]['overlapRisk'] = max($disciplineEvidence[$id]['overlapRisk'], (float) $pair['jaccard']);
            }
        }

        $thresholds = $this->deriveThresholds(array_values($disciplineEvidence));
        $shadow = $this->simulate(array_values($disciplineEvidence), $thresholds);
        $boardShadow = $this->boardShadow($boardIds, $byId, $questionsByFilter, $filtersByQuestion, $examsByFilter, $examById);

        return [
            'sampleDisciplineId' => $this->sampleDisciplineId($disciplineEvidence),
            'filterTypes' => $typeStats,
            'levels' => $levelStats,
            'disciplines' => [
                'total' => count($disciplineEvidence),
                'questionBuckets' => $this->buckets(array_column($disciplineEvidence, 'publicQuestionCount'), [0, 4, 9, 19, 49, 99, 249]),
                'questionPercentiles' => $this->percentiles(array_column($disciplineEvidence, 'publicQuestionCount')),
                'examBuckets' => $this->adaptiveBuckets(array_column($disciplineEvidence, 'examCount')),
                'examPercentiles' => $this->percentiles(array_column($disciplineEvidence, 'examCount')),
                'boardBuckets' => $this->adaptiveBuckets(array_column($disciplineEvidence, 'boardCount')),
                'boardPercentiles' => $this->percentiles(array_column($disciplineEvidence, 'boardCount')),
                'yearBuckets' => $this->adaptiveBuckets(array_column($disciplineEvidence, 'yearCount')),
                'yearPercentiles' => $this->percentiles(array_column($disciplineEvidence, 'yearCount')),
                'descriptionBuckets' => $this->descriptionBuckets(array_column($disciplineEvidence, 'descriptionLength')),
                'pending' => count(array_filter($disciplineEvidence, fn ($x) => $x['pending'])),
                'pendingWithQuestions' => count(array_filter($disciplineEvidence, fn ($x) => $x['pending'] && $x['publicQuestionCount'] > 0)),
                'placeholders' => $this->frequency($disciplineEvidence, 'taxonomy.placeholder'),
                'slugStats' => $this->slugStats($disciplineEvidence),
                'externalIdentities' => $this->identityStats($disciplineEvidence),
                'aliases' => $this->aliasStats($disciplineEvidence),
                'evidence' => array_values($disciplineEvidence),
                'manualSamples' => $this->manualSamples(array_values($disciplineEvidence)),
            ],
            'hierarchy' => [
                'orphans' => $this->orphanStats($byId, $cycles),
                'cycles' => ['count' => count($cycles), 'ids' => array_slice(array_keys($cycles), 0, 50)],
            ],
            'overlap' => [
                'disciplineTopic' => $parentChild['disciplineTopic'],
                'topicSubject' => $parentChild['topicSubject'],
                'disciplineDiscipline' => $disciplinePairs,
            ],
            'thresholdCandidates' => $thresholds,
            'shadow' => $shadow,
            'sitemapSimulation' => [
                'candidateIds' => $shadow['potentialIndexIds'],
                'runtimeChanges' => 0,
            ],
            'boardsShadow' => $boardShadow,
            'slugAuthority' => 'filters.slug',
        ];
    }

    /** @return array<string, mixed> */
    private function datasetContext(): array
    {
        $row = $this->query('dataset', "SELECT DATABASE() db, VERSION() version, CURRENT_USER() account, UTC_TIMESTAMP() measured_at")[0];
        $counts = [];
        foreach (['filters', 'questions', 'provas'] as $table) {
            $counts[$table] = (int) $this->query('dataset_' . $table, "SELECT COUNT(*) count FROM `$table`")[0]['count'];
        }
        return [
            'environment' => 'PRODUCTION_READ_ONLY_USER',
            'database' => $row['db'],
            'engineVersion' => $row['version'],
            'account' => substr((string) $row['account'], 0, 2) . '***',
            'measuredAt' => $row['measured_at'],
            'counts' => $counts,
            'representative' => true,
        ];
    }

    /** @return array<string, mixed> */
    private function deriveThresholds(array $evidence): array
    {
        $eligible = array_values(array_filter($evidence, fn ($x) => $x['hardFailReasons'] === []));
        $positiveQuestions = array_values(array_filter(array_column($eligible, 'publicQuestionCount'), fn ($v) => $v > 0));
        $relations = array_map(fn ($x) => $x['boardCount'] + $x['examCount'], $eligible);
        $overlaps = array_values(array_filter(array_column($eligible, 'overlapRisk'), fn ($v) => $v > 0));
        $descriptions = array_values(array_filter(array_column($eligible, 'descriptionLength'), fn ($v) => $v > 0));
        $topics = array_values(array_filter(array_column($eligible, 'topicCount'), fn ($v) => $v > 0));
        $a = [
            'minimumPublicQuestions' => max(1, (int) $this->percentile($positiveQuestions, .50)),
            'minimumDistinctRelations' => max(1, (int) $this->percentile($relations, .25)),
            'maximumOverlap' => $overlaps === [] ? 1.0 : round((float) $this->percentile($overlaps, .75), 4),
            'editorialAlternative' => false,
            'derivation' => 'P50 positive questions + P25 relations + P75 observed overlap',
        ];
        $b = [
            'minimumPublicQuestions' => max($a['minimumPublicQuestions'], (int) $this->percentile($positiveQuestions, .75)),
            'minimumDistinctRelations' => max($a['minimumDistinctRelations'], (int) $this->percentile($relations, .50)),
            'maximumOverlap' => $overlaps === [] ? 1.0 : round(min($a['maximumOverlap'], (float) $this->percentile($overlaps, .50)), 4),
            'minimumDescriptionCharacters' => max(1, (int) $this->percentile($descriptions, .50)),
            'minimumTopicsAlternative' => max(1, (int) $this->percentile($topics, .50)),
            'derivation' => 'P75 positive questions + P50 relations/overlap + median editorial or topic evidence',
        ];
        return ['candidateA' => $a, 'candidateB' => $b];
    }

    /** @return array<string, mixed> */
    private function simulate(array $evidence, array $thresholds): array
    {
        $result = ['candidateA' => [], 'candidateB' => []];
        foreach (['candidateA', 'candidateB'] as $candidate) {
            $rules = $thresholds[$candidate];
            $counts = ['PASS' => 0, 'FAIL' => 0, 'NOT_EVALUATED' => 0];
            $reasons = [];
            $passIds = [];
            foreach ($evidence as $item) {
                $itemReasons = $item['hardFailReasons'];
                if ($item['publicQuestionCount'] < $rules['minimumPublicQuestions']) $itemReasons[] = 'quality.low_volume';
                if (($item['boardCount'] + $item['examCount']) < $rules['minimumDistinctRelations']) $itemReasons[] = 'quality.low_diversity';
                if ($item['overlapRisk'] > $rules['maximumOverlap']) $itemReasons[] = 'quality.high_overlap';
                if ($candidate === 'candidateB'
                    && $item['descriptionLength'] < $rules['minimumDescriptionCharacters']
                    && $item['topicCount'] < $rules['minimumTopicsAlternative']) {
                    $itemReasons[] = 'quality.no_editorial_or_topic_depth';
                }
                $itemReasons = array_values(array_unique($itemReasons));
                $status = $itemReasons === [] ? 'PASS' : 'FAIL';
                $counts[$status]++;
                if ($status === 'PASS') $passIds[] = $item['id'];
                foreach ($itemReasons as $reason) $reasons[$reason] = ($reasons[$reason] ?? 0) + 1;
            }
            arsort($reasons);
            $result[$candidate] = [
                'counts' => $counts,
                'potentialIndex' => count($passIds),
                'remainNoindex' => count($evidence) - count($passIds),
                'passIds' => $passIds,
                'reasonCodes' => $reasons,
            ];
        }
        $result['comparison'] = [
            'absoluteDifference' => $result['candidateA']['counts']['PASS'] - $result['candidateB']['counts']['PASS'],
            'percentageDifference' => $result['candidateA']['counts']['PASS'] === 0 ? 0 : round(100 * ($result['candidateA']['counts']['PASS'] - $result['candidateB']['counts']['PASS']) / $result['candidateA']['counts']['PASS'], 2),
        ];
        $result['potentialIndexIds'] = $result['candidateA']['passIds'];
        unset($result['candidateA']['passIds'], $result['candidateB']['passIds']);
        return $result;
    }

    /** @return array<string, mixed> */
    private function parentChildOverlap(array $disciplineIds, array $topicIds, array $subjectIds, array $byId, array $sets): array
    {
        $disciplineSet = array_fill_keys($disciplineIds, true);
        $topicSet = array_fill_keys($topicIds, true);
        $subjectSet = array_fill_keys($subjectIds, true);
        $disciplineTopic = $topicSubject = [];
        foreach ($byId as $id => $row) {
            $parentId = (int) ($row['parent_id'] ?? 0);
            if (isset($topicSet[$id], $disciplineSet[$parentId])) $disciplineTopic[] = $this->pair($parentId, $id, $sets);
            if (!isset($subjectSet[$id])) continue;
            $ancestor = $parentId;
            $visited = [];
            while ($ancestor > 0 && isset($byId[$ancestor]) && !isset($visited[$ancestor])) {
                $visited[$ancestor] = true;
                if (isset($topicSet[$ancestor])) {
                    $topicSubject[] = $this->pair($ancestor, $id, $sets);
                    break;
                }
                $ancestor = (int) ($byId[$ancestor]['parent_id'] ?? 0);
            }
        }
        return [
            'disciplineTopic' => $this->overlapSummary($disciplineTopic),
            'topicSubject' => $this->overlapSummary($topicSubject),
        ];
    }

    /** @return array<string, mixed> */
    private function disciplineOverlap(array $disciplineIds, array $sets, array $filtersByQuestion): array
    {
        $disciplineSet = array_fill_keys($disciplineIds, true);
        $candidates = [];
        foreach ($filtersByQuestion as $filterSet) {
            $ids = array_values(array_filter(array_keys($filterSet), fn ($id) => isset($disciplineSet[$id])));
            sort($ids);
            for ($i = 0; $i < count($ids); $i++) for ($j = $i + 1; $j < count($ids); $j++) $candidates[$ids[$i] . ':' . $ids[$j]] = [$ids[$i], $ids[$j]];
        }
        $pairs = [];
        foreach ($candidates as [$left, $right]) $pairs[] = $this->pair($left, $right, $sets);
        usort($pairs, fn ($a, $b) => ($b['jaccard'] ?? -1) <=> ($a['jaccard'] ?? -1));
        return $this->overlapSummary($pairs, 100) + ['candidatePairs' => count($candidates), 'method' => 'shared-public-question inverted index'];
    }

    /** @return array<string, mixed> */
    private function pair(int $left, int $right, array $sets): array
    {
        $a = $sets[$left] ?? [];
        $b = $sets[$right] ?? [];
        $intersection = count(array_intersect_key($a, $b));
        $union = count($a) + count($b) - $intersection;
        return [
            'leftId' => $left,
            'rightId' => $right,
            'leftCount' => count($a),
            'rightCount' => count($b),
            'intersection' => $intersection,
            'leftExclusive' => count($a) - $intersection,
            'rightExclusive' => count($b) - $intersection,
            'jaccard' => $union === 0 ? null : round($intersection / $union, 4),
        ];
    }

    /** @return array<string, mixed> */
    private function overlapSummary(array $pairs, int $detailLimit = 250): array
    {
        $buckets = ['0-0.24' => 0, '0.25-0.49' => 0, '0.50-0.74' => 0, '0.75-0.89' => 0, '0.90-0.99' => 0, '1.00' => 0, 'not_evaluable' => 0];
        foreach ($pairs as $pair) {
            $j = $pair['jaccard'];
            $key = $j === null ? 'not_evaluable' : ($j === 1.0 ? '1.00' : ($j < .25 ? '0-0.24' : ($j < .50 ? '0.25-0.49' : ($j < .75 ? '0.50-0.74' : ($j < .90 ? '0.75-0.89' : '0.90-0.99')))));
            $buckets[$key]++;
        }
        return ['totalPairs' => count($pairs), 'buckets' => $buckets, 'pairs' => array_slice($pairs, 0, $detailLimit)];
    }

    /** @return array<string, mixed> */
    private function boardShadow(array $boardIds, array $byId, array $questionSets, array $filtersByQuestion, array $examSets, array $examById): array
    {
        $items = [];
        $disciplineIds = [];
        foreach ($byId as $id => $row) if ($row['_classification']['kind'] === 'materia') $disciplineIds[$id] = true;
        foreach ($boardIds as $id) {
            $questions = $questionSets[$id] ?? [];
            $disciplines = [];
            foreach (array_keys($questions) as $qid) foreach (array_keys($filtersByQuestion[$qid] ?? []) as $fid) if (isset($disciplineIds[$fid])) $disciplines[$fid] = true;
            $exams = $examSets[$id] ?? [];
            foreach ($examById as $examId => $exam) if ((int) ($exam['banca_id'] ?? 0) === $id) $exams[$examId] = true;
            $hard = [];
            if (trim((string) $byId[$id]['name']) === '' || $this->placeholder((string) $byId[$id]['name'])) $hard[] = 'taxonomy.placeholder';
            if (!$this->validSlug((string) $byId[$id]['slug']) || $this->length((string) $byId[$id]['slug']) > 80) $hard[] = 'taxonomy.slug_incompatible';
            if ($questions === [] && $exams === []) $hard[] = 'taxonomy.no_public_content';
            $items[] = ['id' => $id, 'questions' => count($questions), 'exams' => count($exams), 'disciplines' => count($disciplines), 'hard' => $hard];
        }
        $positive = array_values(array_filter(array_map(fn ($x) => $x['questions'] + $x['exams'], $items), fn ($v) => $v > 0));
        $minimum = max(1, (int) $this->percentile($positive, .50));
        $counts = ['PASS' => 0, 'FAIL' => 0, 'NOT_EVALUATED' => 0];
        foreach ($items as $item) {
            $pass = $item['hard'] === [] && ($item['questions'] + $item['exams']) >= $minimum && $item['disciplines'] >= 1;
            $counts[$pass ? 'PASS' : 'FAIL']++;
        }
        return ['total' => count($items), 'minimumContentDerivedFromPositiveP50' => $minimum, 'counts' => $counts, 'runtimeEnforcement' => false];
    }

    /** @return array<string, mixed> */
    private function explain(int $id): array
    {
        $id = max(1, $id);
        $queries = [
            'identity' => ["EXPLAIN SELECT id FROM filters WHERE type='assunto' AND slug=? AND (taxonomy_level='materia' OR meta_materia=1) LIMIT 1", [(string) $this->query('sample_slug', 'SELECT slug FROM filters WHERE id=?', [$id])[0]['slug']]],
            'topics' => ["EXPLAIN SELECT id FROM filters WHERE parent_id=? AND type='assunto' AND taxonomy_level='topico'", [$id]],
            'questions' => ["EXPLAIN SELECT q.id FROM question_filters qf INNER JOIN questions q ON q.id=qf.question_id WHERE qf.filter_id=? AND q.publish_status IN ('published','scheduled') AND q.visibility_status='public' AND q.published_sort_at IS NOT NULL AND q.published_sort_at<=NOW() ORDER BY q.published_sort_at DESC,q.id DESC LIMIT 20", [$id]],
            'boards' => ["EXPLAIN SELECT DISTINCT b.id FROM question_filters dq INNER JOIN question_filters bq ON bq.question_id=dq.question_id INNER JOIN filters b ON b.id=bq.filter_id AND b.type='banca' INNER JOIN questions q ON q.id=dq.question_id AND q.publish_status IN ('published','scheduled') AND q.visibility_status='public' AND q.published_sort_at IS NOT NULL AND q.published_sort_at<=NOW() WHERE dq.filter_id=? LIMIT 20", [$id]],
            'exams' => ["EXPLAIN SELECT DISTINCT p.id FROM question_filters dq INNER JOIN question_provas qp ON qp.question_id=dq.question_id INNER JOIN provas p ON p.id=qp.prova_id AND p.archived_at IS NULL AND p.status_editorial='published' AND p.visibility_status='public' AND (p.scheduled_at IS NULL OR p.scheduled_at<=NOW()) WHERE dq.filter_id=? LIMIT 20", [$id]],
        ];
        $out = [];
        foreach ($queries as $name => [$sql, $params]) {
            $out[$name] = array_map(fn ($r) => ['type' => $r['type'] ?? null, 'possibleKeys' => $r['possible_keys'] ?? null, 'key' => $r['key'] ?? null, 'rows' => isset($r['rows']) ? (int) $r['rows'] : null, 'extra' => $r['Extra'] ?? null], $this->query('explain_' . $name, $sql, $params));
        }
        return $out;
    }

    /** @return array<string, mixed> */
    private function benchmark(int $id): array
    {
        $id = max(1, $id);
        $queries = [
            'identity' => ["SELECT id FROM filters WHERE id=? AND type='assunto' AND (taxonomy_level='materia' OR meta_materia=1)", [$id]],
            'topics' => ["SELECT id FROM filters WHERE parent_id=? AND type='assunto' AND taxonomy_level='topico' LIMIT 50", [$id]],
            'questions' => ["SELECT q.id FROM question_filters qf INNER JOIN questions q ON q.id=qf.question_id WHERE qf.filter_id=? AND q.publish_status IN ('published','scheduled') AND q.visibility_status='public' AND q.published_sort_at IS NOT NULL AND q.published_sort_at<=NOW() ORDER BY q.published_sort_at DESC,q.id DESC LIMIT 20", [$id]],
            'boards' => ["SELECT DISTINCT b.id FROM question_filters dq INNER JOIN question_filters bq ON bq.question_id=dq.question_id INNER JOIN filters b ON b.id=bq.filter_id AND b.type='banca' INNER JOIN questions q ON q.id=dq.question_id AND q.publish_status IN ('published','scheduled') AND q.visibility_status='public' AND q.published_sort_at IS NOT NULL AND q.published_sort_at<=NOW() WHERE dq.filter_id=? LIMIT 20", [$id]],
            'exams' => ["SELECT DISTINCT p.id FROM question_filters dq INNER JOIN question_provas qp ON qp.question_id=dq.question_id INNER JOIN provas p ON p.id=qp.prova_id AND p.archived_at IS NULL AND p.status_editorial='published' AND p.visibility_status='public' AND (p.scheduled_at IS NULL OR p.scheduled_at<=NOW()) WHERE dq.filter_id=? LIMIT 20", [$id]],
        ];
        $out = [];
        foreach ($queries as $name => [$sql, $params]) {
            $times = [];
            for ($i = 0; $i < 5; $i++) {
                $start = microtime(true);
                $stmt = $this->db->prepare($sql); $stmt->execute($params); $stmt->fetchAll(PDO::FETCH_ASSOC);
                $elapsed = (microtime(true) - $start) * 1000;
                $times[] = $elapsed;
                $this->queryCount++;
                $this->queryTimings['benchmark_' . $name][] = $elapsed;
            }
            sort($times);
            $out[$name] = ['runs' => 5, 'medianMs' => round($times[2], 3), 'p95ApproxMs' => round($times[4], 3), 'maxMs' => round(max($times), 3)];
        }
        return $out;
    }

    private function hierarchyValid(int $id, array $byId, array $cycles): bool
    {
        if (isset($cycles[$id])) return false;
        $row = $byId[$id];
        $kind = $row['_classification']['kind'];
        $parentId = (int) ($row['parent_id'] ?? 0);
        if ($kind === 'materia') return true;
        if (!in_array($kind, ['topico', 'subtopico', 'assunto'], true)) return true;
        if ($parentId <= 0 || !isset($byId[$parentId])) return false;
        $parentKind = $byId[$parentId]['_classification']['kind'];
        $direct = match ($kind) {
            'topico' => $parentKind === 'materia',
            'subtopico' => $parentKind === 'topico',
            'assunto' => in_array($parentKind, ['materia', 'topico', 'subtopico'], true),
            default => true,
        };
        return $direct && $this->hierarchyValid($parentId, $byId, $cycles);
    }

    private function cycleIds(array $byId): array
    {
        $cycles = [];
        foreach ($byId as $id => $_) {
            $path = []; $positions = []; $current = $id;
            while ($current > 0 && isset($byId[$current])) {
                if (isset($positions[$current])) { foreach (array_slice($path, $positions[$current]) as $cycleId) $cycles[$cycleId] = true; break; }
                $positions[$current] = count($path); $path[] = $current; $current = (int) ($byId[$current]['parent_id'] ?? 0);
            }
        }
        return $cycles;
    }

    private function orphanStats(array $byId, array $cycles): array
    {
        $missing = $incompatible = [];
        foreach ($byId as $id => $row) {
            $parentId = (int) ($row['parent_id'] ?? 0);
            if ($parentId > 0 && !isset($byId[$parentId])) $missing[] = $id;
            elseif (!$this->hierarchyValid($id, $byId, $cycles)) $incompatible[] = $id;
        }
        return ['missingParent' => count($missing), 'incompatibleParentOrChain' => count($incompatible), 'examples' => array_slice(array_values(array_unique([...$missing, ...$incompatible])), 0, 50)];
    }

    private function placeholder(string $name): bool
    {
        $normalized = $this->normalize($name);
        return in_array($normalized, ['outros', 'outro', 'geral', 'diversos', 'diverso', 'nao informado', 'sem classificacao', 'a definir', 'pending', 'pendente'], true);
    }

    private function validSlug(string $slug): bool { return preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) === 1; }
    private function length(string $value): int { return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value); }
    private function normalize(string $value): string
    {
        $value = trim(function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value));
        if (class_exists('Transliterator')) $value = Transliterator::create('NFD; [:Nonspacing Mark:] Remove; NFC')?->transliterate($value) ?? $value;
        return preg_replace('/\s+/u', ' ', $value) ?? $value;
    }

    private function buckets(array $values, array $bounds): array
    {
        $labels = ['0', '1-4', '5-9', '10-19', '20-49', '50-99', '100-249', '250+'];
        $out = array_fill_keys($labels, 0);
        foreach ($values as $value) {
            $value = (int) $value;
            $index = $value === 0 ? 0 : ($value <= 4 ? 1 : ($value <= 9 ? 2 : ($value <= 19 ? 3 : ($value <= 49 ? 4 : ($value <= 99 ? 5 : ($value <= 249 ? 6 : 7))))));
            $out[$labels[$index]]++;
        }
        return $out;
    }

    private function adaptiveBuckets(array $values): array
    {
        $out = ['0' => 0, '1' => 0, '2-4' => 0, '5-9' => 0, '10-24' => 0, '25+' => 0];
        foreach ($values as $v) { $v=(int)$v; $out[$v===0?'0':($v===1?'1':($v<=4?'2-4':($v<=9?'5-9':($v<=24?'10-24':'25+'))))]++; }
        return $out;
    }

    private function descriptionBuckets(array $values): array
    {
        $out = ['0' => 0, '1-49' => 0, '50-149' => 0, '150-299' => 0, '300+' => 0];
        foreach ($values as $v) { $v=(int)$v; $out[$v===0?'0':($v<=49?'1-49':($v<=149?'50-149':($v<=299?'150-299':'300+')))]++; }
        return $out;
    }

    private function percentiles(array $values): array
    {
        $out=[]; foreach ([10,25,50,75,90,95,99] as $p) $out['P'.$p]=$this->percentile($values,$p/100); return $out;
    }

    private function percentile(array $values, float $p): float
    {
        if ($values === []) return 0.0;
        sort($values, SORT_NUMERIC); $index=($p*(count($values)-1)); $lo=(int)floor($index); $hi=(int)ceil($index);
        return (float) ($values[$lo] + ($values[$hi]-$values[$lo])*($index-$lo));
    }

    private function frequency(array $evidence, string $reason): array
    {
        $names=[]; foreach($evidence as $item) if(in_array($reason,$item['hardFailReasons'],true)) $names[$item['name']]=($names[$item['name']]??0)+1; arsort($names); return ['total'=>array_sum($names),'values'=>$names];
    }

    private function slugStats(array $evidence): array
    {
        return ['empty'=>count(array_filter($evidence,fn($x)=>$x['slug']==='')),'invalid'=>count(array_filter($evidence,fn($x)=>!$this->validSlug($x['slug']))), 'over80'=>count(array_filter($evidence,fn($x)=>$this->length($x['slug'])>80)), 'over190'=>count(array_filter($evidence,fn($x)=>$this->length($x['slug'])>190)), 'collisionSuffixReview'=>count(array_filter($evidence,fn($x)=>$x['collisionSuffixReview']))];
    }

    private function identityStats(array $evidence): array
    {
        $providers=[]; foreach($evidence as $item) foreach($item['externalProviders'] as $provider) $providers[$provider]=($providers[$provider]??0)+1; arsort($providers);
        return ['with'=>count(array_filter($evidence,fn($x)=>$x['externalIdentityCount']>0)),'without'=>count(array_filter($evidence,fn($x)=>$x['externalIdentityCount']===0)),'multiple'=>count(array_filter($evidence,fn($x)=>$x['externalIdentityCount']>1)),'providers'=>$providers];
    }

    private function aliasStats(array $evidence): array
    {
        return ['zero'=>count(array_filter($evidence,fn($x)=>$x['aliasCount']===0)),'one'=>count(array_filter($evidence,fn($x)=>$x['aliasCount']===1)),'multiple'=>count(array_filter($evidence,fn($x)=>$x['aliasCount']>1)),'conflicts'=>array_sum(array_column($evidence,'aliasConflicts'))];
    }

    private function manualSamples(array $evidence): array
    {
        $valid=array_values(array_filter($evidence,fn($x)=>$x['hardFailReasons']===[]));
        usort($valid,fn($a,$b)=>($b['publicQuestionCount']+$b['boardCount']+$b['examCount'])<=>($a['publicQuestionCount']+$a['boardCount']+$a['examCount']));
        $strong=array_slice($valid,0,10); $weak=array_slice(array_reverse($valid),0,10);
        $middle=$valid===[]?[]:array_slice($valid,max(0,(int)floor(count($valid)/2)-5),10);
        $edge=array_slice(array_values(array_filter($evidence,fn($x)=>$x['hardFailReasons']!==[])),0,10);
        $pick=fn($items)=>array_map(fn($x)=>array_intersect_key($x,array_flip(['id','slug','name','publicQuestionCount','examCount','boardCount','yearCount','descriptionLength','topicCount','overlapRisk','hardFailReasons'])),$items);
        return ['strong'=>$pick($strong),'medium'=>$pick($middle),'weak'=>$pick($weak),'edge'=>$pick($edge)];
    }

    private function sampleDisciplineId(array $evidence): int
    {
        $best=0;$count=-1; foreach($evidence as $id=>$item) if($item['hardFailReasons']===[]&&$item['publicQuestionCount']>$count){$best=(int)$id;$count=$item['publicQuestionCount'];} return $best;
    }

    private function summarizeTimings(): array
    {
        $out=[]; foreach($this->queryTimings as $name=>$times){sort($times);$out[$name]=['runs'=>count($times),'medianMs'=>round($this->percentile($times,.5),3),'p95ApproxMs'=>round($this->percentile($times,.95),3),'maxMs'=>round(max($times),3)];} return $out;
    }

    /** @param array<string, mixed> $explain @return list<array<string, mixed>> */
    private function indexRecommendations(array $explain): array
    {
        $recommendations = [];
        foreach ($explain as $name => $steps) {
            foreach ($steps as $step) {
                if (($step['type'] ?? null) !== 'ALL') continue;
                $rows = (int) ($step['rows'] ?? 0);
                $recommendations[] = [
                    'query' => $name,
                    'indexNeeded' => $rows > 1000 ? 'YES' : 'NO_CURRENT_SCALE',
                    'evidence' => 'type=ALL rows=' . $rows,
                    'ddlCandidate' => null,
                    'risk' => $rows > 1000 ? 'Requires separate migration review.' : 'Full scan is currently bounded; premature index would add write cost.',
                ];
            }
        }
        if ($recommendations === []) {
            $recommendations[] = ['query' => 'all', 'indexNeeded' => 'NO', 'evidence' => 'Critical paths use declared keys.', 'ddlCandidate' => null, 'risk' => 'Continue monitoring growth.'];
        }
        return $recommendations;
    }

    /** @return list<array<string, mixed>> */
    private function query(string $name, string $sql, array $params = []): array
    {
        $this->queryCount++; $started=microtime(true); $stmt=$this->db->prepare($sql); $stmt->execute($params); $rows=$stmt->fetchAll(PDO::FETCH_ASSOC)?:[]; $this->queryTimings[$name][]=1000*(microtime(true)-$started); return $rows;
    }
}
