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
  recoveryUrl?: string | null;
  invoice?: {
    status: string;
    currency: string;
    amountDue: number;
    amountRemaining: number;
    hostedInvoiceUrl: string | null;
    nextPaymentAttemptAt: string | null;
    dueAt: string | null;
    requiresAuthentication: boolean;
  } | null;
};

const PAYMENT_STATUS_CACHE_KEY = buildRequestCacheKey('billing:payment-status', { scope: 'self' });
const PAYMENT_STATUS_STALE_TIME_MS = 60_000;
export const PAYMENT_STATUS_INVALIDATED_EVENT = 'billing:payment-status-invalidated';

export const shouldLoadPaymentStatusForPath = (pathname: string): boolean => (
  pathname === '/profile/billing'
  || pathname === '/profile/personal'
  || pathname === '/profile/billing-history'
  || pathname.startsWith('/checkout')
);

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
        recoveryUrl: typeof data.recoveryUrl === 'string' ? data.recoveryUrl : null,
        invoice: data.invoice && typeof data.invoice === 'object'
          ? data.invoice as PaymentStatus['invoice']
          : null,
      };
    }, PAYMENT_STATUS_STALE_TIME_MS);
  },
  invalidate(): void {
    clearRequestCoalescing('billing:payment-status');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(PAYMENT_STATUS_INVALIDATED_EVENT));
    }
  },
};
