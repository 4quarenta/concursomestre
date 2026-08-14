<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/contracts/SlugContractV1.php';

final class SeoSlugService
{
    public function slug(string $label, string $resourceType, string|int $resourceId): string
    {
        return SlugContractV1::generate($label, $resourceType, $resourceId);
    }
}
