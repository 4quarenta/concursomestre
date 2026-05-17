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

import type { DiscountCode, Plan, PlanConfig, PlanPricing, PlanName } from '@types';
import { getCanonicalPlanName } from './planAccess';
import { resolvePlanAutoCouponsById } from './planAutoCoupon';

type CanonicalPlanName = 'Gratuito' | 'Essencial' | 'Pro' | 'Elite';

interface ResolvedPlanOfferInput {
  plan: Plan;
  pricing?: Partial<Record<CanonicalPlanName, PlanPricing>> | null;
  planDetails?: Partial<Record<CanonicalPlanName, PlanConfig>> | null;
  discountAmount?: number;
}

export interface ResolvedPlanOffer {
  hasDiscount: boolean;
  originalMonthlyAmount: number;
  discountedMonthlyAmount: number;
  originalCycleAmount: number;
  discountedCycleAmount: number;
  cycleCount: number;
  cycleLabel: string;
  effectiveDiscountPercent: number;
  displayName: string;
}

export type PlanBillingCycleKey = 'monthly' | 'quarterly' | 'annual';
export type PlanDiscountBadgeMap = Record<PlanBillingCycleKey, number>;

const getCycleCount = (plan: Plan) => {
  if (plan.interval_unit === 'year') {
    return 12;
  }

  if (plan.interval_unit === 'month' && Number(plan.interval_count || 1) > 0) {
    return Number(plan.interval_count || 1);
  }

  if ((plan.interval_unit === 'day' || plan.interval_unit === 'week') && Number(plan.interval_count || 1) > 0) {
    return Number(plan.interval_count || 1);
  }

  return 1;
};

const toCents = (value: number) => Math.max(0, Math.round(Number(value || 0) * 100));
const fromCents = (value: number) => Number((Math.max(0, value) / 100).toFixed(2));

/**
 * Mantem ofertas de termos longos iguais ao Stripe: parcela mensal em centavos e total = parcela x ciclos.
 * @since v1.0.0
 */
const resolveCanonicalTermAmounts = (cycleAmount: number, cycleCount: number) => {
  const cycleCents = toCents(cycleAmount);

  if (cycleCount <= 1 || cycleCents <= 0) {
    return {
      monthlyAmount: fromCents(cycleCents),
      cycleAmount: fromCents(cycleCents),
    };
  }

  const monthlyCents = Math.max(1, Math.floor(cycleCents / cycleCount));
  return {
    monthlyAmount: fromCents(monthlyCents),
    cycleAmount: fromCents(monthlyCents * cycleCount),
  };
};

const getConfiguredCycleAmount = (
  plan: Plan,
  configuredPricing?: PlanPricing | null,
) => {
  if (!configuredPricing) {
    return Number(plan.price || 0);
  }

  if (plan.interval_unit === 'year') {
    return Number(configuredPricing.annual || 0);
  }

  if (plan.interval_unit === 'month' && Number(plan.interval_count || 1) === 3) {
    return Number(configuredPricing.quarterly || 0);
  }

  if (plan.interval_unit !== 'month') {
    return Number(plan.price || 0);
  }

  return Number(configuredPricing.monthly || 0);
};

export const resolvePlanCycleKey = (plan: Plan): PlanBillingCycleKey | null => {
  if (plan.interval_unit === 'year') {
    return 'annual';
  }

  if (plan.interval_unit === 'month' && Number(plan.interval_count || 1) === 3) {
    return 'quarterly';
  }

  if (plan.interval_unit === 'month' && Number(plan.interval_count || 1) === 1) {
    return 'monthly';
  }

  return null;
};

const getCycleLabel = (plan: Plan, cycleCount: number) => {
  if (plan.interval_unit === 'day') {
    return cycleCount <= 1 ? 'dia' : `${cycleCount} dias`;
  }

  if (plan.interval_unit === 'week') {
    return cycleCount <= 1 ? 'semana' : `${cycleCount} semanas`;
  }

  if (cycleCount === 12) {
    return 'ano';
  }

  if (cycleCount === 3) {
    return 'cada 3 meses';
  }

  return 'mes';
};

export const resolvePlanOffer = ({
  plan,
  pricing,
  planDetails,
  discountAmount = 0,
}: ResolvedPlanOfferInput): ResolvedPlanOffer => {
  const canonicalPlan = getCanonicalPlanName(plan.name);
  const configuredPricing = pricing?.[canonicalPlan];
  const configuredDisplayName = planDetails?.[canonicalPlan]?.displayName?.trim();
  const cycleCount = getCycleCount(plan);
  const fallbackCycleAmount = Number(plan.price || 0);
  const configuredCycleAmount = getConfiguredCycleAmount(plan, configuredPricing);
  const originalCycleAmount = Math.max(
    0,
    configuredCycleAmount > 0 ? configuredCycleAmount : fallbackCycleAmount,
  );
  const originalAmounts = resolveCanonicalTermAmounts(originalCycleAmount, cycleCount);

  // Usa a mesma base do valor original para evitar "1% OFF" fantasma por mismatch de origem.
  const safeDiscountAmount = Math.min(
    originalCycleAmount,
    Math.max(0, Number(discountAmount || 0)),
  );
  const rawDiscountedCycleAmount = Math.max(0, originalCycleAmount - safeDiscountAmount);
  const discountedAmounts = resolveCanonicalTermAmounts(rawDiscountedCycleAmount, cycleCount);
  const originalMonthlyAmount = originalAmounts.monthlyAmount;
  const discountedCycleAmount = discountedAmounts.cycleAmount;
  const discountedMonthlyAmount = discountedAmounts.monthlyAmount;
  const effectiveDiscountPercent = originalCycleAmount > 0
    ? Math.max(0, Math.round(((originalCycleAmount - discountedCycleAmount) / originalCycleAmount) * 100))
    : 0;
  const hasDiscount = safeDiscountAmount > 0
    && originalCycleAmount > 0
    && discountedCycleAmount < originalCycleAmount
    && effectiveDiscountPercent > 0;

  return {
    hasDiscount,
    originalMonthlyAmount,
    discountedMonthlyAmount,
    originalCycleAmount,
    discountedCycleAmount,
    cycleCount,
    cycleLabel: getCycleLabel(plan, cycleCount),
    effectiveDiscountPercent,
    displayName: configuredDisplayName || plan.name,
  };
};

interface ResolvePlanDiscountBadgesByCycleInput {
  plans: Plan[];
  canonicalPlanName: PlanName;
  coupons?: DiscountCode[] | null;
  pricing?: Partial<Record<PlanName, PlanPricing>> | null;
  planDetails?: Partial<Record<PlanName, PlanConfig>> | null;
}

/**
 * Resolve o percentual efetivo de desconto por ciclo para alimentar seletores de mensal/trimestral/anual.
 * @since v1.0.0
 */
export const resolvePlanDiscountBadgesByCycle = ({
  plans,
  canonicalPlanName,
  coupons,
  pricing,
  planDetails,
}: ResolvePlanDiscountBadgesByCycleInput): PlanDiscountBadgeMap => {
  const initialMap: PlanDiscountBadgeMap = {
    monthly: 0,
    quarterly: 0,
    annual: 0,
  };

  const matchingPlans = plans.filter((plan) => getCanonicalPlanName(plan.name) === canonicalPlanName);
  if (matchingPlans.length === 0) {
    return initialMap;
  }

  const autoCouponsByPlanId = resolvePlanAutoCouponsById(matchingPlans, coupons || []);

  return matchingPlans.reduce<PlanDiscountBadgeMap>((accumulator, plan) => {
    const cycleKey = resolvePlanCycleKey(plan);
    if (!cycleKey) {
      return accumulator;
    }

    const offer = resolvePlanOffer({
      plan,
      pricing,
      planDetails,
      discountAmount: autoCouponsByPlanId[plan.id]?.discountAmount || 0,
    });

    accumulator[cycleKey] = offer.hasDiscount ? offer.effectiveDiscountPercent : 0;
    return accumulator;
  }, initialMap);
};
