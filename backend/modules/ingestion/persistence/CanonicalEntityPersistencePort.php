<?php

declare(strict_types=1);

/**
 * Domain boundary used inside the ingestion transaction. Implementations must
 * use the same PDO transaction owned by the metadata repository.
 */
interface CanonicalEntityPersistencePort
{
    /** @return null|array<string,mixed> */
    public function loadPayload(string $domain, string $canonicalEntityId): ?array;

    /** @return array{canonicalEntityId:string,datasetChanged:bool} */
    public function persist(
        CanonicalIngestionItem $item,
        IngestionPlan $plan,
        string $canonicalEntityId,
    ): array;
}
