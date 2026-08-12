import type { PublicExamDirectoryItem } from './blogServerData';

export interface ExamDirectoryFilters {
  year: string;
  region: string;
  state: string;
  page?: number;
}

export const paginateExamDirectory = <T,>(items: T[], page: number, pageSize = 12) => {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, Math.trunc(page) || 1));
  const start = (currentPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    currentPage,
    totalPages,
    totalItems: items.length,
    start: items.length === 0 ? 0 : start + 1,
    end: Math.min(items.length, start + pageSize),
  };
};

export const filterExamDirectory = (
  items: PublicExamDirectoryItem[],
  filters: ExamDirectoryFilters,
): PublicExamDirectoryItem[] => items.filter((item) => (
  (!filters.year || String(item.year) === filters.year)
  && (!filters.region || item.region === filters.region)
  && (!filters.state || item.stateCode === filters.state)
));

export const groupExamDirectoryByYear = (
  items: PublicExamDirectoryItem[],
): Array<{ year: number; items: PublicExamDirectoryItem[] }> => {
  const groups = new Map<number, PublicExamDirectoryItem[]>();
  items.forEach((item) => groups.set(item.year, [...(groups.get(item.year) || []), item]));
  return [...groups.entries()]
    .sort(([left], [right]) => right - left)
    .map(([year, groupedItems]) => ({ year, items: groupedItems }));
};

export const examDirectoryFacets = (items: PublicExamDirectoryItem[]) => ({
  years: [...new Set(items.map((item) => item.year).filter(Boolean))].sort((a, b) => b - a),
  regions: [...new Set(items.map((item) => item.region).filter(Boolean))].sort(),
  states: [...new Map(items.filter((item) => item.stateCode).map((item) => [item.stateCode || '', {
    code: item.stateCode || '',
    name: item.stateName,
  }])).values()].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
});
