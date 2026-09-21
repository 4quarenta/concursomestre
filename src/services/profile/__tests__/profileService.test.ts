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
      profile: 'users/profile.php',
      update: 'users/update.php',
      communicationPreferences: 'users/communication_preferences.php',
      referralStats: 'referrals/stats.php',
      uploadPhoto: 'users/upload_photo.php',
      removePhoto: 'users/remove_photo.php',
      changePassword: 'users/change_password.php',
      levelLeaderboard: 'users/level_leaderboard.php',
    },
    feedback: {
      create: 'feedback/create.php',
    },
  },
  readApiData: (response: MockApiResponse, fallback: unknown) => {
    if (response?.data !== undefined) return response.data;
    return response ?? fallback;
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
}));

vi.mock('@services/auth/session', () => ({
  getCsrfToken: () => 'csrf-test-token',
}));

import { profileService } from '../profileService';

describe('profileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the private personal profile through the self-scoped endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        profile: {
          id: 'user-1',
          displayName: 'Ana Silva',
          email: 'ana@example.com',
          avatarUrl: null,
          status: 'active',
          emailVerified: true,
          personal: {
            cpf: '***.***.***-**',
            phone: '(11) 99999-9999',
            targetExam: 'TJ-SP',
            address: { city: 'Sao Paulo', state: 'SP' },
            preferences: {},
          },
          account: {
            referralCode: 'ANA123',
            twoFactorEnabled: false,
            deletion: { pending: false, requestedAt: null },
          },
          linkedProviders: ['google'],
        },
      },
    });

    const result = await profileService.getPersonalProfile();

    expect(mockGet).toHaveBeenCalledWith('users/profile.php');
    expect(result.personal.address?.city).toBe('Sao Paulo');
    expect(result.linkedProviders).toEqual(['google']);
  });

  it('reads and writes the canonical Marketing email preference with CSRF', async () => {
    mockGet.mockResolvedValueOnce({ success: true, data: { marketingEmailEnabled: false } });
    mockPost.mockResolvedValueOnce({ success: true, data: { marketingEmailEnabled: true } });

    await expect(profileService.getMarketingEmailPreference()).resolves.toBe(false);
    await expect(profileService.updateMarketingEmailPreference(true)).resolves.toBe(true);

    expect(mockGet).toHaveBeenCalledWith('users/communication_preferences.php');
    expect(mockPost).toHaveBeenCalledWith(
      'users/communication_preferences.php',
      { marketingEmailEnabled: true },
      { headers: { 'X-CSRF-Token': 'csrf-test-token' } },
    );
  });

  it('updates personal data through the self-scoped endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Perfil atualizado com sucesso!',
    });

    const input = {
      name: 'Ana Souza',
      cpf: '123.456.789-00',
      phone: '(11) 98888-8888',
      targetExam: 'TRF-3',
      address: {
        zipCode: '01001-000',
        street: 'Praca da Se',
        number: '1',
        complement: '',
        neighborhood: 'Se',
        city: 'Sao Paulo',
        state: 'SP',
      },
    };
    const result = await profileService.updatePersonalProfile(input);

    expect(mockPost).toHaveBeenCalledWith('users/update.php', input);
    expect(result.message).toBe('Perfil atualizado com sucesso!');
  });

  it('loads referral stats through the official facade', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        referralCode: 'ANA123',
        referralLink: 'https://concursomestre.com/auth?ref=ANA123',
        commissionPercent: 20,
        totals: { registered: 10, converted: 2 },
        balance: { pending: 10, available: 15.5, scheduled: 0, paid: 25 },
        cycle: { days: 30, payoutDay: 10, nextPayoutDate: '2026-08-10' },
      },
    });

    const result = await profileService.getReferralStats();

    expect(mockGet).toHaveBeenCalledWith('referrals/stats.php');
    expect(result.totals.registered).toBe(10);
    expect(result.balance.available).toBe(15.5);
  });

  it('uploads the profile photo through the official facade', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Foto atualizada!',
      data: {
        photoUrl: 'uploads/profiles/user-1.png',
      },
    });

    const file = new File(['binary'], 'avatar.png', { type: 'image/png' });
    const result = await profileService.uploadProfilePhoto(file);

    expect(mockPost).toHaveBeenCalledWith('users/upload_photo.php', expect.any(FormData));
    expect(result.message).toBe('Foto atualizada!');
    expect(result.photoUrl).toBe('uploads/profiles/user-1.png');
  });

  it('reads uploaded profile photo url from nested backend payloads', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Foto atualizada!',
      data: {
        user: {
          photo_url: 'uploads/profiles/user-2.png',
        },
      },
    });

    const file = new File(['binary'], 'avatar.png', { type: 'image/png' });
    const result = await profileService.uploadProfilePhoto(file);

    expect(result.photoUrl).toBe('uploads/profiles/user-2.png');
  });

  it('removes the profile photo through the official facade', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Foto removida!',
    });

    const result = await profileService.removeProfilePhoto();

    expect(mockPost).toHaveBeenCalledWith('users/remove_photo.php', {});
    expect(result.message).toBe('Foto removida!');
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

  it('submits profile testimonial through feedback endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Depoimento recebido!',
      data: { id: 44 },
    });

    const result = await profileService.submitTestimonial({
      rating: 5,
      testimonial: 'A plataforma me ajudou a estudar com consistência.',
      publicDisplayName: 'Ana S.',
      publicHeadline: 'Aprovada Tribunal de Justiça',
      photoUrl: 'uploads/profiles/ana.jpg',
      userName: 'Ana Silva',
      userEmail: 'ana@example.com',
      planName: 'Pro',
    });

    expect(mockPost).toHaveBeenCalledWith('feedback/create.php', {
      type: 'platform-rating',
      reason: 'Avaliar plataforma',
      details: 'A plataforma me ajudou a estudar com consistência.',
      rating: 5,
      public_display_name: 'Ana S.',
      public_headline: 'Aprovada Tribunal de Justiça',
      public_photo_url: 'uploads/profiles/ana.jpg',
      user_name: 'Ana Silva',
      user_email: 'ana@example.com',
      plan_name: 'Pro',
      gamification_event: 'platform_rating_submitted',
      notification_event: 'platform_rating',
    });
    expect(result).toEqual({ message: 'Depoimento recebido!', id: 44 });
  });

  it('normalizes the XP leaderboard enriched backend payload', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        entries: [
          {
            user_id: 'user-1',
            user_name: 'Marina',
            photo_url: 'uploads/profiles/marina.png',
            target_exam: 'PM-PB',
            xp: '2450',
            level: '3',
            reputation: '18',
            streak_days: '7',
            answered_questions: '120',
            correct_answers: '82',
            badges_summary: 'streak_7_days::Sequencia de 7 dias||first_answer::Primeira resposta',
          },
        ],
      },
    });

    const result = await profileService.listXpLeaderboard();

    expect(mockGet).toHaveBeenCalledWith('users/level_leaderboard.php');
    expect(result[0]).toMatchObject({
      id: 'user-1',
      name: 'Marina',
      photoUrl: 'uploads/profiles/marina.png',
      targetExam: 'PM-PB',
      xp: 2450,
      level: 3,
      reputation: 18,
      streakDays: 7,
      answeredQuestions: 120,
      correctAnswers: 82,
    });
    expect(result[0].badges?.[0]).toEqual({ key: 'streak_7_days', title: 'Sequencia de 7 dias' });
  });
});
