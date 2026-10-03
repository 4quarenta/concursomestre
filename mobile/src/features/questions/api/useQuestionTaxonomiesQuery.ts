import { useQuery } from '@tanstack/react-query';
import { taxonomyService } from '@/features/questions/api/taxonomyService';

// Version the cache key with the scope so a previously cached full catalog
// can never satisfy a practice-catalog request after an update.
export const questionTaxonomyQueryKey = ['questions', 'taxonomies', 'practice'] as const;

export const useQuestionTaxonomiesQuery = ({ enabled = true }: { enabled?: boolean } = {}) => useQuery({
  queryKey: questionTaxonomyQueryKey,
  queryFn: () => taxonomyService.list(),
  staleTime: 5 * 60 * 1000,
  enabled,
});

export default useQuestionTaxonomiesQuery;
