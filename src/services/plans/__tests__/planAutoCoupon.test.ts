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

import { describe, expect, it } from 'vitest';
import type { DiscountCode, Plan, PlanPricing } from '@types';
import { resolvePlanAutoCouponsById } from '../planAutoCoupon';
import { resolvePlanDiscountBadgesByCycle, resolvePlanOffer } from '../planOffer';

const eliteAnnualPlan = {
  id: 19,
  name: 'Elite - Anual',
  description: '',
  price: 658.8,
  interval_count: 1,
  interval_unit: 'year',
  features: [],
  is_active: true,
} as Plan;

const eliteMonthlyPlan = {
  id: 15,
  name: 'Elite - Mensal',
  description: '',
  price: 54.9,
  interval_count: 1,
  interval_unit: 'month',
  features: [],
  is_active: true,
} as Plan;

const eliteQuarterlyPlan = {
  id: 17,
  name: 'Elite - Trimestral',
  description: '',
  price: 164.7,
  interval_count: 3,
  interval_unit: 'month',
  features: [],
  is_active: true,
} as Plan;

const elitePricing = {
  monthly: 54.9,
  quarterly: 164.7,
  annual: 658.8,
  quarterlyDiscountPercent: 0,
  annualDiscountPercent: 0,
} as PlanPricing;

describe('plan auto coupon offers', () => {
  it('does not force a phantom 1% badge when there is no discount amount', () => {
    const offer = resolvePlanOffer({
      plan: eliteAnnualPlan,
      pricing: {
        Elite: {
          ...elitePricing,
          annual: 660,
        },
      },
      discountAmount: 0,
    });

    expect(offer.hasDiscount).toBe(false);
    expect(offer.effectiveDiscountPercent).toBe(0);
    expect(offer.originalCycleAmount).toBeCloseTo(660, 2);
    expect(offer.discountedCycleAmount).toBeCloseTo(660, 2);
  });

  it('ignores non-auto coupons coming as string flag 0 from backend payload', () => {
    const coupon = {
      code: 'MANUALONLY',
      discountPercentage: 25,
      uses: 0,
      maxUses: 100,
      expiresAt: '2099-04-21T01:00:00.000Z',
      autoApply: '0',
      targetType: 'all',
    } as unknown as DiscountCode;

    const couponsByPlanId = resolvePlanAutoCouponsById([eliteAnnualPlan], [coupon]);

    expect(couponsByPlanId[19].coupon).toBeNull();
    expect(couponsByPlanId[19].discountAmount).toBe(0);
  });

  it('supports snake_case coupon payload fields from backend', () => {
    const coupon = {
      code: 'SNAKE60',
      discount_percentage: 60,
      uses: '0',
      max_uses: '100',
      expires_at: '2099-04-21T01:00:00.000Z',
      auto_apply: '1',
      target_type: 'plan',
      target_id: '19',
    } as unknown as DiscountCode;

    const couponsByPlanId = resolvePlanAutoCouponsById([eliteAnnualPlan], [coupon]);
    const offer = resolvePlanOffer({
      plan: eliteAnnualPlan,
      pricing: { Elite: elitePricing },
      discountAmount: couponsByPlanId[19].discountAmount,
    });

    expect(couponsByPlanId[19].coupon?.code).toBe('SNAKE60');
    expect(couponsByPlanId[19].discountAmount).toBeCloseTo(395.28, 2);
    expect(offer.hasDiscount).toBe(true);
    expect(offer.effectiveDiscountPercent).toBe(60);
  });

  it('applies the active annual Elite coupon to the annual cycle card', () => {
    const coupon = {
      code: 'ELITEANUAL',
      discountPercentage: 54.46,
      uses: 0,
      maxUses: 1000,
      expiresAt: '2099-04-21T01:00:00.000Z',
      autoApply: true,
      targetType: 'plan',
      targetId: '19',
    } as DiscountCode;

    const couponsByPlanId = resolvePlanAutoCouponsById([eliteAnnualPlan], [coupon]);
    const offer = resolvePlanOffer({
      plan: eliteAnnualPlan,
      pricing: { Elite: elitePricing },
      discountAmount: couponsByPlanId[19].discountAmount,
    });

    expect(couponsByPlanId[19].coupon?.code).toBe('ELITEANUAL');
    expect(couponsByPlanId[19].discountAmount).toBeCloseTo(358.78, 2);
    expect(offer.hasDiscount).toBe(true);
    expect(offer.originalCycleAmount).toBeCloseTo(658.8, 2);
    expect(offer.discountedCycleAmount).toBeCloseTo(300, 2);
    expect(offer.discountedMonthlyAmount).toBeCloseTo(25, 2);
    expect(offer.effectiveDiscountPercent).toBe(54);
  });

  it('normalizes annual card values to the same monthly cents charged by Stripe', () => {
    const plan = {
      ...eliteAnnualPlan,
      price: 298.56,
    } as Plan;
    const pricing = {
      ...elitePricing,
      annual: 298.56,
    } as PlanPricing;
    const coupon = {
      code: 'ELITE60',
      discountPercentage: 60,
      uses: 0,
      maxUses: 1000,
      expiresAt: '2099-04-21T01:00:00.000Z',
      autoApply: true,
      targetType: 'plan',
      targetId: '19',
    } as DiscountCode;

    const couponsByPlanId = resolvePlanAutoCouponsById([plan], [coupon]);
    const offer = resolvePlanOffer({
      plan,
      pricing: { Elite: pricing },
      discountAmount: couponsByPlanId[19].discountAmount,
    });

    expect(couponsByPlanId[19].discountAmount).toBeCloseTo(179.14, 2);
    expect(offer.discountedMonthlyAmount).toBeCloseTo(9.95, 2);
    expect(offer.discountedCycleAmount).toBeCloseTo(119.4, 2);
    expect(offer.effectiveDiscountPercent).toBe(60);
  });

  it('ignores expired annual Elite coupons', () => {
    const coupon = {
      code: 'ELITEANUAL',
      discountPercentage: 54.46,
      uses: 0,
      maxUses: 1000,
      expiresAt: '2020-04-21T01:00:00.000Z',
      autoApply: true,
      targetType: 'plan',
      targetId: '19',
    } as DiscountCode;

    const couponsByPlanId = resolvePlanAutoCouponsById([eliteAnnualPlan], [coupon]);

    expect(couponsByPlanId[19].coupon).toBeNull();
    expect(couponsByPlanId[19].discountAmount).toBe(0);
  });

  it('builds discount badges by cycle for Elite', () => {
    const coupons = [
      {
        code: 'ELITEMENSAL',
        discountPercentage: 63.6,
        uses: 0,
        maxUses: 1000,
        expiresAt: '2099-04-21T01:00:00.000Z',
        autoApply: true,
        targetType: 'plan',
        targetId: '15',
      },
      {
        code: 'ELITETRIMESTRAL',
        discountPercentage: 72.7,
        uses: 0,
        maxUses: 1000,
        expiresAt: '2099-04-21T01:00:00.000Z',
        autoApply: true,
        targetType: 'plan',
        targetId: '17',
      },
      {
        code: 'ELITEANUAL',
        discountPercentage: 54.46,
        uses: 0,
        maxUses: 1000,
        expiresAt: '2099-04-21T01:00:00.000Z',
        autoApply: true,
        targetType: 'plan',
        targetId: '19',
      },
    ] as DiscountCode[];

    const badgeMap = resolvePlanDiscountBadgesByCycle({
      plans: [eliteMonthlyPlan, eliteQuarterlyPlan, eliteAnnualPlan],
      canonicalPlanName: 'Elite',
      coupons,
      pricing: { Elite: elitePricing },
    });

    expect(badgeMap).toEqual({
      monthly: 64,
      quarterly: 73,
      annual: 54,
    });
  });
});
