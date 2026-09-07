import { apiClient, assertApiSuccess, readApiData } from '@services/api';
import type { ApiResponse } from '@services/api';
import { getCsrfToken } from '@services/auth/session';

export type AdminBenefitDefinition = {
  id: string;
  definition_key: string;
  name: string;
  benefit_mode: string;
  access_plan: string | null;
  access_duration_days: number;
  billing_extension_days: number;
  stacking_policy: string;
  starts_at: string | null;
  expires_at: string | null;
  active: number;
  source_scope: string;
};

export type AdminBenefitCreateCodeResult = {
  id: string;
  code: string;
  code_hint: string;
  scope: string;
};

const requestApi = <T>(request: Promise<unknown>): Promise<ApiResponse<T>> => request as Promise<ApiResponse<T>>;

const post = async <T>(payload: Record<string, unknown>): Promise<T> => {
  const csrfToken = getCsrfToken();
  const response = await requestApi<T>(apiClient.post<ApiResponse<T>>(
    'admin/benefits.php',
    payload,
    csrfToken ? { headers: { 'X-CSRF-Token': csrfToken } } : undefined,
  ));
  return readApiData(assertApiSuccess<T>(response, 'Não foi possível concluir a operação de benefício.'), {} as T);
};

export const adminBenefitsService = {
  async listDefinitions(): Promise<AdminBenefitDefinition[]> {
    const response = await requestApi<{ definitions?: AdminBenefitDefinition[] }>(apiClient.get<ApiResponse<{ definitions?: AdminBenefitDefinition[] }>>(
      'admin/benefits.php?action=definitions',
    ));
    return readApiData(response, { definitions: [] }).definitions || [];
  },

  createDefinition(payload: Record<string, unknown>): Promise<AdminBenefitDefinition> {
    return post<AdminBenefitDefinition>({ action: 'create_definition', ...payload });
  },

  createCode(payload: Record<string, unknown>): Promise<AdminBenefitCreateCodeResult> {
    return post<AdminBenefitCreateCodeResult>({ action: 'create_code', ...payload });
  },

  grant(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return post<Record<string, unknown>>({ action: 'grant', ...payload });
  },
};

export default adminBenefitsService;
