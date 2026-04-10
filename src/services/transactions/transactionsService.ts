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
};

type RefundMutationResponse = {
  message?: string;
};

/**
 * Normaliza respostas da API para manter os consumidores desacoplados do
 * formato legado dos endpoints PHP.
 * @since 1.0.0
 */
export const transactionsService = {
  /**
   * Lista transações com filtros de usuário, escopo e período.
   * Essa consulta alimenta marketplace, perfil, financeiro e modais do admin.
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

    const response = await apiClient.get<any>(ENDPOINTS.transactions.list, {
      params: queryParams,
    }) as any;

    const payload = readApiData<any>(response, {});
    return payload?.rows || [];
  },

  /**
   * Cria a transação local de compra de material no backend oficial.
   * @since 1.0.0
   */
  async createMaterialPurchase(materialId: string | number, couponCode?: string): Promise<Transaction> {
    const response = await apiClient.post<any>(ENDPOINTS.transactions.create, {
      material_id: materialId,
      coupon_code: couponCode,
    }) as any;

    const raw = assertApiSuccess(response, 'Não foi possível registrar a compra.').raw;
    const payload = readApiData<PurchaseTransactionResponse>(raw, { transaction: {} as Transaction });
    return payload.transaction;
  },

  /**
   * Solicita estorno de uma transação existente.
   * @since 1.0.0
   */
  async requestRefund(transactionId: string, reason: string): Promise<RefundMutationResponse> {
    const response = await apiClient.post<any>(ENDPOINTS.transactions.refund, {
      transaction_id: transactionId,
      reason,
    }) as any;

    const raw = assertApiSuccess(response, 'Não foi possível solicitar o reembolso.').raw;
    return {
      message: raw?.message || raw?.data?.message,
    };
  },

  /**
   * Cancela uma solicitacao de estorno pendente.
   * @since 1.0.0
   */
  async cancelRefundRequest(transactionId: string | number): Promise<RefundMutationResponse> {
    const response = await apiClient.delete<any>(ENDPOINTS.transactions.refund, {
      data: {
        transaction_id: transactionId,
      },
    }) as any;

    const raw = assertApiSuccess(response, 'Não foi possível cancelar a solicitacao de reembolso.').raw;
    return {
      message: raw?.message || raw?.data?.message,
    };
  },

  /**
   * Aprova ou rejeita administrativamente um estorno.
   * @since 1.0.0
   */
  async resolveRefund(
    transactionId: string,
    resolution: 'approved' | 'rejected',
    reason?: string,
  ): Promise<RefundMutationResponse> {
    const endpoint = resolution === 'approved'
      ? ENDPOINTS.transactions.approveRefund
      : ENDPOINTS.transactions.rejectRefund;

    const response = await apiClient.post<any>(endpoint, {
      transaction_id: transactionId,
      reason,
    }) as any;

    const raw = assertApiSuccess(response, 'Não foi possível atualizar o estorno.').raw;
    return {
      message: raw?.message || raw?.data?.message,
    };
  },
};

export default transactionsService;
