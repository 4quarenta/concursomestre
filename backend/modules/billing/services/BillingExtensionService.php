<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../modules/benefits/services/BenefitService.php';
require_once __DIR__ . '/StripeBillingProviderAdapter.php';

/**
 * Orquestra a aplicacao de uma extensao: provider primeiro, estado local depois.
 */
final class BillingExtensionService
{
    public function __construct(
        private readonly PDO $db,
        private readonly ?BillingProviderAdapter $provider = null
    ) {
    }

    public function apply(string $grantId, string $actorId): array
    {
        $benefits = new BenefitService($this->db);
        $grant = $benefits->getGrant($grantId);
        if (!$grant) {
            throw new OutOfBoundsException('Grant de cobranca nao encontrado.');
        }
        if (strtoupper((string) ($grant['status'] ?? '')) === 'APPLIED') {
            return $grant;
        }
        if (!in_array(strtoupper((string) ($grant['status'] ?? '')), ['PENDING_PROVIDER', 'RECONCILIATION_REQUIRED'], true)) {
            throw new DomainException('Grant de cobranca nao esta pronto para aplicacao.');
        }

        $providerSubscription = $this->findProviderSubscription((string) $grant['user_id']);
        if (!$providerSubscription) {
            $benefits->markProviderFailure($grantId, $actorId, 'FAILED', 'Assinatura Stripe ativa nao encontrada.');
            throw new DomainException('Usuario nao possui assinatura Stripe elegivel para extensao.');
        }

        $localOldPeriodEnd = trim((string) ($providerSubscription['provider_current_period_end'] ?? $providerSubscription['current_period_end'] ?? ''));
        if (!$benefits->markProviderApplying($grantId, $actorId, $localOldPeriodEnd !== '' ? $localOldPeriodEnd : null)) {
            $latestGrant = $benefits->getGrant($grantId);
            if ($latestGrant && strtoupper((string) ($latestGrant['status'] ?? '')) === 'APPLIED') {
                return $latestGrant;
            }
            throw new DomainException('Grant de cobranca ja esta sendo processado por outra operacao.');
        }
        $providerRequestStarted = false;
        try {
            $configuredMode = resolveStripeKeyMode(STRIPE_SECRET_KEY);
            if ($configuredMode === '') {
                throw new RuntimeException('Modo da chave Stripe nao identificavel.');
            }
            $providerRequestStarted = true;
            $result = ($this->provider ?? new StripeBillingProviderAdapter())->extendExistingSubscription(
                (string) $providerSubscription['provider_subscription_id'],
                (int) $grant['billing_extension_days'],
                $grantId
            );
            $resultMode = !empty($result['livemode']) ? 'live' : 'test';
            if ($resultMode !== $configuredMode) {
                throw new DomainException('Resposta Stripe em modo diferente da chave configurada.');
            }

            return $benefits->confirmProviderBillingExtension(
                $grantId,
                (string) $result['provider_subscription_id'],
                gmdate('Y-m-d H:i:s', (int) $result['old_period_end']),
                gmdate('Y-m-d H:i:s', (int) $result['new_period_end']),
                $actorId
            );
        } catch (Throwable $error) {
            $benefits->markProviderFailure(
                $grantId,
                $actorId,
                $providerRequestStarted ? 'RECONCILIATION_REQUIRED' : 'FAILED',
                $error->getMessage()
            );
            throw $error;
        }
    }

    public function reconcile(string $grantId, string $actorId): array
    {
        $benefits = new BenefitService($this->db);
        $grant = $benefits->getGrant($grantId);
        if (!$grant) {
            throw new OutOfBoundsException('Grant de cobranca nao encontrado.');
        }
        if (strtoupper((string) ($grant['status'] ?? '')) === 'APPLIED') {
            return $grant;
        }
        if (strtoupper((string) ($grant['status'] ?? '')) !== 'RECONCILIATION_REQUIRED') {
            throw new DomainException('Grant nao esta aguardando reconciliacao.');
        }
        $providerSubscription = $this->findProviderSubscription((string) $grant['user_id']);
        if (!$providerSubscription) {
            throw new DomainException('Assinatura Stripe elegivel nao encontrada para reconciliacao.');
        }
        $facts = ($this->provider ?? new StripeBillingProviderAdapter())->inspectExistingSubscription(
            (string) $providerSubscription['provider_subscription_id']
        );
        $configuredMode = resolveStripeKeyMode(STRIPE_SECRET_KEY);
        $factsMode = !empty($facts['livemode']) ? 'live' : 'test';
        $oldPeriod = strtotime((string) ($grant['provider_old_period_end'] ?? ''));
        $newPeriod = (int) ($facts['current_period_end'] ?? 0);
        $expectedGrant = (string) ($facts['metadata']['benefit_extension_grant_id'] ?? '');
        if ($configuredMode === '' || $factsMode !== $configuredMode || $oldPeriod === false
            || $newPeriod < $oldPeriod + ((int) $grant['billing_extension_days'] * 86400)
            || $expectedGrant !== $grantId) {
            throw new DomainException('Fatos do provedor ainda nao comprovam a extensao solicitada.');
        }
        return $benefits->confirmProviderBillingExtension(
            $grantId,
            (string) $facts['provider_subscription_id'],
            gmdate('Y-m-d H:i:s', $oldPeriod),
            gmdate('Y-m-d H:i:s', $newPeriod),
            $actorId
        );
    }

    private function findProviderSubscription(string $userId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, provider_subscription_id, provider_customer_id, status, current_period_end, provider_current_period_end
             FROM user_subscriptions
             WHERE user_id = :user_id
               AND payment_provider = 'stripe'
               AND provider_subscription_id IS NOT NULL
               AND status IN ('active', 'trialing', 'past_due')
             ORDER BY id DESC
             LIMIT 1"
        );
        $stmt->execute([':user_id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }
}
