import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess } from '@/services/api/response';
import type { UserProfile } from '@/types/auth';

type UserProfileUpdatePayload = Partial<UserProfile>;

type UpdateUserProfileResult = {
  success: boolean;
  message: string;
};

/**
 * Mutacoes de perfil do usuario autenticado no app mobile.
 * @since v1.0.0
 */
export const accountService = {
  async updateUserProfile(payload: UserProfileUpdatePayload): Promise<UpdateUserProfileResult> {
    const sanitizedPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    ) as UserProfileUpdatePayload;

    if (Object.keys(sanitizedPayload).length === 0) {
      return {
        success: true,
        message: 'Nenhuma alteracao pendente.',
      };
    }

    const response = await apiClient.post<any>(ENDPOINTS.profile.update, sanitizedPayload);
    const envelope = assertApiSuccess(response, 'Nao foi possivel atualizar os dados do perfil.');

    return {
      success: true,
      message: envelope.message || 'Perfil atualizado com sucesso.',
    };
  },
};

export default accountService;
