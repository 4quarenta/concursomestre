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
          user_id: userId || '',
        },
      });

      const payload = readApiData<any>(response, []);
      if (Array.isArray(payload)) {
        return payload as QuestionComment[];
      }

      if (Array.isArray(payload?.items)) {
        return payload.items as QuestionComment[];
      }

      if (Array.isArray(payload?.comments)) {
        return payload.comments as QuestionComment[];
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
        user_id: input.userId,
        user_name: input.userName,
        user_avatar: input.userAvatar,
        user_plan: input.userPlan,
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
        userId,
      });

      assertApiSuccess(response, 'Nao foi possivel curtir o comentario.');
      const payload = readApiData<any>(response, {});
      return { liked: Boolean(payload?.liked ?? response?.liked) };
    } catch (error) {
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel curtir o comentario.'));
    }
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
