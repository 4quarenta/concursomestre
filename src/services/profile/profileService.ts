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

export type SubmitProfileTestimonialInput = {
  rating: number;
  testimonial: string;
  publicDisplayName?: string;
  publicHeadline?: string;
  photoUrl?: string;
  userName?: string;
  userEmail?: string;
  planName?: string;
};

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
   * Remove a foto de perfil atual do usuario autenticado.
   */
  async removeProfilePhoto(): Promise<{ message: string }> {
    const response = await apiClient.post<any>(ENDPOINTS.users.removePhoto, {}) as any;
    const envelope = assertApiSuccess(response, 'Não foi possível remover a foto do perfil.');

    return {
      message: envelope.message || 'Foto de perfil removida com sucesso!',
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

  /**
   * Envia depoimento e avaliacao do aluno para a fila oficial de feedback.
   */
  async submitTestimonial(input: SubmitProfileTestimonialInput): Promise<{ message: string; id?: number }> {
    const rating = Math.max(1, Math.min(5, Math.round(Number(input.rating) || 0)));
    const testimonial = String(input.testimonial || '').trim();
    const response = await apiClient.post<any>(ENDPOINTS.feedback.create, {
      type: 'suggestion',
      reason: 'Avaliar plataforma',
      details: testimonial,
      rating,
      public_display_name: input.publicDisplayName,
      public_headline: input.publicHeadline,
      public_photo_url: input.photoUrl,
      user_name: input.userName,
      user_email: input.userEmail,
      plan_name: input.planName,
    }) as any;

    const envelope = assertApiSuccess(response, 'Não foi possível enviar o depoimento.');
    const payload = readApiData<any>(response, {});

    return {
      message: envelope.message || 'Avaliação enviada. Obrigado por compartilhar sua experiência!',
      id: Number(payload?.id || payload?.feedback_id || payload?.thread_id || 0) || undefined,
    };
  },
};

export default profileService;
