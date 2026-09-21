import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData } from '@/services/api/response';
import type { UserProfile } from '@/types/auth';

type UserProfileUpdatePayload = Partial<UserProfile>;

type UpdateUserProfileResult = {
  success: boolean;
  message: string;
};

type ProfilePhotoResult = UpdateUserProfileResult & {
  photoUrl?: string;
};

type AuthenticatedProfileResponse = {
  profile?: {
    id?: string;
    displayName?: string;
    email?: string;
    avatarUrl?: string | null;
    emailVerified?: boolean;
    personal?: {
      cpf?: string | null;
      targetExam?: string | null;
      address?: UserProfile['address'] | null;
    };
    role?: string;
  };
};

const readProfilePhotoUrl = (...sources: unknown[]): string | undefined => {
  const queue = sources.filter((source): source is Record<string, unknown> => (
    Boolean(source) && typeof source === 'object'
  ));

  while (queue.length > 0) {
    const record = queue.shift()!;
    const directValue = record.photoUrl
      ?? record.photo_url
      ?? record.profilePhotoUrl
      ?? record.profile_photo_url
      ?? record.userPhotoUrl
      ?? record.user_photo_url
      ?? record.avatarUrl
      ?? record.avatar_url;

    if (typeof directValue === 'string' && directValue.trim()) return directValue.trim();

    ['data', 'payload', 'user', 'profile'].forEach((key) => {
      const nested = record[key];
      if (nested && typeof nested === 'object') queue.push(nested as Record<string, unknown>);
    });
  }

  return undefined;
};

export const accountService = {
  async getUserProfile(): Promise<Partial<UserProfile>> {
    const response = await apiClient.get<any>(ENDPOINTS.profile.get);
    assertApiSuccess(response, 'Nao foi possivel carregar os dados do perfil.');
    const payload = readApiData<AuthenticatedProfileResponse>(response, {});
    const profile = payload.profile;
    const personal = profile?.personal;

    if (!profile) return {};

    return {
      id: profile.id,
      name: profile.displayName,
      email: profile.email,
      photoUrl: profile.avatarUrl || undefined,
      emailVerified: profile.emailVerified,
      cpf: personal?.cpf || undefined,
      targetExam: personal?.targetExam || undefined,
      address: personal?.address || undefined,
      role: profile.role,
    };
  },

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

  async uploadProfilePhoto(
    uri: string,
    mimeType = 'image/jpeg',
    fileName = 'profile-photo.jpg',
  ): Promise<ProfilePhotoResult> {
    const formData = new FormData();
    formData.append('photo', { uri, type: mimeType, name: fileName } as any);
    formData.append('gamification_event', 'profile_photo_uploaded');
    formData.append('notification_event', 'profile_updated');

    const response = await apiClient.post<any>(ENDPOINTS.users.uploadPhoto, formData);
    const envelope = assertApiSuccess(response, 'Nao foi possivel atualizar a foto do perfil.');
    const payload = readApiData<any>(response, {});
    const photoUrl = readProfilePhotoUrl(payload, envelope.data, envelope.raw);

    return {
      success: true,
      message: envelope.message || 'Foto de perfil atualizada com sucesso.',
      photoUrl,
    };
  },

  async removeProfilePhoto(): Promise<UpdateUserProfileResult> {
    const response = await apiClient.post<any>(ENDPOINTS.users.removePhoto, {});
    const envelope = assertApiSuccess(response, 'Nao foi possivel remover a foto do perfil.');
    return { success: true, message: envelope.message || 'Foto de perfil removida com sucesso.' };
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
