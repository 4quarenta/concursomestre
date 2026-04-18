import type { Plan, UserSubscription } from '@types';

interface CalculateSubscriptionProRatedCreditInput {
  subscription?: UserSubscription | null;
  plans?: Plan[];
  nowMs?: number;
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseDateToMs = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Backend pode enviar timestamp em segundos.
    if (value > 0 && value < 1_000_000_000_000) {
      return value * 1000;
    }
    return value > 0 ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const resolveSubscriptionBaseAmount = (subscription: UserSubscription, plans: Plan[]) => {
  const subscriptionAsRecord = subscription as UserSubscription & Record<string, unknown>;
  const catalogPlan = plans.find((plan) => plan.id === Number(subscription.plan_id));
  const recurringAmount = Math.max(0, toNumber(subscription.recurring_amount, 0));
  const totalInstallments = Math.max(1, toNumber(subscription.total_installments, 1));

  const candidates = [
    toNumber(subscriptionAsRecord.price_snapshot, 0),
    toNumber(subscription.plan?.price, 0),
    toNumber(catalogPlan?.price, 0),
    recurringAmount > 0 && totalInstallments > 1 ? recurringAmount * totalInstallments : 0,
    recurringAmount,
  ];

  return candidates.find((amount) => amount > 0) || 0;
};

const isSubscriptionCreditEligible = (status?: string | null) => {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  return normalizedStatus === 'active'
    || normalizedStatus === 'trialing'
    || normalizedStatus === 'past_due';
};

/**
 * Calcula um preview local do credito proporcional de upgrade.
 * O backend continua sendo a fonte final no fechamento da cobranca.
 * @since v1.0.0
 */
export const calculateSubscriptionProRatedCredit = ({
  subscription,
  plans = [],
  nowMs = Date.now(),
}: CalculateSubscriptionProRatedCreditInput): number => {
  if (!subscription || !isSubscriptionCreditEligible(subscription.status)) {
    return 0;
  }

  const baseAmount = resolveSubscriptionBaseAmount(subscription, plans);
  if (baseAmount <= 0) {
    return 0;
  }

  const startMs = parseDateToMs(subscription.provider_current_period_start ?? subscription.current_period_start);
  const endMs = parseDateToMs(
    subscription.provider_current_period_end
      ?? subscription.current_period_end
      ?? subscription.next_billing_at,
  );

  if (!startMs || !endMs || endMs <= startMs || endMs <= nowMs) {
    return 0;
  }

  const totalDuration = endMs - startMs;
  const remainingDuration = Math.max(0, Math.min(totalDuration, endMs - nowMs));
  const credit = (baseAmount * remainingDuration) / totalDuration;

  return Math.max(0, Number(credit.toFixed(2)));
};
