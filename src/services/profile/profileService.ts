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
import type { ApiResponse } from '@services/api';

const requestApi = <T>(request: Promise<unknown>): Promise<ApiResponse<T>> => request as Promise<ApiResponse<T>>;

export type ReferralStats = Record<string, unknown>;

type MessageMutationResult = {
  message: string;
};

type FeedbackSubmitPayload = {
  id?: number | string | null;
  feedback_id?: number | string | null;
  thread_id?: number | string | null;
};

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
 * Centraliza operacoes auxiliares do perfil que nao pertencem a auth pura
 * nem ao dominio comercial do marketplace.
 */
export const profileService = {
  /**
   * Carrega o resumo de indicacoes do usuario autenticado.
   */
  async getReferralStats(): Promise<ReferralStats> {
    const response = await requestApi<ReferralStats>(apiClient.get<ApiResponse<ReferralStats>>(ENDPOINTS.users.referralStats));
    assertApiSuccess(response, 'Nao foi possivel carregar os dados de indicacao.');
    return readApiData<ReferralStats>(response, {});
  },

  /**
   * Atualiza a foto do perfil atual via upload autenticado.
   */
  async uploadProfilePhoto(file: File): Promise<MessageMutationResult> {
    const formData = new FormData();
    formData.append('photo', file);

    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.users.uploadPhoto, formData));
    const envelope = assertApiSuccess(response, 'Nao foi possivel atualizar a foto do perfil.');

    return {
      message: envelope.message || 'Foto de perfil atualizada!',
    };
  },

  /**
   * Remove a foto de perfil atual do usuario autenticado.
   */
  async removeProfilePhoto(): Promise<MessageMutationResult> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.users.removePhoto, {}));
    const envelope = assertApiSuccess(response, 'Nao foi possivel remover a foto do perfil.');

    return {
      message: envelope.message || 'Foto de perfil removida com sucesso!',
    };
  },

  /**
   * Altera a senha do usuario autenticado.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<MessageMutationResult> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(
      ENDPOINTS.users.changePassword,
      {
        current: currentPassword,
        new: newPassword,
      },
    ));

    const envelope = assertApiSuccess(response, 'Nao foi possivel alterar a senha.');
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
    const response = await requestApi<FeedbackSubmitPayload>(apiClient.post<ApiResponse<FeedbackSubmitPayload>>(
      ENDPOINTS.feedback.create,
      {
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
      },
    ));

    const envelope = assertApiSuccess(response, 'Nao foi possivel enviar o depoimento.');
    const payload = readApiData<FeedbackSubmitPayload>(response, {});

    return {
      message: envelope.message || 'Avaliacao enviada. Obrigado por compartilhar sua experiencia!',
      id: Number(payload.id || payload.feedback_id || payload.thread_id || 0) || undefined,
    };
  },
};

export default profileService;
