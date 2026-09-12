import { useQuery } from '@tanstack/react-query';
import { commentsService } from '@/services/comments/commentsService';
import { questionService } from '@/services/questions/questionService';
import { questionQueryKeys } from '@/features/questions/api/queryKeys';

export const useQuestionStatsQuery = (questionId: string | number | undefined, enabled: boolean) => useQuery({
  queryKey: questionQueryKeys.stats(questionId || 'unknown'),
  queryFn: () => questionService.getQuestionStats(questionId as string | number),
  enabled: enabled && questionId !== undefined,
  staleTime: 60_000,
});

export const useQuestionHistoryQuery = (
  questionId: string | number | undefined,
  userId: string | undefined,
  enabled: boolean,
) => useQuery({
  queryKey: questionQueryKeys.history(questionId || 'unknown', userId),
  queryFn: () => questionService.getQuestionHistory(questionId as string | number, userId),
  enabled: enabled && questionId !== undefined && Boolean(userId),
  staleTime: 30_000,
});

export const useQuestionCommentsQuery = (
  questionId: string | number | undefined,
  userId: string | undefined,
  enabled: boolean,
) => useQuery({
  queryKey: questionQueryKeys.comments(questionId || 'unknown', userId),
  queryFn: () => commentsService.getComments(String(questionId), userId),
  enabled: enabled && questionId !== undefined,
  staleTime: 30_000,
});
