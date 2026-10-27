<?php

declare(strict_types=1);

final class CmBatchTaxonomyPolicy
{
    public static function sourceType(string $category): string
    {
        return $category === 'careers' ? 'area' : self::definition($category)[0];
    }

    /** Parents precede children even when a provider sends categories out of order. */
    public static function orderedEntities(array $taxonomies): array
    {
        $pending = [];
        foreach ($taxonomies as $category => $items) {
            self::definition($category);
            foreach ($items as $entity) $pending[] = ['category' => $category, 'entity' => $entity];
        }
        $known = array_fill_keys(array_column(array_column($pending, 'entity'), 'key'), true);
        $ordered = []; $done = [];
        while ($pending !== []) {
            $progress = false;
            foreach ($pending as $index => $row) {
                $parent = $row['entity']['parentKey'] ?? '';
                if ($parent !== '' && isset($known[$parent]) && !isset($done[$parent])) continue;
                $ordered[] = $row;
                $done[$row['entity']['key']] = true;
                unset($pending[$index]);
                $progress = true;
            }
            if (!$progress) return array_merge($ordered, array_values($pending));
        }
        return $ordered;
    }

    public static function canProposeCreation(array $entity, string $reason, array $candidateIds, bool $parentReady): bool
    {
        return $reason === 'no_verified_local_match' && $candidateIds === [] && $parentReady
            && ($entity['reviewRequired'] ?? true) === false
            && trim((string) ($entity['name'] ?? '')) !== '';
    }

    public static function definition(string $category): array
    {
        $definitions = [
            'examBoards' => ['banca', null], 'organizations' => ['orgao', null],
            'roles' => ['cargo', null], 'careers' => ['carreira', null],
            'professionalAreas' => ['area', null], 'focusAreas' => ['area', null],
            'specializations' => ['especialidade', null],
            'subjects' => ['assunto', 'materia'], 'topics' => ['assunto', 'topico'],
            'subtopics' => ['assunto', 'subtopico'], 'concepts' => ['assunto', 'assunto'],
            'skills' => ['habilidade', null], 'resolutionTechniques' => ['tecnica_resolucao', null],
            'questionTraps' => ['pegadinha', null], 'normativeReferences' => ['norma', null],
            'educationLevels' => ['nivel', null], 'years' => ['ano', null],
            'geographies' => ['geografia', null], 'examTypes' => ['tipo_prova', null],
            'questionTypes' => ['tipo_questao', null], 'examStages' => ['etapa_prova', null],
        ];
        if (!isset($definitions[$category])) {
            throw new InvalidArgumentException('Categoria taxonomica desconhecida: ' . $category);
        }
        return $definitions[$category];
    }

    public static function parentId(array $entity, array $entities): ?int
    {
        $parentKey = $entity['parentKey'] ?? null;
        if ($parentKey === null || $parentKey === '') return null;
        $parents = array_values(array_filter($entities, static fn (array $row): bool => $row['key'] === $parentKey));
        if (count($parents) !== 1 || empty($parents[0]['canonicalId'])) {
            throw new DomainException('Resolva primeiro o pai desta taxonomia: ' . $parentKey);
        }
        return (int) $parents[0]['canonicalId'];
    }

    public static function assertCandidate(array $entity, array $entities, array $candidate): void
    {
        [$type, $level] = self::definition($entity['category']);
        $parentId = self::parentId($entity, $entities);
        $candidateParent = isset($candidate['parent_id']) ? (int) $candidate['parent_id'] : null;
        if ($candidate['type'] !== $type || $candidateParent !== $parentId
            || ($level !== null && ($candidate['taxonomy_level'] ?? null) !== $level)) {
            throw new DomainException('O cadastro selecionado possui categoria, nivel ou pai incompatível.');
        }
    }

    public static function invalidateDescendants(array $entities, string $changedKey): array
    {
        $invalid = [$changedKey => true];
        do {
            $changed = false;
            foreach ($entities as &$entity) {
                if (!isset($invalid[$entity['key']]) && isset($invalid[$entity['parentKey'] ?? ''])) {
                    $invalid[$entity['key']] = true;
                    $entity['canonicalId'] = null;
                    $entity['status'] = 'needs_review';
                    $entity['action'] = 'needs_review';
                    $entity['reason'] = 'parent_resolution_changed';
                    unset($entity['decision']);
                    $changed = true;
                }
            }
            unset($entity);
        } while ($changed);
        return $entities;
    }
}
