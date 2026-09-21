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
  targetType?: 'question' | 'material';
};

export const commentsService = {
  async getComments(targetId: string, userId?: string): Promise<QuestionComment[]> {
    try {
      const response: any = await apiClient.get<any>(ENDPOINTS.comments.list, {
        params: {
          target_id: targetId,
          user_id: userId || '',
        },
      });

      const payload = readApiData<any>(response, []);
      if (Array.isArray(payload)) {
        return payload as QuestionComment[];
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
        userPlan: 'Gratuito',
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

  async likeComment(commentId: string, userId?: string): Promise<void> {
    try {
      const response: any = await apiClient.post<any>(ENDPOINTS.comments.handle, {
        action: 'like',
        commentId,
        userId,
      });

      assertApiSuccess(response, 'Nao foi possivel curtir o comentario.');
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

  likeCommentInTree(comments: QuestionComment[], commentId: string): QuestionComment[] {
    return comments.map((comment) => {
      if (comment.id === commentId) {
        return {
          ...comment,
          likes: Number(comment.likes || 0) + 1,
          isLiked: true,
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
};

export default commentsService;
