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
import { clientLog } from '@services/monitoring/clientLog';

type SubscriptionApiPayload = Record<string, unknown>;
type SubscriptionApiPayloadWithUrl = SubscriptionApiPayload & {
  url?: string | null;
  redirect_url?: string | null;
};
type CouponValidationResponse = SubscriptionApiPayload & {
  coupon?: unknown;
};
type CancelSubscriptionResponse = SubscriptionApiPayload & {
  refund_processed?: boolean;
  refund_id?: string | null;
  debt_settled?: boolean;
  debt_settlement_amount?: number;
  debt_transaction_id?: number | string | null;
};

let automationHelperRequest: Promise<SubscriptionApiPayload> | null = null;
let automationHelperCache: { payload: SubscriptionApiPayload; cachedAt: number } | null = null;
const AUTOMATION_HELPER_CACHE_TTL_MS = 60_000;

/**
 * Consolida payloads do backend em um objeto unico e previsivel.
 * Essa normalizacao evita que checkout e billing precisem conhecer formatos legados.
 * @since 1.0.0
 */
const mergeResponsePayload = <T extends Record<string, unknown>>(
  response: unknown,
  fallback: T,
): T & SubscriptionApiPayload => {
  const payload = readApiData<T>(response, fallback);
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return {
      ...(response && typeof response === 'object' ? response : {}),
      ...payload,
    };
  }

  return (response && typeof response === 'object' ? response : fallback) as T & SubscriptionApiPayload;
};

/**
 * Garante uma URL de redirecionamento nos fluxos hospedados.
 * @since 1.0.0
 */
const mergeResponsePayloadWithUrl = <T extends Record<string, unknown>>(
  response: unknown,
  fallback: T,
): T & SubscriptionApiPayloadWithUrl => {
  const merged = mergeResponsePayload(response, fallback);
  return {
    ...merged,
    url: typeof merged.url === 'string'
      ? merged.url
      : typeof merged.redirect_url === 'string'
        ? merged.redirect_url
        : null,
  };
};

/**
 * Fachada oficial do dominio de assinaturas.
 * Centraliza fluxos de conta e checkout para reduzir acoplamento com endpoints legados.
 * @since 1.0.0
 */
export const subscriptionsService = {
  /**
   * Busca os dados de automacao financeira exibidos no painel admin.
   * @since 1.0.0
   */
  async getAutomationHelperInfo(): Promise<SubscriptionApiPayload> {
    if (automationHelperCache && (Date.now() - automationHelperCache.cachedAt) < AUTOMATION_HELPER_CACHE_TTL_MS) {
      return automationHelperCache.payload;
    }

    if (automationHelperRequest) {
      return automationHelperRequest;
    }

    automationHelperRequest = (async () => {
      const response = await apiClient.get<SubscriptionApiPayload>(ENDPOINTS.subscriptions.automationHelper);
      assertApiSuccess(
        response,
        'Nao foi possivel carregar as instrucoes de automacao.',
      );

      const payload = mergeResponsePayload(response, {});
      automationHelperCache = {
        payload,
        cachedAt: Date.now(),
      };

      return payload;
    })().finally(() => {
      automationHelperRequest = null;
    });

    return automationHelperRequest;
  },

  /**
   * Executa manualmente a reconciliacao Stripe pelo painel admin.
   * @since 1.0.0
   */
  async runAutomationNow(): Promise<SubscriptionApiPayload> {
    automationHelperCache = null;
    const response = await apiClient.post<SubscriptionApiPayload>(
      `${ENDPOINTS.subscriptions.automationHelper}?action=run_now`,
      {},
    );
    assertApiSuccess(
      response,
      'Nao foi possivel executar a rotina de automacao.',
    );

    automationHelperCache = null;
    return mergeResponsePayload(response, {});
  },

  /**
   * Busca a matriz oficial de cenarios de teste Stripe exibida no admin.
   * @since 1.0.0
   */
  async getStripeTestingMatrix(): Promise<SubscriptionApiPayload> {
    const response = await apiClient.get<SubscriptionApiPayload>(ENDPOINTS.subscriptions.stripeTestingMatrix);
    assertApiSuccess(
      response,
      'Nao foi possivel carregar a matriz oficial de testes Stripe.',
    );

    return mergeResponsePayload(response, {});
  },

  /**
   * Busca o historico de execucoes guiadas da matriz Stripe (admin).
   * @since 1.0.0
   */
  async getStripeTestingRuns(limit = 80): Promise<SubscriptionApiPayload> {
    const safeLimit = Math.max(1, Math.min(300, limit));
    const response = await apiClient.get<SubscriptionApiPayload>(
      `${ENDPOINTS.subscriptions.stripeTestingRuns}?limit=${safeLimit}`,
    );
    assertApiSuccess(
      response,
      'Nao foi possivel carregar o historico de execucoes da matriz Stripe.',
    );

    return mergeResponsePayload(response, {});
  },

  /**
   * Registra uma execucao guiada da matriz Stripe (admin).
   * @since 1.0.0
   */
  async createStripeTestingRun(payload: {
    scenario_id: string;
    execution_result: 'passed' | 'failed' | 'blocked';
    payment_intent_id?: string;
    subscription_id?: string;
    transaction_id?: string;
    evidence_url?: string;
    gateway_message?: string;
    notes?: string;
  }): Promise<SubscriptionApiPayload> {
    const response = await apiClient.post<SubscriptionApiPayload>(ENDPOINTS.subscriptions.stripeTestingRuns, payload);
    assertApiSuccess(
      response,
      'Nao foi possivel registrar a execucao guiada da matriz Stripe.',
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
    payment_method_id?: string;
    billing_mode?: 'single_installment' | 'term_recurring';
    installment_count?: number;
  }): Promise<SubscriptionApiPayloadWithUrl> {
    try {
      const response = await apiClient.post<SubscriptionApiPayloadWithUrl>(
        ENDPOINTS.subscriptions.createStripeCheckout,
        payload,
      );
      assertApiSuccess(
        response,
        'Nao foi possivel iniciar o checkout Stripe.',
      );

      return mergeResponsePayloadWithUrl(response, {});
    } catch (error) {
      clientLog.error('Error creating Stripe checkout session:', error);
      throw error;
    }
  },

  /**
   * Cria uma assinatura Stripe pelo fluxo inline com cartao salvo ou novo.
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
  }): Promise<SubscriptionApiPayload> {
    try {
      const response = await apiClient.post<SubscriptionApiPayload>(
        ENDPOINTS.subscriptions.createStripeSubscription,
        payload,
      );
      assertApiSuccess(
        response,
        'Nao foi possivel criar a assinatura Stripe.',
      );

      return mergeResponsePayload(response, {});
    } catch (error) {
      clientLog.error('Error creating Stripe inline subscription:', error);
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
  }): Promise<SubscriptionApiPayload> {
    try {
      const response = await apiClient.post<SubscriptionApiPayload>(
        ENDPOINTS.subscriptions.finalizeStripeSubscription,
        payload,
      );
      assertApiSuccess(
        response,
        'Nao foi possivel finalizar a assinatura Stripe.',
      );

      return mergeResponsePayload(response, {});
    } catch (error) {
      clientLog.error('Error finalizing Stripe subscription:', error);
      throw error;
    }
  },

  /**
   * Consulta a capability pix_payments da Stripe para exibicao segura no checkout.
   * @since 1.0.0
   */
  async getStripePixCapability(): Promise<SubscriptionApiPayload> {
    const response = await apiClient.get<SubscriptionApiPayload>(ENDPOINTS.subscriptions.stripePixCapability);
    assertApiSuccess(
      response,
      'Nao foi possivel consultar a disponibilidade de PIX na Stripe.',
    );

    return mergeResponsePayload(response, {});
  },

  /**
   * Solicita a capability pix_payments por contexto administrativo autorizado.
   * @since 1.0.0
   */
  async requestStripePixCapability(): Promise<SubscriptionApiPayload> {
    const response = await apiClient.post<SubscriptionApiPayload>(
      ENDPOINTS.subscriptions.stripePixCapability,
      { request: true },
    );
    assertApiSuccess(
      response,
      'Nao foi possivel solicitar a ativacao do PIX na Stripe.',
    );

    return mergeResponsePayload(response, {});
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
  ): Promise<CouponValidationResponse> {
    try {
      const response = await apiClient.post<CouponValidationResponse>(
        ENDPOINTS.subscriptions.validateCoupon,
        {
          code,
          amount,
          plan_id: options.planId,
          item_id: options.itemId,
          target_type: options.targetType,
          target_id: options.targetId,
        },
      );
      const merged = mergeResponsePayload(response, {} as CouponValidationResponse);

      return {
        ...assertApiSuccess(response, 'Nao foi possivel validar o cupom.').raw,
        coupon: merged.coupon ?? null,
      };
    } catch (error) {
      clientLog.warn('Error validating coupon:', error);
      throw error;
    }
  },

  /**
   * Abre uma sessao do portal Stripe para gestao de billing do usuario.
   * @since 1.0.0
   */
  async createStripePortalSession(): Promise<SubscriptionApiPayloadWithUrl> {
    try {
      const response = await apiClient.post<SubscriptionApiPayloadWithUrl>(
        ENDPOINTS.subscriptions.createStripePortal,
        {},
      );
      assertApiSuccess(
        response,
        'Nao foi possivel abrir o portal Stripe.',
      );

      return mergeResponsePayloadWithUrl(response, {});
    } catch (error) {
      clientLog.error('Error creating Stripe portal session:', error);
      throw error;
    }
  },

  /**
   * Atualiza a preferencia de renovacao automatica da assinatura atual.
   * @since 1.0.0
   */
  async updateRenewal(autoRenew: boolean): Promise<SubscriptionApiPayload> {
    const response = await apiClient.post<SubscriptionApiPayload>(
      ENDPOINTS.subscriptions.updateRenewal,
      { auto_renew: autoRenew },
    );

    assertApiSuccess(
      response,
      'Nao foi possivel atualizar a renovacao automatica.',
    );

    return mergeResponsePayload(response, {});
  },

  /**
   * Sincroniza a assinatura Stripe do usuario atual para recuperar renovacoes
   * que tenham sido confirmadas no provedor mas ainda nao refletidas localmente.
   * @since 1.0.0
   */
  async syncCurrentStripeState(): Promise<SubscriptionApiPayload> {
    const response = await apiClient.post<SubscriptionApiPayload>(
      ENDPOINTS.subscriptions.syncCurrent,
      {},
    );

    assertApiSuccess(
      response,
      'Nao foi possivel sincronizar a assinatura agora.',
    );

    return mergeResponsePayload(response, {});
  },

  /**
   * Solicita cancelamento da assinatura ativa com contexto opcional.
   * @since 1.0.0
   */
  async cancelSubscription(
    reason?: string,
    details?: string,
    captchaToken?: string | null,
    confirmDebtCharge = false,
  ): Promise<CancelSubscriptionResponse> {
    try {
      const response = await apiClient.post<CancelSubscriptionResponse>(
        ENDPOINTS.subscriptions.cancel,
        {
          reason,
          details,
          captchaToken,
          confirmDebtCharge,
        },
      );
      const merged = mergeResponsePayload(response, {} as CancelSubscriptionResponse);

      return {
        ...assertApiSuccess(response, 'Nao foi possivel cancelar a assinatura.').raw,
        refund_processed: typeof merged.refund_processed === 'boolean' ? merged.refund_processed : false,
        refund_id: typeof merged.refund_id === 'string' || merged.refund_id === null ? merged.refund_id : null,
        debt_settled: typeof merged.debt_settled === 'boolean' ? merged.debt_settled : false,
        debt_settlement_amount: typeof merged.debt_settlement_amount === 'number' ? merged.debt_settlement_amount : 0,
        debt_transaction_id: typeof merged.debt_transaction_id === 'number' || typeof merged.debt_transaction_id === 'string' || merged.debt_transaction_id === null
          ? merged.debt_transaction_id
          : null,
      };
    } catch (error) {
      clientLog.error('Error canceling subscription:', error);
      throw error;
    }
  },

  /**
   * Cancela uma solicitacao de reembolso/cancelamento ainda pendente.
   * @since 1.0.0
   */
  async cancelRefundRequest(): Promise<SubscriptionApiPayload> {
    try {
      const response = await apiClient.post<SubscriptionApiPayload>(ENDPOINTS.subscriptions.cancelRefund, {});
      assertApiSuccess(
        response,
        'Nao foi possivel cancelar a solicitacao de reembolso.',
      );

      return mergeResponsePayload(response, {});
    } catch (error) {
      clientLog.warn('Error canceling refund request:', error);
      throw error;
    }
  },

  /**
   * Reverte uma solicitacao de cancelamento antes do fechamento final.
   * @since 1.0.0
   */
  async undoCancellationRequest(): Promise<SubscriptionApiPayload> {
    try {
      const response = await apiClient.post<SubscriptionApiPayload>(ENDPOINTS.subscriptions.undoCancel, {});
      assertApiSuccess(
        response,
        'Nao foi possivel reverter a solicitacao de cancelamento.',
      );

      return mergeResponsePayload(response, {});
    } catch (error) {
      clientLog.warn('Error undoing cancellation request:', error);
      throw error;
    }
  },
};

export default subscriptionsService;
