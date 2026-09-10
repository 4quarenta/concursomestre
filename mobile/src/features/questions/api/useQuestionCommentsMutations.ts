import { useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsService } from '@/services/comments/commentsService';
import { questionQueryKeys } from '@/features/questions/api/queryKeys';
import type { QuestionComment } from '@/types/comments';

export const useAddQuestionCommentMutation = (
  questionId: string | number | undefined,
  userId?: string,
  userName?: string,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: string }) => {
      if (!questionId || !userId || !userName) {
        throw new Error('Entre na sua conta para comentar nesta questao.');
      }

      const trimmed = content.trim();
      if (!trimmed) throw new Error('Escreva um comentario antes de publicar.');

      return commentsService.addComment({
        questionId: String(questionId),
        content: trimmed,
        userId,
        userName,
        parentId,
        targetType: 'question',
      });
    },
    onSuccess: (comment, variables) => {
      queryClient.setQueryData<QuestionComment[]>(
        questionQueryKeys.comments(questionId || 'unknown', userId),
        (current = []) => variables.parentId
          ? commentsService.addReplyToComments(current, variables.parentId, comment)
          : [comment, ...current],
      );

      if (!variables.parentId) {
        void queryClient.invalidateQueries({ queryKey: questionQueryKeys.lists() });
      }
    },
  });
};

export const useLikeQuestionCommentMutation = (
  questionId: string | number | undefined,
  userId?: string,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!userId) throw new Error('Entre na sua conta para curtir comentarios.');
      await commentsService.likeComment(commentId, userId);
      return commentId;
    },
    onSuccess: (commentId) => {
      queryClient.setQueryData<QuestionComment[]>(
        questionQueryKeys.comments(questionId || 'unknown', userId),
        (current = []) => commentsService.likeCommentInTree(current, commentId),
      );
    },
  });
};
