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

type MockApiResponse = {
  data?: unknown;
  success?: boolean;
  message?: string;
  error?: string;
} | null | undefined;

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
  },
  readApiData: (response: MockApiResponse, fallback: unknown) => {
    if (response?.data !== undefined) return response.data;
    return response ?? fallback;
  },
  readApiErrorMessage: (error: unknown, fallback = '') => {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response?: { data?: { message?: string } } }).response;
      return response?.data?.message || fallback;
    }
    return error instanceof Error ? error.message : fallback;
  },
  assertApiSuccess: (response: MockApiResponse, fallbackMessage: string) => {
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
      adminList: 'adminFiltersList',
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
      orgaos: [{
        id: 10,
        nome: 'Corpo de Bombeiros Militar da Paraiba',
        sigla: 'CBM-PB',
        slug: 'corpo-de-bombeiros-militar-da-paraiba',
        assetUrl: '/uploads/admin-assets/taxonomy-logo/cbm-pb.webp',
        usage: { questions: 12, exams: 3, laws: 1, total: 16 },
      }],
      assuntos: [
        { id: 2, nome: 'Direito', slug: 'direito', materia: true },
        { id: 3, nome: 'Direito Constitucional', slug: 'direito-constitucional', materia: false, parent_id: 2 },
        { id: 4, nome: 'Controle de constitucionalidade', slug: 'controle-de-constitucionalidade', materia: false, parent_id: 3 },
      ],
      carreiras: [{ id: 20, nome: 'Policial', slug: 'policial' }],
      anos: [2024],
      areas: [{ id: 21, nome: 'Segurança Pública', slug: 'seguranca-publica' }],
      usage: {
        all: { taxonomies: 6, questions: 12, exams: 3, laws: 1, total: 16 },
        byType: {
          orgao: { taxonomies: 1, questions: 12, exams: 3, laws: 1, total: 16 },
        },
        byFilterId: {
          '10': { questions: 12, exams: 3, laws: 1, total: 16 },
        },
      },
    });

    expect(taxonomies.agencies[0].name).toBe('FGV');
    expect(taxonomies.organizations[0]).toEqual(expect.objectContaining({
      name: 'Corpo de Bombeiros Militar da Paraiba',
      sigla: 'CBM-PB',
      assetUrl: '/uploads/admin-assets/taxonomy-logo/cbm-pb.webp',
      usage: { questions: 12, exams: 3, laws: 1, total: 16 },
    }));
    expect(taxonomies.subjects[0].name).toBe('Direito');
    expect(taxonomies.subjectTopics?.[0].name).toBe('Direito Constitucional');
    expect(taxonomies.subjectTopics?.[0].taxonomyLevel).toBe('topico');
    expect(taxonomies.specificSubjects?.[0].name).toBe('Controle de constitucionalidade');
    expect(taxonomies.specificSubjects?.[0].rootSubjectId).toBe('2');
    expect(taxonomies.careers).toEqual([
      expect.objectContaining({ id: '20', name: 'Policial', slug: 'policial', type: 'career' }),
    ]);
    expect(taxonomies.years).toEqual(['2024']);
    expect(taxonomies.areas).toEqual([
      expect.objectContaining({ id: '21', name: 'Segurança Pública', type: 'area' }),
    ]);
    expect(taxonomies.usage?.byType.orgao).toEqual({
      taxonomies: 1,
      questions: 12,
      exams: 3,
      laws: 1,
      total: 16,
    });
  });

  it('always exposes ENEM in the foco selector helper', () => {
    expect(injectEnemFocusOption(['Policial', 'Fiscal'])).toEqual([
      ENEM_FOCUS_NAME,
      'Policial',
      'Fiscal',
    ]);
  });

  it('canonicalizes ENEM focus labels without duplicating taxonomy values', () => {
    expect(injectEnemFocusOption(['Enem', 'Policial', 'enem'])).toEqual([
      ENEM_FOCUS_NAME,
      'Policial',
    ]);
    expect(normalizeCareerSelectorLabel('Enem')).toBe(ENEM_FOCUS_NAME);
  });

  it('normalizes focus labels to parent focus names', () => {
    expect(normalizeCareerSelectorLabel('Educação (Professores, Especialistas e outros)')).toBe(
      'Educação',
    );
    expect(normalizeCareerSelectorLabel('Educação / Professor')).toBe('Educação');
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
    } as Record<string, unknown>;

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

  it('loads the reduced practice catalog without materializing every taxonomy', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        bancas: [{ id: 1, nome: 'CESPE' }],
        assuntos: [{ id: 2, nome: 'Direito Penal', materia: true, taxonomy_level: 'materia' }],
      },
    });

    const taxonomies = await filtersService.listPracticeTaxonomies();

    expect(mockGet).toHaveBeenCalledWith('filtersList', {
      params: { scope: 'practice' },
    });
    expect(taxonomies.agencies[0]?.name).toBe('CESPE');
    expect(taxonomies.subjects[0]?.name).toBe('Direito Penal');
  });

  it('loads one administrative taxonomy page instead of the full public tree', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        rows: [{
          id: 12,
          type: 'orgao',
          name: 'Corpo de Bombeiros Militar da Paraiba',
          slug: 'cbm-pb',
          usage: { questions: 4, exams: 1, laws: 0, total: 5 },
        }],
        total: 153,
        page: 2,
        perPage: 50,
        pages: 4,
        usage: {
          all: { taxonomies: 153, questions: 4, exams: 1, laws: 0, total: 5 },
          byType: { orgao: { taxonomies: 1, questions: 4, exams: 1, laws: 0, total: 5 } },
        },
      },
    });

    const result = await filtersService.listAdminPage({ page: 2, perPage: 50, type: 'orgao', search: 'bombeiros' });

    expect(mockGet).toHaveBeenCalledWith('adminFiltersList', {
      params: { page: '2', per_page: '50', type: 'orgao', search: 'bombeiros' },
    });
    expect(result.total).toBe(153);
    expect(result.rows[0]).toEqual(expect.objectContaining({ id: 12, type: 'orgao' }));
  });

  it('loads the canonical administrative taxonomy before editing', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        id: 31,
        type: 'banca',
        name: 'Instituto Brasileiro de Formacao e Capacitacao',
        sigla: 'IBFC',
        slug: 'ibfc',
        usage: { questions: 10, exams: 2, laws: 0, total: 12 },
      },
    });

    const result = await filtersService.getAdminItem(31);

    expect(mockGet).toHaveBeenCalledWith('adminFiltersList', { params: { id: '31' } });
    expect(result).toEqual(expect.objectContaining({
      id: 31,
      name: 'Instituto Brasileiro de Formacao e Capacitacao',
      sigla: 'IBFC',
    }));
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

  it('reuses an existing year when the API reports a slug conflict', async () => {
    const conflictError = {
      response: {
        status: 409,
        data: { message: "O slug '2018' ja esta em uso por outra taxonomia." },
      },
    };
    mockPost.mockRejectedValueOnce(conflictError);
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        anos: [2018, 2023],
      },
    });

    const id = await filtersService.save({
      type: 'ano',
      name: '2018',
      slug: '2018',
    });

    expect(mockPost).toHaveBeenCalledWith('filtersSave', {
      type: 'ano',
      name: '2018',
      slug: '2018',
    });
    expect(mockGet).toHaveBeenCalledWith('filtersList');
    expect(id).toBe(2018);
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

  it('removes several filters with one bulk request', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: { deletedIds: [12, 14], deletedCount: 2 },
    });

    const result = await filtersService.removeMany([12, 14, 12]);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('filtersDelete', { ids: [12, 14] });
    expect(result).toEqual({ deletedIds: [12, 14], deletedCount: 2 });
  });
});
