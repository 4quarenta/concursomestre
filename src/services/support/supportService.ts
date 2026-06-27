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
import { getSupportReasonLabel } from './supportReasonLabels';

export type SupportThread = {
  id: number;
  type: string;
  reason: string;
  details: string;
  status: 'new' | 'read' | 'resolved';
  created_at: string;
  reply_count?: number;
  public_rating?: number | string | null;
  public_display_name?: string | null;
  public_headline?: string | null;
  home_published_at?: string | null;
};

export type PublicSuggestionVote = 'like' | 'dislike';

export type PublicSuggestion = SupportThread & {
  user_name?: string | null;
  likes: number;
  dislikes: number;
  score: number;
  user_vote?: PublicSuggestionVote | null;
};

export type SupportReply = {
  id: number;
  user_id: string;
  user_name?: string | null;
  user_role?: string | null;
  details: string;
  created_at: string;
};

type CreateSupportThreadInput = {
  type: string;
  reason: string;
  details: string;
  parent_id?: number;
  gamificationEvent?: string;
  notificationEvent?: string;
};

export type CreatedSupportThreadResult = {
  id: number;
  type: string;
  parent_id: number | null;
  duplicate?: boolean;
  xpGain?: number;
  newXp?: number;
  newLevel?: number;
};

type SupportRecord = Record<string, unknown>;

type SupportPayload = SupportRecord & {
  feedback?: SupportThread[] | SupportRecord;
  suggestions?: PublicSuggestion[];
  suggestion?: PublicSuggestion;
  replies?: SupportReply[];
  thread?: SupportRecord;
  data?: SupportRecord;
};

const asSupportRecord = (value: unknown): SupportRecord => (
  value && typeof value === 'object' ? value as SupportRecord : {}
);

const readCreatedThreadId = (payload: unknown) => {
  const record = asSupportRecord(payload);
  const feedback = asSupportRecord(record.feedback);
  const thread = asSupportRecord(record.thread);
  const data = asSupportRecord(record.data);

  return Number(
    record.id
    || record.feedback_id
    || record.thread_id
    || record.insert_id
    || feedback.id
    || thread.id
    || data.id
    || 0,
  );
};

const toOptionalNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readMutationProgress = (payload: unknown) => {
  const record = asSupportRecord(payload);
  const data = asSupportRecord(record.data);
  const progress = {
    xpGain: toOptionalNumber(record.xpGain ?? record.xp_gain ?? data.xpGain ?? data.xp_gain),
    newXp: toOptionalNumber(record.newXp ?? record.new_xp ?? data.newXp ?? data.new_xp),
    newLevel: toOptionalNumber(record.newLevel ?? record.new_level ?? data.newLevel ?? data.new_level),
  };

  return {
    ...(progress.xpGain !== undefined ? { xpGain: progress.xpGain } : {}),
    ...(progress.newXp !== undefined ? { newXp: progress.newXp } : {}),
    ...(progress.newLevel !== undefined ? { newLevel: progress.newLevel } : {}),
  };
};

const normalizeSupportThread = <T extends SupportThread>(thread: T): T => ({
  ...thread,
  reason: getSupportReasonLabel(thread.reason),
});

const getSupportGamificationEvent = (type: string) => {
  const normalizedType = String(type || '').trim().toLowerCase();
  if (normalizedType === 'suggestion') return 'suggestion_submitted';
  if (normalizedType === 'platform-rating') return 'platform_rating_submitted';
  if (normalizedType === 'feedback') return 'legal_comment_submitted';
  return 'support_feedback_submitted';
};

const getSupportNotificationEvent = (type: string) => {
  const normalizedType = String(type || '').trim().toLowerCase();
  if (normalizedType === 'suggestion') return 'suggestion_received';
  if (normalizedType === 'platform-rating') return 'platform_rating';
  if (normalizedType === 'feedback') return 'legal_comment';
  return 'support_opened';
};

/**
 * Centraliza o fluxo da central de suporte/feedback do usuário.
 * Essa camada é consumida pela página pública de suporte e pelo histórico de conversas.
 *
 * @since 1.0.0
 */
export const supportService = {
  /**
   * Lista os chamados do usuário autenticado.
   *
   * @since 1.0.0
   */
  async listThreads(): Promise<SupportThread[]> {
    const response = await apiClient.get(ENDPOINTS.feedback.list) as unknown;
    const payload = readApiData<SupportThread[] | SupportPayload>(response, {});
    const responsePayload = asSupportRecord(response) as SupportPayload;

    if (Array.isArray(payload)) {
      return payload.map(normalizeSupportThread);
    }

    if (Array.isArray(payload?.feedback)) {
      return payload.feedback.map(normalizeSupportThread);
    }

    if (Array.isArray(responsePayload.feedback)) {
      return responsePayload.feedback.map(normalizeSupportThread);
    }

    return [];
  },

  /**
   * Lista sugestões enviadas pela comunidade para votação.
   *
   * @since 1.0.0
   */
  async listPublicSuggestions(): Promise<PublicSuggestion[]> {
    const response = await apiClient.get(`${ENDPOINTS.feedback.list}?public_suggestions=1`) as unknown;
    const payload = readApiData<SupportPayload>(response, {});
    const responsePayload = asSupportRecord(response) as SupportPayload;

    if (Array.isArray(payload?.suggestions)) {
      return payload.suggestions.map(normalizeSupportThread);
    }

    if (Array.isArray(responsePayload.suggestions)) {
      return responsePayload.suggestions.map(normalizeSupportThread);
    }

    return [];
  },

  /**
   * Registra like/dislike em uma sugestão pública.
   *
   * @since 1.0.0
   */
  async votePublicSuggestion(suggestionId: number, value: PublicSuggestionVote | null): Promise<PublicSuggestion | null> {
    const response = await apiClient.post(ENDPOINTS.feedback.vote, {
      feedback_id: suggestionId,
      value,
      gamification_event: value ? 'public_suggestion_vote' : '',
      notification_event: value ? 'suggestion_vote' : '',
    }) as unknown;

    assertApiSuccess(response, 'Não foi possível registrar o voto.');
    const payload = readApiData<SupportPayload>(response, {});
    const responsePayload = asSupportRecord(response) as SupportPayload;

    return payload?.suggestion || responsePayload.suggestion || null;
  },

  /**
   * Carrega a conversa de um chamado especifico.
   *
   * @since 1.0.0
   */
  async listReplies(threadId: number): Promise<SupportReply[]> {
    const response = await apiClient.get(`${ENDPOINTS.feedback.list}?id=${threadId}`) as unknown;
    const payload = readApiData<SupportPayload>(response, {});
    const responsePayload = asSupportRecord(response) as SupportPayload;

    if (Array.isArray(payload?.replies)) {
      return payload.replies;
    }

    if (Array.isArray(responsePayload.replies)) {
      return responsePayload.replies;
    }

    return [];
  },

  /**
   * Abre um novo chamado/sugestão para o suporte.
   * Retorna o payload persistido para a UI materializar a thread sem depender do refresh imediato.
   *
   * @since 1.0.0
   */
  async createThread(input: CreateSupportThreadInput): Promise<CreatedSupportThreadResult> {
    const { gamificationEvent, notificationEvent, ...threadPayload } = input;
    const response = await apiClient.post(ENDPOINTS.feedback.create, {
      ...threadPayload,
      gamification_event: gamificationEvent || getSupportGamificationEvent(input.type),
      notification_event: notificationEvent || getSupportNotificationEvent(input.type),
    }) as unknown;
    assertApiSuccess(response, 'Não foi possível enviar a solicitação.');

    const payload = readApiData<SupportPayload>(response, {});
    const progress = readMutationProgress(payload);

    return {
      id: readCreatedThreadId(payload),
      type: String(payload?.type || input.type),
      parent_id: payload?.parent_id === null || payload?.parent_id === undefined
        ? null
        : Number(payload.parent_id || 0),
      ...(payload?.duplicate !== undefined ? { duplicate: Boolean(payload.duplicate) } : {}),
      ...progress,
    };
  },

  /**
   * Responde uma thread existente da central de suporte.
   * O retorno ajuda a auditar que a resposta foi persistida no backend oficial.
   *
   * @since 1.0.0
   */
  async replyToThread(parentId: number, type: string, details: string): Promise<CreatedSupportThreadResult> {
    const response = await apiClient.post(ENDPOINTS.feedback.create, {
      parent_id: parentId,
      type,
      reason: 'Resposta do usuário',
      details,
      gamification_event: 'support_thread_reply',
      notification_event: 'support_reply',
    }) as unknown;

    assertApiSuccess(response, 'Não foi possível enviar a solicitação.');

    const payload = readApiData<SupportPayload>(response, {});
    const progress = readMutationProgress(payload);

    return {
      id: readCreatedThreadId(payload),
      type: String(payload?.type || type),
      parent_id: payload?.parent_id === null || payload?.parent_id === undefined
        ? null
        : Number(payload.parent_id || parentId),
      ...progress,
    };
  },
};

export default supportService;
