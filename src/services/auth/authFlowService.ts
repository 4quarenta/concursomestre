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
import type { UserProfile } from '@types';

export type AuthFlowSuccessPayload = {
  success: true;
  data: {
    user?: UserProfile;
    token?: string | null;
    require2FA?: boolean;
    email?: string;
  };
  user?: UserProfile;
  token?: string | null;
  require2FA?: boolean;
  email?: string;
};

type RegisterPayload = {
  name: string;
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
};

export type ForgotPasswordPayload = {
  email: string;
  captchaToken?: string | null;
};

export type VerifyTwoFactorPayload = {
  email: string;
  code: string;
};

/**
 * Centraliza os fluxos de autenticação usados por telas de entrada e checkout.
 * Mantem cadastro, login, confirmacao e 2FA alinhados ao contrato oficial do backend.
 * @since 1.0.0
 */
export const authFlowService = {
  /**
   * Cria uma conta e devolve o usuário autenticado no mesmo contrato usado
   * pelo provider de sessão.
   * @since 1.0.0
   */
  async register(payload: RegisterPayload): Promise<AuthFlowSuccessPayload> {
    const response = await apiClient.post<any>(ENDPOINTS.auth.register, payload) as any;
    assertApiSuccess(response, 'Não foi possível criar a conta.');

    const data = readApiData<AuthFlowSuccessPayload>(response, {} as AuthFlowSuccessPayload);
    return {
      success: true,
      data: {
        user: data.user,
        token: data.token ?? null,
        require2FA: Boolean(data.require2FA),
        email: data.email,
      },
      user: data.user,
      token: data.token ?? null,
      require2FA: Boolean(data.require2FA),
      email: data.email,
    };
  },

  /**
   * Realiza login com email e senha usando o contrato oficial do backend.
   * O resultado desta funcao alimenta o bootstrap de sessão do shell principal do site.
   * @since 1.0.0
   */
  async login(payload: LoginPayload): Promise<AuthFlowSuccessPayload> {
    const response = await apiClient.post<any>(ENDPOINTS.auth.login, payload) as any;
    assertApiSuccess(response, 'Não foi possível realizar o login.');

    const data = readApiData<AuthFlowSuccessPayload>(response, {} as AuthFlowSuccessPayload);
    return {
      success: true,
      data: {
        user: data.user,
        token: data.token ?? null,
        require2FA: Boolean(data.require2FA),
        email: data.email,
      },
      user: data.user,
      token: data.token ?? null,
      require2FA: Boolean(data.require2FA),
      email: data.email,
    };
  },

  /**
   * Dispara o fluxo inicial de recuperacao de senha para o e-mail informado.
   * @since 1.0.0
   */
  async forgotPassword(payload: ForgotPasswordPayload): Promise<string> {
    const response = await apiClient.post<any>(ENDPOINTS.auth.forgotPassword, payload) as any;
    const envelope = assertApiSuccess(response, 'Não foi possível enviar as instrucoes de recuperacao.');

    return envelope.message || 'Enviamos as instrucoes para redefinir sua senha.';
  },

  /**
   * Reenvia o email de confirmacao para a conta informada.
   * @since 1.0.0
   */
  async resendConfirmation(email: string): Promise<string> {
    const response = await apiClient.post<any>(ENDPOINTS.auth.resendConfirmation, { email }) as any;
    const envelope = assertApiSuccess(response, 'Não foi possível reenviar o e-mail de confirmacao.');
    return envelope.message || 'E-mail de confirmacao reenviado com sucesso.';
  },

  /**
   * Confirma o e-mail do usuário a partir do token enviado no fluxo de cadastro.
   * @since 1.0.0
   */
  async confirmEmail(token: string): Promise<ConfirmEmailResult> {
    const response = await apiClient.post<any>(ENDPOINTS.auth.confirmEmail, { token }) as any;
    const envelope = assertApiSuccess(response, 'Não foi possível confirmar o e-mail.');
    const data = readApiData<{ newXp?: number }>(response, {});

    return {
      message: envelope.message || 'E-mail verificado com sucesso!',
      newXp: Number(data.newXp ?? 0),
    };
  },

  /**
   * Finaliza o fluxo de redefinição de senha usando o token do e-mail.
   * @since 1.0.0
   */
  async resetPassword(payload: ResetPasswordPayload): Promise<string> {
    const response = await apiClient.post<any>(ENDPOINTS.auth.resetPassword, payload) as any;
    const envelope = assertApiSuccess(response, 'Não foi possível redefinir a senha.');

    return envelope.message || 'Senha alterada com sucesso.';
  },

  /**
   * Valida o código do segundo fator e devolve o token de sessão liberado.
   * Esse retorno e usado pelo login para concluir a entrada sem duplicar regras na UI.
   * @since 1.0.0
   */
  async verifyTwoFactor(payload: VerifyTwoFactorPayload): Promise<{ token: string | null; message: string }> {
    const response = await apiClient.post<any>(ENDPOINTS.auth.verifyTwoFactor, payload) as any;
    const envelope = assertApiSuccess(response, 'Não foi possível validar o código de segurança.');
    const data = readApiData<{ token?: string | null }>(response, {});

    return {
      token: data.token ?? null,
      message: envelope.message || 'Código validado com sucesso.',
    };
  },
};

export default authFlowService;
