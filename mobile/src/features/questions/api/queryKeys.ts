import type { QuestionListFilters } from '@/types/questions';

export const questionQueryKeys = {
  all: ['questions'] as const,
  lists: () => [...questionQueryKeys.all, 'list'] as const,
  list: (filters: QuestionListFilters, pageSize: number) => (
    [...questionQueryKeys.lists(), { filters, pageSize }] as const
  ),
  stats: (questionId: string | number) => [...questionQueryKeys.all, 'stats', String(questionId)] as const,
  history: (questionId: string | number, userId?: string) => (
    [...questionQueryKeys.all, 'history', String(questionId), userId || 'anonymous'] as const
  ),
  comments: (questionId: string | number, userId?: string) => (
    [...questionQueryKeys.all, 'comments', String(questionId), userId || 'anonymous'] as const
  ),
  notes: (userId?: string) => (
    [...questionQueryKeys.all, 'notes', userId || 'anonymous'] as const
  ),
};

export default questionQueryKeys;
