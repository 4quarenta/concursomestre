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

import { apiClient, ENDPOINTS, assertApiSuccess } from '@services/api';
import type { UserProfile } from '@types';

type UserProfileUpdatePayload = Partial<UserProfile>;

type UpdateUserProfileResult = {
  success: boolean;
  message: string;
};

/**
 * Centraliza mutacoes de perfil e role do usuario autenticado.
 * O backend usa a sessao atual para identificar o alvo da alteracao.
 * @since 1.0.0
 */
export const accountService = {
  /**
   * Persiste alteracoes do perfil do usuario autenticado.
   * Essa chamada alimenta a tela de conta e qualquer fluxo de onboarding complementar.
   * @since 1.0.0
   */
  async updateUserProfile(payload: UserProfileUpdatePayload): Promise<UpdateUserProfileResult> {
    const response = await apiClient.post<any>(ENDPOINTS.users.update, payload) as any;
    const envelope = assertApiSuccess(response, 'Erro ao atualizar perfil. Tente novamente.');

    return {
      success: true,
      message: envelope.message || 'Perfil atualizado com sucesso!',
    };
  },

  /**
   * Atalho explicito para a transicao de usuario comum para parceiro.
   * Ele reaproveita o mesmo endpoint de perfil para manter o contrato do frontend simples.
   * @since 1.0.0
   */
  async becomePartner(): Promise<UpdateUserProfileResult> {
    return this.updateUserProfile({ role: 'partner' });
  },
};

export default accountService;
