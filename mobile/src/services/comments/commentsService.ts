import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData, readApiErrorMessage } from '@/services/api/response';
import type { QuestionComment } from '@/types/comments';

type AddCommentInput = {
  questionId: string;
  content: string;
  userId: string;
  userName: string;
  parentId?: string;
  userAvatar?: string;
  userPlan?: string;
  targetType?: 'question' | 'material' | 'blog_article';
};

export type LikeCommentResult = {
  liked: boolean;
};

const normalizeComment = (value: unknown): QuestionComment => {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const replies = Array.isArray(record.replies) ? record.replies.map(normalizeComment) : [];
  return {
    ...(record as unknown as QuestionComment),
    id: String(record.id ?? record.comment_id ?? ''),
    userId: String(record.userId ?? record.user_id ?? record.authorId ?? record.author_id ?? ''),
    userName: String(record.userName ?? record.user_name ?? 'Usuário'),
    userAvatar: String(record.userAvatar ?? record.user_avatar ?? record.user_photo_url ?? record.avatar_url ?? '') || undefined,
    userPlan: String(record.userPlan ?? record.user_plan ?? record.plan ?? 'Gratuito'),
    userRole: String(record.userRole ?? record.user_role ?? record.role ?? ''),
    userHasPendingReport: Boolean(record.userHasPendingReport ?? record.user_has_pending_report),
    text: String(record.text ?? record.content ?? ''),
    date: String(record.date ?? record.created_at ?? ''),
    likes: Number(record.likes ?? record.likes_count ?? 0) || 0,
    isLiked: Boolean(record.isLiked ?? record.is_liked),
    parentId: String(record.parentId ?? record.parent_id ?? '') || undefined,
    replies,
  };
};

export const commentsService = {
  async getComments(
    targetId: string,
    userId?: string,
    targetType: 'question' | 'material' | 'blog_article' = 'question',
  ): Promise<QuestionComment[]> {
    try {
      const response: any = await apiClient.get<any>(ENDPOINTS.comments.list, {
        params: {
          target_id: targetId,
          target_type: targetType,
        },
      });

      const payload = readApiData<any>(response, []);
      if (Array.isArray(payload)) {
        return payload.map(normalizeComment);
      }

      if (Array.isArray(payload?.items)) {
        return payload.items.map(normalizeComment);
      }

      if (Array.isArray(payload?.comments)) {
        return payload.comments.map(normalizeComment);
      }

      return [];
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel carregar comentarios.'));
    }
  },

  async addComment(input: AddCommentInput): Promise<QuestionComment> {
    try {
      const response: any = await apiClient.post<any>(ENDPOINTS.comments.create, {
        action: 'add',
        question_id: input.questionId,
        content: input.content,
        parent_id: input.parentId,
        targetType: input.targetType || 'question',
      });

      const envelope = assertApiSuccess<{ id?: string | number }>(response, 'Nao foi possivel publicar o comentario.');
      const payload = readApiData<any>(response, {});
      const commentId = String(payload?.id || envelope.raw?.id || `comment-${Date.now()}`);

      return {
        id: commentId,
        userId: input.userId,
        userName: input.userName,
        userAvatar: input.userAvatar,
        userPlan: input.userPlan || 'Gratuito',
        text: input.content,
        date: 'Agora',
        likes: 0,
        replies: [],
        isLiked: false,
        parentId: input.parentId,
      };
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel publicar o comentario.'));
    }
  },

  async likeComment(commentId: string, userId?: string): Promise<LikeCommentResult> {
    try {
      const response: any = await apiClient.post<any>(ENDPOINTS.comments.handle, {
        action: 'like',
        commentId,
      });

      assertApiSuccess(response, 'Nao foi possivel curtir o comentario.');
      const payload = readApiData<any>(response, {});
      return { liked: Boolean(payload?.liked ?? response?.liked) };
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel curtir o comentario.'));
    }
  },

  async deleteComment(commentId: string): Promise<void> {
    try {
      const response: any = await apiClient.post<any>(ENDPOINTS.comments.handle, {
        action: 'delete',
        commentId,
      });
      assertApiSuccess(response, 'Não foi possível excluir o comentário.');
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Não foi possível excluir o comentário.'));
    }
  },

  findCommentOwner(comments: QuestionComment[], commentId: string): string | undefined {
    for (const comment of comments) {
      if (String(comment.id) === String(commentId)) return comment.userId;
      const owner = this.findCommentOwner(comment.replies || [], commentId);
      if (owner !== undefined) return owner;
    }
    return undefined;
  },

  deleteCommentFromTree(comments: QuestionComment[], commentId: string): QuestionComment[] {
    return comments
      .filter((comment) => String(comment.id) !== String(commentId))
      .map((comment) => ({ ...comment, replies: this.deleteCommentFromTree(comment.replies || [], commentId) }));
  },

  addReplyToComments(
    comments: QuestionComment[],
    parentId: string,
    newReply: QuestionComment,
  ): QuestionComment[] {
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

  likeCommentInTree(
    comments: QuestionComment[],
    commentId: string,
    result?: LikeCommentResult,
  ): QuestionComment[] {
    return comments.map((comment) => {
      if (comment.id === commentId) {
        const liked = result?.liked ?? !comment.isLiked;
        return {
          ...comment,
          likes: Math.max(0, Number(comment.likes || 0) + (liked ? 1 : -1)),
          isLiked: liked,
        };
      }

      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: this.likeCommentInTree(comment.replies, commentId, result),
        };
      }

      return comment;
    });
  },
};

export default commentsService;
