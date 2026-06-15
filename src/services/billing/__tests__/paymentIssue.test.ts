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

import { describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@/types';

vi.mock('@services/plans/planAccess', () => ({
  hasActivePlanAccess: (user?: UserProfile | null) => ['active', 'trialing'].includes(String(user?.subscription?.status || '').toLowerCase()),
}));

import { resolveUserPaymentIssue } from '../paymentIssue';

describe('resolveUserPaymentIssue', () => {
  it('treats expired subscription cards as blocking even with legacy payloads', () => {
    const issue = resolveUserPaymentIssue({
      id: 'user-1',
      hasSavedCard: true,
      paymentIssue: {
        type: 'expired_card',
        message: 'O cartao VISA final 4242 da sua assinatura expirou.',
      },
      subscription: {
        id: 1,
        user_id: 'user-1',
        plan_id: 2,
        status: 'active',
        current_period_start: '2026-02-24 09:00:00',
        current_period_end: '2026-05-24 09:00:00',
      },
    } as UserProfile);

    expect(issue?.severity).toBe('blocking');
    expect(issue?.interactionLock).toBe(true);
    expect(issue?.blockingReason).toBe('expired_card');
  });

  it('treats manual admin gifts without card as non-blocking renewal guidance', () => {
    const issue = resolveUserPaymentIssue({
      id: 'user-2',
      planDisplayName: 'Pro',
      hasSavedCard: false,
      subscription: {
        id: 2,
        user_id: 'user-2',
        plan_id: 3,
        status: 'active',
        payment_provider: 'manual_admin',
        current_period_start: '2026-06-15 10:00:00',
        current_period_end: '2026-07-15 10:00:00',
      },
    } as UserProfile);

    expect(issue?.type).toBe('manual_gift_no_card');
    expect(issue?.severity).toBe('warning');
    expect(issue?.interactionLock).toBe(false);
    expect(issue?.message).toContain('cortesia');
  });
});
