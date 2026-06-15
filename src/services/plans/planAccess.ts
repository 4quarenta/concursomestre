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
  PlanName,
  PlanUsageLimitKey,
  PlanUsageLimits,
  UserProfile,
} from '@types';
import {
  DEFAULT_PLAN_ENTITLEMENTS,
  DEFAULT_PLAN_USAGE_LIMITS,
  PLAN_ORDER,
  normalizePlanEntitlements,
  normalizePlanUsageLimits,
} from '@constants/subscriptions/planEntitlements';

export type CanonicalPlanName = 'Gratuito' | 'Essencial' | 'Pro' | 'Elite';

const ACTIVE_ACCESS_STATUSES = new Set(['active', 'trialing']);
const BLOCKING_PAYMENT_ISSUE_CODES = new Set(['card_expired', 'payment_past_due']);

const hasPaymentAccessBlock = (user?: UserProfile | null): boolean => {
  const subscriptionBlockReason = String(user?.subscription?.payment_block_reason || '').trim();
  const issueSeverity = String(user?.paymentIssue?.severity || '').trim().toLowerCase();
  const issueCode = String(user?.paymentIssue?.code || '').trim().toLowerCase();
  const issueType = String(user?.paymentIssue?.type || '').trim().toLowerCase();
  const issueBlockingReason = String(user?.paymentIssue?.blockingReason || '').trim();

  return Boolean(user?.subscription?.payment_blocking)
    || subscriptionBlockReason !== ''
    || Boolean(user?.paymentIssue?.interactionLock)
    || issueSeverity === 'blocking'
    || BLOCKING_PAYMENT_ISSUE_CODES.has(issueCode)
    || BLOCKING_PAYMENT_ISSUE_CODES.has(issueType)
    || issueBlockingReason !== '';
};

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
  return ACTIVE_ACCESS_STATUSES.has(status) && !hasPaymentAccessBlock(user);
};

export const getEffectivePlanName = (user?: UserProfile | null): CanonicalPlanName => {
  if (!user) return 'Gratuito';
  if (hasPaymentAccessBlock(user)) return 'Gratuito';

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
  if (hasPaymentAccessBlock(user)) return 1;

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

export const getResolvedPlanUsageLimits = (
  configuredLimits?: Partial<PlanUsageLimits> | null
): PlanUsageLimits => {
  if (!configuredLimits) {
    return DEFAULT_PLAN_USAGE_LIMITS;
  }

  return normalizePlanUsageLimits(configuredLimits);
};

export const getPlanBenefits = (
  planName?: string | null,
  configuredEntitlements?: Partial<PlanEntitlements> | null
): PlanBenefitMatrix => {
  const resolvedEntitlements = getResolvedPlanEntitlements(configuredEntitlements);
  return resolvedEntitlements[getCanonicalPlanName(planName)];
};

export const getCanonicalPlanDetailsName = (planName?: string | null): PlanName => getCanonicalPlanName(planName);

export const isPlanEnabledByName = (
  planName: string | null | undefined,
  configuredPlanDetails?: Partial<Record<PlanName, { enabled?: boolean }>> | null
): boolean => {
  const canonicalPlan = getCanonicalPlanDetailsName(planName);
  const rawPlanConfig = configuredPlanDetails?.[canonicalPlan];
  if (!rawPlanConfig || typeof rawPlanConfig.enabled !== 'boolean') {
    return true;
  }

  return rawPlanConfig.enabled;
};

export const getConfiguredPlanDisplayName = (
  planName: string | null | undefined,
  configuredPlanDetails?: Partial<Record<PlanName, { displayName?: string }>> | null,
  fallbackName?: string | null,
): string => {
  const canonicalPlan = getCanonicalPlanDetailsName(planName);
  const configuredName = configuredPlanDetails?.[canonicalPlan]?.displayName;
  const normalizedConfiguredName = typeof configuredName === 'string' ? configuredName.trim() : '';
  const normalizedFallback = typeof fallbackName === 'string' ? fallbackName.trim() : '';

  return normalizedConfiguredName || normalizedFallback || canonicalPlan;
};

export const hasBenefitForPlanName = (
  planName: string | null | undefined,
  benefitKey: PlanBenefitKey,
  configuredEntitlements?: Partial<PlanEntitlements> | null
): boolean => {
  return !!getPlanBenefits(planName, configuredEntitlements)[benefitKey]?.enabled;
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
  const matchedPlan = PLAN_ORDER.find((planName) => resolvedEntitlements[planName][benefitKey]?.enabled);

  return matchedPlan || 'Elite';
};

export const getPlanUsageLimitForPlanName = (
  planName: string | null | undefined,
  limitKey: PlanUsageLimitKey,
  configuredLimits?: Partial<PlanUsageLimits> | null
): number | null => {
  const resolvedLimits = getResolvedPlanUsageLimits(configuredLimits);
  const limitValue = resolvedLimits[getCanonicalPlanName(planName)][limitKey];

  if (limitValue.mode === 'unlimited') {
    return null;
  }

  return Math.max(0, Number(limitValue.value || 0));
};

export const isPlanUsageUnlimitedForPlanName = (
  planName: string | null | undefined,
  limitKey: PlanUsageLimitKey,
  configuredLimits?: Partial<PlanUsageLimits> | null
): boolean => {
  const resolvedLimits = getResolvedPlanUsageLimits(configuredLimits);
  return resolvedLimits[getCanonicalPlanName(planName)][limitKey].mode === 'unlimited';
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
