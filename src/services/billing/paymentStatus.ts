import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';
import { buildRequestCacheKey, clearRequestCoalescing, withRequestCoalescing } from '@services/api/requestCoalescer';
import type { ApiResponse } from '@services/api';

export type PaymentActionRequired =
  | 'add_payment_method'
  | 'replace_expired_payment_method'
  | 'payment_failed'
  | 'authentication_required'
  | null;

export type PaymentStatus = {
  subscriptionStatus: string;
  billingMode: 'free' | 'manual' | 'offline' | 'trial' | 'non_recurring' | 'recurring_card' | string;
  requiresPaymentMethod: boolean;
  hasValidPaymentMethod: boolean;
  actionRequired: PaymentActionRequired;
};

const PAYMENT_STATUS_CACHE_KEY = buildRequestCacheKey('billing:payment-status', { scope: 'self' });
const PAYMENT_STATUS_STALE_TIME_MS = 60_000;

export const shouldShowPaymentWarning = (status: PaymentStatus | null | undefined): boolean => Boolean(
  status
  && status.subscriptionStatus === 'active'
  && status.requiresPaymentMethod === true
  && status.hasValidPaymentMethod === false
  && status.actionRequired !== null,
);

export const paymentStatusService = {
  async getCurrentUserStatus(signal?: AbortSignal): Promise<PaymentStatus> {
    return withRequestCoalescing(PAYMENT_STATUS_CACHE_KEY, async () => {
      const response = await apiClient.get<ApiResponse<PaymentStatus>>(ENDPOINTS.users.paymentStatus, { signal });
      assertApiSuccess(response, 'Não foi possível verificar a forma de pagamento.');
      const data = readApiData<Partial<PaymentStatus>>(response, {});

      if (
        typeof data.subscriptionStatus !== 'string'
        || typeof data.billingMode !== 'string'
        || typeof data.requiresPaymentMethod !== 'boolean'
        || typeof data.hasValidPaymentMethod !== 'boolean'
        || !('actionRequired' in data)
      ) {
        throw new Error('Contrato de status financeiro incompleto.');
      }

      return {
        subscriptionStatus: data.subscriptionStatus,
        billingMode: data.billingMode,
        requiresPaymentMethod: data.requiresPaymentMethod,
        hasValidPaymentMethod: data.hasValidPaymentMethod,
        actionRequired: data.actionRequired ?? null,
      };
    }, PAYMENT_STATUS_STALE_TIME_MS);
  },
  invalidate(): void {
    clearRequestCoalescing('billing:payment-status');
  },
};
