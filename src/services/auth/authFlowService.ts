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
import { readApiErrorMessage } from '@services/api/response';
import type { ApiResponse } from '@services/api/types';
import type { CanonicalSessionData } from './session';

export type AuthFlowSuccessPayload = {
  success: true;
  data: AuthFlowApiData;
  token?: string | null;
  require2FA?: boolean;
  email?: string;
  emailDelivery?: AuthEmailDelivery;
};

export type AuthEmailDelivery = {
  status?: 'sent' | 'failed' | 'disabled' | string;
  message?: string;
  reason?: string;
};

type RegisterPayload = {
  name: string;
  cpf: string;
  phone: string;
  email: string;
  password: string;
  captchaToken?: string | null;
  referralCode?: string | null;
};

type LoginPayload = {
  email: string;
  password: string;
  captchaToken?: string | null;
};

export type ConfirmEmailResult = {
  message: string;
  newXp: number;
};

export type ResetPasswordPayload = {
  token: string;
  password: string;
  captchaToken?: string | null;
};

export type ForgotPasswordPayload = {
  email: string;
  captchaToken?: string | null;
};

export type VerifyTwoFactorPayload = {
  email: string;
  code: string;
};

export type AuthFlowApiData = Partial<CanonicalSessionData> & {
  token?: string | null;
  require2FA?: boolean;
  email?: string;
  emailDelivery?: AuthEmailDelivery;
  authSession?: {
    id?: string;
    accessExpiresIn?: number;
    refreshExpiresAt?: string;
  };
};

type AuthFlowApiResponse = ApiResponse<AuthFlowApiData> | AuthFlowApiData;
type AuthMessageResponse = ApiResponse<Record<string, never>> | { message?: string };
type ConfirmEmailApiResponse = ApiResponse<{ newXp?: number }> | { newXp?: number };
type VerifyTwoFactorApiResponse = ApiResponse<AuthFlowApiData> | AuthFlowApiData;

const normalizeAuthFlowError = (error: unknown, fallbackMessage: string): Error => {
  return new Error(readApiErrorMessage(error, fallbackMessage));
};

const buildAuthFlowSuccessPayload = (data: AuthFlowApiData): AuthFlowSuccessPayload => ({
  success: true,
  data: {
    ...data,
    token: data.token ?? null,
    require2FA: Boolean(data.require2FA),
    email: data.email,
    emailDelivery: data.emailDelivery,
  },
  token: data.token ?? null,
  require2FA: Boolean(data.require2FA),
  email: data.email,
  emailDelivery: data.emailDelivery,
});

/**
 * Centraliza os fluxos de autenticacao usados por telas de entrada e checkout.
 * Mantém cadastro, login, confirmação e 2FA alinhados ao contrato oficial do backend.
 * @since 1.0.0
 */
export const authFlowService = {
  /**
   * Cria uma conta e devolve o usuário autenticado no mesmo contrato usado
   * pelo provider de sessão.
   * @since 1.0.0
   */
  async register(payload: RegisterPayload): Promise<AuthFlowSuccessPayload> {
    const response = await apiClient.post<AuthFlowApiResponse>(ENDPOINTS.auth.register, payload);
    assertApiSuccess<AuthFlowApiData>(response, 'Não foi possível criar a conta.');

    const data = readApiData<AuthFlowApiData>(response, {});
    return buildAuthFlowSuccessPayload(data);
  },

  /**
   * Realiza login com email e senha usando o contrato oficial do backend.
   * O resultado desta funcao alimenta o bootstrap de sessao do shell principal do site.
   * @since 1.0.0
   */
  async login(payload: LoginPayload): Promise<AuthFlowSuccessPayload> {
    const response = await apiClient.post<AuthFlowApiResponse>(ENDPOINTS.auth.login, payload);
    assertApiSuccess<AuthFlowApiData>(response, 'Não foi possível realizar o login.');

    const data = readApiData<AuthFlowApiData>(response, {});
    return buildAuthFlowSuccessPayload(data);
  },

  /**
   * Dispara o fluxo inicial de recuperação de senha para o e-mail informado.
   * @since 1.0.0
   */
  async forgotPassword(payload: ForgotPasswordPayload): Promise<string> {
    const response = await apiClient.post<AuthMessageResponse>(ENDPOINTS.auth.forgotPassword, payload);
    const envelope = assertApiSuccess(response, 'Não foi possível enviar as instruções de recuperação.');

    return envelope.message || 'Enviamos as instruções para redefinir sua senha.';
  },

  /**
   * Reenvia o e-mail de confirmação para a conta informada.
   * @since 1.0.0
   */
  async resendConfirmation(email: string): Promise<string> {
    const response = await apiClient.post<AuthMessageResponse>(ENDPOINTS.auth.resendConfirmation, { email });
    const envelope = assertApiSuccess(response, 'Não foi possível reenviar o e-mail de confirmação.');
    return envelope.message || 'E-mail de confirmação reenviado com sucesso.';
  },

  /**
   * Confirma o e-mail do usuário a partir do token enviado no fluxo de cadastro.
   * @since 1.0.0
   */
  async confirmEmail(token: string): Promise<ConfirmEmailResult> {
    try {
      const response = await apiClient.post<ConfirmEmailApiResponse>(ENDPOINTS.auth.confirmEmail, { token });
      const envelope = assertApiSuccess(response, 'Não foi possível confirmar o e-mail.');
      const data = readApiData<{ newXp?: number }>(response, {});

      return {
        message: envelope.message || 'E-mail verificado com sucesso!',
        newXp: Number(data.newXp ?? 0),
      };
    } catch (error) {
      throw normalizeAuthFlowError(error, 'Não foi possível confirmar o e-mail.');
    }
  },

  /**
   * Finaliza o fluxo de redefinição de senha usando o token do e-mail.
   * @since 1.0.0
   */
  async resetPassword(payload: ResetPasswordPayload): Promise<string> {
    const response = await apiClient.post<AuthMessageResponse>(ENDPOINTS.auth.resetPassword, payload);
    const envelope = assertApiSuccess(response, 'Não foi possível redefinir a senha.');

    return envelope.message || 'Senha alterada com sucesso.';
  },

  /**
   * Valida o código do segundo fator e devolve o token de sessão liberado.
   * Esse retorno é usado pelo login para concluir a entrada sem duplicar regras na UI.
   * @since 1.0.0
   */
  async verifyTwoFactor(payload: VerifyTwoFactorPayload): Promise<AuthFlowApiData & { message: string }> {
    const response = await apiClient.post<VerifyTwoFactorApiResponse>(ENDPOINTS.auth.verifyTwoFactor, payload);
    const envelope = assertApiSuccess(response, 'Não foi possível validar o código de segurança.');
    const data = readApiData<AuthFlowApiData>(response, {});

    return {
      ...data,
      token: data.token ?? null,
      message: envelope.message || 'Código validado com sucesso.',
    };
  },
};

export default authFlowService;
