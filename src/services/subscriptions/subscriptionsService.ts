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

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';

/**
 * Consolida payloads do backend em um objeto unico e previsivel.
 * Essa normalizacao evita que checkout e billing precisem conhecer todos os formatos legados.
 * @since 1.0.0
 */
const mergeResponsePayload = <T extends Record<string, any>>(response: any, fallback: T): T & Record<string, any> => {
  const payload = readApiData<T>(response, fallback);
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return {
      ...response,
      ...payload,
    };
  }

  return response;
};

/**
 * Variante do merge que garante a exposicao de uma URL de redirecionamento.
 * Ela e usada por flows de checkout hospedado que precisam abrir uma rota externa.
 * @since 1.0.0
 */
const mergeResponsePayloadWithUrl = <T extends Record<string, any>>(response: any, fallback: T): T & Record<string, any> => {
  const merged = mergeResponsePayload(response, fallback);
  return {
    ...merged,
    url: merged?.url || merged?.redirect_url || null,
  };
};

/**
 * Fachada oficial do dominio de assinaturas.
 * Centraliza os fluxos de conta e checkout para reduzir dependencias diretas
 * dos entry points em endpoints legados.
 * @since 1.0.0
 */
export const subscriptionsService = {
  /**
   * Busca os dados de automacao financeira exibidos no painel admin.
   * @since 1.0.0
   */
  async getAutomationHelperInfo(): Promise<any> {
    const response = await apiClient.get<any>(ENDPOINTS.subscriptions.automationHelper);
    assertApiSuccess(
      response,
      'NÃ£o foi possÃ­vel carregar as instrucoes de automacao.',
    );

    return mergeResponsePayload(response, {});
  },

  /**
   * Inicia o checkout hospedado da Stripe para um plano.
   * @since 1.0.0
   */
  async createStripeCheckoutSession(payload: {
    plan_id: number;
    auto_renew?: boolean;
    coupon_code?: string;
    billing_mode?: 'single_installment' | 'term_recurring';
    installment_count?: number;
  }): Promise<any> {
    try {
      const response = await apiClient.post<any>(ENDPOINTS.subscriptions.createStripeCheckout, payload);
      assertApiSuccess(
        response,
        'NÃ£o foi possÃ­vel iniciar o checkout Stripe.',
      );
      return mergeResponsePayloadWithUrl(response, {});
    } catch (error) {
      console.error('Error creating Stripe checkout session:', error);
      throw error;
    }
  },

  /**
   * Cria uma assinatura Stripe pelo fluxo inline com cartÃ£o salvo ou novo.
   * @since 1.0.0
   */
  async createStripeSubscription(payload: {
    plan_id: number;
    auto_renew?: boolean;
    coupon_code?: string;
    payment_method_id?: string;
    saved_card_id?: string;
    save_card?: boolean;
    billing_mode?: 'single_installment' | 'term_recurring';
    installment_count?: number;
  }): Promise<any> {
    try {
      const response = await apiClient.post<any>(ENDPOINTS.subscriptions.createStripeSubscription, payload);
      assertApiSuccess(
        response,
        'NÃ£o foi possÃ­vel criar a assinatura Stripe.',
      );
      return mergeResponsePayload(response, {});
    } catch (error) {
      console.error('Error creating Stripe inline subscription:', error);
      throw error;
    }
  },

  /**
   * Finaliza a assinatura Stripe apos setup intent ou pagamento inicial.
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
    billing_mode?: 'single_installment' | 'term_recurring';
  }): Promise<any> {
    try {
      const response = await apiClient.post<any>(ENDPOINTS.subscriptions.finalizeStripeSubscription, payload);
      assertApiSuccess(
        response,
        'NÃ£o foi possÃ­vel finalizar a assinatura Stripe.',
      );
      return mergeResponsePayload(response, {});
    } catch (error) {
      console.error('Error finalizing Stripe subscription:', error);
      throw error;
    }
  },

  /**
   * Valida um cupom comercial para o valor e plano informados.
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
    try {
      const response = await apiClient.post<any>(ENDPOINTS.subscriptions.validateCoupon, {
        code,
        amount,
        plan_id: options.planId,
        item_id: options.itemId,
        target_type: options.targetType,
        target_id: options.targetId,
      });
      const payload = readApiData<any>(response, {});
      return {
        ...assertApiSuccess(response, 'NÃ£o foi possÃ­vel validar o cupom.').raw,
        coupon: payload?.coupon || response?.coupon || null,
      };
    } catch (error) {
      console.error('Error validating coupon:', error);
      throw error;
    }
  },

  /**
   * Abre uma sessÃ£o do portal Stripe para gestÃ£o de billing do usuÃ¡rio.
   * @since 1.0.0
   */
  async createStripePortalSession(): Promise<any> {
    try {
      const response = await apiClient.post<any>(ENDPOINTS.subscriptions.createStripePortal, {});
      assertApiSuccess(
        response,
        'NÃ£o foi possÃ­vel abrir o portal Stripe.',
      );
      return mergeResponsePayload(response, {});
    } catch (error) {
      console.error('Error creating Stripe portal session:', error);
      throw error;
    }
  },

  /**
   * Atualiza a preferencia de renovaÃ§Ã£o automÃ¡tica da assinatura atual.
   * @since 1.0.0
   */
  async updateRenewal(autoRenew: boolean): Promise<any> {
    const response = await apiClient.post(ENDPOINTS.subscriptions.updateRenewal, {
      auto_renew: autoRenew,
    });

    assertApiSuccess(
      response,
      'NÃ£o foi possÃ­vel atualizar a renovaÃ§Ã£o automÃ¡tica.',
    );

    return mergeResponsePayload(response, {});
  },

  /**
   * Solicita cancelamento da assinatura ativa com contexto opcional.
   * @since 1.0.0
   */
  async cancelSubscription(reason?: string, details?: string, captchaToken?: string | null): Promise<any> {
    try {
      const response = await apiClient.post<any>(ENDPOINTS.subscriptions.cancel, {
        reason,
        details,
        captchaToken,
      });
      const payload = readApiData<any>(response, {});
      return {
        ...assertApiSuccess(response, 'NÃ£o foi possÃ­vel cancelar a assinatura.').raw,
        refund_processed: payload?.refund_processed ?? response?.refund_processed ?? false,
        refund_id: payload?.refund_id ?? response?.refund_id ?? null,
      };
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  },

  /**
   * Cancela uma solicitacao de reembolso/cancelamento ainda pendente.
   * @since 1.0.0
   */
  async cancelRefundRequest(): Promise<any> {
    try {
      const response = await apiClient.post<any>(ENDPOINTS.subscriptions.cancelRefund, {});
      assertApiSuccess(
        response,
        'NÃ£o foi possÃ­vel cancelar a solicitacao de reembolso.',
      );
      return mergeResponsePayload(response, {});
    } catch (error) {
      console.error('Error canceling refund request:', error);
      throw error;
    }
  },

  /**
   * Reverte uma solicitacao de cancelamento antes do fechamento final.
   * @since 1.0.0
   */
  async undoCancellationRequest(): Promise<any> {
    try {
      const response = await apiClient.post<any>(ENDPOINTS.subscriptions.undoCancel, {});
      assertApiSuccess(
        response,
        'NÃ£o foi possÃ­vel reverter a solicitacao de cancelamento.',
      );
      return mergeResponsePayload(response, {});
    } catch (error) {
      console.error('Error undoing cancellation request:', error);
      throw error;
    }
  },
};

export default subscriptionsService;
