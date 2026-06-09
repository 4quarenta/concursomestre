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
import { resolveProfileSubscriptionTimeline } from '../subscriptionDateUtils';
import type { Plan, UserSubscription } from '@/types';

const eliteAnnualPlan: Plan = {
  id: 4,
  name: 'Elite',
  description: 'Plano Elite anual',
  price: 120,
  interval_count: 12,
  interval_unit: 'month',
  features: [],
  canonical_name: 'Elite',
};

const eliteQuarterlyPlan: Plan = {
  ...eliteAnnualPlan,
  id: 3,
  description: 'Plano Elite trimestral',
  interval_count: 3,
  interval_unit: 'month',
};

const buildSubscription = (overrides: Partial<UserSubscription> = {}): UserSubscription => ({
  id: 10,
  user_id: 'u-admin',
  plan_id: 4,
  status: 'active',
  current_period_start: '2026-05-21 22:35:57',
  current_period_end: '2027-05-21 09:00:00',
  created_at: '2026-05-21 22:35:57',
  total_installments: 12,
  paid_installments: 2,
  recurring_amount: 25.87,
  plan: eliteAnnualPlan,
  ...overrides,
});

describe('resolveProfileSubscriptionTimeline', () => {
  it('keeps annual parcelled subscriptions on the full contracted term', () => {
    const timeline = resolveProfileSubscriptionTimeline({
      now: new Date('2026-07-23T12:00:00-03:00'),
      subscription: buildSubscription({
        provider_current_period_start: '2026-05-21 22:35:57',
        provider_current_period_end: '2026-06-20 22:35:57',
      }),
    });

    expect(timeline.totalDays).toBe(365);
    expect(timeline.usedDays).toBe(63);
    expect(timeline.remainingDays).toBe(302);
    expect(timeline.progressPercent).toBe(17);
  });

  it('repairs monthly provider windows for annual installment terms using creation date', () => {
    const timeline = resolveProfileSubscriptionTimeline({
      now: new Date('2026-06-10T12:00:00-03:00'),
      subscription: buildSubscription({
        current_period_end: '2026-06-20 22:35:57',
        provider_current_period_start: '2026-05-21 22:35:57',
        provider_current_period_end: '2026-06-20 22:35:57',
      }),
    });

    expect(timeline.totalDays).toBe(365);
    expect(timeline.usedDays).toBe(20);
    expect(timeline.remainingDays).toBe(345);
  });

  it('keeps one remaining day while the quarterly cycle still has hours left', () => {
    const timeline = resolveProfileSubscriptionTimeline({
      now: new Date('2026-05-24T08:00:00-03:00'),
      subscription: buildSubscription({
        plan: eliteQuarterlyPlan,
        current_period_start: '2026-02-24 09:00:00',
        current_period_end: '2026-05-24 09:00:00',
        created_at: '2026-02-24 09:00:00',
        total_installments: 3,
        paid_installments: 2,
        recurring_amount: 33.27,
      }),
    });

    expect(timeline.totalDays).toBe(89);
    expect(timeline.usedDays).toBe(88);
    expect(timeline.remainingDays).toBe(1);
    expect(timeline.progressPercent).toBe(99);
  });
});
