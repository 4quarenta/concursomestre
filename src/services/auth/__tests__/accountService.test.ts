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

type MockApiResponse = {
  data?: unknown;
  success?: boolean;
  message?: string;
  error?: string;
} | null | undefined;

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    post: mockPost,
  },
  assertApiSuccess: (response: MockApiResponse, fallbackMessage: string) => {
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
    users: {
      update: 'users/update.php',
    },
  },
}));

import { accountService } from '../accountService';

type UserProfileUpdatePayload = Parameters<typeof accountService.updateUserProfile>[0];

describe('accountService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persiste atualizacao de perfil pelo endpoint oficial de users', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Profile updated successfully',
    });

    const result = await accountService.updateUserProfile({
      name: 'Usuário Teste',
      cpf: '12345678900',
    } as UserProfileUpdatePayload);

    expect(mockPost).toHaveBeenCalledWith('users/update.php', {
      name: 'Usuário Teste',
      cpf: '12345678900',
    });
    expect(result.success).toBe(true);
  });

  it('promove o usuário para parceiro pelo mesmo endpoint oficial', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Profile updated successfully',
    });

    await accountService.becomePartner();

    expect(mockPost).toHaveBeenCalledWith('users/update.php', {
      role: 'partner',
    });
  });
});
