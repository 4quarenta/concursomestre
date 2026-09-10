import { questionService } from '@/services/questions/questionService';
import type { Question, QuestionListFilters } from '@/types/questions';
import type { MobileSimulationConfig, MobileSimulationSeed } from '@/types/simulation';

const MAX_CANDIDATE_PAGE_SIZE = 100;

const shuffle = <T,>(rows: T[]): T[] => {
  const result = [...rows];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

const difficultyMap: Record<NonNullable<MobileSimulationConfig['difficulty']>, string[] | undefined> = {
  all: undefined,
  easy: ['Muito facil', 'Facil'],
  medium: ['Medio'],
  hard: ['Dificil', 'Muito dificil'],
};

const toQuestionFilters = (config: MobileSimulationConfig): QuestionListFilters => ({
  keyword: config.keyword?.trim() || undefined,
  difficulty: difficultyMap[config.difficulty || 'all'],
  subject: config.subjects,
  topic: config.topics,
  agency: config.agencies,
  organization: config.organizations,
  role: config.roles,
  year: config.years,
  excludeCanceled: true,
  excludeOutdated: true,
});

const dedupe = (rows: Question[]): Question[] => {
  const seen = new Set<string>();
  return rows.filter((question, index) => {
    const key = String(question.id ?? `index-${index}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Monta um conjunto limitado de candidatas no servidor e sorteia somente esse conjunto no aparelho.
 * Evita transferir toda a base de questoes para criar um simulado.
 */
export const buildSimulationSeed = async (config: MobileSimulationConfig): Promise<MobileSimulationSeed> => {
  const pageSize = Math.min(
    MAX_CANDIDATE_PAGE_SIZE,
    Math.max(40, Math.max(1, config.questionCount) * 3),
  );
  const filters = toQuestionFilters(config);
  const firstPage = await questionService.getQuestionPage({ ...filters, page: 1, limit: pageSize });

  if (firstPage.total <= 0 || firstPage.rows.length === 0) {
    throw new Error('Nao encontramos questoes para os filtros selecionados.');
  }

  let candidates = firstPage.rows;
  if (firstPage.pages > 1) {
    const randomPage = 1 + Math.floor(Math.random() * firstPage.pages);
    if (randomPage !== 1) {
      const sampledPage = await questionService.getQuestionPage({ ...filters, page: randomPage, limit: pageSize });
      candidates = dedupe([...sampledPage.rows, ...firstPage.rows]);
    }
  }

  const selected = shuffle(candidates).slice(0, Math.min(config.questionCount, candidates.length));
  if (selected.length === 0) {
    throw new Error('Nao foi possivel montar o simulado com esses filtros.');
  }

  return {
    config: {
      ...config,
      questionCount: selected.length,
    },
    questions: selected,
    startedAt: Date.now(),
  };
};
