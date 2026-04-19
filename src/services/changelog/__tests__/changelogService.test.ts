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
    if (response?.data !== undefined) return response.data;
    return response ?? fallback;
  },
  ENDPOINTS: {
    changelog: {
      list: 'changelog/list.php',
    },
  },
}));

import { changelogService } from '../changelogService';

describe('changelogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads changelog versions through the official endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 1,
          version: '1.0.0',
          release_date: '2026-04-02',
          title: 'Primeira versao',
          description: 'Descrição',
          content_json: [],
        },
      ],
    });

    const versions = await changelogService.listVersions();

    expect(mockGet).toHaveBeenCalledWith('changelog/list.php');
    expect(versions).toHaveLength(1);
    expect(versions[0]?.version).toBe('1.0.0');
  });
});
