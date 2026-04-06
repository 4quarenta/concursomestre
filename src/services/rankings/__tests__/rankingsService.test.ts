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
    rankings: {
      list: 'rankingsList',
      create: 'rankingsCreate',
      join: 'rankingsJoin',
      update: 'rankingsUpdate',
      moderate: 'rankingsModerate',
      delete: 'rankingsDelete',
    },
  },
}));

import { rankingsService } from '../rankingsService';

describe('rankingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads rankings from the official endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: [
        { id: 'r-1', name: 'Ranking Teste' },
      ],
    });

    const rankings = await rankingsService.list();

    expect(mockGet).toHaveBeenCalledWith('rankingsList');
    expect(rankings[0].id).toBe('r-1');
  });

  it('returns empty list when the backend responds with success but no rankings payload', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
    });

    const rankings = await rankingsService.list();

    expect(rankings).toEqual([]);
  });

  it('accepts legacy envelopes with rankings nested inside data.rankings', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        rankings: [
          { id: 'r-legacy', name: 'Ranking Legado' },
        ],
      },
    });

    const rankings = await rankingsService.list();

    expect(rankings).toHaveLength(1);
    expect(rankings[0].id).toBe('r-legacy');
  });

  it('creates rankings through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: { id: 'r-2' },
    });

    const id = await rankingsService.create({
      id: 'r-local',
      name: 'Novo Ranking',
      institution: 'Instituição',
      totalQuestions: 60,
      vacanciesAc: 1,
      vacanciesAfro: 0,
      vacanciesPcd: 0,
      reserveLimit: 10,
      correctKey: '',
      keyStatus: 'pending',
      examTypes: [],
      hasDiscursive: false,
      entries: [],
      createdAt: 0,
    });

    expect(mockPost).toHaveBeenCalledWith('rankingsCreate', expect.objectContaining({
      name: 'Novo Ranking',
      institution: 'Instituição',
    }));
    expect(id).toBe('r-2');
  });

  it('submits ranking entries through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: { id: 'e-1' },
    });

    const id = await rankingsService.join('r-1', 'u-1', {
      id: 'e-local',
      userName: 'Candidato',
      registrationNumber: '123',
      examType: 'Geral',
      category: 'AC',
      userAnswers: 'ABCDE',
      score: 50,
      timestamp: Date.now(),
      status: 'active',
    });

    expect(mockPost).toHaveBeenCalledWith('rankingsJoin', expect.objectContaining({
      rankingId: 'r-1',
      userId: 'u-1',
    }));
    expect(id).toBe('e-1');
  });
});
