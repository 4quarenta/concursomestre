<?php

declare(strict_types=1);

require_once __DIR__ . '/ProfessionalTaxonomiesService.php';

final class ProfessionalTaxonomiesController
{
    public function __construct(private readonly ProfessionalTaxonomiesService $service) {}

    public function directory(string $kind, int $page, int $limit, string $search, string $letter): array
    {
        return $this->service->directory($kind, $page, $limit, $search, $letter);
    }

    public function detail(string $kind, string $slug): ?array
    {
        return $this->service->detail($kind, $slug);
    }
}
