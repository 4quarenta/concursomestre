<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../config/stripe.php';
require_once __DIR__ . '/BillingProviderAdapter.php';

/**
 * Adaptador Stripe para extensoes de periodo de assinaturas existentes.
 * A extensao usa trial_end, sem alterar o preco nem emitir prorata.
 */
final class StripeBillingProviderAdapter implements BillingProviderAdapter
{
    public function inspectExistingSubscription(string $subscriptionId): array
    {
        if (!stripeIsConfigured()) {
            throw new RuntimeException('Stripe nao configurado para reconciliacao de cobranca.');
        }

        $subscription = getStripeClient()->subscriptions->retrieve($subscriptionId, [
            'expand' => ['latest_invoice.lines.data'],
        ]);
        $metadataValue = $subscription->metadata ?? null;
        $metadata = [];
        foreach (['benefit_extension_grant_id', 'benefit_extension_days'] as $key) {
            if (is_array($metadataValue)) {
                $value = $metadataValue[$key] ?? null;
            } elseif (is_object($metadataValue)) {
                $value = $metadataValue->$key ?? null;
            } else {
                $value = null;
            }
            if (is_scalar($value)) {
                $metadata[$key] = (string) $value;
            }
        }
        return [
            'provider_subscription_id' => (string) ($subscription->id ?? $subscriptionId),
            'livemode' => !empty($subscription->livemode),
            'status' => strtolower(trim((string) ($subscription->status ?? ''))),
            'current_period_end' => self::periodEnd($subscription),
            'metadata' => array_filter($metadata, static fn($value): bool => is_scalar($value)),
        ];
    }

    public function extendExistingSubscription(string $subscriptionId, int $days, string $grantId): array
    {
        if ($days < 1 || $days > 366) {
            throw new InvalidArgumentException('Quantidade de dias de cobranca invalida.');
        }
        if (!stripeIsConfigured()) {
            throw new RuntimeException('Stripe nao configurado para extensao de cobranca.');
        }

        $stripe = getStripeClient();
        $subscription = $stripe->subscriptions->retrieve($subscriptionId, [
            'expand' => ['items.data.price', 'latest_invoice.lines.data'],
        ]);
        $oldPeriodEnd = self::periodEnd($subscription);
        $status = strtolower(trim((string) ($subscription->status ?? '')));
        $trialEnd = (int) ($subscription->trial_end ?? 0);

        if ($oldPeriodEnd <= time()) {
            throw new DomainException('A assinatura nao possui periodo futuro para estender.');
        }
        if (!in_array($status, ['active', 'past_due'], true)) {
            throw new DomainException('O estado atual da assinatura nao permite extensao segura.');
        }
        if ($trialEnd > time()) {
            throw new DomainException('Assinatura ja possui trial futuro; a extensao deve ser reconciliada separadamente.');
        }
        if (!empty($subscription->cancel_at_period_end)) {
            throw new DomainException('Assinatura marcada para cancelamento no fim do periodo.');
        }

        $newPeriodEnd = $oldPeriodEnd + ($days * 86400);
        $updated = $stripe->subscriptions->update($subscriptionId, [
            'trial_end' => $newPeriodEnd,
            'proration_behavior' => 'none',
            'metadata' => [
                'benefit_extension_grant_id' => $grantId,
                'benefit_extension_days' => (string) $days,
            ],
        ], [
            'idempotency_key' => 'benefit_extension_' . $grantId,
        ]);

        $confirmedPeriodEnd = self::periodEnd($updated);
        if ($confirmedPeriodEnd < $newPeriodEnd) {
            throw new RuntimeException('Stripe nao confirmou o periodo minimo da extensao.');
        }

        return [
            'provider_subscription_id' => (string) ($updated->id ?? $subscriptionId),
            'livemode' => !empty($updated->livemode),
            'status' => strtolower(trim((string) ($updated->status ?? 'trialing'))),
            'old_period_end' => $oldPeriodEnd,
            'new_period_end' => $confirmedPeriodEnd,
        ];
    }

    /** Stripe pode expor o periodo no item em versoes recentes da API. */
    private static function periodEnd($subscription): int
    {
        $direct = $subscription->current_period_end ?? null;
        if (is_numeric($direct) && (int) $direct > 0) {
            return (int) $direct;
        }

        $items = $subscription->items->data ?? [];
        if (is_iterable($items)) {
            foreach ($items as $item) {
                $itemEnd = $item->current_period_end ?? null;
                if (is_numeric($itemEnd) && (int) $itemEnd > 0) {
                    return (int) $itemEnd;
                }
            }
        }

        $latestInvoice = $subscription->latest_invoice ?? null;
        $lineItems = $latestInvoice->lines->data ?? [];
        if (is_iterable($lineItems)) {
            foreach ($lineItems as $lineItem) {
                $lineEnd = $lineItem->period->end ?? null;
                if (is_numeric($lineEnd) && (int) $lineEnd > 0) {
                    return (int) $lineEnd;
                }
            }
        }

        $trialEnd = $subscription->trial_end ?? null;
        return is_numeric($trialEnd) ? (int) $trialEnd : 0;
    }
}
