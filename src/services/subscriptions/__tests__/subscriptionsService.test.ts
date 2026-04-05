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
      createMercadoPagoPreference: 'subscriptions/create.php',
      processMercadoPagoPayment: 'subscriptions/process_payment.php',
      automationHelper: 'subscriptions/automation_helper.php',
      createStripeCheckout: 'subscriptions/create_stripe_checkout.php',
      createStripeSubscription: 'subscriptions/create_stripe_subscription.php',
      finalizeStripeSubscription: 'subscriptions/finalize_stripe_subscription.php',
      validateCoupon: 'subscriptions/validate_coupon.php',
      createStripePortal: 'subscriptions/create_stripe_portal.php',
      updateRenewal: 'subscriptions/update_renewal.php',
      cancel: 'subscriptions/cancel.php',
      cancelRefund: 'subscriptions/cancel_refund.php',
      undoCancel: 'subscriptions/undo_cancel.php',
    },
  },
  readApiData: (response: any, fallback: any) => {
    if (response?.data !== undefined) return response.data;
    return response ?? fallback;
  },
  assertApiSuccess: (response: any, fallbackMessage: string) => {
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

import { subscriptionsService } from '../subscriptionsService';

describe('subscriptionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the Mercado Pago subscription preference through the official subscriptions facade', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        preferenceId: 'pref_123',
        initPoint: 'https://www.mercadopago.com.br/checkout/test',
      },
    });

    const response = await subscriptionsService.createMercadoPagoSubscriptionPreference({
      plan_id: 2,
    });

    expect(mockPost).toHaveBeenCalledWith('subscriptions/create.php', {
      plan_id: 2,
    });
    expect(response.success).toBe(true);
  });

  it('loads the automation helper through the official subscriptions facade', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        cron_url: 'http://localhost/questao-pro-backend/api/subscriptions/cron_recurring.php?key=secret',
        download_url: 'http://localhost/questao-pro-backend/api/subscriptions/automation_helper.php?action=download_bat',
        linux_command: '0 * * * * curl -s "http://localhost/questao-pro-backend/api/subscriptions/cron_recurring.php?key=secret"',
      },
    });

    const response = await subscriptionsService.getAutomationHelperInfo();

    expect(mockGet).toHaveBeenCalledWith('subscriptions/automation_helper.php');
    expect(response.cron_url).toContain('cron_recurring.php');
  });

  it('processes Mercado Pago payments through the official subscriptions facade', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      status: 'approved',
      id: 'mp_123',
    });

    const response = await subscriptionsService.processMercadoPagoPayment({
      token: 'tok_test',
      plan_id: 2,
      transaction_amount: 39.9,
      payment_method_id: 'visa',
    });

    expect(mockPost).toHaveBeenCalledWith('subscriptions/process_payment.php', {
      token: 'tok_test',
      plan_id: 2,
      transaction_amount: 39.9,
      payment_method_id: 'visa',
    });
    expect(response.success).toBe(true);
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

  it('opens the stripe portal through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        url: 'https://billing.stripe.com/session/test',
      },
    });

    const response = await subscriptionsService.createStripePortalSession();

    expect(mockPost).toHaveBeenCalledWith('subscriptions/create_stripe_portal.php', {});
    expect(response.success).toBe(true);
  });

  it('updates renewal through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        auto_renew: true,
      },
    });

    const response = await subscriptionsService.updateRenewal(true);

    expect(mockPost).toHaveBeenCalledWith('subscriptions/update_renewal.php', {
      auto_renew: true,
    });
    expect(response.success).toBe(true);
  });

  it('normalizes coupon validation to the legacy checkout contract', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        coupon: {
          code: 'APROVADO20',
          discount_amount: 20,
        },
      },
    });

    const response = await subscriptionsService.validateCoupon('APROVADO20', 100, 2);

    expect(mockPost).toHaveBeenCalledWith('subscriptions/validate_coupon.php', {
      code: 'APROVADO20',
      amount: 100,
      plan_id: 2,
    });
    expect(response.coupon.code).toBe('APROVADO20');
  });

  it('normalizes cancellation response fields used by profile', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Assinatura cancelada.',
      data: {
        refund_processed: true,
        refund_id: 're_123',
      },
    });

    const response = await subscriptionsService.cancelSubscription('arrependimento', 'teste', 'captcha');

    expect(mockPost).toHaveBeenCalledWith('subscriptions/cancel.php', {
      reason: 'arrependimento',
      details: 'teste',
      captchaToken: 'captcha',
    });
    expect(response.refund_processed).toBe(true);
    expect(response.refund_id).toBe('re_123');
  });

  it('cancels refund requests through the official subscriptions facade', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Solicitacao de reembolso cancelada.',
    });

    const response = await subscriptionsService.cancelRefundRequest();

    expect(mockPost).toHaveBeenCalledWith('subscriptions/cancel_refund.php', {});
    expect(response.success).toBe(true);
  });

  it('reverts cancellation requests through the official subscriptions facade', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Solicitacao de cancelamento removida.',
    });

    const response = await subscriptionsService.undoCancellationRequest();

    expect(mockPost).toHaveBeenCalledWith('subscriptions/undo_cancel.php', {});
    expect(response.success).toBe(true);
  });

  it('finalizes the Stripe subscription through the same facade used by checkout', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        subscription_status: 'active',
      },
    });

    const response = await subscriptionsService.finalizeStripeSubscription({
      subscription_id: 'sub_123',
      payment_intent_id: 'pi_123',
      payment_method_id: 'pm_123',
      save_card: true,
    });

    expect(mockPost).toHaveBeenCalledWith('subscriptions/finalize_stripe_subscription.php', {
      subscription_id: 'sub_123',
      payment_intent_id: 'pi_123',
      payment_method_id: 'pm_123',
      save_card: true,
    });
    expect(response.success).toBe(true);
  });
});
