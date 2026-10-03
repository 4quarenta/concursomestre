import { describe, expect, it } from 'vitest';
import { buildGranQuestionQueryUrl, readGranQuestionQueryControls } from '../granCrawlerUrl';

describe('Gran crawler URL controls', () => {
  it('replaces indexed years returned by PHP instead of accumulating them on resume', () => {
    const previous = 'https://rota-api.grancursosonline.com.br/v1/elastic/questao?anos[0]=2004&anos[1]=2004&bancas[]=10';
    expect(readGranQuestionQueryControls(previous).year).toBe('2004');
    const result = new URL(buildGranQuestionQueryUrl(previous, { page: 202, perPage: 100, year: '2005' }));
    expect([...result.searchParams.keys()].filter((key) => key.startsWith('anos'))).toEqual(['anos[]']);
    expect(result.searchParams.get('anos[]')).toBe('2005');
    expect(result.searchParams.get('bancas[]')).toBe('10');
  });
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
    expect(result.searchParams.has('anulada')).toBe(false);
    expect(result.searchParams.has('desatualizada')).toBe(false);
    expect(result.searchParams.get('inedita')).toBe('0');
  });

  it('reads controls from a pasted URL and removes a cleared year', () => {
    const pasted = 'https://rota-api.grancursosonline.com.br/v1/elastic/questao?page=9&perPage=50&anos%5B%5D=2023';
    expect(readGranQuestionQueryControls(pasted)).toEqual({ page: 9, perPage: 50, year: '2023' });
    expect(new URL(buildGranQuestionQueryUrl(pasted, { page: 9, perPage: 50, year: '' }))
      .searchParams.getAll('anos[]')).toEqual([]);
  });

  it('removes status filters so the source returns every status for the selected year', () => {
    const result = new URL(buildGranQuestionQueryUrl(
      'https://rota-api.grancursosonline.com.br/v1/elastic/questao?anulada=0&desatualizada=0',
      { page: 16, perPage: 1000, year: '2000' },
    ));
    expect(result.searchParams.has('anulada')).toBe(false);
    expect(result.searchParams.has('desatualizada')).toBe(false);
    expect(result.searchParams.get('inedita')).toBe('0');
    expect(result.searchParams.get('perPage')).toBe('1000');
    expect(result.searchParams.get('anos[]')).toBe('2000');
  });

  it('rejects multiple or invalid years through the canonical control', () => {
    expect(() => buildGranQuestionQueryUrl('', { page: 1, perPage: 20, year: '1899' })).toThrow();
  });

  it('allows up to 1.000 questions per request and clamps larger values', () => {
    expect(new URL(buildGranQuestionQueryUrl('', { page: 1, perPage: 750, year: '1999' }))
      .searchParams.get('perPage')).toBe('750');
    expect(new URL(buildGranQuestionQueryUrl('', { page: 1, perPage: 5000, year: '1999' }))
      .searchParams.get('perPage')).toBe('1000');
    expect(readGranQuestionQueryControls(
      'https://rota-api.grancursosonline.com.br/v1/elastic/questao?page=1&perPage=1000&anos%5B%5D=1999',
    )).toEqual({ page: 1, perPage: 1000, year: '1999' });
  });
});
