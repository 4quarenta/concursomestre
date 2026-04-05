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
    if (response?.data !== undefined) {
      return response.data;
    }

    return response ?? fallback;
  },
  assertApiSuccess: (response: any, fallbackMessage: string) => {
    if (!response?.success) {
      throw new Error(response?.message || fallbackMessage);
    }

    return {
      success: true,
      message: response?.message,
      data: response?.data,
      raw: response,
    };
  },
  ENDPOINTS: {
    reports: {
      create: 'reportsCreate',
      list: 'reportsList',
    },
  },
}));

import { reportsService } from '../reportsService';

describe('reportsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates reports through the official reports endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Denuncia registrada com sucesso.',
      data: {
        id: 'rep-10',
        duplicate: false,
      },
    });

    const result = await reportsService.createReport({
      reporterId: 'user-1',
      targetType: 'material',
      targetId: 'mat-1',
      reason: 'Plagio',
      details: 'Conteudo duplicado.',
      evidenceUrl: 'https://cdn.example.com/prova.png',
    });

    expect(mockPost).toHaveBeenCalledWith('reportsCreate', {
      reporter_id: 'user-1',
      target_type: 'material',
      target_id: 'mat-1',
      reason: 'Plagio',
      details: 'Conteudo duplicado.',
      evidence_url: 'https://cdn.example.com/prova.png',
    });
    expect(result).toEqual({
      id: 'rep-10',
      duplicate: false,
      message: 'Denuncia registrada com sucesso.',
    });
  });

  it('loads reports from the official admin endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'rep-11',
          targetType: 'comment',
          commentId: 'com-9',
          status: 'pending',
        },
      ],
    });

    const reports = await reportsService.listReports();

    expect(mockGet).toHaveBeenCalledWith('reportsList');
    expect(reports).toHaveLength(1);
    expect(reports[0].id).toBe('rep-11');
  });
});
