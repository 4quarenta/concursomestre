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
  ENDPOINTS: {
    users: {
      listCards: 'users/list_cards.php',
      removeCard: 'users/remove_card.php',
      setDefaultCard: 'users/set_default_card.php',
      saveCard: 'users/save_card.php',
      createStripeSetupIntent: 'users/create_stripe_setup_intent.php',
      syncStripeCard: 'users/sync_stripe_card.php',
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

import { cardsService } from '../cardsService';

describe('cardsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists saved cards preserving stale-card cleanup metadata', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      cards: [{ id: 'card-1' }],
      removed_stale_cards: 2,
    });

    const result = await cardsService.listSavedCards('user-1');

    expect(mockPost).toHaveBeenCalledWith('users/list_cards.php', {
      user_id: 'user-1',
    });
    expect(result.success).toBe(true);
    expect(result.cards).toHaveLength(1);
    expect(result.removed_stale_cards).toBe(2);
  });

  it('removes a saved card through the billing facade', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Cartão removido com sucesso!',
    });

    const result = await cardsService.removeSavedCard('card-2', 'user-2');

    expect(mockPost).toHaveBeenCalledWith('users/remove_card.php', {
      user_id: 'user-2',
      card_id: 'card-2',
    });
    expect(result.success).toBe(true);
  });

  it('saves a legacy card through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Cartão salvo com sucesso!',
    });

    const result = await cardsService.saveLegacyCard({
      user_id: 'user-3',
      card_number: '4111111111111111',
      card_name: 'Teste',
      card_expiry: '12/2030',
      brand: 'visa',
    });

    expect(mockPost).toHaveBeenCalledWith('users/save_card.php', {
      user_id: 'user-3',
      card_number: '4111111111111111',
      card_name: 'Teste',
      card_expiry: '12/2030',
      brand: 'visa',
    });
    expect(result.success).toBe(true);
  });

  it('creates a Stripe setup intent through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        client_secret: 'seti_123',
      },
    });

    const result = await cardsService.createStripeSetupIntent();

    expect(mockPost).toHaveBeenCalledWith('users/create_stripe_setup_intent.php', {});
    expect(result.client_secret).toBe('seti_123');
  });

  it('syncs a Stripe card through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Cartão salvo com sucesso na Stripe!',
    });

    const result = await cardsService.syncStripeCard('pm_123');

    expect(mockPost).toHaveBeenCalledWith('users/sync_stripe_card.php', {
      payment_method_id: 'pm_123',
    });
    expect(result.success).toBe(true);
  });
});
