import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  assertApiSuccess: vi.fn(),
  readApiData: vi.fn(),
  coalesce: vi.fn(async (_key: string, loader: () => Promise<unknown>) => loader()),
  clear: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: { get: mocks.get },
  ENDPOINTS: { users: { paymentStatus: 'v2/users/me/billing/payment-status.php' } },
  assertApiSuccess: mocks.assertApiSuccess,
  readApiData: mocks.readApiData,
}));

vi.mock('@services/api/requestCoalescer', () => ({
  buildRequestCacheKey: (prefix: string) => prefix,
  clearRequestCoalescing: mocks.clear,
  withRequestCoalescing: mocks.coalesce,
}));

import {
  paymentStatusService,
  shouldLoadPaymentStatusForPath,
  shouldShowPaymentWarning,
} from '../paymentStatus';

describe('paymentStatusService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads only the dedicated payment status endpoint', async () => {
    const payload = {
      subscriptionStatus: 'active',
      billingMode: 'recurring_card',
      requiresPaymentMethod: true,
      hasValidPaymentMethod: true,
      actionRequired: null,
      recoveryUrl: null,
      invoice: null,
    };
    mocks.get.mockResolvedValue({ success: true, data: payload });
    mocks.readApiData.mockReturnValue(payload);

    await expect(paymentStatusService.getCurrentUserStatus()).resolves.toEqual(payload);
    expect(mocks.get).toHaveBeenCalledWith('v2/users/me/billing/payment-status.php', { signal: undefined });
    expect(shouldShowPaymentWarning(payload)).toBe(false);
  });

  it('preserves the safe invoice recovery contract', async () => {
    const payload = {
      subscriptionStatus: 'past_due',
      billingMode: 'recurring_card',
      requiresPaymentMethod: true,
      hasValidPaymentMethod: true,
      actionRequired: 'payment_failed' as const,
      recoveryUrl: 'https://invoice.stripe.com/i/test',
      invoice: {
        status: 'open',
        currency: 'BRL',
        amountDue: 54,
        amountRemaining: 54,
        hostedInvoiceUrl: 'https://invoice.stripe.com/i/test',
        nextPaymentAttemptAt: null,
        dueAt: null,
        requiresAuthentication: false,
      },
    };
    mocks.get.mockResolvedValue({ success: true, data: payload });
    mocks.readApiData.mockReturnValue(payload);

    await expect(paymentStatusService.getCurrentUserStatus()).resolves.toEqual(payload);
  });

  it('does not treat loading, errors or incomplete contracts as no card', async () => {
    mocks.get.mockResolvedValue({ success: true, data: {} });
    mocks.readApiData.mockReturnValue({ subscriptionStatus: 'active' });

    await expect(paymentStatusService.getCurrentUserStatus()).rejects.toThrow('Contrato de status financeiro incompleto');
    expect(shouldShowPaymentWarning(undefined)).toBe(false);
    expect(shouldShowPaymentWarning({
      subscriptionStatus: 'active',
      billingMode: 'recurring_card',
      requiresPaymentMethod: true,
      hasValidPaymentMethod: false,
      actionRequired: null,
    })).toBe(false);
  });

  it('invalidates the financial status after card mutations', () => {
    paymentStatusService.invalidate();
    expect(mocks.clear).toHaveBeenCalledWith('billing:payment-status');
  });

  it('loads authoritative billing status only on financial routes', () => {
    expect(shouldLoadPaymentStatusForPath('/profile/billing')).toBe(true);
    expect(shouldLoadPaymentStatusForPath('/profile/personal')).toBe(true);
    expect(shouldLoadPaymentStatusForPath('/profile/billing-history')).toBe(true);
    expect(shouldLoadPaymentStatusForPath('/checkout')).toBe(true);
    expect(shouldLoadPaymentStatusForPath('/checkout/card')).toBe(true);
    expect(shouldLoadPaymentStatusForPath('/dashboard')).toBe(false);
    expect(shouldLoadPaymentStatusForPath('/practice')).toBe(false);
    expect(shouldLoadPaymentStatusForPath('/profile/privacy')).toBe(false);
  });
});
