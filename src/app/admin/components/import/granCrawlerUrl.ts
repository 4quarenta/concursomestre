const GRAN_API_ENDPOINT = 'https://rota-api.grancursosonline.com.br/v1/elastic/questao';
const MAX_GRAN_QUESTIONS_PER_PAGE = 1000;

/** Keep one page size for the whole automatic cycle when deep pages are unreliable. */
export const calculateGranSafePageSize = (
  totalPages: number,
  perPage: number,
  maxPages = 500,
): number => {
  const currentPageSize = Math.max(1, Math.min(MAX_GRAN_QUESTIONS_PER_PAGE, Math.trunc(perPage)));
  const observedPages = Math.max(0, Math.trunc(totalPages));
  const pageLimit = Math.max(1, Math.trunc(maxPages));
  if (observedPages <= pageLimit) return currentPageSize;
  return Math.max(
    currentPageSize,
    Math.min(MAX_GRAN_QUESTIONS_PER_PAGE, Math.ceil((observedPages * currentPageSize) / pageLimit)),
  );
};

export type GranQuestionQueryControls = {
  page: number;
  perPage: number;
  year: string;
};

const normalizeYear = (value: string) => {
  const year = value.trim();
  if (year === '') return '';
  if (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2200) {
    throw new Error('Informe um unico ano entre 1900 e 2200.');
  }
  return year;
};

export const readGranQuestionQueryControls = (urlValue: string): Partial<GranQuestionQueryControls> => {
  const parsed = new URL(urlValue);
  if (parsed.origin !== 'https://rota-api.grancursosonline.com.br'
    || parsed.pathname !== '/v1/elastic/questao') {
    throw new Error('Use somente a rota oficial de questoes da Gran.');
  }
  const page = Number(parsed.searchParams.get('page'));
  const perPage = Number(parsed.searchParams.get('perPage'));
  const rawYears = [
    ...parsed.searchParams.getAll('anos'),
    ...parsed.searchParams.getAll('anos[]'),
  ].map((entry) => entry.trim()).filter(Boolean);
  const years = [...new Set(rawYears)];
  return {
    page: Number.isInteger(page) && page >= 1 ? page : undefined,
    perPage: Number.isInteger(perPage) && perPage >= 1 && perPage <= MAX_GRAN_QUESTIONS_PER_PAGE
      ? perPage
      : undefined,
    year: years.length === 1 ? normalizeYear(years[0]) : '',
  };
};

export const buildGranQuestionQueryUrl = (
  urlValue: string,
  controls: GranQuestionQueryControls,
) => {
  const page = Math.max(1, Math.trunc(controls.page));
  const perPage = Math.max(1, Math.min(MAX_GRAN_QUESTIONS_PER_PAGE, Math.trunc(controls.perPage)));
  const year = normalizeYear(controls.year);
  const parsed = urlValue.trim() ? new URL(urlValue.trim()) : new URL(GRAN_API_ENDPOINT);
  if (parsed.origin !== 'https://rota-api.grancursosonline.com.br'
    || parsed.pathname !== '/v1/elastic/questao') {
    throw new Error('Use somente a rota oficial de questoes da Gran.');
  }
  if (!urlValue.trim()) {
    parsed.searchParams.set('marcarResolvidas', '1');
    parsed.searchParams.set('resolucao', 'TODAS');
    // Omitting the status filters is Gran's "all statuses" mode. Setting
    // anulada/desatualizada to 1 narrows the response to those statuses and
    // can exclude ordinary questions from later pages.
    parsed.searchParams.set('inedita', '0');
    parsed.searchParams.set('tiposProva', '1');
    parsed.searchParams.set('sort', '[{"anos":"desc"},{"_score":"desc"}]');
  }
  // A pasted URL may contain status filters from the Gran screen. Remove
  // both so manual and automatic collection use the all-statuses policy;
  // the explicit inedita=0 filter remains the only status restriction.
  parsed.searchParams.delete('anulada');
  parsed.searchParams.delete('desatualizada');
  parsed.searchParams.set('inedita', '0');
  parsed.searchParams.set('page', String(page));
  parsed.searchParams.set('perPage', String(perPage));
  parsed.searchParams.delete('anos');
  parsed.searchParams.delete('anos[]');
  if (year) parsed.searchParams.append('anos[]', year);
  return parsed.toString();
};
