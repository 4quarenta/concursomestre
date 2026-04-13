import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData } from '@/services/api/response';

/**
 * Operacoes de assinatura/billing para o app mobile.
 * @since v1.0.0
 */
export const subscriptionsService = {
  async createStripePortalSession(): Promise<{ url: string }> {
    const response: any = await apiClient.post<any>(ENDPOINTS.subscriptions.createStripePortal, {});
    assertApiSuccess(response, 'Nao foi possivel abrir o portal da Stripe.');
    const payload = readApiData<any>(response, {});
    const url = String(payload?.url || response?.url || payload?.redirect_url || '').trim();
    if (!url) {
      throw new Error('Portal da Stripe retornou sem URL.');
    }
    return { url };
  },
};

export default subscriptionsService;
