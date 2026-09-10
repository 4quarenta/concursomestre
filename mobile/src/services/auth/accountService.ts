import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData } from '@/services/api/response';
import type { UserProfile } from '@/types/auth';

type UserProfileUpdatePayload = Partial<UserProfile>;

type UpdateUserProfileResult = {
  success: boolean;
  message: string;
};

export const accountService = {
  async updateUserProfile(payload: UserProfileUpdatePayload): Promise<UpdateUserProfileResult> {
    const sanitizedPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    ) as UserProfileUpdatePayload;

    if (Object.keys(sanitizedPayload).length === 0) {
      return { success: true, message: 'Nenhuma alteracao pendente.' };
    }

    const response = await apiClient.post<any>(ENDPOINTS.profile.update, sanitizedPayload);
    const envelope = assertApiSuccess(response, 'Nao foi possivel atualizar os dados do perfil.');
    return { success: true, message: envelope.message || 'Perfil atualizado com sucesso.' };
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const response = await apiClient.post<any>(ENDPOINTS.users.changePassword, {
      current: currentPassword,
      new: newPassword,
    });
    const envelope = assertApiSuccess(response, 'Nao foi possivel alterar a senha.');
    const payload = readApiData<any>(response, {});
    return { message: String(payload?.message || envelope.message || 'Senha alterada com sucesso.') };
  },

  async requestAccountDeletion(currentPassword: string, reason: string): Promise<{ pending: boolean; message: string }> {
    const response = await apiClient.post<any>(ENDPOINTS.users.deleteAccount, {
      current_password: currentPassword,
      reason,
    });
    const envelope = assertApiSuccess(response, 'Nao foi possivel solicitar a exclusao da conta.');
    const payload = readApiData<any>(response, {});
    return {
      pending: payload?.pending !== false,
      message: String(payload?.message || envelope.message || 'Solicitacao de exclusao registrada.'),
    };
  },
};

export default accountService;
