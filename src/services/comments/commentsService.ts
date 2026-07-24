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
import { reportsService } from '@services/reports';
import type { ApiResponse } from '@services/api';
import type { QuestaoComentario } from 'types';

export type CurrentUserCommentsPage = {
  items: QuestaoComentario[];
  hasMore: boolean;
  nextCursor: string | null;
  totalComments: number;
};

export type CurrentUserCommentsRequest = {
  limit?: number;
  cursor?: string | null;
  range?: 'today' | 'week' | 'month' | 'year' | 'all';
};

type AddCommentInput = {
  questionId: string;
  content: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userPlan?: string;
  userRole?: string;
  parentId?: string;
  targetType?: 'question' | 'material' | 'blog_article';
};

type CommentCreationPayload = {
  id?: string | number;
  moderationStatus?: 'pending' | 'approved' | 'spam' | string;
  requiresModeration?: boolean;
  message?: string;
  xpGain?: string | number | null;
  xp_gain?: string | number | null;
  newXp?: string | number | null;
  new_xp?: string | number | null;
  newLevel?: string | number | null;
  new_level?: string | number | null;
};

export interface CommentSubmissionResult {
  id: string;
  moderationStatus: 'pending' | 'approved' | 'spam';
  requiresModeration: boolean;
  message?: string;
  comment?: QuestaoComentario;
  xpGain?: number;
  newXp?: number;
  newLevel?: number;
}

export interface CommentMutationResult {
  success: boolean;
  message?: string;
  duplicate?: boolean;
  xpGain?: number;
  newXp?: number;
  newLevel?: number;
}

const toOptionalNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeCommentPlan = (value: unknown): QuestaoComentario['userPlan'] => {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('elite')) return 'Elite';
  if (normalized.includes('pro')) return 'Pro';
  if (normalized.includes('essencial')) return 'Essencial';
  return 'Gratuito';
};

const normalizeCommentRecord = (comment: QuestaoComentario): QuestaoComentario => {
  const record = comment as unknown as Record<string, unknown>;
  return {
    ...comment,
    userId: String(comment.userId || record.user_id || record.userId || ''),
    userName: String(comment.userName || record.user_name || record.userName || 'Aluno'),
    userAvatar: String(comment.userAvatar || record.user_avatar || record.user_photo_url || record.photo_url || record.avatar_url || ''),
    userPlan: normalizeCommentPlan(comment.userPlan || record.user_plan || record.plan_name || record.plan || record.userPlan),
    userRole: String(comment.userRole || record.user_role || record.role || record.userRole || ''),
    userHasPendingReport: Boolean(comment.userHasPendingReport || record.user_has_pending_report || record.userHasPendingReport),
    replies: Array.isArray(comment.replies) ? comment.replies.map(normalizeCommentRecord) : [],
  };
};

/**
 * Fachada oficial do dominio de comentarios.
 * Conecta questoes, materiais e fluxo de denuncias ao backend consolidado.
 * @since 1.0.0
 */
export const commentService = {
  /**
   * Carrega comentarios de um alvo especifico no formato aninhado esperado
   * pelo frontend.
   * @since 1.0.0
   */
  async getComments(
    targetId: string,
    userId?: string,
    targetType: 'question' | 'material' | 'blog_article' = 'question',
  ): Promise<QuestaoComentario[]> {
    return withRequestCoalescing(buildRequestCacheKey('comments:list', { targetId, targetType, userId: userId || '' }), async () => {
      const response = await apiClient.get(
        ENDPOINTS.comments.list,
        {
          params: {
            target_id: targetId,
            target_type: targetType,
            user_id: userId || '',
          },
        },
      ) as unknown;

      const payload = readApiData<{ items?: QuestaoComentario[]; comments?: QuestaoComentario[] } | QuestaoComentario[]>(response, []);
      const comments = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.items) ? payload.items : payload?.comments);

      return Array.isArray(comments) ? comments.map(normalizeCommentRecord) : [];
    }, 2500);
  },

  /**
   * Lista os comentarios publicados por um usuario para alimentar dashboard e
   * sessoes de atividade.
   * @since 1.0.0
   */
  async getUserComments(userId: string): Promise<QuestaoComentario[]> {
    return withRequestCoalescing(buildRequestCacheKey('comments:user', { userId }), async () => {
      const response = await apiClient.get(
        ENDPOINTS.users.comments,
        { params: { user_id: userId } },
      ) as unknown;

      const payload = readApiData<{ items?: QuestaoComentario[]; comments?: QuestaoComentario[] } | QuestaoComentario[]>(response, []);
      const comments = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.items) ? payload.items : payload?.comments);

      return Array.isArray(comments) ? comments.map(normalizeCommentRecord) : [];
    }, 4000);
  },

  /**
   * Lista um recorte dos comentarios do proprio usuario autenticado.
   * Nao envia user_id e respeita a paginacao do backend.
   */
  async getCurrentUserCommentsPage(options: CurrentUserCommentsRequest = {}): Promise<CurrentUserCommentsPage> {
    const limit = Math.max(1, Math.min(50, Number(options.limit ?? 20) || 20));
    const range = options.range ?? 'all';

    return withRequestCoalescing(buildRequestCacheKey('comments:me', {
      limit,
      range,
      cursor: options.cursor || null,
    }), async () => {
      const response = await apiClient.get(
        ENDPOINTS.users.myComments,
        {
          params: {
            limit,
            range,
            ...(options.cursor ? { cursor: options.cursor } : {}),
          },
        },
      ) as unknown;

      const payload = readApiData<{ items?: QuestaoComentario[]; comments?: QuestaoComentario[] } | QuestaoComentario[]>(response, []);
      const comments = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.items) ? payload.items : payload?.comments);

      const record = payload && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
      const summary = record.summary && typeof record.summary === 'object'
        ? record.summary as Record<string, unknown>
        : {};

      return {
        items: Array.isArray(comments) ? comments.map(normalizeCommentRecord) : [],
        hasMore: record.hasMore === true,
        nextCursor: typeof record.nextCursor === 'string' && record.nextCursor.trim() !== ''
          ? record.nextCursor
          : null,
        totalComments: Math.max(0, Number(summary.totalComments ?? 0) || 0),
      };
    }, 4000);
  },

  /** Alias de itens para consumidores legados sem acesso ao envelope paginado. */
  async getCurrentUserComments(limit = 20): Promise<QuestaoComentario[]> {
    const page = await this.getCurrentUserCommentsPage({ limit });
    return page.items;
  },

  /**
   * Persiste um novo comentario e devolve o contrato de moderacao.
   * @since 1.0.0
   */
  async addComment(commentData: AddCommentInput): Promise<CommentSubmissionResult> {
    const requestPayload: Record<string, unknown> = {
      action: 'add',
      question_id: commentData.questionId,
      user_id: commentData.userId,
      user_name: commentData.userName,
      content: commentData.content,
      parent_id: commentData.parentId,
      targetType: commentData.targetType || 'question',
      gamification_event: commentData.parentId ? 'comment_reply_submitted' : 'comment_submitted',
      notification_event: commentData.parentId ? 'comment_reply' : 'comment_published',
    };

    if (commentData.userAvatar) {
      requestPayload.user_avatar = commentData.userAvatar;
    }

    if (commentData.userPlan) {
      requestPayload.user_plan = commentData.userPlan;
    }
    if (commentData.userRole) {
      requestPayload.user_role = commentData.userRole;
    }

    const response = await apiClient.post(
      ENDPOINTS.comments.create,
      requestPayload,
    ) as unknown;

    const envelope = assertApiSuccess<CommentCreationPayload>(response, 'Falha ao criar comentario.');
    const payload = readApiData<CommentCreationPayload>(response, {});
    const commentId = String(payload?.id ?? envelope.raw?.id ?? '');
    const moderationStatus = String(payload?.moderationStatus || envelope.raw?.moderationStatus || 'approved') as 'pending' | 'approved' | 'spam';
    const requiresModeration = Boolean(payload?.requiresModeration ?? envelope.raw?.requiresModeration ?? moderationStatus === 'pending');
    const xpGain = toOptionalNumber(payload?.xpGain ?? payload?.xp_gain ?? envelope.raw?.xpGain ?? envelope.raw?.xp_gain);
    const newXp = toOptionalNumber(payload?.newXp ?? payload?.new_xp ?? envelope.raw?.newXp ?? envelope.raw?.new_xp);
    const newLevel = toOptionalNumber(payload?.newLevel ?? payload?.new_level ?? envelope.raw?.newLevel ?? envelope.raw?.new_level);

    if (!requiresModeration && moderationStatus === 'approved') {
      return {
        id: commentId,
        moderationStatus,
        requiresModeration,
        message: String(payload?.message || envelope.message || ''),
        xpGain,
        newXp,
        newLevel,
        comment: normalizeCommentRecord({
          id: commentId,
          userId: commentData.userId,
          userName: commentData.userName,
          userAvatar: commentData.userAvatar,
          userPlan: normalizeCommentPlan(commentData.userPlan),
          userRole: commentData.userRole,
          text: commentData.content,
          date: 'Agora',
          likes: 0,
          replies: [],
          isLiked: false,
          parentId: commentData.parentId,
          moderationStatus,
        }),
      };
    }

    return {
      id: commentId,
      moderationStatus,
      requiresModeration,
      message: String(payload?.message || envelope.message || ''),
      xpGain,
      newXp,
      newLevel,
    };
  },

  /**
   * Persiste a curtida via endpoint oficial de commentsHandle.
   * @since 1.0.0
   */
  async likeComment(commentId: string, userId?: string): Promise<CommentMutationResult> {
    const response = await apiClient.post<ApiResponse>(
      ENDPOINTS.comments.handle,
      {
        action: 'like',
        commentId,
        userId,
        gamification_event: 'comment_like_received',
        notification_event: 'comment_like_received',
      },
    );

    const envelope = assertApiSuccess(response, 'Falha ao curtir comentario.');
    const payload = readApiData<Record<string, unknown>>(response, {});
    return {
      success: true,
      message: envelope.message,
      xpGain: toOptionalNumber(payload.xpGain ?? payload.xp_gain ?? envelope.raw?.xpGain ?? envelope.raw?.xp_gain),
      newXp: toOptionalNumber(payload.newXp ?? payload.new_xp ?? envelope.raw?.newXp ?? envelope.raw?.new_xp),
      newLevel: toOptionalNumber(payload.newLevel ?? payload.new_level ?? envelope.raw?.newLevel ?? envelope.raw?.new_level),
    };
  },

  /**
   * Registra a denuncia de um comentario na camada oficial do dominio.
   * @since 1.0.0
   */
  async reportComment(
    commentId: string,
    reason: string,
    details: string,
    reporterId: string,
  ): Promise<CommentMutationResult> {
    const result = await reportsService.createReport({
      reporterId,
      targetType: 'comment',
      targetId: commentId,
      reason,
      details,
    });

    return {
      success: true,
      message: result.message,
      duplicate: result.duplicate,
      xpGain: result.xpGain,
      newXp: result.newXp,
      newLevel: result.newLevel,
    };
  },

  /**
   * Deleta um comentario respeitando a validacao de ownership do backend.
   * @since 1.0.0
   */
  async deleteComment(commentId: string, userId?: string): Promise<{ success: boolean }> {
    const response = await apiClient.post<ApiResponse>(
      ENDPOINTS.comments.delete,
      { action: 'delete', commentId, userId },
    );

    assertApiSuccess(response, 'Falha ao deletar comentario.');
    return { success: true };
  },

  /**
   * Adiciona resposta em arvore no estado local.
   * @since 1.0.0
   */
  addReplyToComments(
    comments: QuestaoComentario[],
    parentId: string,
    newReply: QuestaoComentario,
  ): QuestaoComentario[] {
    return comments.map((comment) => {
      if (comment.id === parentId) {
        return {
          ...comment,
          replies: [newReply, ...(comment.replies || [])],
        };
      }

      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: this.addReplyToComments(comment.replies, parentId, newReply),
        };
      }

      return comment;
    });
  },

  /**
   * Atualiza a curtida localmente na arvore de comentarios.
   * @since 1.0.0
   */
  likeCommentInTree(comments: QuestaoComentario[], commentId: string): QuestaoComentario[] {
    return comments.map((comment) => {
      if (comment.id === commentId) {
        const currentLikes = Number(comment.likes || 0);
        const nextIsLiked = !comment.isLiked;
        return {
          ...comment,
          isLiked: nextIsLiked,
          likes: nextIsLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1),
        };
      }

      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: this.likeCommentInTree(comment.replies, commentId),
        };
      }

      return comment;
    });
  },

  /**
   * Localiza o dono de um comentario na arvore para disparo de notificacao.
   * @since 1.0.0
   */
  findCommentOwner(comments: QuestaoComentario[], commentId: string): string | null {
    for (const comment of comments) {
      if (comment.id === commentId) {
        return comment.userId;
      }

      if (comment.replies && comment.replies.length > 0) {
        const found = this.findCommentOwner(comment.replies, commentId);
        if (found) {
          return found;
        }
      }
    }

    return null;
  },

  /**
   * Remove um comentario da arvore local.
   * @since 1.0.0
   */
  deleteCommentFromTree(comments: QuestaoComentario[], commentId: string): QuestaoComentario[] {
    return comments
      .filter((comment) => comment.id !== commentId)
      .map((comment) => ({
        ...comment,
        replies: comment.replies
          ? this.deleteCommentFromTree(comment.replies, commentId)
          : [],
      }));
  },
};

export default commentService;
