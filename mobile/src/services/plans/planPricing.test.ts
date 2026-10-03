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
import {
  formatPlanPrice,
  formatPlanPriceNumber,
  normalizePlanPricing,
  resolveEqualInstallmentPrice,
  roundPlanPriceUp,
} from '@shared/planPricing';

describe('shared plan pricing', () => {
  it('rounds fractional cent amounts upward consistently', () => {
    expect(roundPlanPriceUp(9.985)).toBe(9.99);
    expect(formatPlanPriceNumber(9.985)).toBe('9,99');
    expect(formatPlanPrice(9.985)).toBe('R$ 9,99');
  });

  it('formats zero and free-plan amounts without a negative sign', () => {
    expect(Object.is(roundPlanPriceUp(0), -0)).toBe(false);
    expect(formatPlanPriceNumber(0)).toBe('0,00');
    expect(formatPlanPrice(0)).toBe('R$ 0,00');
    expect(formatPlanPrice(-0)).toBe('R$ 0,00');
  });

  it('normalizes configured discounted cycles from the monthly installment', () => {
    const pricing = normalizePlanPricing({
      monthly: 19.97,
      quarterlyDiscountPercent: 20,
      annualDiscountPercent: 50,
    });

    expect(pricing.quarterly).toBe(47.94);
    expect(pricing.annual).toBe(119.88);
    expect(pricing.annual / 12).toBe(9.99);
  });

  it('rounds arbitrary cycle installment prices upward and derives the displayed total', () => {
    expect(resolveEqualInstallmentPrice(119.82, 12)).toEqual({
      installmentAmount: 9.99,
      cycleAmount: 119.88,
    });
  });
});
