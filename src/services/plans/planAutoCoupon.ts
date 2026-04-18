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

import type { DiscountCode, Plan } from '@types';
import { getCanonicalPlanName } from './planAccess';

export interface ResolvedPlanAutoCoupon {
  coupon: DiscountCode | null;
  discountAmount: number;
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false;
  }

  return Boolean(value);
};

const getCouponExpiresAt = (coupon?: DiscountCode | null) => {
  const rawCoupon = (coupon || {}) as DiscountCode & Record<string, unknown>;
  const expiresAt = rawCoupon.expiresAt ?? rawCoupon.expires_at;
  return typeof expiresAt === 'string' ? expiresAt : '';
};

const getCouponMaxUses = (coupon?: DiscountCode | null) => {
  const rawCoupon = (coupon || {}) as DiscountCode & Record<string, unknown>;
  const maxUses = rawCoupon.maxUses ?? rawCoupon.max_uses;
  const normalized = toNumber(maxUses, 0);
  return normalized > 0 ? normalized : 0;
};

const getCouponUses = (coupon?: DiscountCode | null) => {
  const rawCoupon = (coupon || {}) as DiscountCode & Record<string, unknown>;
  const uses = rawCoupon.uses ?? rawCoupon.used_count;
  return Math.max(0, toNumber(uses, 0));
};

const getCouponAutoApply = (coupon?: DiscountCode | null) => {
  const rawCoupon = (coupon || {}) as DiscountCode & Record<string, unknown>;
  const autoApply = rawCoupon.autoApply ?? rawCoupon.auto_apply;
  return toBoolean(autoApply);
};

const getCouponDiscountPercentage = (coupon?: DiscountCode | null) => {
  const rawCoupon = (coupon || {}) as DiscountCode & Record<string, unknown>;
  return Math.max(0, toNumber(rawCoupon.discountPercentage ?? rawCoupon.discount_percentage, 0));
};

const getCouponDiscountAmount = (coupon?: DiscountCode | null) => {
  const rawCoupon = (coupon || {}) as DiscountCode & Record<string, unknown>;
  return Math.max(0, toNumber(rawCoupon.discountAmount ?? rawCoupon.discount_amount, 0));
};

/**
 * Verifica se o cupom automatico ainda pode ser exibido/aplicado no frontend.
 * @since v1.0.0
 */
export const isPlanAutoCouponActive = (coupon?: DiscountCode | null) => {
  if (!coupon) {
    return false;
  }

  const expiresAt = getCouponExpiresAt(coupon);
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return false;
  }

  const maxUses = getCouponMaxUses(coupon);
  const uses = getCouponUses(coupon);
  if (maxUses > 0 && uses >= maxUses) {
    return false;
  }

  return true;
};

const normalizeCouponTargetType = (coupon?: DiscountCode | null) => {
  const rawCoupon = (coupon || {}) as DiscountCode & Record<string, unknown>;
  const targetType = String(rawCoupon.targetType ?? rawCoupon.target_type ?? 'all').trim().toLowerCase();
  return targetType === 'plan' || targetType === 'item' ? targetType : 'all';
};

const normalizeCouponTargetId = (coupon?: DiscountCode | null) => {
  const rawCoupon = (coupon || {}) as DiscountCode & Record<string, unknown>;
  return String(rawCoupon.targetId ?? rawCoupon.target_id ?? '').trim().toLowerCase();
};

const roundCurrency = (value: number) => Number(Number(value || 0).toFixed(2));

/**
 * Resolve o desconto absoluto do cupom para o plano informado.
 * @since v1.0.0
 */
export const calculatePlanAutoCouponDiscount = (coupon: DiscountCode, amount: number) => {
  const normalizedAmount = Math.max(0, Number(amount || 0));
  const percentageDiscount = getCouponDiscountPercentage(coupon);
  const fixedDiscount = getCouponDiscountAmount(coupon);

  if (percentageDiscount > 0) {
    return Math.min(normalizedAmount, roundCurrency(normalizedAmount * (percentageDiscount / 100)));
  }

  if (fixedDiscount > 0) {
    return Math.min(normalizedAmount, roundCurrency(fixedDiscount));
  }

  return 0;
};

/**
 * Confere se o cupom automatico mira o plano exibido.
 * @since v1.0.0
 */
export const couponMatchesPlan = (coupon: DiscountCode, plan: Plan) => {
  const targetType = normalizeCouponTargetType(coupon);
  if (targetType === 'all') {
    return true;
  }

  if (targetType !== 'plan') {
    return false;
  }

  const targetId = normalizeCouponTargetId(coupon);
  const canonicalPlanName = getCanonicalPlanName(plan.name).toLowerCase();
  const rawPlanName = String(plan.name || '').trim().toLowerCase();

  return targetId === String(plan.id).trim().toLowerCase()
    || targetId === canonicalPlanName
    || targetId === rawPlanName;
};

const getCouponSpecificityScore = (coupon: DiscountCode) => {
  const targetType = normalizeCouponTargetType(coupon);
  if (targetType === 'plan') {
    return 2;
  }

  if (targetType === 'all') {
    return 1;
  }

  return 0;
};

/**
 * Escolhe o melhor cupom automatico disponivel para um plano.
 * @since v1.0.0
 */
export const resolveBestPlanAutoCoupon = (coupons: DiscountCode[], plan: Plan) => {
  const matchingCoupons = coupons
    .filter((coupon) => getCouponAutoApply(coupon))
    .filter((coupon) => isPlanAutoCouponActive(coupon))
    .filter((coupon) => couponMatchesPlan(coupon, plan));

  if (matchingCoupons.length === 0) {
    return null;
  }

  return matchingCoupons.sort((left, right) => {
    const specificityDelta = getCouponSpecificityScore(right) - getCouponSpecificityScore(left);
    if (specificityDelta !== 0) {
      return specificityDelta;
    }

    const rightDiscount = calculatePlanAutoCouponDiscount(right, Number(plan.price || 0));
    const leftDiscount = calculatePlanAutoCouponDiscount(left, Number(plan.price || 0));
    if (rightDiscount !== leftDiscount) {
      return rightDiscount - leftDiscount;
    }

    return String(left.code || '').localeCompare(String(right.code || ''));
  })[0] || null;
};

/**
 * Materializa o mapa de cupons automaticos por plano para cards e vitrines.
 * @since v1.0.0
 */
export const resolvePlanAutoCouponsById = (plans: Plan[], coupons: DiscountCode[]): Record<number, ResolvedPlanAutoCoupon> => {
  return Object.fromEntries(plans.map((plan) => {
    const coupon = resolveBestPlanAutoCoupon(coupons || [], plan);
    return [plan.id, {
      coupon,
      discountAmount: coupon ? calculatePlanAutoCouponDiscount(coupon, Number(plan.price || 0)) : 0,
    }];
  }));
};
