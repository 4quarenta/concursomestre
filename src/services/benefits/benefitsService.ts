import { apiClient, assertApiSuccess, readApiData, ENDPOINTS } from '@services/api';
import type { ApiResponse } from '@services/api';
import { getCsrfToken } from '@services/auth/session';

export type UserBenefit = {
  id: string;
  name: string;
  definition_key: string;
  benefit_mode: 'ACCESS_ONLY' | 'BILLING_EXTENSION_ONLY' | 'ACCESS_AND_BILLING_EXTENSION' | string;
  status: string;
  access_plan: string | null;
  billing_extension_days: number;
  grant_starts_at: string;
  grant_expires_at: string | null;
  provider_status: string | null;
  provider_old_period_end: string | null;
  provider_new_period_end: string | null;
};

export type UserBenefitSnapshot = {
  benefits: UserBenefit[];
  entitlement: {
    paid_plan: string;
    effective_access: string;
    subscription_status: string | null;
    provider_current_period_end: string | null;
  };
};

export type BenefitRedemptionResult = {
  redemption_idempotency_key: string;
  code_hint: string;
  grant: {
    id: string;
    status: string;
    access_plan: string | null;
    billing_extension_days: number;
  };
};

const requestApi = <T>(request: Promise<unknown>): Promise<ApiResponse<T>> => request as Promise<ApiResponse<T>>;

export const benefitsService = {
  async getMine(): Promise<UserBenefitSnapshot> {
    const response = await requestApi<UserBenefitSnapshot>(apiClient.get<ApiResponse<UserBenefitSnapshot>>(ENDPOINTS.users.benefits));
    assertApiSuccess(response, 'Não foi possível carregar seus Benefits.');
    return readApiData<UserBenefitSnapshot>(response, { benefits: [], entitlement: { paid_plan: 'Gratuito', effective_access: 'Gratuito', subscription_status: null, provider_current_period_end: null } });
  },

  async redeemCode(code: string): Promise<BenefitRedemptionResult> {
    const csrfToken = getCsrfToken();
    const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `benefit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const response = await requestApi<BenefitRedemptionResult>(apiClient.post<ApiResponse<BenefitRedemptionResult>>(
      ENDPOINTS.users.redeemBenefit,
      { code, idempotency_key: idempotencyKey },
      csrfToken ? { headers: { 'X-CSRF-Token': csrfToken } } : undefined,
    ));
    assertApiSuccess(response, 'Não foi possível resgatar o código.');
    return readApiData<BenefitRedemptionResult>(response, {
      redemption_idempotency_key: idempotencyKey,
      code_hint: '',
      grant: { id: '', status: 'UNKNOWN', access_plan: null, billing_extension_days: 0 },
    });
  },
};

export default benefitsService;
