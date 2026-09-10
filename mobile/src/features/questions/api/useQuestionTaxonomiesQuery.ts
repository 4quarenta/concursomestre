import { useQuery } from '@tanstack/react-query';
import { taxonomyService } from '@/features/questions/api/taxonomyService';

export const questionTaxonomyQueryKey = ['questions', 'taxonomies'] as const;

export const useQuestionTaxonomiesQuery = () => useQuery({
  queryKey: questionTaxonomyQueryKey,
  queryFn: () => taxonomyService.list(),
  staleTime: 5 * 60 * 1000,
});

export default useQuestionTaxonomiesQuery;
