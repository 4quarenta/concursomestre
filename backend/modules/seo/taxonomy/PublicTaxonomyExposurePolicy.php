<?php

declare(strict_types=1);

require_once __DIR__ . '/TaxonomyClassification.php';

/**
 * Decide somente se uma taxonomia pode atravessar a fronteira publica.
 * Promocao SEO, qualidade e indexabilidade continuam fora desta policy.
 */
final class PublicTaxonomyExposurePolicy
{
    /** @var list<string> */
    private array $blockedNames;

    public function __construct(?string $policyPath = null)
    {
        $path = $policyPath ?? dirname(__DIR__, 4) . '/config/seo/taxonomy-promotion-policy.v1.json';
        $decoded = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($decoded) || ($decoded['version'] ?? null) !== 'taxonomy-promotion-policy.v1') {
            throw new RuntimeException('Taxonomy Promotion Policy invalida para exposicao publica.');
        }
        $this->blockedNames = array_values(array_filter(array_map(
            fn (mixed $value): string => $this->normalize((string) $value),
            $decoded['blockedNames'] ?? []
        )));
    }

    /** @param array<string, mixed> $filter */
    public function allowsDiscipline(array $filter): bool
    {
        $classification = TaxonomyClassification::fromFilter($filter);
        $name = $this->normalize((string) ($filter['name'] ?? ''));
        $slug = trim((string) ($filter['slug'] ?? ''));

        return $classification['kind'] === 'materia'
            && $classification['pending'] === false
            && $name !== ''
            && !in_array($name, $this->blockedNames, true)
            && $slug !== ''
            && preg_match('/[\x00-\x1F\x7F\/\\?#]/u', $slug) !== 1;
    }

    private function normalize(string $value): string
    {
        $value = trim(function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value));
        if (class_exists('Transliterator')) {
            $transliterator = Transliterator::create('NFD; [:Nonspacing Mark:] Remove; NFC');
            $value = $transliterator?->transliterate($value) ?? $value;
        }
        return preg_replace('/\s+/u', ' ', $value) ?? $value;
    }
}
