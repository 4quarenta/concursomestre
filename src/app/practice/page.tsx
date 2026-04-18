import type { Metadata } from 'next';
import PracticePageClient, {
  DEFAULT_PRACTICE_FILTERS,
  type PracticeFilters,
} from '@/components/practice/PracticePageClient';
import { safeServerFetch } from '@/lib/api';
import { mergePublicSystemSettings } from '@/lib/publicSettings';
import { readFirstSearchParam, type RouteSearchParams } from '@/lib/searchParams';
import type { SystemSettings } from '@/types';

export const metadata: Metadata = {
  title: 'Questoes | ConcursoMestre',
  description: 'Resolva questoes por banca, materia, assunto, ano e dificuldade.',
  robots: {
    index: false,
    follow: false,
  },
};

const readFilter = (
  searchParams: RouteSearchParams,
  key: string,
  fallback: string,
) => readFirstSearchParam(searchParams[key]) || fallback;

const resolveInitialFilters = (searchParams: RouteSearchParams): PracticeFilters => ({
  ...DEFAULT_PRACTICE_FILTERS,
  keyword: readFilter(searchParams, 'keyword', DEFAULT_PRACTICE_FILTERS.keyword),
  subject: readFirstSearchParam(searchParams.subject)
    || readFirstSearchParam(searchParams.materia)
    || DEFAULT_PRACTICE_FILTERS.subject,
  topic: readFirstSearchParam(searchParams.topic)
    || readFirstSearchParam(searchParams.assunto)
    || DEFAULT_PRACTICE_FILTERS.topic,
  agency: readFilter(searchParams, 'agency', DEFAULT_PRACTICE_FILTERS.agency),
  organization: readFilter(searchParams, 'organization', DEFAULT_PRACTICE_FILTERS.organization),
  year: readFilter(searchParams, 'year', DEFAULT_PRACTICE_FILTERS.year),
  difficulty: readFilter(searchParams, 'difficulty', DEFAULT_PRACTICE_FILTERS.difficulty),
  onlySaved: readFirstSearchParam(searchParams.onlySaved) === 'true',
});

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const settings = mergePublicSystemSettings(
    await safeServerFetch<Partial<SystemSettings>>('settings.php', {}),
  );

  return (
    <PracticePageClient
      highlightedQuestionId={readFirstSearchParam(resolvedSearchParams.questionId) || ''}
      initialFilters={resolveInitialFilters(resolvedSearchParams)}
      systemSettings={settings}
    />
  );
}
