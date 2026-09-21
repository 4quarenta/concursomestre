import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData } from '@/services/api/response';
import { sessionStorage } from '@/storage/sessionStorage';
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
    const data = readApiData<{
      user?: UserProfile;
      subscription?: UserProfile['subscription'];
      gamification?: { level?: number; xp?: number };
    }>(response, {});

    const user = data.user || (response?.user as UserProfile);
    if (!user) throw new Error('Sessao invalida retornada pelo backend.');

    // /auth/me devolve assinatura e gamificação no envelope da sessão, fora
    // de data.user. Mantemos esses dados no mesmo objeto usado pelo app.
    return {
      ...user,
      subscription: data.subscription || user.subscription,
      level: data.gamification?.level ?? user.level,
      xp: data.gamification?.xp ?? user.xp,
    };
  },

  async resendConfirmation(email: string): Promise<string> {
    const response: any = await apiClient.post<any>(ENDPOINTS.auth.resendConfirmation, { email });
    const envelope = assertApiSuccess(response, 'Nao foi possivel reenviar o e-mail de confirmacao.');
    return envelope.message || 'E-mail de confirmacao reenviado com sucesso.';
  },

  async logout(): Promise<void> {
    const refreshToken = sessionStorage.getRefreshToken();
    const csrfToken = sessionStorage.getCsrfToken();
    if (!refreshToken || !csrfToken) return;

    await apiClient.post<any>(ENDPOINTS.auth.logout, { refreshToken, csrfToken });
  },

  async verifyTwoFactor(email: string, code: string): Promise<AuthFlowResponse> {
    const response = await apiClient.post<any>(ENDPOINTS.auth.verifyTwoFactor, { email, code });
    assertApiSuccess(response, 'Nao foi possivel validar o codigo de seguranca.');
    return readApiData<AuthFlowResponse>(response, { success: true });
  },
};

export default authFlowService;
