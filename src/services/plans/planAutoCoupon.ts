import type { DiscountCode, Plan } from '@types';
import { getCanonicalPlanName } from './planAccess';

export interface ResolvedPlanAutoCoupon {
  coupon: DiscountCode | null;
  discountAmount: number;
}

/**
 * Verifica se o cupom automatico ainda pode ser exibido/aplicado no frontend.
 * @since v1.0.0
 */
export const isPlanAutoCouponActive = (coupon?: DiscountCode | null) => {
  if (!coupon) {
    return false;
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
    return false;
  }

  if (typeof coupon.maxUses === 'number' && coupon.maxUses > 0 && Number(coupon.uses || 0) >= coupon.maxUses) {
    return false;
  }

  return true;
};

const normalizeCouponTargetType = (coupon?: DiscountCode | null) => {
  const targetType = String(coupon?.targetType || 'all').trim().toLowerCase();
  return targetType === 'plan' || targetType === 'item' ? targetType : 'all';
};

const normalizeCouponTargetId = (coupon?: DiscountCode | null) => String(coupon?.targetId || '').trim().toLowerCase();

const roundCurrency = (value: number) => Number(Number(value || 0).toFixed(2));

/**
 * Resolve o desconto absoluto do cupom para o plano informado.
 * @since v1.0.0
 */
export const calculatePlanAutoCouponDiscount = (coupon: DiscountCode, amount: number) => {
  const normalizedAmount = Math.max(0, Number(amount || 0));
  const percentageDiscount = Math.max(0, Number(coupon.discountPercentage || 0));
  const fixedDiscount = Math.max(0, Number(coupon.discountAmount || 0));

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
    .filter((coupon) => Boolean(coupon.autoApply))
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
