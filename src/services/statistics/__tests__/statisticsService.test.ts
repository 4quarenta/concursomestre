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
  readApiData: (response: { data?: unknown } | undefined, fallback: unknown) => (
    response?.data !== undefined ? response.data : (response ?? fallback)
  ),
  ENDPOINTS: {
    statistics: {
      user: 'statistics/user.php',
      question: 'statistics/question.php',
      platform: 'statistics/platform.php',
      studySession: 'statistics/study-session.php',
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
        questionStudyTime: 120,
        readingStudyTime: 45,
        totalStudyTime: 165,
        lastActivity: '2026-04-09 12:00:00',
        subjectBreakdown: [],
      },
    });

    const result = await statisticsService.getUserStatistics('user-1');

    expect(mockGet).toHaveBeenCalledWith('statistics/user.php', {
      params: { user_id: 'user-1' },
    });
    expect(result.userId).toBe('user-1');
    expect(result.totalQuestionsAnswered).toBe(10);
    expect(result.questionStudyTime).toBe(120);
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

    expect(mockGet).toHaveBeenCalledWith('statistics/question.php', {
      params: { question_id: 7 },
    });
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

    expect(mockGet).toHaveBeenCalledWith('statistics/platform.php');
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

    expect(mockPost).toHaveBeenCalledWith('statistics/user.php', {
      questionId: 7,
      isCorrect: true,
      timeSpent: 12,
      user_id: 'user-1',
      action: 'update',
    });
    expect(result.success).toBe(true);
  });

  it('records a study session through the official statistics endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        sessionId: 'study-1',
        totalStudyTime: 210,
        questionStudyTime: 180,
        readingStudyTime: 30,
        statistics: {
          userId: 'user-1',
          questionStudyTime: 180,
          readingStudyTime: 30,
          totalStudyTime: 210,
          totalQuestionsAnswered: 10,
          correctAnswers: 8,
          wrongAnswers: 2,
          accuracyRate: 80,
          currentStreak: 3,
          bestStreak: 5,
          lastActivity: '2026-04-09 15:00:00',
          subjectBreakdown: [],
        },
      },
    });

    const result = await statisticsService.recordStudySession({
      practiceSeconds: 120,
      simulationSeconds: 60,
      readingSeconds: 30,
      startedAt: '2026-04-09T14:30:00.000Z',
      endedAt: '2026-04-09T15:00:00.000Z',
      sourceContext: {
        pathname: '/practice',
      },
    });

    expect(mockPost).toHaveBeenCalledWith('statistics/study-session.php', {
      practice_seconds: 120,
      simulation_seconds: 60,
      reading_seconds: 30,
      started_at: '2026-04-09T14:30:00.000Z',
      ended_at: '2026-04-09T15:00:00.000Z',
      source_context: {
        pathname: '/practice',
      },
    });
    expect(result.sessionId).toBe('study-1');
    expect(result.statistics.totalStudyTime).toBe(210);
  });
});
