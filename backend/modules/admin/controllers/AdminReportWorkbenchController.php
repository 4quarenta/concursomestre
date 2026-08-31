<?php

require_once __DIR__ . '/../services/AdminReportWorkbenchService.php';

class AdminReportWorkbenchController
{
    public function __construct(private readonly AdminReportWorkbenchService $service)
    {
    }

    public function review(string $moderatorUserId, string $reportId): array
    {
        return $this->service->review($moderatorUserId, $reportId);
    }

    public function saveDraft(string $moderatorUserId, array $payload): array
    {
        return $this->service->saveDraft($moderatorUserId, $payload);
    }

    public function generateSuggestion(string $moderatorUserId, array $payload): array
    {
        return $this->service->generateSuggestion($moderatorUserId, $payload);
    }

    public function apply(string $moderatorUserId, array $payload): array
    {
        return $this->service->apply($moderatorUserId, $payload);
    }
}
