import { describe, expect, it } from 'vitest';
import {
  getCheckoutLastInstallmentChargeAt,
  getMaximumInstallmentsCoveredByCard,
  resolveCheckoutChargeInterval,
} from './cardInstallmentExpiry';

const annualPlan = { interval_unit: 'year', interval_count: 1 };
const fourMonthPlan = { interval_unit: 'month', interval_count: 4 };

describe('card installment expiration', () => {
  it('limits a card expiring in 10/26 to four monthly charges for a July purchase', () => {
    expect(getMaximumInstallmentsCoveredByCard({
      plan: fourMonthPlan,
      maxInstallments: 4,
      expMonth: 10,
      expYear: 2026,
      firstChargeAt: new Date('2026-07-16T12:00:00.000Z'),
    })).toBe(4);
  });

  it('accepts the installment charged during the expiration month', () => {
    expect(getCheckoutLastInstallmentChargeAt(
      fourMonthPlan,
      4,
      new Date('2026-07-16T12:00:00.000Z'),
    ).toISOString()).toBe('2026-10-16T12:00:00.000Z');
  });

  it('rejects options whose schedule extends past the expiration month', () => {
    expect(getMaximumInstallmentsCoveredByCard({
      plan: { interval_unit: 'month', interval_count: 5 },
      maxInstallments: 5,
      expMonth: '10',
      expYear: '26',
      firstChargeAt: new Date('2026-07-31T12:00:00.000Z'),
    })).toBe(4);
  });

  it('keeps selected annual-plan installments monthly', () => {
    expect(getMaximumInstallmentsCoveredByCard({
      plan: annualPlan,
      maxInstallments: 12,
      expMonth: 10,
      expYear: 2026,
      firstChargeAt: new Date('2026-07-16T12:00:00.000Z'),
    })).toBe(4);
    expect(resolveCheckoutChargeInterval(annualPlan, 12)).toEqual({ unit: 'month', count: 1 });
  });

  it('fails closed when saved-card expiration metadata is unavailable', () => {
    expect(getMaximumInstallmentsCoveredByCard({
      plan: annualPlan,
      maxInstallments: 12,
      expMonth: null,
      expYear: null,
      firstChargeAt: new Date('2026-07-16T12:00:00.000Z'),
    })).toBe(1);
  });
});
