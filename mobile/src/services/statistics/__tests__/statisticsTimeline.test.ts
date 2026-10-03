import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.hoisted(() => vi.fn());

vi.mock('@/services/api/client', () => ({ apiClient: { get: mockGet } }));

import { statisticsService } from '@/services/statistics/statisticsService';

describe('statistics activity timeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 27, 12, 0, 0));
    mockGet.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it('aggregates actual answers by local day and follows the API cursor', async () => {
    mockGet
      .mockResolvedValueOnce({
        success: true,
        data: {
          items: [
            { timestamp: new Date(2026, 8, 27, 10).getTime(), isCorrect: true },
            { timestamp: new Date(2026, 8, 27, 11).getTime(), isCorrect: false },
          ],
          hasMore: true,
          nextCursor: 'next-page',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          answers: [{ timestamp: new Date(2026, 8, 25, 9).getTime(), is_correct: 1 }],
          hasMore: false,
          nextCursor: null,
        },
      });

    const timeline = await statisticsService.getCurrentUserQuestionTimeline('semanal');
    const today = timeline[6];
    const twoDaysAgo = timeline[4];

    expect(timeline).toHaveLength(7);
    expect(today).toMatchObject({ questions: 2, correct: 1, wrong: 1 });
    expect(twoDaysAgo).toMatchObject({ questions: 1, correct: 1, wrong: 0 });
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet).toHaveBeenNthCalledWith(1, 'users/me/answers.php', {
      params: { limit: 50, range: 'week' },
    });
    expect(mockGet).toHaveBeenNthCalledWith(2, 'users/me/answers.php', {
      params: { limit: 50, range: 'week', cursor: 'next-page' },
    });
  });

  it('aggregates today into three-hour blocks using the bounded day range', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: {
        items: [
          { timestamp: new Date(2026, 8, 27, 1, 20).getTime(), isCorrect: true, subjectName: 'Direito Constitucional' },
          { timestamp: new Date(2026, 8, 27, 3, 10).getTime(), isCorrect: false, subjectName: 'Direito Constitucional' },
          { timestamp: new Date(2026, 8, 27, 10, 45).getTime(), isCorrect: true, subjectName: 'Português' },
        ],
        hasMore: false,
      },
    });

    const timeline = await statisticsService.getCurrentUserQuestionTimeline('dia');

    expect(timeline).toHaveLength(8);
    expect(timeline[0]).toMatchObject({ label: '00h', questions: 1, correct: 1, wrong: 0 });
    expect(timeline[1]).toMatchObject({ label: '03h', questions: 1, correct: 0, wrong: 1 });
    expect(timeline[3]).toMatchObject({ label: '09h', questions: 1, correct: 1, wrong: 0 });
    expect(timeline[0].subjectBreakdown).toEqual([
      { subject: 'Direito Constitucional', totalQuestions: 1, correctAnswers: 1, wrongAnswers: 0, accuracyRate: 100 },
    ]);
    expect(mockGet).toHaveBeenCalledWith('users/me/answers.php', {
      params: { limit: 50, range: 'today' },
    });
  });

  it('rejects a repeated cursor instead of looping indefinitely', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { items: [], hasMore: true, nextCursor: 'same-cursor' },
    });

    await expect(statisticsService.getCurrentUserQuestionTimeline('mensal'))
      .rejects.toThrow('pagina repetida');
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('uses the canonical answer summary and derives subject accuracy from real answers', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: {
        summary: { totalAttempts: 42, correct: 30, wrong: 12, accuracy: 71.43 },
        items: [
          { subjectName: 'Direito Penal', isCorrect: true },
          { subjectName: 'Direito Penal', isCorrect: false },
          { subjectName: 'Português', isCorrect: true },
        ],
      },
    });

    const snapshot = await statisticsService.getCurrentUserAnswerSnapshot();

    expect(mockGet).toHaveBeenCalledWith('users/me/answers.php', {
      params: { limit: 50, range: 'all' },
    });
    expect(snapshot.summary).toEqual({
      totalQuestionsAnswered: 42,
      correctAnswers: 30,
      wrongAnswers: 12,
      accuracyRate: 71.43,
    });
    expect(snapshot.subjectBreakdown).toEqual([
      { subject: 'Direito Penal', totalQuestions: 2, correctAnswers: 1, wrongAnswers: 1, accuracyRate: 50 },
      { subject: 'Português', totalQuestions: 1, correctAnswers: 1, wrongAnswers: 0, accuracyRate: 100 },
    ]);
  });
});
