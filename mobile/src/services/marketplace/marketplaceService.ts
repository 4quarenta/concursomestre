import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData } from '@/services/api/response';
import type { Material } from '@/types/materials';

type ListFilters = {
  subject?: string;
};

/**
 * Fachada mobile do dominio de marketplace.
 * @since v1.0.0
 */
export const marketplaceService = {
  async listMaterials(filters: ListFilters = {}): Promise<Material[]> {
    const response: any = await apiClient.get<any>(ENDPOINTS.materials.list, {
      params: filters,
    });

    const payload = readApiData<any>(response, []);
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.rows)
        ? payload.rows
        : [];

    return rows as Material[];
  },

  async createMaterialPurchase(materialId: string | number, couponCode?: string): Promise<{ transactionId: string }> {
    const response: any = await apiClient.post<any>(ENDPOINTS.transactions.create, {
      material_id: materialId,
      coupon_code: couponCode,
    });

    const envelope = assertApiSuccess(response, 'Nao foi possivel concluir a compra deste material.');
    const payload = readApiData<any>(envelope.raw, {});
    const transactionId = String(
      payload?.transaction?.id
      || payload?.transaction_id
      || envelope.raw?.transaction?.id
      || envelope.raw?.transaction_id
      || '',
    ).trim();

    return { transactionId };
  },
};

export default marketplaceService;
