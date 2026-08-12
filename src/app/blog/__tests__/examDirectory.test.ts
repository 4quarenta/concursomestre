import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { examDirectoryFacets, filterExamDirectory, groupExamDirectoryByYear, paginateExamDirectory } from '../examDirectory';
import type { PublicExamDirectoryItem } from '../blogServerData';

const exam = (overrides: Partial<PublicExamDirectoryItem>): PublicExamDirectoryItem => ({
  id: 1,
  title: 'Prova teste',
  slug: 'prova-teste',
  year: 2026,
  board: 'FGV',
  boardSlug: 'fgv',
  organizations: [],
  questionCount: 80,
  proofUrl: null,
  answerKeyUrl: null,
  stateCode: 'SP',
  stateName: 'São Paulo',
  region: 'Sudeste',
  ...overrides,
});

describe('blog exam directory', () => {
  const items = [
    exam({ id: 1, year: 2026, stateCode: 'SP', stateName: 'São Paulo', region: 'Sudeste' }),
    exam({ id: 2, year: 2025, stateCode: 'PB', stateName: 'Paraíba', region: 'Nordeste' }),
  ];

  it('renders related exams from the public detail contract', () => {
    const detailPage = readFileSync(resolve(process.cwd(), 'src/app/blog/provas/[slug]/page.tsx'), 'utf8');
    const serverContract = readFileSync(resolve(process.cwd(), 'src/app/blog/blogServerData.ts'), 'utf8');

    expect(detailPage).toContain('Outras provas relacionadas');
    expect(detailPage).toContain('exam.relatedExams.map');
    expect(serverContract).toContain('relatedExams: PublicExamDirectoryItem[]');
  });

  it('filters by year, region and state without mixing dimensions', () => {
    expect(filterExamDirectory(items, { year: '2025', region: 'Nordeste', state: 'PB' })).toEqual([items[1]]);
    expect(filterExamDirectory(items, { year: '2026', region: 'Nordeste', state: '' })).toEqual([]);
  });

  it('groups years in descending order', () => {
    expect(groupExamDirectoryByYear(items).map((group) => group.year)).toEqual([2026, 2025]);
  });

  it('creates stable year, region and state facets', () => {
    const facets = examDirectoryFacets(items);
    expect(facets.years).toEqual([2026, 2025]);
    expect(facets.regions).toEqual(['Nordeste', 'Sudeste']);
    expect(facets.states.map((state) => state.code)).toEqual(['PB', 'SP']);
  });

  it('paginates filtered exams without rendering the whole directory', () => {
    const paginated = paginateExamDirectory(Array.from({ length: 25 }, (_, index) => index + 1), 2, 12);
    expect(paginated.items).toEqual([13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
    expect(paginated).toMatchObject({ currentPage: 2, totalPages: 3, totalItems: 25, start: 13, end: 24 });
  });
});
