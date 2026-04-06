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

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    post: mockPost,
  },
  readApiData: (response: any, fallback: any) => {
    if (response?.data !== undefined) return response.data;
    return response ?? fallback;
  },
  assertApiSuccess: (response: any, fallbackMessage: string) => {
    if (!response?.success) {
      throw new Error(response?.message || response?.error || fallbackMessage);
    }

    return {
      success: true,
      message: response?.message,
      data: response?.data,
      raw: response,
    };
  },
  ENDPOINTS: {
    auth: {
      register: 'auth/register.php',
      login: 'auth/login.php',
      forgotPassword: 'auth/forgot-password.php',
      verifyTwoFactor: 'auth/verify_2fa.php',
      confirmEmail: 'auth/confirm-email.php',
      resendConfirmation: 'auth/resend-confirmation.php',
      resetPassword: 'auth/reset-password.php',
    },
  },
}));

import { authFlowService } from '../authFlowService';

describe('authFlowService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers through the official auth endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        user: { id: 'user-1', name: 'Teste' },
        token: 'tok_123',
      },
    });

    const result = await authFlowService.register({
      name: 'Teste',
      email: 'teste@example.com',
      password: '123456',
      captchaToken: 'captcha',
      referralCode: 'REF10',
    });

    expect(mockPost).toHaveBeenCalledWith('auth/register.php', {
      name: 'Teste',
      email: 'teste@example.com',
      password: '123456',
      captchaToken: 'captcha',
      referralCode: 'REF10',
    });
    expect(result.success).toBe(true);
    expect(result.data.user.id).toBe('user-1');
    expect(result.token).toBe('tok_123');
  });

  it('logs in through the official auth endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        user: { id: 'user-2', name: 'Maria' },
        token: 'tok_456',
      },
    });

    const result = await authFlowService.login({
      email: 'maria@example.com',
      password: 'senha',
      captchaToken: 'captcha-2',
    });

    expect(mockPost).toHaveBeenCalledWith('auth/login.php', {
      email: 'maria@example.com',
      password: 'senha',
      captchaToken: 'captcha-2',
    });
    expect(result.success).toBe(true);
    expect(result.user.id).toBe('user-2');
  });

  it('verifies 2FA through the official auth endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Código validado.',
      data: {
        token: 'tok_2fa',
      },
    });

    const result = await authFlowService.verifyTwoFactor({
      email: 'admin@example.com',
      code: '123456',
    });

    expect(mockPost).toHaveBeenCalledWith('auth/verify_2fa.php', {
      email: 'admin@example.com',
      code: '123456',
    });
    expect(result.token).toBe('tok_2fa');
    expect(result.message).toBe('Código validado.');
  });

  it('resends the confirmation email through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'E-mail reenviado.',
    });

    const message = await authFlowService.resendConfirmation('conta@example.com');

    expect(mockPost).toHaveBeenCalledWith('auth/resend-confirmation.php', {
      email: 'conta@example.com',
    });
    expect(message).toBe('E-mail reenviado.');
  });

  it('starts forgot-password through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Instrucao enviada.',
    });

    const message = await authFlowService.forgotPassword({
      email: 'conta@example.com',
      captchaToken: 'captcha-token',
    });

    expect(mockPost).toHaveBeenCalledWith('auth/forgot-password.php', {
      email: 'conta@example.com',
      captchaToken: 'captcha-token',
    });
    expect(message).toBe('Instrucao enviada.');
  });

  it('confirms the email through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Conta confirmada.',
      data: {
        newXp: 50,
      },
    });

    const result = await authFlowService.confirmEmail('token-123');

    expect(mockPost).toHaveBeenCalledWith('auth/confirm-email.php', {
      token: 'token-123',
    });
    expect(result.message).toBe('Conta confirmada.');
    expect(result.newXp).toBe(50);
  });

  it('resets the password through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Senha alterada.',
    });

    const message = await authFlowService.resetPassword({
      token: 'reset-token',
      password: 'nova-senha',
    });

    expect(mockPost).toHaveBeenCalledWith('auth/reset-password.php', {
      token: 'reset-token',
      password: 'nova-senha',
    });
    expect(message).toBe('Senha alterada.');
  });
});
