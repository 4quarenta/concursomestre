import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData } from '@/services/api/response';
import type { AuthFlowResponse, UserProfile } from '@/types/auth';

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  referralCode?: string | null;
};

type LoginPayload = {
  email: string;
  password: string;
};

/**
 * Fluxos de autenticacao usados no app mobile.
 * @since v1.0.0
 */
export const authFlowService = {
  async login(payload: LoginPayload): Promise<AuthFlowResponse> {
    const response = await apiClient.post<any>(ENDPOINTS.auth.login, payload);
    assertApiSuccess(response, 'Nao foi possivel realizar o login.');
    const data = readApiData<AuthFlowResponse>(response, { success: true });
    return data;
  },

  async register(payload: RegisterPayload): Promise<AuthFlowResponse> {
    const response = await apiClient.post<any>(ENDPOINTS.auth.register, payload);
    assertApiSuccess(response, 'Nao foi possivel criar a conta.');
    const data = readApiData<AuthFlowResponse>(response, { success: true });
    return data;
  },

  async me(): Promise<UserProfile> {
    const response: any = await apiClient.get<any>(ENDPOINTS.auth.user);
    assertApiSuccess(response, 'Nao foi possivel carregar o perfil.');
    const data = readApiData<{ user?: UserProfile }>(response, {});

    return data.user || (response?.user as UserProfile);
  },

  async logout(): Promise<void> {
    await apiClient.post<any>(ENDPOINTS.auth.logout, undefined);
  },
};

export default authFlowService;
