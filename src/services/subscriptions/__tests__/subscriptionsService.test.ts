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

import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockApiResponse = {
  data?: unknown;
  success?: boolean;
  message?: string;
  error?: string;
} | null | undefined;

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
  },
  ENDPOINTS: {
    subscriptions: {
      current: 'subscriptions/current.php',
      automationHelper: 'subscriptions/automation_helper.php',
      stripeTestingMatrix: 'subscriptions/stripe_testing_matrix.php',
      stripeTestingRuns: 'subscriptions/stripe_testing_runs.php',
      createStripeCheckout: 'subscriptions/create_stripe_checkout.php',
      createStripeSubscription: 'subscriptions/create_stripe_subscription.php',
      finalizeStripeSubscription: 'subscriptions/finalize_stripe_subscription.php',
      stripePixCapability: 'subscriptions/stripe_pix_capability.php',
      validateCoupon: 'subscriptions/validate_coupon.php',
      createStripePortal: 'subscriptions/create_stripe_portal.php',
      updateRenewal: 'subscriptions/update_renewal.php',
      syncCurrent: 'subscriptions/sync_current.php',
      cancel: 'subscriptions/cancel.php',
      cancelRefund: 'subscriptions/cancel_refund.php',
      undoCancel: 'subscriptions/undo_cancel.php',
    },
  },
  readApiData: (response: MockApiResponse, fallback: unknown) => {
    if (response?.data !== undefined) return response.data;
    return response ?? fallback;
  },
  assertApiSuccess: (response: MockApiResponse, fallbackMessage: string) => {
    if (!response?.success) {
      throw new Error(response?.message || response?.error || fallbackMessage);
    }

    return {
      success: true,
      message: response?.message,
      data: response?.data,
      raw: response,
    };
  },
}));

vi.mock('@services/monitoring/clientLog', () => ({
  clientLog: {
    error: vi.fn(),
  },
}));

import { subscriptionsService } from '../subscriptionsService';

describe('subscriptionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the automation helper through the official subscriptions facade', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        cron_url: 'http://localhost/api/subscriptions/cron.php?key=secret',
        download_url: 'http://localhost/api/subscriptions/helper.php?action=download_bat',
        linux_command: '0 * * * * curl -s "http://localhost/api/subscriptions/cron.php?key=secret"',
        cli_command: '*/15 * * * * /usr/bin/php /var/www/questao-pro-backend/scripts/tasks/reconcile_stripe_subscriptions.php',
        cron_health: {
          status: 'ok',
          checked: 2,
          issues: 0,
        },
        webhook_health: {
          status: 'processed',
          event_type: 'invoice.paid',
        },
      },
    });

    const response = await subscriptionsService.getAutomationHelperInfo();

    expect(mockGet).toHaveBeenCalledWith('subscriptions/automation_helper.php');
    expect(response.cron_url).toContain('cron.php');
    expect(response.cli_command).toContain('reconcile_stripe_subscriptions.php');
    expect(response.cron_health).toMatchObject({ status: 'ok', checked: 2 });
    expect(response.webhook_health).toMatchObject({ status: 'processed', event_type: 'invoice.paid' });
  });

  it('maps the authenticated billing snapshot without relying on the session DTO', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        subscription: {
          id: 104,
          status: 'active',
          paymentProvider: 'stripe',
          autoRenew: true,
          cancelAtPeriodEnd: false,
          createdAt: '2026-06-28 08:15:29',
          plan: {
            id: 134,
            displayName: 'Elite - Teste 2 dias',
            price: 10,
            intervalUnit: 'day',
            intervalCount: 2,
            tier: 4,
          },
          period: {
            startAt: '2026-07-18 08:15:28',
            endAt: '2026-07-20 08:15:28',
            providerStartAt: '2026-07-18 08:15:28',
            providerEndAt: '2026-07-20 08:15:28',
          },
          billing: {
            isRecurring: true,
            chargeAmount: 10,
            totalInstallments: 1,
            paidInstallments: 1,
            renewalIteration: 1,
            nextRenewal: {
              amount: 10,
              date: '2026-07-20 08:15:28',
              priceSource: 'contracted_amount',
              cycleLabel: '2 dias',
            },
          },
          payment: {
            blocking: false,
            blockingReason: null,
          },
        },
      },
    });

    const subscription = await subscriptionsService.getCurrentBillingSubscription();

    expect(mockGet).toHaveBeenCalledWith('subscriptions/current.php');
    expect(subscription).toMatchObject({
      id: 104,
      recurring_amount: 10,
      next_renewal_amount: 10,
      next_renewal_date: '2026-07-20 08:15:28',
      current_period_start: '2026-07-18 08:15:28',
      current_period_end: '2026-07-20 08:15:28',
      auto_renew: true,
      plan: {
        name: 'Elite - Teste 2 dias',
        price: 10,
        interval_unit: 'day',
        interval_count: 2,
      },
    });
  });

  it('returns null when the authenticated user has no managed subscription', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: { subscription: null },
    });

    await expect(subscriptionsService.getCurrentBillingSubscription()).resolves.toBeNull();
  });

  it('runs the automation routine through the official admin helper', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        summary: {
          checked: 2,
          synced_status: 1,
          errors: 0,
        },
      },
    });
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        cron_health: {
          status: 'ok',
          checked: 2,
          materialized_invoices: 1,
        },
      },
    });

    const response = await subscriptionsService.runAutomationNow();
    const refreshedHelper = await subscriptionsService.getAutomationHelperInfo();

    expect(mockPost).toHaveBeenCalledWith('subscriptions/automation_helper.php?action=run_now', {});
    expect(mockGet).toHaveBeenCalledWith('subscriptions/automation_helper.php');
    expect(response.summary.checked).toBe(2);
    expect(response.summary.synced_status).toBe(1);
    expect(refreshedHelper.cron_health).toMatchObject({ materialized_invoices: 1 });
  });

  it('loads the official Stripe testing matrix through the subscriptions facade', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        scenarios: [
          {
            id: 'card-success',
            title: 'Cartao aprovado',
          },
        ],
      },
    });

    const response = await subscriptionsService.getStripeTestingMatrix();

    expect(mockGet).toHaveBeenCalledWith('subscriptions/stripe_testing_matrix.php');
    expect(response.scenarios).toHaveLength(1);
    expect(response.scenarios[0].id).toBe('card-success');
  });

  it('registers a guided Stripe testing run through the official endpoint', async () => {
    const payload = {
      scenario_id: 'card-success',
      execution_result: 'passed' as const,
      payment_intent_id: 'pi_123',
      subscription_id: 'sub_123',
      transaction_id: 'tx_123',
      evidence_url: 'https://example.com/evidence.png',
      gateway_message: 'approved',
      notes: 'Fluxo aprovado no ambiente de teste.',
    };
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        id: 42,
      },
    });

    const response = await subscriptionsService.createStripeTestingRun(payload);

    expect(mockPost).toHaveBeenCalledWith('subscriptions/stripe_testing_runs.php', payload);
    expect(response.id).toBe(42);
  });

  it('creates the hosted Stripe checkout through the official subscriptions facade', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        session_id: 'cs_test_123',
        redirect_url: 'https://checkout.stripe.com/pay/cs_test_123',
      },
    });

    const response = await subscriptionsService.createStripeCheckoutSession({
      plan_id: 3,
      auto_renew: true,
      coupon_code: 'TRI20',
      billing_mode: 'term_recurring',
      installment_count: 3,
    });

    expect(mockPost).toHaveBeenCalledWith('subscriptions/create_stripe_checkout.php', {
      plan_id: 3,
      auto_renew: true,
      coupon_code: 'TRI20',
      billing_mode: 'term_recurring',
      installment_count: 3,
    });
    expect(response.success).toBe(true);
    expect(response.url).toBe('https://checkout.stripe.com/pay/cs_test_123');
  });

  it('creates the internal Stripe subscription through the official subscriptions facade', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        subscription_id: 'sub_123',
      },
    });

    const response = await subscriptionsService.createStripeSubscription({
      plan_id: 5,
      auto_renew: false,
      payment_method_id: 'pm_123',
      save_card: true,
      billing_mode: 'single_installment',
      installment_count: 1,
    });

    expect(mockPost).toHaveBeenCalledWith('subscriptions/create_stripe_subscription.php', {
      plan_id: 5,
      auto_renew: false,
      payment_method_id: 'pm_123',
      save_card: true,
      billing_mode: 'single_installment',
      installment_count: 1,
    });
    expect(response.success).toBe(true);
  });

  it('creates an internal Stripe subscription using a saved card token', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        subscription_id: 'sub_saved_123',
        requires_action: false,
      },
    });

    const response = await subscriptionsService.createStripeSubscription({
      plan_id: 4,
      auto_renew: true,
      coupon_code: 'FIDELIDADE15',
      saved_card_id: 'card_123',
      billing_mode: 'term_recurring',
      installment_count: 12,
    });

    expect(mockPost).toHaveBeenCalledWith('subscriptions/create_stripe_subscription.php', {
      plan_id: 4,
      auto_renew: true,
      coupon_code: 'FIDELIDADE15',
      saved_card_id: 'card_123',
      billing_mode: 'term_recurring',
      installment_count: 12,
    });
    expect(response.subscription_id).toBe('sub_saved_123');
    expect(response.requires_action).toBe(false);
  });

  it('finalizes the Stripe subscription through the official subscriptions facade', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        approved: true,
      },
    });

    const response = await subscriptionsService.finalizeStripeSubscription({
      subscription_id: 'sub_123',
      payment_method_id: 'pm_123',
      save_card: true,
    });

    expect(mockPost).toHaveBeenCalledWith('subscriptions/finalize_stripe_subscription.php', {
      subscription_id: 'sub_123',
      payment_method_id: 'pm_123',
      save_card: true,
    });
    expect(response.success).toBe(true);
  });

  it('loads the Stripe PIX capability through the official subscriptions facade', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        available: false,
        status: 'pending',
        capability: 'pix_payments',
      },
    });

    const response = await subscriptionsService.getStripePixCapability();

    expect(mockGet).toHaveBeenCalledWith('subscriptions/stripe_pix_capability.php');
    expect(response.capability).toBe('pix_payments');
    expect(response.status).toBe('pending');
  });

  it('requests Stripe PIX capability activation through the administrative facade', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        requested: true,
        capability: 'pix_payments',
      },
    });

    const response = await subscriptionsService.requestStripePixCapability();

    expect(mockPost).toHaveBeenCalledWith('subscriptions/stripe_pix_capability.php', {
      request: true,
    });
    expect(response.requested).toBe(true);
    expect(response.capability).toBe('pix_payments');
  });

  it('validates a commercial coupon with plan targeting data', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        coupon: {
          code: 'PRO20',
          discountPercentage: 20,
        },
      },
    });

    const response = await subscriptionsService.validateCoupon('PRO20', 129.9, {
      planId: 3,
      targetType: 'plan',
      targetId: 3,
    });

    expect(mockPost).toHaveBeenCalledWith('subscriptions/validate_coupon.php', {
      code: 'PRO20',
      amount: 129.9,
      plan_id: 3,
      item_id: undefined,
      target_type: 'plan',
      target_id: 3,
    });
    expect(response.coupon.code).toBe('PRO20');
    expect(response.coupon.discountPercentage).toBe(20);
  });

  it('opens the stripe portal through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        url: 'https://billing.stripe.com/session/test',
      },
    });

    const response = await subscriptionsService.createStripePortalSession();

    expect(mockPost).toHaveBeenCalledWith('subscriptions/create_stripe_portal.php', {});
    expect(response.url).toBe('https://billing.stripe.com/session/test');
  });

  it('updates automatic renewal preference through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        auto_renew: false,
      },
    });

    const response = await subscriptionsService.updateRenewal(false);

    expect(mockPost).toHaveBeenCalledWith('subscriptions/update_renewal.php', {
      auto_renew: false,
    });
    expect(response.auto_renew).toBe(false);
  });

  it('requests subscription cancellation with optional context and captcha token', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        refund_processed: true,
        refund_id: 're_123',
      },
    });

    const response = await subscriptionsService.cancelSubscription(
      'budget',
      'Usuario pediu cancelamento com reembolso.',
      'captcha-token',
    );

    expect(mockPost).toHaveBeenCalledWith('subscriptions/cancel.php', {
      reason: 'budget',
      details: 'Usuario pediu cancelamento com reembolso.',
      captchaToken: 'captcha-token',
      confirmDebtCharge: false,
    });
    expect(response.refund_processed).toBe(true);
    expect(response.refund_id).toBe('re_123');
  });

  it('sends explicit debt settlement confirmation when canceling a parcelled term', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        debt_settled: true,
        debt_settlement_amount: 110,
        debt_transaction_id: 77,
      },
    });

    const response = await subscriptionsService.cancelSubscription(
      'user_request',
      'Cancelar termo anual com saldo pendente.',
      'captcha-token',
      true,
    );

    expect(mockPost).toHaveBeenCalledWith('subscriptions/cancel.php', {
      reason: 'user_request',
      details: 'Cancelar termo anual com saldo pendente.',
      captchaToken: 'captcha-token',
      confirmDebtCharge: true,
    });
    expect(response.debt_settled).toBe(true);
    expect(response.debt_settlement_amount).toBe(110);
    expect(response.debt_transaction_id).toBe(77);
  });

  it('cancels a pending subscription refund request through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        status: 'refund_cancelled',
      },
    });

    const response = await subscriptionsService.cancelRefundRequest();

    expect(mockPost).toHaveBeenCalledWith('subscriptions/cancel_refund.php', {});
    expect(response.status).toBe('refund_cancelled');
  });

  it('undoes a pending cancellation request through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        status: 'active',
        cancel_at_period_end: false,
      },
    });

    const response = await subscriptionsService.undoCancellationRequest();

    expect(mockPost).toHaveBeenCalledWith('subscriptions/undo_cancel.php', {});
    expect(response.status).toBe('active');
    expect(response.cancel_at_period_end).toBe(false);
  });
});
