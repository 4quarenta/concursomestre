<?php

declare(strict_types=1);

/** Fixture-only adapter. It has no database dependency and never persists data. */
final class ArraySourceAdapter implements SourceAdapter
{
    /** @param list<array<string,mixed>> $items */
    public function __construct(private readonly string $provider, private readonly array $items)
    {
    }

    public function sourceProvider(): string
    {
        return $this->provider;
    }

    public function contractVersion(): string
    {
        return 'fixture-ingestion.v1';
    }

    public function fetchBatch(?string $cursor, int $limit): array
    {
        $offset = $cursor !== null && ctype_digit($cursor) ? (int) $cursor : 0;
        $batch = array_slice($this->items, $offset, max(1, min(1000, $limit)));
        $next = $offset + count($batch);
        return [
            'items' => array_map(fn (array $item): CanonicalIngestionItem => $this->normalize($item), $batch),
            'nextCursor' => $next < count($this->items) ? (string) $next : null,
            'hasMore' => $next < count($this->items),
        ];
    }

    public function normalize(array $rawItem): CanonicalIngestionItem
    {
        $rawItem['sourceProvider'] = $this->provider;
        return CanonicalIngestionItem::fromArray($rawItem);
    }
}
