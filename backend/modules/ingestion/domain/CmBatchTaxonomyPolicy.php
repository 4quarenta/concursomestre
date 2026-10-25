<?php

declare(strict_types=1);

final class CmBatchTaxonomyPolicy
{
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
