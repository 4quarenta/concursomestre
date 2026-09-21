import { useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsService } from '@/services/comments/commentsService';
import { questionQueryKeys } from '@/features/questions/api/queryKeys';
import type { QuestionComment } from '@/types/comments';

export const useAddQuestionCommentMutation = (
  questionId: string | number | undefined,
  userId?: string,
  userName?: string,
  userAvatar?: string,
  userPlan?: string,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, parentId }: { content: string; parentId?: string }) => {
      if (!questionId || !userId) {
        throw new Error('Entre na sua conta para comentar nesta questao.');
      }

      const trimmed = content.trim();
      if (!trimmed) throw new Error('Escreva um comentario antes de publicar.');

      return commentsService.addComment({
        questionId: String(questionId),
        content: trimmed,
        userId,
        // O backend autentica o autor pelo token; o nome e apenas um campo
        // de apresentacao e pode faltar em sessoes legadas.
        userName: userName?.trim() || 'Aluno',
        userAvatar,
        userPlan,
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
      const result = await commentsService.likeComment(commentId, userId);
      return { commentId, result };
    },
    onSuccess: ({ commentId, result }) => {
      queryClient.setQueryData<QuestionComment[]>(
        questionQueryKeys.comments(questionId || 'unknown', userId),
        (current = []) => commentsService.likeCommentInTree(current, commentId, result),
      );
    },
  });
};
