<?php

declare(strict_types=1);

/** Central registry of payload contracts; it is intentionally not a DTO for every domain. */
final class IngestionContractRegistry
{
    /** @var array<string,DomainIngestionContract> */
    private array $contracts = [];

    public function __construct(?array $contracts = null)
    {
        $contracts ??= [
            new GenericDomainIngestionContract('question', ['statement', 'content']),
            new GenericDomainIngestionContract('exam', ['title', 'name']),
            new GenericDomainIngestionContract('contest', ['title', 'name']),
            new GenericDomainIngestionContract('news', ['title']),
            new GenericDomainIngestionContract('material', ['title', 'name']),
            new GenericDomainIngestionContract('law', ['title', 'name']),
            new GenericDomainIngestionContract('taxonomy', ['name', 'slug']),
        ];
        foreach ($contracts as $contract) {
            if (!$contract instanceof DomainIngestionContract) {
                throw new InvalidArgumentException('Contrato de dominio invalido.');
            }
            $this->contracts[$contract->domain()] = $contract;
        }
    }

    public function get(string $domain): DomainIngestionContract
    {
        $contract = $this->contracts[strtolower(trim($domain))] ?? null;
        if (!$contract instanceof DomainIngestionContract) {
            throw new DomainException('Dominio de ingestao nao autorizado.');
        }
        return $contract;
    }

    /** @return list<string> */
    public function validate(CanonicalIngestionItem $item): array
    {
        $contract = $this->get($item->domain);
        $errors = $contract->validate($item->payload);
        if (strlen(json_encode($item->payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)) > 15_000_000) {
            $errors[] = 'payload_too_large';
        }
        return array_values(array_unique($errors));
    }
}

final class GenericDomainIngestionContract implements DomainIngestionContract
{
    public function __construct(
        private readonly string $domainName,
        private readonly array $requiredAlternatives,
    ) {
    }

    public function domain(): string
    {
        return $this->domainName;
    }

    public function contractVersion(): string
    {
        return $this->domainName . '-ingestion.v1';
    }

    public function validate(array $payload): array
    {
        if ($payload === []) {
            return ['empty_payload'];
        }
        foreach ($this->requiredAlternatives as $field) {
            if (array_key_exists($field, $payload) && $payload[$field] !== '' && $payload[$field] !== []) {
                return [];
            }
        }
        return ['missing_domain_identity_fields'];
    }

    public function fieldOwnership(): array
    {
        return [
            'slug' => 'SYSTEM_OWNED',
            'id' => 'SYSTEM_OWNED',
            'source' => 'SOURCE_OWNED',
            'description' => 'EDITORIAL_OWNED',
            'taxonomy' => 'DERIVED',
        ];
    }
}
