import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData } from '@/services/api/response';
import type { SavedCardsListResult } from '@/types/billing';

/**
 * Cofre de cartoes (Stripe) no app mobile.
 * @since v1.0.0
 */
export const cardsService = {
  async listSavedCards(userId?: string): Promise<SavedCardsListResult> {
    const response: any = await apiClient.post<any>(
      ENDPOINTS.users.listCards,
      userId ? { user_id: userId } : {},
    );

    const payload = readApiData<any>(response, {});

    return {
      success: response?.success !== false,
      cards: Array.isArray(payload?.cards)
        ? payload.cards
        : Array.isArray(response?.cards)
          ? response.cards
          : [],
      removed_stale_cards: Number(payload?.removed_stale_cards ?? response?.removed_stale_cards ?? 0),
    };
  },

  async removeSavedCard(cardId: string, userId?: string): Promise<{ success: boolean; message?: string }> {
    const response: any = await apiClient.post<any>(
      ENDPOINTS.users.removeCard,
      {
        ...(userId ? { user_id: userId } : {}),
        card_id: cardId,
      },
    );

    const envelope = assertApiSuccess(response, 'Nao foi possivel remover o cartao.');
    return {
      success: true,
      message: envelope.message || 'Cartao removido com sucesso.',
    };
  },

  async setDefaultSavedCard(cardId: string, userId?: string): Promise<{ success: boolean; message?: string }> {
    const response: any = await apiClient.post<any>(
      ENDPOINTS.users.setDefaultCard,
      {
        ...(userId ? { user_id: userId } : {}),
        card_id: cardId,
      },
    );

    const envelope = assertApiSuccess(response, 'Nao foi possivel definir cartao padrao.');
    return {
      success: true,
      message: envelope.message || 'Cartao padrao atualizado.',
    };
  },
};

export default cardsService;
