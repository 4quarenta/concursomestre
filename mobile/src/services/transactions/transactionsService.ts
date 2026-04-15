import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData } from '@/services/api/response';
import type { MobileTransaction, TransactionListParams } from '@/types/transactions';

/**
 * Historico de cobranca/transacoes para o app mobile.
 * @since v1.0.0
 */
export const transactionsService = {
  async list(params: TransactionListParams = {}): Promise<MobileTransaction[]> {
    const queryParams: Record<string, string | number> = {};

    if (params.userId) queryParams.user_id = params.userId;
    if (params.scope) queryParams.scope = params.scope;
    if (params.page) queryParams.page = params.page;
    if (params.limit) queryParams.limit = params.limit;
    if (params.startDate) queryParams.start_date = params.startDate;
    if (params.endDate) queryParams.end_date = params.endDate;
    if (params.status) queryParams.status = params.status;
    if (params.type) queryParams.type = params.type;

    const response: any = await apiClient.get<any>(ENDPOINTS.transactions.list, {
      params: queryParams,
    });

    const payload = readApiData<any>(response, {});
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    return rows as MobileTransaction[];
  },

  async requestRefund(transactionId: string, reason: string): Promise<{ message?: string }> {
    const response: any = await apiClient.post<any>(ENDPOINTS.transactions.refund, {
      transaction_id: transactionId,
      reason,
    });

    const envelope = assertApiSuccess(response, 'Nao foi possivel solicitar o reembolso.');
    const payload = readApiData<any>(response, {});
    return {
      message: payload?.message || envelope.message || response?.message,
    };
  },

  async cancelRefundRequest(transactionId: string | number): Promise<{ message?: string }> {
    const response: any = await apiClient.delete<any>(ENDPOINTS.transactions.refund, {
      data: {
        transaction_id: transactionId,
      },
    });

    const envelope = assertApiSuccess(response, 'Nao foi possivel cancelar a solicitacao de reembolso.');
    const payload = readApiData<any>(response, {});
    return {
      message: payload?.message || envelope.message || response?.message,
    };
  },
};

export default transactionsService;
