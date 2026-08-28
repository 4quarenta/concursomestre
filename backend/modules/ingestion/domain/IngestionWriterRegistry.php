<?php

declare(strict_types=1);

/** Explicit allowlist for source adapters allowed to enter the canonical core. */
final class IngestionWriterRegistry
{
    /** @var array<string,true> */
    private array $writers = [];

    /** @param list<string> $writerIds */
    public function __construct(array $writerIds)
    {
        foreach ($writerIds as $writerId) {
            $normalized = strtolower(trim($writerId));
            if ($normalized === '' || preg_match('/^[a-z0-9][a-z0-9_.:-]{0,79}$/', $normalized) !== 1) {
                throw new InvalidArgumentException('Writer de ingestao invalido.');
            }
            $this->writers[$normalized] = true;
        }
    }

    public function isAuthorized(string $writerId): bool
    {
        return isset($this->writers[strtolower(trim($writerId))]);
    }
}
