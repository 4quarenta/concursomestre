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
import { buildRequestCacheKey, withRequestCoalescing } from '@services/api/requestCoalescer';
import type { Transaction } from '@types';

type TransactionListParams = {
  userId?: string;
  scope?: 'buyer' | 'seller' | 'all';
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  type?: string;
};

type PurchaseTransactionResponse = {
  transaction: Transaction;
  rows?: Transaction[];
};

type RefundMutationResponse = {
  message?: string;
};

type RefundMutationPayload = {
  message?: string;
  data?: {
    message?: string;
  };
};

/**
 * Normaliza respostas da API para manter os consumidores desacoplados do formato legado.
 * @since 1.0.0
 */
export const transactionsService = {
  /**
   * Lista transacoes com filtros de usuario, escopo e periodo.
   * @since 1.0.0
   */
  async list(params: TransactionListParams = {}): Promise<Transaction[]> {
    const queryParams: Record<string, string | number> = {};

    if (params.userId) queryParams.user_id = params.userId;
    if (params.scope) queryParams.scope = params.scope;
    if (params.page) queryParams.page = params.page;
    if (params.limit) queryParams.limit = params.limit;
    if (params.startDate) queryParams.start_date = params.startDate;
    if (params.endDate) queryParams.end_date = params.endDate;
    if (params.status) queryParams.status = params.status;
    if (params.type) queryParams.type = params.type;

    return withRequestCoalescing(
      buildRequestCacheKey('transactions:list', queryParams),
      async () => {
        const response = await apiClient.get<PurchaseTransactionResponse>(ENDPOINTS.transactions.list, {
          params: queryParams,
        });

        const payload = readApiData<{ rows?: Transaction[] }>(response, {});
        return payload.rows || [];
      },
      3000,
    );
  },

  /**
   * Cria a transação local de compra de material no backend oficial.
   * @since 1.0.0
   */
  async createMaterialPurchase(materialId: string | number, couponCode?: string): Promise<Transaction> {
    const response = await apiClient.post<PurchaseTransactionResponse>(ENDPOINTS.transactions.create, {
      material_id: materialId,
      coupon_code: couponCode,
    });

    assertApiSuccess(response, 'Não foi possível registrar a compra.');
    const payload = readApiData<PurchaseTransactionResponse>(response, { transaction: {} as Transaction });
    return payload.transaction;
  },

  /**
   * Solicita estorno de uma transação existente.
   * @since 1.0.0
   */
  async requestRefund(transactionId: string, reason: string): Promise<RefundMutationResponse> {
    const response = await apiClient.post<RefundMutationPayload>(ENDPOINTS.transactions.refund, {
      transaction_id: transactionId,
      reason,
    });

    const envelope = assertApiSuccess(response, 'Não foi possível solicitar o reembolso.');
    const payload = readApiData<RefundMutationPayload>(response, {});

    return {
      message: payload.message || payload.data?.message || envelope.message,
    };
  },

  /**
   * Cancela uma solicitação de estorno pendente.
   * @since 1.0.0
   */
  async cancelRefundRequest(transactionId: string | number): Promise<RefundMutationResponse> {
    const response = await apiClient.delete<RefundMutationPayload>(ENDPOINTS.transactions.refund, {
      data: {
        transaction_id: transactionId,
      },
    });

    const envelope = assertApiSuccess(response, 'Não foi possível cancelar a solicitação de reembolso.');
    const payload = readApiData<RefundMutationPayload>(response, {});

    return {
      message: payload.message || payload.data?.message || envelope.message,
    };
  },

  /**
   * Aprova ou rejeita administrativamente um estorno.
   * @since 1.0.0
   */
  async resolveRefund(
    transactionId: string,
    resolution: 'approved' | 'retention_offer',
    reason?: string,
    retention?: { offeredDays: number; expiresAt: string; userNote?: string; internalNote?: string },
  ): Promise<RefundMutationResponse> {
    const endpoint = resolution === 'approved'
      ? ENDPOINTS.transactions.approveRefund
      : ENDPOINTS.transactions.rejectRefund;

    const response = await apiClient.post<RefundMutationPayload>(endpoint, {
      transaction_id: transactionId,
      reason,
      actor_id: undefined,
      offered_days: resolution === 'retention_offer' ? retention?.offeredDays : undefined,
      expires_at: resolution === 'retention_offer' ? retention?.expiresAt : undefined,
      user_note: resolution === 'retention_offer' ? retention?.userNote : undefined,
      internal_note: resolution === 'retention_offer' ? retention?.internalNote : undefined,
    });

    const envelope = assertApiSuccess(response, 'Não foi possível atualizar o estorno.');
    const payload = readApiData<RefundMutationPayload>(response, {});

    return {
      message: payload.message || payload.data?.message || envelope.message,
    };
  },

  async decideRefundRetentionOffer(offerId: string, decision: 'ACCEPT' | 'DECLINE'): Promise<RefundMutationResponse> {
    const response = await apiClient.post<RefundMutationPayload>(ENDPOINTS.transactions.retentionOfferDecision, {
      offer_id: offerId,
      decision,
    });
    const envelope = assertApiSuccess(response, 'Não foi possível registrar a decisão da oferta.');
    const payload = readApiData<RefundMutationPayload>(response, {});
    return { message: payload.message || payload.data?.message || envelope.message };
  },
};

export default transactionsService;
