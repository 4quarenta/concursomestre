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

const { mockPost, mockGet } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
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
  readApiData: (response: any, fallback: any) => response?.data ?? response ?? fallback,
  ENDPOINTS: {
    simulations: {
      list: 'simulationsList',
      create: 'simulationsCreate',
    },
  },
}));

import { simulationsService } from '../index';

describe('simulationsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persiste uma sessão de simulado pelo endpoint oficial', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      id: 'sim-123',
      message: 'Simulation saved',
    });

    const session = {
      id: 'sim-123',
      config: { name: 'Simulado PF' },
      questions: [],
      answers: { '10': 2 },
      startTime: 1712010000000,
      endTime: 1712010300000,
      durationSeconds: 180,
      status: 'completed',
      score: 8,
    } as any;

    const result = await simulationsService.saveSimulation(session);

    expect(mockPost).toHaveBeenCalledWith('simulationsCreate', {
      ...session,
      duration_seconds: 180,
    });
    expect(result.success).toBe(true);
    expect(result.id).toBe('sim-123');
  });
  it('lista sessoes persistidas pelo endpoint oficial', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        simulations: [
          {
            id: 'sim-1',
            config: { name: 'Treino' },
            questionIds: ['10', '11'],
            answers: { '10': { index: 1, is_correct: 1 } },
            startTime: 1712010000000,
            endTime: 1712010300000,
            durationSeconds: 180,
            status: 'completed',
            score: 1,
          },
        ],
      },
    });

    const result = await simulationsService.listSimulations();

    expect(mockGet).toHaveBeenCalledWith('simulationsList');
    expect(result[0].id).toBe('sim-1');
    expect(result[0].questionIds).toEqual([10, 11]);
    expect(result[0].durationSeconds).toBe(180);
  });
});
