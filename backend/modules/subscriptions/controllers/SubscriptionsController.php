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

require_once __DIR__ . '/../services/SubscriptionsService.php';

/**
 * Controller HTTP do dominio de assinaturas.
 */
class SubscriptionsController
{
    private SubscriptionsService $service;

    public function __construct(SubscriptionsService $service)
    {
        $this->service = $service;
    }

    public function updateRenewal(string $userId, array $data): array
    {
        return $this->service->updateRenewal($userId, $data);
    }

    public function getCurrentUserBillingSnapshot(string $userId): array
    {
        return $this->service->getCurrentUserBillingSnapshot($userId);
    }

    public function createStripeCheckoutSession(string $userId, array $data): array
    {
        return $this->service->createStripeCheckoutSession($userId, $data);
    }

    public function buildAutomationHelperPayload(string $apiBaseUrl, string $cronSecret): array
    {
        return $this->service->buildAutomationHelperPayload($apiBaseUrl, $cronSecret);
    }

    public function buildAutomationBatchScript(string $cronUrl): string
    {
        return $this->service->buildAutomationBatchScript($cronUrl);
    }

    public function buildStripeTestingMatrixPayload(): array
    {
        return $this->service->buildStripeTestingMatrixPayload();
    }

    public function listStripeTestingRuns(int $limit = 80): array
    {
        return $this->service->listStripeTestingRuns($limit);
    }

    public function createStripeTestingRun(string $adminUserId, array $data): array
    {
        return $this->service->createStripeTestingRun($adminUserId, $data);
    }

    public function createStripeInlineSubscription(string $userId, array $data): array
    {
        return $this->service->createStripeInlineSubscription($userId, $data);
    }

    public function finalizeStripeSubscription(string $userId, array $data): array
    {
        return $this->service->finalizeStripeSubscription($userId, $data);
    }

    public function resolveStripePixCapability(bool $requestCapability = false): array
    {
        return $this->service->resolveStripePixCapability($requestCapability);
    }

    public function processStripeWebhook(string $payload, string $signature): array
    {
        return $this->service->processStripeWebhook($payload, $signature);
    }

    public function enqueueStripeWebhook(string $payload, string $signature): array
    {
        return $this->service->enqueueStripeWebhook($payload, $signature);
    }

    public function processNextQueuedStripeWebhook(): ?array
    {
        return $this->service->processNextQueuedStripeWebhook();
    }

    public function validateCoupon(array $data): ?array
    {
        return $this->service->validateCoupon($data);
    }

    public function createStripePortalSession(string $userId): array
    {
        return $this->service->createStripePortalSession($userId);
    }

    public function cancelSubscription(string $userId, array $data): array
    {
        return $this->service->cancelSubscription($userId, $data);
    }

    public function cancelRefundRequest(string $userId): array
    {
        return $this->service->cancelRefundRequest($userId);
    }

    public function undoCancellationRequest(string $userId): array
    {
        return $this->service->undoCancellationRequest($userId);
    }

    public function runStripeReconciliationCron(): array
    {
        return $this->service->runStripeReconciliationCron();
    }

    public function syncCurrentUserStripeState(string $userId): array
    {
        return $this->service->syncCurrentUserStripeState($userId);
    }

    public function syncStripeRenewalProjectionsAfterPricingChange(): array
    {
        return $this->service->syncStripeRenewalProjectionsAfterPricingChange();
    }
}
