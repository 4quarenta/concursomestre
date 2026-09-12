import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { questionQueryKeys } from '@/features/questions/api/queryKeys';
import { questionService } from '@/services/questions/questionService';
import type { QuestionPageResult, UserAnswerInput } from '@/types/questions';

export const useAnswerQuestionMutation = (userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (answer: UserAnswerInput) => {
      if (!userId) {
        throw new Error('Sessao invalida. Faca login novamente.');
      }

      const result = await questionService.submitUserAnswer(userId, answer);
      if (!result.success) {
        throw new Error(result.message || 'Nao foi possivel salvar a resposta.');
      }

      return { answer, result };
    },
    onSuccess: ({ answer, result }) => {
      queryClient.setQueriesData<InfiniteData<QuestionPageResult>>(
        { queryKey: questionQueryKeys.lists() },
        (current) => {
          if (!current) return current;

          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              rows: page.rows.map((question) => (
                question.id === answer.questionId
                  ? {
                    ...question,
                    correctOptionIndex: result.correctOptionIndex,
                    userAnswer: {
                      questionId: answer.questionId,
                      selectedOptionIndex: answer.selectedOptionIndex,
                      isCorrect: result.isCorrect,
                      timestamp: Date.now(),
                    },
                  }
                  : question
              )),
            })),
          };
        },
      );

      void queryClient.invalidateQueries({
        queryKey: questionQueryKeys.stats(answer.questionId),
      });
      void queryClient.invalidateQueries({
        queryKey: questionQueryKeys.history(answer.questionId, userId),
      });
    },
  });
};

export default useAnswerQuestionMutation;
