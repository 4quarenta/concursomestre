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

  async updateRenewal(autoRenew: boolean): Promise<{ autoRenew: boolean; message?: string }> {
    const response: any = await apiClient.post<any>(ENDPOINTS.subscriptions.updateRenewal, {
      auto_renew: autoRenew,
    });

    const envelope = assertApiSuccess(response, 'Nao foi possivel atualizar a renovacao automatica.');
    const payload = readApiData<any>(response, {});
    const resolvedAutoRenew = typeof payload?.auto_renew === 'boolean'
      ? payload.auto_renew
      : typeof response?.auto_renew === 'boolean'
        ? response.auto_renew
        : autoRenew;

    return {
      autoRenew: resolvedAutoRenew,
      message: payload?.message || envelope.message || response?.message,
    };
  },

  async cancelRefundRequest(): Promise<{ message?: string }> {
    const response: any = await apiClient.post<any>(ENDPOINTS.subscriptions.cancelRefund, {});
    const envelope = assertApiSuccess(response, 'Nao foi possivel cancelar a solicitacao de reembolso.');
    const payload = readApiData<any>(response, {});
    return {
      message: payload?.message || envelope.message || response?.message,
    };
  },

  async cancelSubscription(reason?: string, details?: string): Promise<{ message?: string }> {
    const response: any = await apiClient.post<any>(ENDPOINTS.subscriptions.cancel, {
      reason,
      details,
    });
    const envelope = assertApiSuccess(response, 'Nao foi possivel cancelar a assinatura.');
    const payload = readApiData<any>(response, {});
    return {
      message: payload?.message || envelope.message || response?.message,
    };
  },

  async undoCancellationRequest(): Promise<{ message?: string }> {
    const response: any = await apiClient.post<any>(ENDPOINTS.subscriptions.undoCancel, {});
    const envelope = assertApiSuccess(response, 'Nao foi possivel reativar a assinatura.');
    const payload = readApiData<any>(response, {});
    return {
      message: payload?.message || envelope.message || response?.message,
    };
  },
};

export default subscriptionsService;
