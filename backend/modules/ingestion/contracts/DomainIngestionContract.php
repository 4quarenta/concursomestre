<?php

declare(strict_types=1);

interface DomainIngestionContract
{
    public function domain(): string;

    public function contractVersion(): string;

    /** @param array<string,mixed> $payload @return list<string> */
    public function validate(array $payload): array;

    /** @return array<string,string> */
    public function fieldOwnership(): array;
}
