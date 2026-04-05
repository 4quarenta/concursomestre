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

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
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
  ENDPOINTS: {
    simulations: {
      create: 'simulationsCreate',
    },
  },
}));

import { simulationsService } from '../index';

describe('simulationsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persiste uma sessao de simulado pelo endpoint oficial', async () => {
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
      status: 'completed',
      score: 8,
    } as any;

    const result = await simulationsService.saveSimulation(session);

    expect(mockPost).toHaveBeenCalledWith('simulationsCreate', {
      ...session,
    });
    expect(result.success).toBe(true);
    expect(result.id).toBe('sim-123');
  });
});
