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

import type { UserProfile } from '@/types';
import { assertApiSuccess, readApiData, readApiErrorMessage, requestApi } from '@/lib/browserApi';

const AUTH_ENDPOINTS = {
  login: 'auth/login.php',
  register: 'auth/register.php',
  forgotPassword: 'auth/forgot-password.php',
  confirmEmail: 'auth/confirm-email.php',
  logout: 'auth/logout.php',
  resetPassword: 'auth/reset-password.php',
  resendConfirmation: 'auth/resend-confirmation.php',
  verifyTwoFactor: 'auth/verify_2fa.php',
} as const;

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

const normalizeAuthFlowError = (error: unknown, fallbackMessage: string): Error => {
  return new Error(readApiErrorMessage(error, fallbackMessage));
};

export const authFlowService = {
  async register(payload: RegisterPayload): Promise<AuthFlowSuccessPayload> {
    const response = await requestApi<any>(AUTH_ENDPOINTS.register, {
      method: 'POST',
      body: payload,
    });

    assertApiSuccess(response, 'Nao foi possivel criar a conta.');
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

  async login(payload: LoginPayload): Promise<AuthFlowSuccessPayload> {
    const response = await requestApi<any>(AUTH_ENDPOINTS.login, {
      method: 'POST',
      body: payload,
    });

    assertApiSuccess(response, 'Nao foi possivel realizar o login.');
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

  async forgotPassword(payload: ForgotPasswordPayload): Promise<string> {
    const response = await requestApi<any>(AUTH_ENDPOINTS.forgotPassword, {
      method: 'POST',
      body: payload,
    });

    const envelope = assertApiSuccess(response, 'Nao foi possivel enviar as instrucoes de recuperacao.');
    return envelope.message || 'Enviamos as instrucoes para redefinir sua senha.';
  },

  async resendConfirmation(email: string): Promise<string> {
    const response = await requestApi<any>(AUTH_ENDPOINTS.resendConfirmation, {
      method: 'POST',
      body: { email },
    });

    const envelope = assertApiSuccess(response, 'Nao foi possivel reenviar o e-mail de confirmacao.');
    return envelope.message || 'E-mail de confirmacao reenviado com sucesso.';
  },

  async confirmEmail(token: string): Promise<ConfirmEmailResult> {
    try {
      const response = await requestApi<any>(AUTH_ENDPOINTS.confirmEmail, {
        method: 'POST',
        body: { token },
      });

      const envelope = assertApiSuccess(response, 'Nao foi possivel confirmar o e-mail.');
      const data = readApiData<{ newXp?: number }>(response, {});

      return {
        message: envelope.message || 'E-mail verificado com sucesso!',
        newXp: Number(data.newXp ?? 0),
      };
    } catch (error) {
      throw normalizeAuthFlowError(error, 'Nao foi possivel confirmar o e-mail.');
    }
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<string> {
    const response = await requestApi<any>(AUTH_ENDPOINTS.resetPassword, {
      method: 'POST',
      body: payload,
    });

    const envelope = assertApiSuccess(response, 'Nao foi possivel redefinir a senha.');
    return envelope.message || 'Senha alterada com sucesso.';
  },

  async verifyTwoFactor(payload: VerifyTwoFactorPayload): Promise<{ token: string | null; message: string }> {
    const response = await requestApi<any>(AUTH_ENDPOINTS.verifyTwoFactor, {
      method: 'POST',
      body: payload,
    });

    const envelope = assertApiSuccess(response, 'Nao foi possivel validar o codigo de seguranca.');
    const data = readApiData<{ token?: string | null }>(response, {});

    return {
      token: data.token ?? null,
      message: envelope.message || 'Codigo validado com sucesso.',
    };
  },
};

export default authFlowService;
