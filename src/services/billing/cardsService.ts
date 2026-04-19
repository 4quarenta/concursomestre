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

export type SavedCard = Record<string, any>;

export type SavedCardsListResult = {
  cards: SavedCard[];
  removed_stale_cards: number;
  success: boolean;
};

type OptionalUserPayload = {
  user_id?: string;
};

/**
 * Centraliza o cofre de cartoes e o setup de cartão salvo no frontend.
 * @since 1.0.0
 */
export const cardsService = {
  /**
   * Lista os cartoes salvos do usuário atual.
   * @since 1.0.0
   */
  async listSavedCards(userId?: string): Promise<SavedCardsListResult> {
    const response = await apiClient.post<any>(
      ENDPOINTS.users.listCards,
      userId ? { user_id: userId } : {},
    ) as any;

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

  /**
   * Remove um cartão salvo.
   * @since 1.0.0
   */
  async removeSavedCard(cardId: string, userId?: string): Promise<any> {
    const response = await apiClient.post<any>(
      ENDPOINTS.users.removeCard,
      {
        ...(userId ? { user_id: userId } : {}),
        card_id: cardId,
      },
    ) as any;

    const envelope = assertApiSuccess(response, 'Não foi possível remover o cartão.');
    return {
      ...response,
      success: true,
      message: envelope.message || 'Cartão removido com sucesso!',
    } as any;
  },

  /**
   * Define um cartão salvo como padrao.
   * @since 1.0.0
   */
  async setDefaultSavedCard(cardId: string, userId?: string): Promise<any> {
    const response = await apiClient.post<any>(
      ENDPOINTS.users.setDefaultCard,
      {
        ...(userId ? { user_id: userId } : {}),
        card_id: cardId,
      },
    ) as any;

    const envelope = assertApiSuccess(response, 'Não foi possível definir o cartão padrao.');
    return {
      ...response,
      success: true,
      message: envelope.message || 'Cartão padrao atualizado!',
    };
  },

  /**
   * Salva um cartão no cofre legado/local.
   * @since 1.0.0
   */
  async saveLegacyCard(payload: Record<string, unknown>): Promise<any> {
    const response = await apiClient.post<any>(ENDPOINTS.users.saveCard, payload) as any;
    const envelope = assertApiSuccess(response, 'Não foi possível salvar o cartão.');
    return {
      ...response,
      success: true,
      message: envelope.message || 'Cartão salvo com sucesso!',
    };
  },

  /**
   * Prepara o setup intent do Stripe para salvar novo cartão.
   * @since 1.0.0
   */
  async createStripeSetupIntent(): Promise<{ success: true; client_secret: string }> {
    const response = await apiClient.post<any>(ENDPOINTS.users.createStripeSetupIntent, {}) as any;
    assertApiSuccess(response, 'Não foi possível preparar o formulário Stripe.');

    const payload = readApiData<any>(response, {});
    const clientSecret = payload?.client_secret ?? response?.client_secret;

    if (!clientSecret) {
      throw new Error('Não foi possível preparar o formulário Stripe.');
    }

    return {
      success: true,
      client_secret: clientSecret,
    };
  },

  /**
   * Sincroniza o metodo de pagamento Stripe apos o setup intent.
   * @since 1.0.0
   */
  async syncStripeCard(paymentMethodId: string): Promise<any> {
    const response = await apiClient.post<any>(ENDPOINTS.users.syncStripeCard, {
      payment_method_id: paymentMethodId,
    }) as any;

    const envelope = assertApiSuccess(response, 'Não foi possível sincronizar o cartão Stripe.');
    return {
      ...response,
      success: true,
      message: envelope.message || 'Cartão salvo com sucesso na Stripe!',
    };
  },
};

export default cardsService;
