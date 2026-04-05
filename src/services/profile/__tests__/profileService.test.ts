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

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
  },
  ENDPOINTS: {
    users: {
      referralStats: 'referrals/stats.php',
      uploadPhoto: 'users/upload_photo.php',
      changePassword: 'users/change_password.php',
    },
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
}));

import { profileService } from '../profileService';

describe('profileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads referral stats through the official facade', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        clicks: 10,
        conversions: 2,
        balance: 15.5,
      },
    });

    const result = await profileService.getReferralStats();

    expect(mockGet).toHaveBeenCalledWith('referrals/stats.php');
    expect(result.clicks).toBe(10);
  });

  it('uploads the profile photo through the official facade', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Foto atualizada!',
    });

    const file = new File(['binary'], 'avatar.png', { type: 'image/png' });
    const result = await profileService.uploadProfilePhoto(file);

    expect(mockPost).toHaveBeenCalledWith('users/upload_photo.php', expect.any(FormData));
    expect(result.message).toBe('Foto atualizada!');
  });

  it('changes password through the official facade', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Senha alterada!',
    });

    const result = await profileService.changePassword('old-pass', 'new-pass');

    expect(mockPost).toHaveBeenCalledWith('users/change_password.php', {
      current: 'old-pass',
      new: 'new-pass',
    });
    expect(result.message).toBe('Senha alterada!');
  });
});
