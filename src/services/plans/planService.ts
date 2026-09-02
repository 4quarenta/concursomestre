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

import { apiClient, ENDPOINTS, readApiData } from '@services/api';
import { withRequestCoalescing } from '@services/api/requestCoalescer';
import type { DiscountCode, Plan } from '@types';
import { cardsService } from '@services/billing';
import { clientLog } from '@services/monitoring/clientLog';

const loadSubscriptionsService = async () => (
  await import('@services/subscriptions')
).subscriptionsService;

type StripeBillingMode = 'single_installment' | 'term_recurring';
type PlanApiEnvelope<TData extends Record<string, unknown> = Record<string, unknown>> = TData & {
  success?: boolean;
  message?: string | null;
  data?: TData | null;
};
type CheckoutCoupon = DiscountCode & {
  discount_amount?: number;
  discount_percentage?: number;
};
type StripeCheckoutSessionResponse = PlanApiEnvelope<{
  url?: string | null;
  redirect_url?: string | null;
}>;
type StripeSubscriptionPayload = {
  subscription_id?: string | null;
  client_secret?: string | null;
  payment_intent_status?: string | null;
  confirmation_type?: 'payment' | 'setup' | string | null;
  payment_intent_id?: string | null;
  save_card?: boolean;
  card_saved?: boolean;
  card_save_warning?: string | null;
  approved?: boolean;
  access_granted?: boolean;
};
type StripeSubscriptionResponse = PlanApiEnvelope<StripeSubscriptionPayload>;
type StripeFinalizeSubscriptionResponse = PlanApiEnvelope<StripeSubscriptionPayload>;
type StripeSetupIntentResponse = Awaited<ReturnType<typeof cardsService.createStripeSetupIntent>>;
type StripeCardSyncResponse = Awaited<ReturnType<typeof cardsService.syncStripeCard>>;
type StripePortalSessionResponse = PlanApiEnvelope<{
  url?: string | null;
  redirect_url?: string | null;
}>;
type StripePixCapabilityResponse = PlanApiEnvelope;
type CouponValidationResult = PlanApiEnvelope<{
  coupon?: CheckoutCoupon | null;
}>;
type SubscriptionActionResponse = PlanApiEnvelope<{
  refund_processed?: boolean;
  refund_id?: string | null;
  debt_settled?: boolean;
  debt_settlement_amount?: number;
  debt_transaction_id?: number | string | null;
}>;
type SubscriptionGenericResponse = PlanApiEnvelope;

/**
 * Fachada oficial do dominio de planos.
 * Mantem catalogo, validacao comercial e delegacao para assinaturas/billing
 * fora dos entry points do frontend.
 * @since 1.0.0
 */
export const planService = {
  /**
   * Lista todos os planos disponiveis no catalogo.
   * @since 1.0.0
   */
  async getPlans(): Promise<Plan[]> {
    return withRequestCoalescing('plans:list', async () => {
      try {
        const response = await apiClient.get<unknown>(ENDPOINTS.plans.list);
        const plans = readApiData<Plan[]>(response, []);
        return Array.isArray(plans) ? plans : [];
      } catch (error) {
        clientLog.warn('Error fetching plans:', error);
        return [];
      }
    }, 5000);
  },

  /**
   * Inicia o checkout hospedado da Stripe.
   * @since 1.0.0
   */
  async createStripeCheckoutSession(payload: {
    plan_id: number;
    auto_renew?: boolean;
    coupon_code?: string;
    payment_method_id?: string;
    billing_mode?: StripeBillingMode;
    installment_count?: number;
    checkout_attempt_id?: string;
    checkout_adhesion_terms_accepted: true;
    checkout_adhesion_terms_version: string;
  }): Promise<StripeCheckoutSessionResponse> {
    const subscriptionsService = await loadSubscriptionsService();
    return subscriptionsService.createStripeCheckoutSession(payload) as Promise<StripeCheckoutSessionResponse>;
  },

  /**
   * Cria a assinatura inline da Stripe.
   * @since 1.0.0
   */
  async createStripeSubscription(payload: {
    plan_id: number;
    auto_renew?: boolean;
    coupon_code?: string;
    payment_method_id?: string;
    saved_card_id?: string;
    save_card?: boolean;
    billing_mode?: StripeBillingMode;
    installment_count?: number;
    checkout_attempt_id?: string;
    checkout_adhesion_terms_accepted: true;
    checkout_adhesion_terms_version: string;
  }): Promise<StripeSubscriptionResponse> {
    const subscriptionsService = await loadSubscriptionsService();
    return subscriptionsService.createStripeSubscription(payload) as Promise<StripeSubscriptionResponse>;
  },

  /**
   * Finaliza a assinatura inline depois do setup/pagamento inicial.
   * @since 1.0.0
   */
  async finalizeStripeSubscription(payload: {
    subscription_id: string;
    plan_id?: number;
    auto_renew?: boolean;
    payment_method_id?: string;
    payment_intent_id?: string;
    saved_card_id?: string;
    save_card?: boolean;
    billing_mode?: StripeBillingMode;
  }): Promise<StripeFinalizeSubscriptionResponse> {
    const subscriptionsService = await loadSubscriptionsService();
    return subscriptionsService.finalizeStripeSubscription(payload) as Promise<StripeFinalizeSubscriptionResponse>;
  },

  /**
   * Prepara o setup intent usado para salvar um cartao Stripe.
   * @since 1.0.0
   */
  async createStripeSetupIntent(): Promise<StripeSetupIntentResponse> {
    return cardsService.createStripeSetupIntent();
  },

  /**
   * Sincroniza o cartao Stripe salvo com o cofre local.
   * @since 1.0.0
   */
  async syncStripeCard(paymentMethodId: string): Promise<StripeCardSyncResponse> {
    return cardsService.syncStripeCard(paymentMethodId);
  },

  /**
   * Abre o portal da Stripe para gerenciar assinatura e billing.
   * @since 1.0.0
   */
  async createStripePortalSession(): Promise<StripePortalSessionResponse> {
    const subscriptionsService = await loadSubscriptionsService();
    return subscriptionsService.createStripePortalSession() as Promise<StripePortalSessionResponse>;
  },

  /**
   * Consulta a disponibilidade operacional de PIX via capability Stripe.
   * @since 1.0.0
   */
  async getStripePixCapability(): Promise<StripePixCapabilityResponse> {
    const subscriptionsService = await loadSubscriptionsService();
    return subscriptionsService.getStripePixCapability() as Promise<StripePixCapabilityResponse>;
  },

  /**
   * Solicita a ativação operacional de PIX na Stripe via backend oficial.
   * @since 1.0.0
   */
  async requestStripePixCapability(): Promise<StripePixCapabilityResponse> {
    const subscriptionsService = await loadSubscriptionsService();
    return subscriptionsService.requestStripePixCapability() as Promise<StripePixCapabilityResponse>;
  },

  /**
   * Valida um cupom comercial contra valor/plano selecionado.
   * @since 1.0.0
   */
  async validateCoupon(
    code: string,
    amount: number,
    options: {
      planId?: number;
      itemId?: string | number;
      targetType?: 'plan' | 'item';
      targetId?: string | number;
    } = {},
  ): Promise<CouponValidationResult> {
    const subscriptionsService = await loadSubscriptionsService();
    return subscriptionsService.validateCoupon(code, amount, options) as Promise<CouponValidationResult>;
  },

  /**
   * Solicita cancelamento da assinatura ativa.
   * @since 1.0.0
   */
  async cancelSubscription(userId: string, reason?: string, details?: string, captchaToken?: string | null, confirmDebtCharge = false): Promise<SubscriptionActionResponse> {
    void userId;
    const subscriptionsService = await loadSubscriptionsService();
    return subscriptionsService.cancelSubscription(reason, details, captchaToken, confirmDebtCharge) as Promise<SubscriptionActionResponse>;
  },

  /**
   * Cancela uma solicitacao de reembolso pendente.
   * @since 1.0.0
   */
  async cancelRefundRequest(): Promise<SubscriptionGenericResponse> {
    const subscriptionsService = await loadSubscriptionsService();
    return subscriptionsService.cancelRefundRequest() as Promise<SubscriptionGenericResponse>;
  },

  /**
   * Reverte a solicitacao de cancelamento/reembolso.
   * @since 1.0.0
   */
  async undoCancellationRequest(): Promise<SubscriptionGenericResponse> {
    const subscriptionsService = await loadSubscriptionsService();
    return subscriptionsService.undoCancellationRequest() as Promise<SubscriptionGenericResponse>;
  },

  /**
   * Atualiza a preferencia de renovacao automatica.
   * @since 1.0.0
   */
  async updateRenewal(autoRenew: boolean): Promise<SubscriptionGenericResponse> {
    const subscriptionsService = await loadSubscriptionsService();
    return subscriptionsService.updateRenewal(autoRenew) as Promise<SubscriptionGenericResponse>;
  },
};

export default planService;
