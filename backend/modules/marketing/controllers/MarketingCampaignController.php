<?php

declare(strict_types=1);

final class MarketingCampaignController
{
    public function __construct(private readonly MarketingCampaignService $service)
    {
    }

    public function campaigns(?string $search, ?string $status): array { return $this->service->listCampaigns($search, $status); }
    public function segments(?string $search): array { return $this->service->listSegments($search); }
    public function evaluateSegment(string $id, ?string $userId): array { return $this->service->evaluateSegment($id, $userId); }
    public function publicCampaigns(?string $userId = null, ?string $sessionKey = null): array { return $this->service->listPublicCampaigns($userId, $sessionKey); }
    public function saveCampaign(array $payload, string $adminUserId): array { return $this->service->saveCampaign($payload, $adminUserId); }
    public function saveSegment(array $payload, string $adminUserId): array { return $this->service->saveSegment($payload, $adminUserId); }
    public function transition(string $id, string $status, string $adminUserId): array { return $this->service->transition($id, $status, $adminUserId); }
    public function interaction(array $payload, ?string $userId): array { return $this->service->recordInteraction($payload, $userId); }
    public function analytics(string $id): array { return $this->service->analytics($id); }
    public function grantBenefit(string $id, string $userId, array $payload, string $adminUserId): array { return $this->service->grantCampaignBenefit($id, $userId, $payload, $adminUserId); }
    public function delete(string $id): void { $this->service->delete($id); }
}
