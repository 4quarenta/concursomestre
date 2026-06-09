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
  photoUrl?: string;
  xpGain?: number;
  newXp?: number;
  newLevel?: number;
};

type FeedbackSubmitPayload = {
  id?: number | string | null;
  feedback_id?: number | string | null;
  thread_id?: number | string | null;
  xpGain?: number | string | null;
  xp_gain?: number | string | null;
  newXp?: number | string | null;
  new_xp?: number | string | null;
  newLevel?: number | string | null;
  new_level?: number | string | null;
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

export type XpLeaderboardBadge = {
  key: string;
  title: string;
};

export type XpLeaderboardEntry = {
  id: string;
  name: string;
  photoUrl?: string;
  xp: number;
  level: number;
  reputation: number;
  rank?: number;
  targetExam?: string | null;
  streakDays?: number;
  answeredQuestions?: number;
  correctAnswers?: number;
  badges?: XpLeaderboardBadge[];
};

type XpLeaderboardPayload = {
  entries?: unknown[];
};

const toRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' ? value as Record<string, unknown> : null
);

const readProfilePhotoUrl = (...sources: unknown[]): string | undefined => {
  const queue = sources
    .map(toRecord)
    .filter((record): record is Record<string, unknown> => Boolean(record));

  while (queue.length > 0) {
    const record = queue.shift()!;
    const directValue =
      record.photoUrl
      ?? record.photo_url
      ?? record.profilePhotoUrl
      ?? record.profile_photo_url
      ?? record.userPhotoUrl
      ?? record.user_photo_url
      ?? record.avatarUrl
      ?? record.avatar_url;

    if (typeof directValue === 'string' && directValue.trim()) {
      return directValue.trim();
    }

    ['data', 'payload', 'user', 'profile'].forEach((key) => {
      const nestedRecord = toRecord(record[key]);
      if (nestedRecord) {
        queue.push(nestedRecord);
      }
    });
  }

  return undefined;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readMutationProgress = (...sources: unknown[]) => {
  const queue = sources
    .map(toRecord)
    .filter((record): record is Record<string, unknown> => Boolean(record));

  while (queue.length > 0) {
    const record = queue.shift()!;
    const xpGain = toOptionalNumber(record.xpGain ?? record.xp_gain);
    const newXp = toOptionalNumber(record.newXp ?? record.new_xp);
    const newLevel = toOptionalNumber(record.newLevel ?? record.new_level);

    if (xpGain !== undefined || newXp !== undefined || newLevel !== undefined) {
      return { xpGain, newXp, newLevel };
    }

    ['data', 'payload', 'user', 'profile'].forEach((key) => {
      const nestedRecord = toRecord(record[key]);
      if (nestedRecord) {
        queue.push(nestedRecord);
      }
    });
  }

  return {};
};

const normalizeXpBadges = (value: unknown): XpLeaderboardBadge[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const record = toRecord(item);
        if (!record) {
          const title = String(item || '').trim();
          return title ? { key: title, title } : null;
        }

        const key = String(record.key ?? record.badgeKey ?? record.badge_key ?? record.id ?? '').trim();
        const title = String(record.title ?? record.name ?? key).trim();
        return key || title ? { key: key || title, title: title || key } : null;
      })
      .filter((badge): badge is XpLeaderboardBadge => Boolean(badge));
  }

  if (typeof value === 'string') {
    return value
      .split(value.includes('||') ? '||' : ',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [key, title] = item.split('::');
        const resolvedKey = String(key || title || '').trim();
        const resolvedTitle = String(title || key || '').trim();
        return { key: resolvedKey || resolvedTitle, title: resolvedTitle || resolvedKey };
      })
      .filter((badge) => badge.key || badge.title);
  }

  return [];
};

const normalizeXpLeaderboardEntry = (value: unknown, index: number): XpLeaderboardEntry | null => {
  const record = toRecord(value);
  if (!record) return null;

  const id = String(record.id ?? record.userId ?? record.user_id ?? '').trim();
  const name = String(record.name ?? record.userName ?? record.user_name ?? 'Aluno').trim() || 'Aluno';
  const xp = toNumber(record.xp);
  const level = Math.max(1, Math.floor(toNumber(record.level, Math.floor(xp / 1000) + 1)));
  const rank = toNumber(record.rank ?? record.position ?? record.posicao, index + 1);

  return {
    id: id || `rank-${index + 1}-${name}`,
    name,
    photoUrl: String(record.photoUrl ?? record.photo_url ?? record.avatarUrl ?? record.avatar_url ?? '').trim() || undefined,
    xp,
    level,
    rank: rank > 0 ? rank : index + 1,
    reputation: toNumber(record.reputation ?? record.reputacao),
    targetExam: String(record.targetExam ?? record.target_exam ?? record.examFocus ?? record.exam_focus ?? '').trim() || null,
    streakDays: toNumber(record.streakDays ?? record.streak_days ?? record.currentStreak ?? record.current_streak),
    answeredQuestions: toNumber(record.answeredQuestions ?? record.answered_questions ?? record.totalAnswers ?? record.total_answers),
    correctAnswers: toNumber(record.correctAnswers ?? record.correct_answers),
    badges: normalizeXpBadges(record.badges ?? record.badgeSummary ?? record.badges_summary),
  };
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
    formData.append('gamification_event', 'profile_photo_uploaded');
    formData.append('notification_event', 'profile_updated');

    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(ENDPOINTS.users.uploadPhoto, formData));
    const envelope = assertApiSuccess(response, 'Nao foi possivel atualizar a foto do perfil.');
    const payload = readApiData<Record<string, unknown>>(response, {});
    const photoUrl = readProfilePhotoUrl(payload, envelope.data, envelope.raw);
    const progress = readMutationProgress(payload, envelope.data, envelope.raw);

    return {
      message: String(payload.message || envelope.message || 'Foto de perfil atualizada!'),
      photoUrl,
      ...progress,
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
  async submitTestimonial(input: SubmitProfileTestimonialInput): Promise<MessageMutationResult & { id?: number }> {
    const rating = Math.max(1, Math.min(5, Math.round(Number(input.rating) || 0)));
    const testimonial = String(input.testimonial || '').trim();
    const response = await requestApi<FeedbackSubmitPayload>(apiClient.post<ApiResponse<FeedbackSubmitPayload>>(
      ENDPOINTS.feedback.create,
      {
        type: 'platform-rating',
        reason: 'Avaliar plataforma',
        details: testimonial,
        rating,
        public_display_name: input.publicDisplayName,
        public_headline: input.publicHeadline,
        public_photo_url: input.photoUrl,
        user_name: input.userName,
        user_email: input.userEmail,
        plan_name: input.planName,
        gamification_event: 'platform_rating_submitted',
        notification_event: 'platform_rating',
      },
    ));

    const envelope = assertApiSuccess(response, 'Nao foi possivel enviar o depoimento.');
    const payload = readApiData<FeedbackSubmitPayload>(response, {});
    const progress = readMutationProgress(payload, envelope.data, envelope.raw);

    return {
      message: envelope.message || 'Avaliacao enviada. Obrigado por compartilhar sua experiencia!',
      id: Number(payload.id || payload.feedback_id || payload.thread_id || 0) || undefined,
      ...progress,
    };
  },

  /**
   * Lista o ranking publico de XP sem misturar com o ranking pos-prova.
   */
  async listXpLeaderboard(): Promise<XpLeaderboardEntry[]> {
    const response = await requestApi<XpLeaderboardPayload | XpLeaderboardEntry[]>(
      apiClient.get<ApiResponse<XpLeaderboardPayload | XpLeaderboardEntry[]>>(ENDPOINTS.users.levelLeaderboard),
    );
    assertApiSuccess(response, 'Nao foi possivel carregar o ranking de XP.');
    const payload = readApiData<XpLeaderboardPayload | XpLeaderboardEntry[]>(response, []);

    if (Array.isArray(payload)) {
      return payload
        .map(normalizeXpLeaderboardEntry)
        .filter((entry): entry is XpLeaderboardEntry => Boolean(entry))
        .map((entry, index) => ({ ...entry, rank: entry.rank || index + 1 }));
    }

    return Array.isArray(payload.entries)
      ? payload.entries
        .map(normalizeXpLeaderboardEntry)
        .filter((entry): entry is XpLeaderboardEntry => Boolean(entry))
        .map((entry, index) => ({ ...entry, rank: entry.rank || index + 1 }))
      : [];
  },

  /**
   * Registra a solicitacao real de exclusao de conta do usuario autenticado.
   */
  async requestAccountDeletion(reason: string, captchaToken?: string | null): Promise<MessageMutationResult> {
    const response = await requestApi<unknown>(apiClient.post<ApiResponse>(
      ENDPOINTS.users.delete,
      {
        reason,
        captchaToken: captchaToken || '',
      },
    ));
    const envelope = assertApiSuccess(response, 'Nao foi possivel solicitar a exclusao da conta.');

    return {
      message: envelope.message || 'Solicitacao de exclusao registrada com sucesso.',
    };
  },
};

export default profileService;
