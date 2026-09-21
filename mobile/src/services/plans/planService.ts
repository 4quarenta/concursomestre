import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData } from '@/services/api/response';
import type { CouponValidationResult, Plan } from '@/types/plans';

type StripeBillingMode = 'single_installment' | 'term_recurring';

type StripeCheckoutPayload = {
  plan_id: number;
  auto_renew?: boolean;
  coupon_code?: string;
  billing_mode?: StripeBillingMode;
  installment_count?: number;
};

type StripeInlineSubscriptionPayload = {
  plan_id: number;
  auto_renew?: boolean;
  coupon_code?: string;
  payment_method_id?: string;
  saved_card_id?: string;
  save_card?: boolean;
  billing_mode?: StripeBillingMode;
  installment_count?: number;
};

type StripeFinalizePayload = {
  subscription_id: string;
  plan_id?: number;
  auto_renew?: boolean;
  payment_method_id?: string;
  payment_intent_id?: string;
  saved_card_id?: string;
  save_card?: boolean;
  billing_mode?: StripeBillingMode;
};

/**
 * Fachada mobile do dominio de planos e checkout.
 * @since v1.0.0
 */
export const planService = {
  async getPlans(): Promise<Plan[]> {
    const response: any = await apiClient.get<any>(ENDPOINTS.plans.list, {
      params: { _: Date.now() },
    });

    const payload = readApiData<any>(response, []);
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.rows)
        ? payload.rows
        : [];

    return rows as Plan[];
  },

  async validateCoupon(code: string, amount: number, planId: number): Promise<CouponValidationResult> {
    const response: any = await apiClient.post<any>(ENDPOINTS.subscriptions.validateCoupon, {
      code,
      amount,
      plan_id: planId,
      target_type: 'plan',
      target_id: planId,
    });

    const payload = readApiData<any>(response, {});
    const discountAmount = Number(payload?.discount_amount ?? response?.discount_amount ?? 0);
    const discountPercentage = Number(payload?.discount_percentage ?? response?.discount_percentage ?? 0);

    if (response?.success === false) {
      return {
        valid: false,
        message: String(response?.message || 'Cupom invalido.'),
      };
    }

    return {
      valid: true,
      message: String(response?.message || payload?.message || 'Cupom aplicado com sucesso.'),
      discount_amount: Number.isFinite(discountAmount) ? discountAmount : 0,
      discount_percentage: Number.isFinite(discountPercentage) ? discountPercentage : 0,
    };
  },

  async createStripeCheckoutSession(payload: StripeCheckoutPayload): Promise<{ url: string }> {
    const response: any = await apiClient.post<any>(ENDPOINTS.subscriptions.createStripeCheckout, payload);
    assertApiSuccess(response, 'Nao foi possivel iniciar o checkout.');

    const rawData = readApiData<any>(response, {});
    const url = String(rawData?.url || response?.url || rawData?.redirect_url || '').trim();
    if (!url) {
      throw new Error('Checkout retornou sem URL de redirecionamento.');
    }

    return { url };
  },

  async createStripeSubscription(payload: StripeInlineSubscriptionPayload): Promise<any> {
    const response: any = await apiClient.post<any>(ENDPOINTS.subscriptions.createStripeSubscription, payload);
    assertApiSuccess(response, 'Nao foi possivel iniciar a assinatura Stripe.');
    return response;
  },

  async finalizeStripeSubscription(payload: StripeFinalizePayload): Promise<any> {
    const response: any = await apiClient.post<any>(ENDPOINTS.subscriptions.finalizeStripeSubscription, payload);
    assertApiSuccess(response, 'Nao foi possivel finalizar a assinatura Stripe.');
    return response;
  },
};

export default planService;
