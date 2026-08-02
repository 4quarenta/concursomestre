import { describe, expect, it } from 'vitest';
import { buildGranQuestionQueryUrl, readGranQuestionQueryControls } from '../granCrawlerUrl';

describe('Gran crawler URL controls', () => {
  it('applies page, perPage and a single year while preserving filters', () => {
    const result = new URL(buildGranQuestionQueryUrl(
      'https://rota-api.grancursosonline.com.br/v1/elastic/questao?page=7&perPage=20&anos=2024&anos%5B%5D=2025&banca=10',
      { page: 3, perPage: 100, year: '2026' },
    ));
    expect(result.searchParams.get('page')).toBe('3');
    expect(result.searchParams.get('perPage')).toBe('100');
    expect(result.searchParams.getAll('anos')).toEqual([]);
    expect(result.searchParams.getAll('anos[]')).toEqual(['2026']);
    expect(result.searchParams.get('banca')).toBe('10');
  });

  it('reads controls from a pasted URL and removes a cleared year', () => {
    const pasted = 'https://rota-api.grancursosonline.com.br/v1/elastic/questao?page=9&perPage=50&anos%5B%5D=2023';
    expect(readGranQuestionQueryControls(pasted)).toEqual({ page: 9, perPage: 50, year: '2023' });
    expect(new URL(buildGranQuestionQueryUrl(pasted, { page: 9, perPage: 50, year: '' }))
      .searchParams.getAll('anos[]')).toEqual([]);
  });

  it('rejects multiple or invalid years through the canonical control', () => {
    expect(() => buildGranQuestionQueryUrl('', { page: 1, perPage: 20, year: '1899' })).toThrow();
  });
});
