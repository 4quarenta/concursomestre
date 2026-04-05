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

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
  },
  readApiData: (response: any, fallback: any) => {
    if (response?.data !== undefined) {
      return response.data;
    }

    return response ?? fallback;
  },
  ENDPOINTS: {
    statistics: {
      xray: 'statistics/xray.php',
      bancaInfo: 'statistics/banca_info.php',
    },
  },
}));

import { bankAnalysisService } from '../index';

describe('bankAnalysisService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads bank intel through the official statistics endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        emAndamento: [{ text: 'Concurso A', url: 'https://a.local' }],
        realizados: [{ text: 'Concurso B', url: 'https://b.local' }],
      },
    });

    const result = await bankAnalysisService.getBankIntel('https://banca.local');

    expect(mockGet).toHaveBeenCalledWith('statistics/banca_info.php', {
      params: { url: 'https://banca.local' },
    });
    expect(result.emAndamento).toHaveLength(1);
    expect(result.realizados).toHaveLength(1);
  });

  it('loads xray stats with the selected filters', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        total: 42,
        subjectData: [],
      },
    });

    const result = await bankAnalysisService.getXrayStats({
      banca: 'CESPE',
      cargo: 'Analista',
      ano: '2025',
    });

    expect(mockGet).toHaveBeenCalledWith('statistics/xray.php', {
      params: {
        banca: 'CESPE',
        cargo: 'Analista',
        ano: '2025',
      },
    });
    expect(result.total).toBe(42);
  });
});
