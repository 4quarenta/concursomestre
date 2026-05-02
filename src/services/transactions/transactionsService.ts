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

    const response = await apiClient.get<PurchaseTransactionResponse>(ENDPOINTS.transactions.list, {
      params: queryParams,
    });

    const payload = readApiData<{ rows?: Transaction[] }>(response, {});
    return payload.rows || [];
  },

  /**
   * Cria a transacao local de compra de material no backend oficial.
   * @since 1.0.0
   */
  async createMaterialPurchase(materialId: string | number, couponCode?: string): Promise<Transaction> {
    const response = await apiClient.post<PurchaseTransactionResponse>(ENDPOINTS.transactions.create, {
      material_id: materialId,
      coupon_code: couponCode,
    });

    assertApiSuccess(response, 'Nao foi possivel registrar a compra.');
    const payload = readApiData<PurchaseTransactionResponse>(response, { transaction: {} as Transaction });
    return payload.transaction;
  },

  /**
   * Solicita estorno de uma transacao existente.
   * @since 1.0.0
   */
  async requestRefund(transactionId: string, reason: string): Promise<RefundMutationResponse> {
    const response = await apiClient.post<RefundMutationPayload>(ENDPOINTS.transactions.refund, {
      transaction_id: transactionId,
      reason,
    });

    const envelope = assertApiSuccess(response, 'Nao foi possivel solicitar o reembolso.');
    const payload = readApiData<RefundMutationPayload>(response, {});

    return {
      message: payload.message || payload.data?.message || envelope.message,
    };
  },

  /**
   * Cancela uma solicitacao de estorno pendente.
   * @since 1.0.0
   */
  async cancelRefundRequest(transactionId: string | number): Promise<RefundMutationResponse> {
    const response = await apiClient.delete<RefundMutationPayload>(ENDPOINTS.transactions.refund, {
      data: {
        transaction_id: transactionId,
      },
    });

    const envelope = assertApiSuccess(response, 'Nao foi possivel cancelar a solicitacao de reembolso.');
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
  ): Promise<RefundMutationResponse> {
    const endpoint = resolution === 'approved'
      ? ENDPOINTS.transactions.approveRefund
      : ENDPOINTS.transactions.rejectRefund;

    const response = await apiClient.post<RefundMutationPayload>(endpoint, {
      transaction_id: transactionId,
      reason,
    });

    const envelope = assertApiSuccess(response, 'Nao foi possivel atualizar o estorno.');
    const payload = readApiData<RefundMutationPayload>(response, {});

    return {
      message: payload.message || payload.data?.message || envelope.message,
    };
  },
};

export default transactionsService;
