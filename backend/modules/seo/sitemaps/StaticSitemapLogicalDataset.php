<?php

declare(strict_types=1);

final class StaticSitemapLogicalDataset
{
    public const VERSION = 'eligible-sitemap-dataset.v2';

    /** @var array<string, array<string, string|null>> */
    private array $records = [];

    /** @param array<string, mixed> $record */
    public function add(array $record): void
    {
        $family = trim((string) ($record['family'] ?? ''));
        $identity = trim((string) ($record['identity'] ?? ''));
        $canonicalUrl = trim((string) ($record['canonicalUrl'] ?? ''));
        $lastModified = self::normalizeLastModified($record['lastModified'] ?? null);
        $policyVersion = trim((string) ($record['policyVersion'] ?? ''));

        if ($family === '' || $identity === '' || $policyVersion === '') {
            throw new InvalidArgumentException('Registro logico de sitemap sem identidade autoritativa.');
        }
        $parts = parse_url($canonicalUrl);
        if (!is_array($parts)
            || ($parts['scheme'] ?? null) !== 'https'
            || strtolower((string) ($parts['host'] ?? '')) !== 'concursomestre.com'
            || isset($parts['query'])
            || isset($parts['fragment'])) {
            throw new InvalidArgumentException('Canonical invalido no dataset logico de sitemap.');
        }

        $key = $family . "\0" . $identity;
        $normalized = [
            'family' => $family,
            'identity' => $identity,
            'canonicalUrl' => $canonicalUrl,
            'lastModified' => $lastModified,
            'policyVersion' => $policyVersion,
        ];
        if (isset($this->records[$key]) && $this->records[$key] !== $normalized) {
            throw new LogicException('Uma identidade de sitemap produziu canonicals divergentes.');
        }
        $this->records[$key] = $normalized;
    }

    /** @return list<array<string, string|null>> */
    public function records(): array
    {
        ksort($this->records, SORT_STRING);
        return array_values($this->records);
    }

    public function fingerprint(): string
    {
        $context = hash_init('sha256');
        hash_update($context, self::VERSION . "\n");
        foreach ($this->records() as $record) {
            hash_update($context, json_encode($record, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n");
        }
        return hash_final($context);
    }

    public function count(): int
    {
        return count($this->records);
    }

    private static function normalizeLastModified(mixed $value): ?string
    {
        if (!is_scalar($value) || trim((string) $value) === '') {
            return null;
        }
        $timestamp = strtotime((string) $value);
        return $timestamp === false ? null : gmdate('Y-m-d', $timestamp);
    }
}
