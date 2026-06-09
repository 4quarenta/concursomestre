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
  ENDPOINTS: {
    feedback: {
      list: 'feedback/list.php',
      create: 'feedback/create.php',
      vote: 'feedback/vote.php',
    },
  },
  assertApiSuccess: (response: MockApiResponse) => {
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
  readApiData: (response: MockApiResponse, fallback: unknown) => {
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
      gamification_event: 'support_feedback_submitted',
      notification_event: 'support_opened',
    });
    expect(result).toEqual({ id: 9, type: 'support', parent_id: null });
  });

  it('lists and votes public suggestions through the official endpoints', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        suggestions: [
          { id: 31, type: 'suggestion', reason: 'Filtro novo', likes: 4, dislikes: 1, score: 3 },
        ],
      },
    });

    const suggestions = await supportService.listPublicSuggestions();

    expect(mockGet).toHaveBeenCalledWith('feedback/list.php?public_suggestions=1');
    expect(suggestions[0].id).toBe(31);

    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        suggestion: { id: 31, likes: 5, dislikes: 1, score: 4, user_vote: 'like' },
      },
    });

    const voted = await supportService.votePublicSuggestion(31, 'like');

    expect(mockPost).toHaveBeenCalledWith('feedback/vote.php', {
      feedback_id: 31,
      value: 'like',
      gamification_event: 'public_suggestion_vote',
      notification_event: 'suggestion_vote',
    });
    expect(voted?.user_vote).toBe('like');
    expect(voted?.likes).toBe(5);
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
      gamification_event: 'support_thread_reply',
      notification_event: 'support_reply',
    });
    expect(result).toEqual({ id: 22, type: 'bug', parent_id: 12 });
  });
});
