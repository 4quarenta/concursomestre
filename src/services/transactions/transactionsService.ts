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
import { getCsrfToken } from '@services/auth/session';
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

type TransactionRetentionOffer = {
  id?: string | number;
  status?: string;
  refundAmount?: number | string;
  paidPlan?: string;
  currentRenewalAt?: string | null;
  offeredDays?: number | string;
  expectedRenewalAt?: string | null;
  expiresAt?: string | null;
  userNote?: string | null;
  providerConfirmedAt?: string | null;
  providerReference?: string | null;
  benefitGrantId?: string | number | null;
};

const normalizeTransactionRows = (rows: Transaction[]): Transaction[] => rows.map((row) => {
  const raw = row as Transaction & {
    retention_offer?: Record<string, unknown> | string | null;
    retentionOffer?: TransactionRetentionOffer | Record<string, unknown> | string | null;
    retention_offer_id?: string | number | null;
    retention_offer_status?: string | null;
    retention_offer_refund_amount?: number | string | null;
    retention_offer_paid_plan?: string | null;
    retention_offer_offered_days?: number | string | null;
    retentionOfferId?: string | number | null;
    retentionOfferStatus?: string | null;
    retentionOfferRefundAmount?: number | string | null;
    retentionOfferPaidPlan?: string | null;
    retentionOfferOfferedDays?: number | string | null;
  };
  const rawOffer = raw.retentionOffer || raw.retention_offer;
  let offer: Record<string, unknown> | null = null;
  if (rawOffer && typeof rawOffer === 'object') {
    offer = rawOffer as Record<string, unknown>;
  } else if (typeof rawOffer === 'string') {
    try {
      const parsed = JSON.parse(rawOffer);
      if (parsed && typeof parsed === 'object') offer = parsed as Record<string, unknown>;
    } catch {
      // Ignore malformed legacy payloads and rely on flattened fields below.
    }
  }
  const flattenedStatus = raw.retention_offer_status ?? raw.retentionOfferStatus;
  if (!offer && !flattenedStatus) return row;

  const source = offer || {};
  return {
    ...row,
    retentionOffer: {
      id: String(source.id ?? source.offer_id ?? raw.retention_offer_id ?? raw.retentionOfferId ?? ''),
      status: String(source.status ?? source.offer_status ?? flattenedStatus ?? ''),
      refundAmount: Number(source.refundAmount ?? source.refund_amount ?? raw.retention_offer_refund_amount ?? raw.retentionOfferRefundAmount ?? 0),
      paidPlan: String(source.paidPlan ?? source.paid_plan ?? raw.retention_offer_paid_plan ?? raw.retentionOfferPaidPlan ?? ''),
      currentRenewalAt: (source.currentRenewalAt ?? source.current_renewal_at ?? null) as string | null,
      offeredDays: Number(source.offeredDays ?? source.offered_days ?? raw.retention_offer_offered_days ?? raw.retentionOfferOfferedDays ?? 0),
      expectedRenewalAt: (source.expectedRenewalAt ?? source.expected_renewal_at ?? null) as string | null,
      expiresAt: (source.expiresAt ?? source.expires_at ?? null) as string | null,
      userNote: (source.userNote ?? source.user_note ?? null) as string | null,
      providerConfirmedAt: (source.providerConfirmedAt ?? source.provider_confirmed_at ?? null) as string | null,
      providerReference: (source.providerReference ?? source.provider_reference ?? null) as string | null,
      benefitGrantId: (source.benefitGrantId ?? source.benefit_grant_id ?? null) as string | number | null,
    },
  } as Transaction;
});

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
        return normalizeTransactionRows(payload.rows || []);
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

    const csrfToken = getCsrfToken();
    const requestBody = {
      transaction_id: transactionId,
      reason,
      actor_id: undefined,
      offered_days: resolution === 'retention_offer' ? retention?.offeredDays : undefined,
      expires_at: resolution === 'retention_offer' ? retention?.expiresAt : undefined,
      user_note: resolution === 'retention_offer' ? retention?.userNote : undefined,
      internal_note: resolution === 'retention_offer' ? retention?.internalNote : undefined,
    };
    const response = csrfToken
      ? await apiClient.post<RefundMutationPayload>(endpoint, requestBody, { headers: { 'X-CSRF-Token': csrfToken } })
      : await apiClient.post<RefundMutationPayload>(endpoint, requestBody);

    const envelope = assertApiSuccess(response, 'Não foi possível atualizar o estorno.');
    const payload = readApiData<RefundMutationPayload>(response, {});

    return {
      message: payload.message || payload.data?.message || envelope.message,
    };
  },

  async decideRefundRetentionOffer(offerId: string, decision: 'ACCEPT' | 'DECLINE'): Promise<RefundMutationResponse> {
    const csrfToken = getCsrfToken();
    const response = csrfToken
      ? await apiClient.post<RefundMutationPayload>(ENDPOINTS.transactions.retentionOfferDecision, {
        offer_id: offerId,
        decision,
      }, { headers: { 'X-CSRF-Token': csrfToken } })
      : await apiClient.post<RefundMutationPayload>(ENDPOINTS.transactions.retentionOfferDecision, {
        offer_id: offerId,
        decision,
      });
    const envelope = assertApiSuccess(response, 'Não foi possível registrar a decisão da oferta.');
    const payload = readApiData<RefundMutationPayload>(response, {});
    return { message: payload.message || payload.data?.message || envelope.message };
  },
};

export default transactionsService;
