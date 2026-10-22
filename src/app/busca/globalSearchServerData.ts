import type { Question } from '@types';
import { fetchPracticeInitialQuestions } from '../practice/practiceServerData';
import { fetchBlogPageForServer, fetchPublicExamDirectoryPageForServer } from '../blog/blogServerData';
import { fetchPublicTaxonomyDirectory, type PublicTaxonomyDirectoryItem } from '../taxonomias/taxonomyDirectoryServerData';
import { fetchContestDirectoryForServer } from '../concursos/contestServerData';
import { fetchPublicMaterialDirectory } from '../materiais/materialServerData';
import { fetchPublicSimulationDirectory } from '../simulados/simulationServerData';
import type { BlogArticle } from '@services/blog';
import type { PublicExamDirectoryItem } from '../blog/blogServerData';
import type { ContestSummary } from '../concursos/contestServerData';
import type { PublicMaterialSummary } from '../materiais/materialServerData';
import type { PublicSimulationSummary } from '../simulados/simulationServerData';

export type GlobalSearchGroup<T> = {
  items: T[];
  total: number;
};

export type GlobalSearchResults = {
  questions: GlobalSearchGroup<Question>;
  exams: GlobalSearchGroup<PublicExamDirectoryItem>;
  news: GlobalSearchGroup<BlogArticle>;
  subjects: GlobalSearchGroup<PublicTaxonomyDirectoryItem>;
  topics: GlobalSearchGroup<PublicTaxonomyDirectoryItem>;
  boards: GlobalSearchGroup<PublicTaxonomyDirectoryItem>;
  organizations: GlobalSearchGroup<PublicTaxonomyDirectoryItem>;
  contests: GlobalSearchGroup<ContestSummary>;
  materials: GlobalSearchGroup<PublicMaterialSummary>;
  simulations: GlobalSearchGroup<PublicSimulationSummary>;
};

const EMPTY: GlobalSearchResults = {
  questions: { items: [], total: 0 },
  exams: { items: [], total: 0 },
  news: { items: [], total: 0 },
  subjects: { items: [], total: 0 },
  topics: { items: [], total: 0 },
  boards: { items: [], total: 0 },
  organizations: { items: [], total: 0 },
  contests: { items: [], total: 0 },
  materials: { items: [], total: 0 },
  simulations: { items: [], total: 0 },
};

const settled = <T,>(result: PromiseSettledResult<T>, fallback: T): T => (
  result.status === 'fulfilled' ? result.value : fallback
);

export const fetchGlobalSearchResults = async (query: string): Promise<GlobalSearchResults> => {
  const search = query.trim().slice(0, 120);
  if (!search) return EMPTY;

  const [questionsResult, examsResult, newsResult, subjectsResult, topicsResult, boardsResult,
    organizationsResult, contestsResult, materialsResult, simulationsResult] = await Promise.allSettled([
    fetchPracticeInitialQuestions({ searchParams: { keyword: search } }),
    fetchPublicExamDirectoryPageForServer({ page: 1, limit: 6, search }),
    fetchBlogPageForServer({ search, limit: 6 }),
    fetchPublicTaxonomyDirectory({ type: 'subjects', page: 1, search, letter: '' }),
    fetchPublicTaxonomyDirectory({ type: 'topics', page: 1, search, letter: '' }),
    fetchPublicTaxonomyDirectory({ type: 'boards', page: 1, search, letter: '' }),
    fetchPublicTaxonomyDirectory({ type: 'organizations', page: 1, search, letter: '' }),
    fetchContestDirectoryForServer({ busca: search }),
    fetchPublicMaterialDirectory({ busca: search }),
    fetchPublicSimulationDirectory({ busca: search }),
  ]);

  const questions = settled(questionsResult, { questions: [], total: 0, pageInfo: { limit: 10, total: 0, hasMore: false, nextCursor: null } });
  const exams = settled(examsResult, null);
  const news = settled(newsResult, { items: [], pageInfo: { limit: 6, hasMore: false, nextCursor: null, total: 0 } });
  const subjects = settled(subjectsResult, null);
  const topics = settled(topicsResult, null);
  const boards = settled(boardsResult, null);
  const organizations = settled(organizationsResult, null);
  const contests = settled(contestsResult, null);
  const materials = settled(materialsResult, null);
  const simulations = settled(simulationsResult, null);

  return {
    questions: { items: questions.questions.slice(0, 6), total: questions.total },
    exams: { items: exams?.items || [], total: exams?.pageInfo.totalItems || 0 },
    news: { items: news.items.slice(0, 6), total: Math.max(news.items.length, Number(news.pageInfo.total || 0)) },
    subjects: { items: subjects?.items.slice(0, 6) || [], total: subjects?.pageInfo.total || 0 },
    topics: { items: topics?.items.slice(0, 6) || [], total: topics?.pageInfo.total || 0 },
    boards: { items: boards?.items.slice(0, 6) || [], total: boards?.pageInfo.total || 0 },
    organizations: { items: organizations?.items.slice(0, 6) || [], total: organizations?.pageInfo.total || 0 },
    contests: { items: contests?.items.slice(0, 6) || [], total: contests?.pageInfo.total || 0 },
    materials: { items: materials?.items.slice(0, 6) || [], total: materials?.pageInfo.total || 0 },
    simulations: { items: simulations?.items.slice(0, 6) || [], total: simulations?.pageInfo.total || 0 },
  };
};
