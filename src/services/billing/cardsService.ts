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
import { buildRequestCacheKey, withRequestCoalescing } from '@services/api/requestCoalescer';
import type { ApiResponse } from '@services/api';

const requestApi = <T>(request: Promise<unknown>): Promise<ApiResponse<T>> => request as Promise<ApiResponse<T>>;

export type SavedCard = {
  id: string | number;
  brand?: string;
  last4?: string;
  last_four?: string;
  payment_method_id?: string | null;
  stripe_payment_method_id?: string | null;
  issuer_id?: string | number | null;
  first_six_digits?: string | null;
  bin?: string | number | null;
  exp_month?: number | string;
  exp_year?: number | string;
  is_default?: number | string | boolean;
  locked_by_recurring?: number | string | boolean;
  gateway?: string;
  holder_name?: string;
  created_at?: string | null;
  [key: string]: unknown;
};

export type SavedCardsListResult = {
  cards: SavedCard[];
  removed_stale_cards: number;
  success: boolean;
};

export type SavedCardMutationResult = {
  success: true;
  message: string;
};

type RawSavedCardsPayload = {
  cards?: SavedCard[];
  removed_stale_cards?: number | string | null;
};

type RawSetupIntentPayload = {
  client_secret?: string;
};

/**
 * Centraliza o cofre de cartoes e o setup de cartao salvo no frontend.
 * @since 1.0.0
 */
export const cardsService = {
  /**
   * Lista os cartoes salvos do usuario atual.
   * @since 1.0.0
   */
  async listSavedCards(userId?: string): Promise<SavedCardsListResult> {
    return withRequestCoalescing(buildRequestCacheKey('billing:saved-cards', { userId: userId || 'self' }), async () => {
      const response = await requestApi<RawSavedCardsPayload>(apiClient.post<ApiResponse<RawSavedCardsPayload>>(
        ENDPOINTS.users.listCards,
        userId ? { user_id: userId } : {},
      ));

      const payload = readApiData<RawSavedCardsPayload>(response, {});

      return {
        success: response.success !== false,
        cards: Array.isArray(payload.cards) ? payload.cards : [],
        removed_stale_cards: Number(payload.removed_stale_cards ?? 0),
      };
    }, 15000);
  },

  /**
   * Remove um cartão salvo.
   * @since 1.0.0
   */
  async removeSavedCard(cardId: string, userId?: string): Promise<SavedCardMutationResult> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(
      ENDPOINTS.users.removeCard,
      {
        ...(userId ? { user_id: userId } : {}),
        card_id: cardId,
      },
    ));

    const envelope = assertApiSuccess(response, 'Não foi possível remover o cartão.');
    return {
      success: true,
      message: envelope.message || 'Cartão removido com sucesso!',
    };
  },

  /**
   * Define um cartão salvo como padrão.
   * @since 1.0.0
   */
  async setDefaultSavedCard(cardId: string, userId?: string): Promise<SavedCardMutationResult> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(
      ENDPOINTS.users.setDefaultCard,
      {
        ...(userId ? { user_id: userId } : {}),
        card_id: cardId,
      },
    ));

    const envelope = assertApiSuccess(response, 'Não foi possível definir o cartão padrão.');
    return {
      success: true,
      message: envelope.message || 'Cartão padrão atualizado!',
    };
  },

  /**
   * Salva um cartão no cofre legado/local.
   * @since 1.0.0
   */
  async saveLegacyCard(payload: Record<string, unknown>): Promise<SavedCardMutationResult> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.users.saveCard, payload));
    const envelope = assertApiSuccess(response, 'Não foi possível salvar o cartão.');
    return {
      success: true,
      message: envelope.message || 'Cartão salvo com sucesso!',
    };
  },

  /**
   * Prepara o setup intent do Stripe para salvar novo cartão.
   * @since 1.0.0
   */
  async createStripeSetupIntent(): Promise<{ success: true; client_secret: string }> {
    const response = await requestApi<RawSetupIntentPayload>(apiClient.post<ApiResponse<RawSetupIntentPayload>>(
      ENDPOINTS.users.createStripeSetupIntent,
      {},
    ));
    assertApiSuccess(response, 'Não foi possível preparar o formulário Stripe.');

    const payload = readApiData<RawSetupIntentPayload>(response, {});
    const clientSecret = payload.client_secret;

    if (!clientSecret) {
      throw new Error('Não foi possível preparar o formulário Stripe.');
    }

    return {
      success: true,
      client_secret: clientSecret,
    };
  },

  /**
   * Sincroniza o método de pagamento Stripe após o setup intent.
   * @since 1.0.0
   */
  async syncStripeCard(paymentMethodId: string): Promise<SavedCardMutationResult> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(
      ENDPOINTS.users.syncStripeCard,
      {
        payment_method_id: paymentMethodId,
      },
    ));

    const envelope = assertApiSuccess(response, 'Não foi possível sincronizar o cartão Stripe.');
    return {
      success: true,
      message: envelope.message || 'Cartão salvo com sucesso na Stripe!',
    };
  },
};

export default cardsService;
