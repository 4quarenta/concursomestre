<?php

declare(strict_types=1);

interface SourceAdapter
{
    public function sourceProvider(): string;

    public function contractVersion(): string;

    /** @return array{items:list<CanonicalIngestionItem>,nextCursor:?string,hasMore:bool} */
    public function fetchBatch(?string $cursor, int $limit): array;

    /** @param array<string,mixed> $rawItem */
    public function normalize(array $rawItem): CanonicalIngestionItem;
}
