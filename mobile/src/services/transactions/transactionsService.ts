import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { readApiData } from '@/services/api/response';
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
};

export default transactionsService;
