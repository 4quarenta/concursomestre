/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
  },
  readApiData: (response: any, fallback: any) => {
    if (response?.data !== undefined) return response.data;
    return response ?? fallback;
  },
  assertApiSuccess: (response: any, fallbackMessage: string) => {
    if (!response?.success) {
      throw new Error(response?.message || response?.error || fallbackMessage);
    }

    return {
      success: true,
      message: response?.message,
      data: response?.data,
      raw: response,
    };
  },
  ENDPOINTS: {
    filters: {
      list: 'filtersList',
      save: 'filtersSave',
      delete: 'filtersDelete',
    },
  },
}));

import {
  ENEM_FOCUS_NAME,
  filtersService,
  getEnemSubjectAreasForQuestion,
  injectEnemFocusOption,
  isEnemQuestion,
  normalizeCareerSelectorLabel,
  normalizeFiltersToTaxonomies,
} from '../index';

describe('filtersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes taxonomy payload into app structure', () => {
    const taxonomies = normalizeFiltersToTaxonomies({
      bancas: [{ id: 1, nome: 'FGV', sigla: 'FGV', slug: 'fgv' }],
      assuntos: [{ id: 2, nome: 'Direito', slug: 'direito', materia: true }],
      anos: [2024],
    });

    expect(taxonomies.agencies[0].name).toBe('FGV');
    expect(taxonomies.subjects[0].name).toBe('Direito');
    expect(taxonomies.years).toEqual(['2024']);
  });

  it('always exposes ENEM in the foco selector helper', () => {
    expect(injectEnemFocusOption(['Policial', 'Fiscal'])).toEqual([
      ENEM_FOCUS_NAME,
      'Policial',
      'Fiscal',
    ]);
  });

  it('normalizes focus labels to a single slash-based pattern', () => {
    expect(normalizeCareerSelectorLabel('Educação (Professores, Especialistas e outros)')).toBe(
      'Educação / Professores, Especialistas e outros',
    );
    expect(normalizeCareerSelectorLabel('Educação / Professor')).toBe('Educação / Professor');
  });

  it('detects ENEM questions and maps subject areas', () => {
    const enemQuestion = {
      orgaos: [{ nome: 'INEP', sigla: 'INEP' }],
      carreiras: [],
      bancas: [],
      assuntos: [
        { nome: 'Geografia', materia: true },
        { nome: 'Cartografia', materia: false },
      ],
      areas: [],
      provas: [{ nome: 'ENEM 2025', orgao: { nome: 'INEP' }, banca: { nome: 'INEP' } }],
    } as any;

    expect(isEnemQuestion(enemQuestion)).toBe(true);
    expect(getEnemSubjectAreasForQuestion(enemQuestion)).toContain('Ciencias Humanas e suas Tecnologias');
  });

  it('loads raw filters payload from the official endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        bancas: [{ id: 1, nome: 'CESPE' }],
      },
    });

    const payload = await filtersService.list();

    expect(mockGet).toHaveBeenCalledWith('filtersList');
    expect(payload.bancas?.[0].nome).toBe('CESPE');
  });

  it('saves filters through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: { id: 9 },
    });

    const id = await filtersService.save({
      type: 'banca',
      name: 'Nova banca',
      slug: 'nova-banca',
    });

    expect(mockPost).toHaveBeenCalledWith('filtersSave', {
      type: 'banca',
      name: 'Nova banca',
      slug: 'nova-banca',
    });
    expect(id).toBe(9);
  });

  it('removes filters through the official endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
    });

    await filtersService.remove(12);

    expect(mockGet).toHaveBeenCalledWith('filtersDelete', {
      params: { id: '12' },
    });
  });
});
