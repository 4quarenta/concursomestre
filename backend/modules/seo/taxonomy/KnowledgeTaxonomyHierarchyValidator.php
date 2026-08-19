<?php

declare(strict_types=1);

/**
 * Valida somente a estrutura publica da arvore de conhecimento. O resultado
 * mede readiness da instancia; volume e qualidade editorial nao participam.
 */
final class KnowledgeTaxonomyHierarchyValidator
{
    /** @param array<string, mixed> $identity
     *  @return array{status:string,reasonCodes:list<string>}
     */
    public static function evaluate(array $identity, string $expectedLevel): array
    {
        $reasons = [];
        $type = strtolower(trim((string) ($identity['type'] ?? '')));
        $level = strtolower(trim((string) ($identity['taxonomy_level'] ?? '')));
        $name = self::normalizeName((string) ($identity['name'] ?? ''));
        if ($type !== 'assunto') {
            $reasons[] = 'instance_readiness.wrong_type';
        }
        if ($level === 'pending') {
            $reasons[] = 'instance_readiness.pending';
        } elseif (in_array($level, ['internal', 'technical'], true)) {
            $reasons[] = 'instance_readiness.internal';
            $reasons[] = 'instance_readiness.publication_blocked';
        }
        if ($name === '' || in_array($name, ['outros', 'geral', 'diversos', 'nao informado', 'sem classificacao', 'a definir'], true)) {
            $reasons[] = 'instance_readiness.placeholder';
        }
        $slug = strtolower(trim((string) ($identity['slug'] ?? '')));
        if ($slug === '' || strlen($slug) > 80 || preg_match('/^[a-z0-9-]+$/', $slug) !== 1) {
            $reasons[] = 'instance_readiness.invalid_slug';
        }

        if (self::hasCycle($identity)) {
            $reasons[] = 'instance_readiness.cycle';
            $reasons[] = 'instance_readiness.invalid_taxonomy_chain';
        } elseif (self::hasOrphan($identity, $expectedLevel)) {
            $reasons[] = 'instance_readiness.orphan';
            $reasons[] = 'instance_readiness.invalid_taxonomy_chain';
        } elseif (!self::chainMatches($identity, $expectedLevel)) {
            $reasons[] = 'instance_readiness.wrong_parent_level';
            $reasons[] = 'instance_readiness.invalid_taxonomy_chain';
        }

        $ancestorReasons = self::ancestorReadinessReasons($identity, $expectedLevel);
        if ($ancestorReasons !== []) {
            array_push($reasons, ...$ancestorReasons);
            $reasons[] = 'instance_readiness.invalid_taxonomy_chain';
        }

        $reasons = array_values(array_unique($reasons));
        return [
            'status' => $reasons === [] ? 'READY' : 'NOT_READY',
            'reasonCodes' => $reasons,
        ];
    }

    /** @param array<string, mixed> $identity */
    private static function chainMatches(array $identity, string $expectedLevel): bool
    {
        $level = self::level($identity);
        if ($expectedLevel === 'materia') {
            return $level === 'materia' && (int) ($identity['own_parent_id'] ?? 0) === 0;
        }

        $parent = self::ancestor($identity, 'parent');
        if ($expectedLevel === 'topico') {
            return $level === 'topico'
                && self::isMatter($parent)
                && (int) ($parent['parent_id'] ?? 0) === 0;
        }

        if ($expectedLevel === 'subtopico') {
            $root = self::ancestor($identity, 'grandparent');
            return $level === 'subtopico'
                && self::level($parent) === 'topico'
                && self::isMatter($root)
                && (int) ($root['parent_id'] ?? 0) === 0;
        }

        if ($expectedLevel !== 'assunto' || $level !== 'assunto') {
            return false;
        }

        if (self::level($parent) !== 'subtopico') {
            return false;
        }

        $topic = self::ancestor($identity, 'grandparent');
        $root = self::ancestor($identity, 'great_grandparent');
        return self::level($topic) === 'topico'
            && self::isMatter($root)
            && (int) ($root['parent_id'] ?? 0) === 0;
    }

    /** @param array<string, mixed> $identity */
    private static function hasOrphan(array $identity, string $expectedLevel): bool
    {
        if ($expectedLevel === 'materia') return false;
        if ((int) ($identity['own_parent_id'] ?? 0) <= 0 || (int) ($identity['parent_id'] ?? 0) <= 0) return true;
        if ($expectedLevel === 'topico') return false;
        if ((int) ($identity['grandparent_id'] ?? 0) <= 0) return true;
        if ($expectedLevel === 'assunto' && self::level(self::ancestor($identity, 'parent')) === 'subtopico') {
            return (int) ($identity['great_grandparent_id'] ?? 0) <= 0;
        }
        return false;
    }

    /** @param array<string, mixed> $identity */
    private static function hasCycle(array $identity): bool
    {
        $ids = [];
        foreach (['id', 'own_parent_id', 'grandparent_id', 'great_grandparent_id'] as $field) {
            $id = (int) ($identity[$field] ?? 0);
            if ($id <= 0) continue;
            if (isset($ids[$id])) return true;
            $ids[$id] = true;
        }
        return false;
    }

    /** @param array<string, mixed> $identity @return list<string> */
    private static function ancestorReadinessReasons(array $identity, string $expectedLevel): array
    {
        $prefixes = match ($expectedLevel) {
            'topico' => ['parent'],
            'subtopico' => ['parent', 'grandparent'],
            'assunto' => ['parent', 'grandparent', 'great_grandparent'],
            default => [],
        };
        $reasons = [];
        foreach ($prefixes as $prefix) {
            $ancestor = self::ancestor($identity, $prefix);
            if ((int) ($ancestor['id'] ?? 0) <= 0) continue;
            $level = self::level($ancestor);
            if (($ancestor['type'] ?? '') !== 'assunto') {
                $reasons[] = 'instance_readiness.wrong_parent_level';
            }
            if ($level === 'pending') {
                $reasons[] = 'instance_readiness.pending';
            } elseif (in_array($level, ['internal', 'technical'], true)) {
                $reasons[] = 'instance_readiness.internal';
                $reasons[] = 'instance_readiness.publication_blocked';
            }
            $name = self::normalizeName((string) ($ancestor['name'] ?? ''));
            if ($name === '' || in_array($name, ['outros', 'geral', 'diversos', 'nao informado', 'sem classificacao', 'a definir'], true)) {
                $reasons[] = 'instance_readiness.placeholder';
            }
            $slug = strtolower(trim((string) ($ancestor['slug'] ?? '')));
            if ($slug === '' || strlen($slug) > 80 || preg_match('/^[a-z0-9-]+$/', $slug) !== 1) {
                $reasons[] = 'instance_readiness.invalid_slug';
            }
        }
        return array_values(array_unique($reasons));
    }

    /** @param array<string, mixed> $identity @return array<string, mixed> */
    private static function ancestor(array $identity, string $prefix): array
    {
        return [
            'id' => (int) ($identity[$prefix . '_id'] ?? 0),
            'parent_id' => (int) ($identity[$prefix . '_parent_id'] ?? 0),
            'type' => (string) ($identity[$prefix . '_type'] ?? ''),
            'taxonomy_level' => (string) ($identity[$prefix . '_taxonomy_level'] ?? ''),
            'meta_materia' => (int) ($identity[$prefix . '_meta_materia'] ?? 0),
            'slug' => (string) ($identity[$prefix . '_slug'] ?? ''),
            'name' => (string) ($identity[$prefix . '_name'] ?? ''),
        ];
    }

    /** @param array<string, mixed> $item */
    private static function isMatter(array $item): bool
    {
        return ($item['type'] ?? '') === 'assunto'
            && (self::level($item) === 'materia' || (int) ($item['meta_materia'] ?? 0) === 1);
    }

    /** @param array<string, mixed> $item */
    private static function level(array $item): string
    {
        if (($item['type'] ?? '') === 'assunto' && (int) ($item['meta_materia'] ?? 0) === 1) return 'materia';
        return strtolower(trim((string) ($item['taxonomy_level'] ?? '')));
    }

    private static function normalizeName(string $value): string
    {
        $value = trim(function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value));
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        $value = $ascii !== false ? $ascii : $value;
        return trim((string) preg_replace('/\s+/', ' ', $value));
    }

    private function __construct()
    {
    }
}
