<?php

declare(strict_types=1);

/**
 * Classificacao estrutural interna de filters. Nao infere semantica por nome
 * ou slug: somente type, taxonomy_level e meta_materia sao autoritativos.
 */
final class TaxonomyClassification
{
    public const KNOWLEDGE_LEVELS = ['materia', 'topico', 'subtopico', 'assunto'];

    /**
     * @param array<string, mixed> $filter
     * @return array{kind:string,knowledgeLevel:?string,seoFactsKind:string,routeFamily:?string,parentRequired:bool,pending:bool}
     */
    public static function fromFilter(array $filter): array
    {
        $type = strtolower(trim((string) ($filter['type'] ?? '')));
        $level = strtolower(trim((string) ($filter['taxonomy_level'] ?? '')));
        $pending = $type === 'assunto' && $level === 'pending';
        $isMatter = $type === 'materia'
            || ($type === 'assunto' && ($level === 'materia' || self::truthy($filter['meta_materia'] ?? false)));

        if ($type === 'banca') {
            return self::result('banca', null, 'category', 'board_detail', false, false);
        }
        if ($type === 'orgao') {
            return self::result('orgao', null, 'organization', null, false, false);
        }
        if ($type === 'cargo') {
            return self::result('cargo', null, 'role', null, false, false);
        }
        if ($type === 'ano') {
            return self::result('ano', null, 'year', null, false, false);
        }
        if ($isMatter) {
            return self::result('materia', 'materia', 'discipline', $pending ? null : 'discipline_detail', false, $pending);
        }
        if ($type !== 'assunto') {
            return self::result('unsupported', null, 'subject', null, false, false);
        }

        if ($level === 'topico') {
            return self::result('topico', 'topico', 'topic', 'topic_detail', true, false);
        }
        if ($level === 'subtopico') {
            return self::result('subtopico', 'subtopico', 'subject', null, true, false);
        }

        return self::result('assunto', 'assunto', 'subject', $pending ? null : 'subject_detail', true, $pending);
    }

    /** @return array{kind:string,knowledgeLevel:?string,seoFactsKind:string,routeFamily:?string,parentRequired:bool,pending:bool} */
    private static function result(
        string $kind,
        ?string $knowledgeLevel,
        string $seoFactsKind,
        ?string $routeFamily,
        bool $parentRequired,
        bool $pending
    ): array {
        return compact('kind', 'knowledgeLevel', 'seoFactsKind', 'routeFamily', 'parentRequired', 'pending');
    }

    private static function truthy(mixed $value): bool
    {
        return $value === true || $value === 1 || $value === '1';
    }
}
