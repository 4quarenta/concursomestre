<?php

declare(strict_types=1);

/** Readiness estrutural de Carreira e Cargo, sem gates de volume. */
final class ProfessionalTaxonomyReadinessValidator
{
    private const TYPES = ['career' => 'carreira', 'position' => 'cargo'];
    private const BLOCKED_NAMES = [
        'outros', 'outras', 'diversos', 'diversas', 'geral', 'nao informado',
        'sem classificacao', 'a definir', 'cargo nao identificado',
    ];

    /** @param array<string,mixed> $identity @return array{status:string,reasonCodes:list<string>} */
    public static function evaluate(array $identity, string $kind): array
    {
        $reasons = [];
        $expectedType = self::TYPES[$kind] ?? '';
        $type = strtolower(trim((string) ($identity['type'] ?? '')));
        $level = strtolower(trim((string) ($identity['taxonomy_level'] ?? '')));
        $name = self::normalize((string) ($identity['name'] ?? ''));
        $slug = trim((string) ($identity['slug'] ?? ''));

        if ($expectedType === '' || $type !== $expectedType) $reasons[] = 'instance_readiness.wrong_type';
        if (in_array($level, ['pending', 'internal', 'technical'], true)) $reasons[] = 'instance_readiness.publication_blocked';
        if ($name === '') $reasons[] = 'instance_readiness.missing_identity';
        if (in_array($name, self::BLOCKED_NAMES, true)) $reasons[] = 'instance_readiness.placeholder';
        if ($slug === '' || strlen($slug) > 190 || preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) !== 1) {
            $reasons[] = 'instance_readiness.invalid_slug';
        }
        if ((int) ($identity['canonical_slug_count'] ?? 1) > 1) $reasons[] = 'instance_readiness.duplicate_canonical_slug';
        foreach (['orphan_relation', 'invalid_relation', 'nonpublic_relation'] as $relationReason) {
            if (($identity[$relationReason] ?? false) === true) $reasons[] = 'instance_readiness.' . $relationReason;
        }

        $reasons = array_values(array_unique($reasons));
        return ['status' => $reasons === [] ? 'READY' : 'NOT_READY', 'reasonCodes' => $reasons];
    }

    private static function normalize(string $value): string
    {
        $value = trim(function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value));
        if (class_exists('Transliterator')) {
            $transliterator = Transliterator::create('NFD; [:Nonspacing Mark:] Remove; NFC');
            $value = $transliterator?->transliterate($value) ?? $value;
        }
        $value = strtr($value, [
            'á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a',
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i',
            'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o',
            'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u', 'ç' => 'c',
        ]);
        return preg_replace('/\s+/u', ' ', $value) ?? $value;
    }
}
