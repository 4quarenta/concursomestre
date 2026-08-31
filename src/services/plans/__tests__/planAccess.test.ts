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
import type { UserProfile } from '@types';
import { getAccessPlanName, getEffectivePlanName, hasActivePlanAccess, isPlanAtLeast } from '../planAccess';

const makeUser = (patch: Partial<UserProfile>): UserProfile => ({
  id: 'user-1',
  name: 'Aluno',
  email: 'aluno@example.com',
  emailVerified: true,
  targetExam: '',
  level: 1,
  xp: 0,
  reputation: 0,
  commentsCount: 0,
  role: 'user',
  status: 'active',
  savedQuestionIds: [],
  simulations: [],
  purchasedMaterialIds: [],
  preferences: {
    shareData: false,
    notifications: true,
  },
  billing: {
    plan: 'Gratuito',
    billingCycle: 'monthly',
  },
  ...patch,
});

describe('planAccess helpers', () => {
  it('allows active paid subscriptions when there is no payment block', () => {
    const user = makeUser({
      plan: 'Elite',
      subscription: {
        id: 1,
        user_id: 'user-1',
        plan_id: 4,
        status: 'active',
        current_period_start: '2026-06-01',
        current_period_end: '2026-07-01',
        plan: { id: 4, name: 'Elite', description: '', price: 99, interval_count: 1, interval_unit: 'month', features: [] },
      },
    });

    expect(hasActivePlanAccess(user)).toBe(true);
    expect(getAccessPlanName(user)).toBe('Elite');
  });

  it('blocks premium access when the subscription has a payment block', () => {
    const user = makeUser({
      plan: 'Elite',
      subscription: {
        id: 1,
        user_id: 'user-1',
        plan_id: 4,
        status: 'active',
        current_period_start: '2026-06-01',
        current_period_end: '2026-07-01',
        payment_blocking: true,
        payment_block_reason: 'expired_card',
        plan: { id: 4, name: 'Elite', description: '', price: 99, interval_count: 1, interval_unit: 'month', features: [] },
      },
    });

    expect(hasActivePlanAccess(user)).toBe(false);
    expect(getAccessPlanName(user)).toBe('Gratuito');
    expect(getEffectivePlanName(user)).toBe('Gratuito');
    expect(isPlanAtLeast(user, 'Elite')).toBe(false);
  });

  it('blocks premium access for blocking payment issues even with an active status snapshot', () => {
    const user = makeUser({
      plan: 'Pro',
      paymentIssue: {
        type: 'expired_card',
        code: 'card_expired',
        severity: 'blocking',
        interactionLock: true,
        blockingReason: 'expired_card',
      },
      subscription: {
        id: 2,
        user_id: 'user-1',
        plan_id: 3,
        status: 'active',
        current_period_start: '2026-06-01',
        current_period_end: '2026-07-01',
        plan: { id: 3, name: 'Pro', description: '', price: 59, interval_count: 1, interval_unit: 'month', features: [] },
      },
    });

    expect(hasActivePlanAccess(user)).toBe(false);
    expect(getAccessPlanName(user)).toBe('Gratuito');
    expect(getEffectivePlanName(user)).toBe('Gratuito');
    expect(isPlanAtLeast(user, 'Pro')).toBe(false);
  });
});
