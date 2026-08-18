<?php

declare(strict_types=1);

require_once __DIR__ . '/TaxonomyClassification.php';

/**
 * Reune evidencias internas para promocao futura. Nao altera SeoDecision,
 * sitemap ou runtime e permanece bloqueado enquanto a calibracao for ausente.
 */
final class TaxonomyPromotionEligibility
{
    /** @var array<string, mixed> */
    private array $policy;

    public function __construct(?string $policyPath = null)
    {
        $path = $policyPath ?? dirname(__DIR__, 4) . '/config/seo/taxonomy-promotion-policy.v1.json';
        $decoded = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($decoded) || ($decoded['version'] ?? null) !== 'taxonomy-promotion-policy.v1') {
            throw new RuntimeException('Taxonomy Promotion Policy invalida.');
        }
        if (($decoded['enforcement'] ?? null) !== false) {
            throw new RuntimeException('Taxonomy Promotion Policy deve permanecer sem enforcement.');
        }
        $this->policy = $decoded;
    }

    /**
     * @param array<string, mixed> $filter
     * @param array<string, mixed> $evidence
     * @return array{promotable:bool,reasonCodes:list<string>,classification:array<string,mixed>}
     */
    public function evaluate(array $filter, array $evidence = []): array
    {
        $classification = TaxonomyClassification::fromFilter($filter);
        $slug = trim((string) ($filter['slug'] ?? ''));
        $name = $this->normalize((string) ($filter['name'] ?? ''));
        $maxLength = (int) ($this->policy['slug']['maxLength'] ?? 80);
        $pattern = '~' . (string) ($this->policy['slug']['pattern'] ?? '^[a-z0-9]+(?:-[a-z0-9]+)*$') . '~';
        $reasons = [];

        if ($slug === '' || preg_match($pattern, $slug) !== 1) {
            $reasons[] = 'taxonomy.slug_invalid';
        }
        if ($this->length($slug) > $maxLength) {
            $reasons[] = 'taxonomy.slug_too_long';
        }
        $blockedNames = array_map(fn (mixed $value): string => $this->normalize((string) $value), $this->policy['blockedNames'] ?? []);
        if ($name === '' || in_array($name, $blockedNames, true)) {
            $reasons[] = 'taxonomy.placeholder';
        }
        if ($classification['pending']) {
            $reasons[] = 'taxonomy.pending';
        }
        if ($classification['routeFamily'] === null) {
            $reasons[] = 'taxonomy.route_not_available';
        }
        if (($classification['parentRequired'] ?? false) && empty($filter['parent_id'])) {
            $reasons[] = 'taxonomy.invalid_hierarchy';
        }
        if (($evidence['calibrationAvailable'] ?? false) !== true) {
            $reasons[] = 'taxonomy.calibration_required';
        }

        return [
            'promotable' => $reasons === [],
            'reasonCodes' => array_values(array_unique($reasons)),
            'classification' => $classification,
        ];
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

    private function length(string $value): int
    {
        return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
    }
}
