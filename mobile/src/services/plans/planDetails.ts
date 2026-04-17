import type { Plan } from '@/types/plans';
import type { MobilePlanDetailsMap } from '@/types/system';
import type { MobilePlanName } from '@/types/system';
import type { MobilePlanPricingMap } from '@/types/system';

const normalizePlanNameKey = (value: string): string => {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

export const resolveCanonicalPlanKey = (planName: string): string | null => {
  const normalized = normalizePlanNameKey(planName);
  if (!normalized) return null;

  if (normalized.includes('gratuito') || normalized.includes('free')) return 'Gratuito';
  if (normalized.includes('essencial')) return 'Essencial';
  if (normalized.includes('elite')) return 'Elite';
  if (normalized.includes('pro')) return 'Pro';
  return null;
};

export const resolvePlanDetail = (
  planName: string,
  planDetails: MobilePlanDetailsMap,
) => {
  if (planDetails[planName]) return planDetails[planName];

  const canonicalKey = resolveCanonicalPlanKey(planName);
  if (!canonicalKey) return undefined;

  return (
    planDetails[canonicalKey]
    || planDetails[canonicalKey.toLowerCase()]
    || planDetails[canonicalKey.toUpperCase()]
  );
};

export const isPlanEnabledByName = (
  planName: string,
  planDetails: MobilePlanDetailsMap,
): boolean => {
  const detail = resolvePlanDetail(planName, planDetails);
  if (!detail) return true;
  return detail.enabled !== false;
};

export const resolveConfiguredPlanDisplayName = (
  planName: string,
  planDetails: MobilePlanDetailsMap,
): string => {
  const detail = resolvePlanDetail(planName, planDetails);
  const configuredName = String(detail?.displayName || '').trim();
  return configuredName || planName;
};

export const resolveConfiguredPlanCycleAmount = (
  plan: Pick<Plan, 'name' | 'price' | 'interval_count' | 'interval_unit'>,
  pricing: MobilePlanPricingMap,
): number => {
  const canonicalKey = resolveCanonicalPlanKey(String(plan.name || '')) as MobilePlanName | null;
  const configuredPricing = canonicalKey ? pricing[canonicalKey] : undefined;

  if (!configuredPricing) {
    return Number(plan.price || 0);
  }

  if (plan.interval_unit === 'year') {
    return Number(configuredPricing.annual || plan.price || 0);
  }

  if (plan.interval_unit === 'month' && Number(plan.interval_count || 1) === 3) {
    return Number(configuredPricing.quarterly || plan.price || 0);
  }

  return Number(configuredPricing.monthly || plan.price || 0);
};
