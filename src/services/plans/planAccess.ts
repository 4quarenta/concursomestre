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

import {
  PlanBenefitKey,
  PlanBenefitMatrix,
  PlanEntitlements,
  UserProfile,
} from '@types';
import {
  DEFAULT_PLAN_ENTITLEMENTS,
  PLAN_ORDER,
  normalizePlanEntitlements,
} from '@constants/subscriptions/planEntitlements';

export type CanonicalPlanName = 'Gratuito' | 'Essencial' | 'Pro' | 'Elite';

const ACTIVE_ACCESS_STATUSES = new Set(['active', 'trialing']);

export const getCanonicalPlanName = (planName?: string | null): CanonicalPlanName => {
  const normalized = String(planName || '').trim().toLowerCase();

  if (normalized.includes('elite')) return 'Elite';
  if (normalized.includes('pro')) return 'Pro';
  if (normalized.includes('essencial')) return 'Essencial';
  return 'Gratuito';
};

export const getPlanTierFromName = (planName?: string | null): number => {
  switch (getCanonicalPlanName(planName)) {
    case 'Elite':
      return 4;
    case 'Pro':
      return 3;
    case 'Essencial':
      return 2;
    default:
      return 1;
  }
};

export const hasActivePlanAccess = (user?: UserProfile | null): boolean => {
  const status = String(user?.subscription?.status || '').trim().toLowerCase();
  return ACTIVE_ACCESS_STATUSES.has(status);
};

export const getEffectivePlanName = (user?: UserProfile | null): CanonicalPlanName => {
  if (!user) return 'Gratuito';

  if (hasActivePlanAccess(user)) {
    return getCanonicalPlanName(user.subscription?.plan?.name || user.plan);
  }

  return getCanonicalPlanName(user.plan || user.billing?.plan);
};

export const getAccessPlanName = (user?: UserProfile | null): CanonicalPlanName => {
  if (user?.isAdmin) return 'Elite';
  if (!user) return 'Gratuito';

  if (hasActivePlanAccess(user)) {
    return getCanonicalPlanName(user.subscription?.plan?.name || user.plan);
  }

  return 'Gratuito';
};

export const getEffectivePlanDisplayName = (user?: UserProfile | null): string => {
  if (!user) return 'Gratuito';

  if (hasActivePlanAccess(user)) {
    return user.subscription?.plan?.name || getEffectivePlanName(user);
  }

  return user.plan || user.billing?.plan || 'Gratuito';
};

export const getEffectivePlanTier = (user?: UserProfile | null): number => {
  if (user?.isAdmin) return 4;

  if (!user) return 1;

  const subscriptionPlanName = hasActivePlanAccess(user)
    ? (user.subscription?.plan?.name || user.plan)
    : null;

  if (subscriptionPlanName) {
    return getPlanTierFromName(subscriptionPlanName);
  }

  const fallbackPlan = user.plan || user.billing?.plan;
  return getPlanTierFromName(fallbackPlan);
};

export const isPlanAtLeast = (user: UserProfile | null | undefined, requiredPlan: CanonicalPlanName): boolean => {
  return getEffectivePlanTier(user) >= getPlanTierFromName(requiredPlan);
};

export const getResolvedPlanEntitlements = (
  configuredEntitlements?: Partial<PlanEntitlements> | null
): PlanEntitlements => {
  if (!configuredEntitlements) {
    return DEFAULT_PLAN_ENTITLEMENTS;
  }

  return normalizePlanEntitlements(configuredEntitlements);
};

export const getPlanBenefits = (
  planName?: string | null,
  configuredEntitlements?: Partial<PlanEntitlements> | null
): PlanBenefitMatrix => {
  const resolvedEntitlements = getResolvedPlanEntitlements(configuredEntitlements);
  return resolvedEntitlements[getCanonicalPlanName(planName)];
};

export const hasBenefitForPlanName = (
  planName: string | null | undefined,
  benefitKey: PlanBenefitKey,
  configuredEntitlements?: Partial<PlanEntitlements> | null
): boolean => {
  return !!getPlanBenefits(planName, configuredEntitlements)[benefitKey];
};

export const hasPlanBenefit = (
  user: UserProfile | null | undefined,
  benefitKey: PlanBenefitKey,
  configuredEntitlements?: Partial<PlanEntitlements> | null
): boolean => {
  if (user?.isAdmin) return true;
  return hasBenefitForPlanName(getAccessPlanName(user), benefitKey, configuredEntitlements);
};

export const getBenefitRequiredPlan = (
  benefitKey: PlanBenefitKey,
  configuredEntitlements?: Partial<PlanEntitlements> | null
): CanonicalPlanName => {
  const resolvedEntitlements = getResolvedPlanEntitlements(configuredEntitlements);
  const matchedPlan = PLAN_ORDER.find((planName) => resolvedEntitlements[planName][benefitKey]);

  return matchedPlan || 'Elite';
};

export const getBenefitPlanLabel = (
  benefitKey: PlanBenefitKey,
  configuredEntitlements?: Partial<PlanEntitlements> | null
): string => {
  const requiredPlan = getBenefitRequiredPlan(benefitKey, configuredEntitlements);

  if (requiredPlan === 'Elite') {
    return 'Plano Elite';
  }

  if (requiredPlan === 'Gratuito') {
    return 'Plano Gratuito';
  }

  return `Plano ${requiredPlan} ou superior`;
};
