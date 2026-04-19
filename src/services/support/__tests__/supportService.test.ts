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
  ENDPOINTS: {
    feedback: {
      list: 'feedback/list.php',
      create: 'feedback/create.php',
    },
  },
  assertApiSuccess: (response: any) => {
    if (!response?.success) {
      throw new Error(response?.message || 'erro');
    }

    return {
      success: true,
      message: response?.message,
      data: response?.data,
      raw: response,
    };
  },
  readApiData: (response: any, fallback: any) => {
    if (response?.data !== undefined) {
      return response.data;
    }

    return response ?? fallback;
  },
}));

import { supportService } from '../index';

describe('supportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists feedback threads for the current user', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      feedback: [{ id: 1, type: 'bug' }],
    });

    const result = await supportService.listThreads();

    expect(mockGet).toHaveBeenCalledWith('feedback/list.php');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('loads replies for a thread', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      replies: [{ id: 7, details: 'Resposta' }],
    });

    const result = await supportService.listReplies(7);

    expect(mockGet).toHaveBeenCalledWith('feedback/list.php?id=7');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(7);
  });

  it('creates a support thread through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: { id: 9, type: 'support', parent_id: null },
    });

    const result = await supportService.createThread({
      type: 'support',
      reason: 'Ajuda',
      details: 'Preciso de ajuda',
    });

    expect(mockPost).toHaveBeenCalledWith('feedback/create.php', {
      type: 'support',
      reason: 'Ajuda',
      details: 'Preciso de ajuda',
    });
    expect(result).toEqual({ id: 9, type: 'support', parent_id: null });
  });

  it('replies to an existing support thread through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: { id: 22, type: 'bug', parent_id: 12 },
    });

    const result = await supportService.replyToThread(12, 'bug', 'Tenho mais contexto para esse caso.');

    expect(mockPost).toHaveBeenCalledWith('feedback/create.php', {
      parent_id: 12,
      type: 'bug',
      reason: 'Resposta do usuario',
      details: 'Tenho mais contexto para esse caso.',
    });
    expect(result).toEqual({ id: 22, type: 'bug', parent_id: 12 });
  });
});
