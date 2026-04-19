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
import type { Plan } from '@types';
import { cardsService } from '@services/billing';
import { subscriptionsService } from '@services/subscriptions';

type StripeBillingMode = 'single_installment' | 'term_recurring';

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
    try {
      const response = await apiClient.get<any>(ENDPOINTS.plans.list, {
        params: {
          _: Date.now(),
        },
      });
      const plans = readApiData<Plan[]>(response, []);
      return Array.isArray(plans) ? plans : [];
    } catch (error) {
      console.error('Error fetching plans:', error);
      return [];
    }
  },

  /**
   * Inicia o checkout hospedado da Stripe.
   * @since 1.0.0
   */
  async createStripeCheckoutSession(payload: {
    plan_id: number;
    auto_renew?: boolean;
    coupon_code?: string;
    billing_mode?: StripeBillingMode;
    installment_count?: number;
  }): Promise<any> {
    return subscriptionsService.createStripeCheckoutSession(payload);
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
  }): Promise<any> {
    return subscriptionsService.createStripeSubscription(payload);
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
  }): Promise<any> {
    return subscriptionsService.finalizeStripeSubscription(payload);
  },

  /**
   * Prepara o setup intent usado para salvar um cartao Stripe.
   * @since 1.0.0
   */
  async createStripeSetupIntent(): Promise<any> {
    return cardsService.createStripeSetupIntent();
  },

  /**
   * Sincroniza o cartao Stripe salvo com o cofre local.
   * @since 1.0.0
   */
  async syncStripeCard(paymentMethodId: string): Promise<any> {
    return cardsService.syncStripeCard(paymentMethodId);
  },

  /**
   * Abre o portal da Stripe para gerenciar assinatura e billing.
   * @since 1.0.0
   */
  async createStripePortalSession(): Promise<any> {
    return subscriptionsService.createStripePortalSession();
  },

  /**
   * Consulta a disponibilidade operacional de PIX via capability Stripe.
   * @since 1.0.0
   */
  async getStripePixCapability(): Promise<any> {
    return subscriptionsService.getStripePixCapability();
  },

  /**
   * Solicita a ativação operacional de PIX na Stripe via backend oficial.
   * @since 1.0.0
   */
  async requestStripePixCapability(): Promise<any> {
    return subscriptionsService.requestStripePixCapability();
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
  ): Promise<any> {
    return subscriptionsService.validateCoupon(code, amount, options);
  },

  /**
   * Solicita cancelamento da assinatura ativa.
   * @since 1.0.0
   */
  async cancelSubscription(userId: string, reason?: string, details?: string, captchaToken?: string | null): Promise<any> {
    void userId;
    return subscriptionsService.cancelSubscription(reason, details, captchaToken);
  },

  /**
   * Cancela uma solicitacao de reembolso pendente.
   * @since 1.0.0
   */
  async cancelRefundRequest(): Promise<any> {
    return subscriptionsService.cancelRefundRequest();
  },

  /**
   * Reverte a solicitacao de cancelamento/reembolso.
   * @since 1.0.0
   */
  async undoCancellationRequest(): Promise<any> {
    return subscriptionsService.undoCancellationRequest();
  },

  /**
   * Atualiza a preferencia de renovacao automatica.
   * @since 1.0.0
   */
  async updateRenewal(autoRenew: boolean): Promise<any> {
    return subscriptionsService.updateRenewal(autoRenew);
  },
};

export default planService;
