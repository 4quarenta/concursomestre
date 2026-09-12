import { useInfiniteQuery } from '@tanstack/react-query';
import { questionQueryKeys } from '@/features/questions/api/queryKeys';
import { questionService } from '@/services/questions/questionService';
import type { QuestionListFilters, QuestionPageResult } from '@/types/questions';

const DEFAULT_PAGE_SIZE = 20;

export const useInfiniteQuestionsQuery = (
  filters: QuestionListFilters = {},
  pageSize = DEFAULT_PAGE_SIZE,
) => {
  const query = useInfiniteQuery<QuestionPageResult>({
    queryKey: questionQueryKeys.list(filters, pageSize),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => questionService.getQuestionPage({
      ...filters,
      page: Number(pageParam),
      limit: pageSize,
    }),
    getNextPageParam: (lastPage) => (
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined
    ),
  });

  return {
    ...query,
    questions: query.data?.pages.flatMap((page) => page.rows) ?? [],
    total: query.data?.pages[0]?.total ?? 0,
  };
};

export default useInfiniteQuestionsQuery;
