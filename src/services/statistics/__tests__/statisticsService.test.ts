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
    statistics: {
      user: 'statistics/user',
      question: 'statistics/question',
      platform: 'statistics/platform',
    },
  },
}));

import { statisticsService } from '../statisticsService';

describe('statisticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads user statistics through the official endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        userId: 'user-1',
        totalQuestionsAnswered: 10,
      },
    });

    const result = await statisticsService.getUserStatistics('user-1');

    expect(mockGet).toHaveBeenCalledWith('statistics/user/user-1');
    expect(result.userId).toBe('user-1');
    expect(result.totalQuestionsAnswered).toBe(10);
  });

  it('loads question statistics through the official endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        questionId: 7,
        totalAttempts: 20,
      },
    });

    const result = await statisticsService.getQuestionStatistics(7);

    expect(mockGet).toHaveBeenCalledWith('statistics/question/7');
    expect(result.questionId).toBe(7);
    expect(result.totalAttempts).toBe(20);
  });

  it('loads platform statistics through the official endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        totalUsers: 100,
        activeUsers: 40,
      },
    });

    const result = await statisticsService.getPlatformStatistics();

    expect(mockGet).toHaveBeenCalledWith('statistics/platform');
    expect(result.totalUsers).toBe(100);
    expect(result.activeUsers).toBe(40);
  });

  it('posts user statistics updates to the legacy-compatible path', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
    });

    const result = await statisticsService.updateUserStatistics('user-1', {
      questionId: 7,
      isCorrect: true,
      timeSpent: 12,
    });

    expect(mockPost).toHaveBeenCalledWith('statistics/user/user-1/update', {
      questionId: 7,
      isCorrect: true,
      timeSpent: 12,
    });
    expect(result.success).toBe(true);
  });
});
