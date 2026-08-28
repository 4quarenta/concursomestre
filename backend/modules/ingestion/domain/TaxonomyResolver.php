<?php

declare(strict_types=1);

/**
 * Resolver boundary. Unknown or ambiguous taxonomy never becomes a silent
 * canonical insert; the callback is the only place allowed to consult the DB.
 */
final class TaxonomyResolver
{
    private $resolver;

    /** @param null|callable(array<string,mixed>):string $resolver */
    public function __construct(?callable $resolver = null)
    {
        $this->resolver = $resolver;
    }

    /** @param array<string,mixed> $reference @return array{decision:string,canonicalId:?string,reason:?string} */
    public function resolve(array $reference): array
    {
        if ($this->resolver !== null) {
            $decision = TaxonomyResolutionPolicy::resolve((string) ($this->resolver)($reference));
            $canonicalId = match ($decision) {
                TaxonomyResolutionPolicy::EXACT_MATCH => trim((string) ($reference['canonicalId'] ?? '')),
                TaxonomyResolutionPolicy::ALIAS_MATCH => trim((string) ($reference['aliasOf'] ?? '')),
                default => null,
            };
            return ['decision' => $decision, 'canonicalId' => $canonicalId !== '' ? $canonicalId : null, 'reason' => null];
        }
        if (isset($reference['canonicalId']) && trim((string) $reference['canonicalId']) !== '') {
            return ['decision' => TaxonomyResolutionPolicy::EXACT_MATCH, 'canonicalId' => trim((string) $reference['canonicalId']), 'reason' => null];
        }
        if (isset($reference['aliasOf']) && trim((string) $reference['aliasOf']) !== '') {
            return ['decision' => TaxonomyResolutionPolicy::ALIAS_MATCH, 'canonicalId' => trim((string) $reference['aliasOf']), 'reason' => null];
        }
        return ['decision' => TaxonomyResolutionPolicy::REVIEW_REQUIRED, 'canonicalId' => null, 'reason' => 'unknown_taxonomy'];
    }

    /** @param list<array<string,mixed>> $references @return list<array{decision:string,canonicalId:?string,reason:?string}> */
    public function resolveMany(array $references): array
    {
        return array_map(fn (array $reference): array => $this->resolve($reference), $references);
    }
}
