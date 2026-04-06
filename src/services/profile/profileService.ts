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

import { apiClient, assertApiSuccess, readApiData, ENDPOINTS } from '@services/api';

type ReferralStats = Record<string, any>;

/**
 * Centraliza operações auxiliares do perfil que não pertencem a auth pura
 * nem ao dominio comercial do marketplace.
 */
export const profileService = {
  /**
   * Carrega o resumo de indicacoes do usuário autenticado.
   */
  async getReferralStats(): Promise<ReferralStats> {
    const response = await apiClient.get<any>(ENDPOINTS.users.referralStats) as any;
    assertApiSuccess(response, 'Não foi possível carregar os dados de indicacao.');
    return readApiData<ReferralStats>(response, {});
  },

  /**
   * Atualiza a foto do perfil atual via upload autenticado.
   */
  async uploadProfilePhoto(file: File): Promise<{ message: string }> {
    const formData = new FormData();
    formData.append('photo', file);

    const response = await apiClient.post<any>(ENDPOINTS.users.uploadPhoto, formData) as any;
    const envelope = assertApiSuccess(response, 'Não foi possível atualizar a foto do perfil.');

    return {
      message: envelope.message || 'Foto de perfil atualizada!',
    };
  },

  /**
   * Altera a senha do usuário autenticado.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const response = await apiClient.post<any>(ENDPOINTS.users.changePassword, {
      current: currentPassword,
      new: newPassword,
    }) as any;

    const envelope = assertApiSuccess(response, 'Não foi possível alterar a senha.');
    return {
      message: envelope.message || 'Senha alterada com sucesso!',
    };
  },
};

export default profileService;
