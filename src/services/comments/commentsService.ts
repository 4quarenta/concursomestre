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
import { reportsService } from '@services/reports';
import type { ApiResponse } from '@services/api';
import type { QuestaoComentario } from 'types';

type AddCommentInput = {
  questionId: string;
  content: string;
  userId: string;
  userName: string;
  parentId?: string;
  targetType?: 'question' | 'material';
};

/**
 * Fachada oficial do dominio de comentários.
 * Conecta questões, materiais e fluxo de denúncias ao backend consolidado.
 * @since 1.0.0
 */
export const commentService = {
  /**
   * Carrega comentários de um alvo especifico no formato aninhado esperado
   * pelo frontend.
   * @since 1.0.0
   */
  async getComments(targetId: string, userId?: string): Promise<QuestaoComentario[]> {
    const response = await apiClient.get<any>(
      ENDPOINTS.comments.list,
      {
        params: {
          target_id: targetId,
          user_id: userId || '',
        },
      },
    ) as any;

    const comments = readApiData<QuestaoComentario[]>(response, []);
    return Array.isArray(comments) ? comments : [];
  },

  /**
   * Lista os comentários publicados por um usuário para alimentar dashboard e
   * sessoes de atividade.
   * @since 1.0.0
   */
  async getUserComments(userId: string): Promise<QuestaoComentario[]> {
    const response = await apiClient.get<any>(
      ENDPOINTS.users.comments,
      { params: { user_id: userId } },
    ) as any;

    const comments = readApiData<QuestaoComentario[]>(response, []);
    return Array.isArray(comments) ? comments : [];
  },

  /**
   * Persiste um novo comentário e devolve um contrato pronto para o estado
   * local do app.
   * @since 1.0.0
   */
  async addComment(commentData: AddCommentInput): Promise<QuestaoComentario> {
    const response = await apiClient.post<any>(
      ENDPOINTS.comments.create,
      {
        action: 'add',
        question_id: commentData.questionId,
        user_id: commentData.userId,
        user_name: commentData.userName,
        content: commentData.content,
        parent_id: commentData.parentId,
        targetType: commentData.targetType || 'question',
      },
    ) as any;

    const envelope = assertApiSuccess<{ id?: string | number }>(response, 'Falha ao criar comentário.');
    const payload = readApiData<{ id?: string | number }>(response, {});
    const commentId = payload?.id ?? envelope.raw?.id;

    return {
      id: commentId,
      userId: commentData.userId,
      userName: commentData.userName,
      userPlan: 'Gratuito',
      text: commentData.content,
      date: 'Agora',
      likes: 0,
      replies: [],
      isLiked: false,
      parentId: commentData.parentId,
    };
  },

  /**
   * Persiste a curtida via endpoint oficial de commentsHandle.
   * @since 1.0.0
   */
  async likeComment(commentId: string, userId?: string): Promise<{ success: boolean }> {
    const response = await apiClient.post<ApiResponse>(
      ENDPOINTS.comments.handle,
      { action: 'like', commentId, userId },
    );

    assertApiSuccess(response, 'Falha ao curtir comentário.');
    return { success: true };
  },

  /**
   * Registra a denúncia de um comentário na camada oficial do dominio.
   * @since 1.0.0
   */
  async reportComment(
    commentId: string,
    reason: string,
    details: string,
    reporterId: string,
  ): Promise<{ success: boolean; message?: string }> {
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
    };
  },

  /**
   * Deleta um comentário respeitando a validação de ownership do backend.
   * @since 1.0.0
   */
  async deleteComment(commentId: string, userId?: string): Promise<{ success: boolean }> {
    const response = await apiClient.post<ApiResponse>(
      ENDPOINTS.comments.delete,
      { action: 'delete', commentId, userId },
    );

    assertApiSuccess(response, 'Falha ao deletar comentário.');
    return { success: true };
  },

  /**
   * Adiciona resposta em arvore no estado local.
   * Esse helper evita remontar a arvore inteira de comentários em cada reply.
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
   * Atualiza a curtida localmente na arvore de comentários.
   * @since 1.0.0
   */
  likeCommentInTree(comments: QuestaoComentario[], commentId: string): QuestaoComentario[] {
    return comments.map((comment) => {
      if (comment.id === commentId) {
        return { ...comment, likes: comment.likes + 1 };
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
   * Localiza o dono de um comentário na arvore para disparo de notificação.
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
   * Remove um comentário da arvore local.
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
