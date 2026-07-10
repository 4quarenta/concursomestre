<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

require_once __DIR__ . '/../services/AdminAnalyticsService.php';

/**
 * Controller HTTP do analytics administrativo.
 *
 * @since 1.0.0
 */
class AdminAnalyticsController
{
    public function __construct(private readonly AdminAnalyticsService $service)
    {
    }

    public function finance(?string $period, ?string $startDate, ?string $endDate): array
    {
        return $this->service->getFinanceAnalytics($period, $startDate, $endDate);
    }

    public function sendBillingRiskEmail(array $payload): array
    {
        return $this->service->sendBillingRiskEmail($payload);
    }

    public function dashboard(?string $period, ?string $startDate, ?string $endDate): array
    {
        return $this->service->getDashboardAnalytics($period, $startDate, $endDate);
    }

    public function funnel(?string $period, ?string $startDate, ?string $endDate): array
    {
        return $this->service->getFunnelAnalytics($period, $startDate, $endDate);
    }

    public function segments(?string $period, ?string $startDate, ?string $endDate): array
    {
        return $this->service->getSegments($period, $startDate, $endDate);
    }

    public function exportFunnelLeads(?string $period, ?string $startDate, ?string $endDate): array
    {
        return $this->service->exportFunnelLeads($period, $startDate, $endDate);
    }

    public function exportSegments(?string $period, ?string $startDate, ?string $endDate, ?string $segmentKey = null): array
    {
        return $this->service->exportSegments($period, $startDate, $endDate, $segmentKey);
    }
}
