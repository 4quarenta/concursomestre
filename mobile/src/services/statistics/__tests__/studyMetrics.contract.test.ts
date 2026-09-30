import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPost, storage } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  storage: new Map<string, string>(),
}));

vi.mock('@/services/api/client', () => ({
  apiClient: { get: vi.fn(), post: mockPost },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
  },
}));

import { statisticsService } from '@/services/statistics/statisticsService';
import { touchStudyStreak } from '@/services/statistics/studyStreakService';

describe('study metrics contracts', () => {
  beforeEach(() => {
    storage.clear();
    mockPost.mockReset();
  });

  it('records mobile study time through the existing production study-session contract', async () => {
    mockPost.mockResolvedValue({
      success: true,
      data: { statistics: { userId: 'u1', totalStudyTime: 120, questionStudyTime: 120 } },
    });

    const result = await statisticsService.recordStudySession({
      practiceSeconds: 61,
      startedAt: '2026-09-27T12:00:00.000Z',
      endedAt: '2026-09-27T12:01:01.000Z',
      sourceContext: { source: 'mobile_practice' },
    });

    expect(mockPost).toHaveBeenCalledWith('statistics/study-session.php', {
      practice_seconds: 61,
      simulation_seconds: 0,
      reading_seconds: 0,
      started_at: '2026-09-27T12:00:00.000Z',
      ended_at: '2026-09-27T12:01:01.000Z',
      source_context: { source: 'mobile_practice' },
    });
    expect(result).toMatchObject({ userId: 'u1', totalStudyTime: 120, questionStudyTime: 120 });
  });

  it('uses the web daily streak rule, isolated by user', async () => {
    const first = await touchStudyStreak('user-a', new Date(2026, 8, 27, 8));
    const sameDay = await touchStudyStreak('user-a', new Date(2026, 8, 27, 20));
    const nextDay = await touchStudyStreak('user-a', new Date(2026, 8, 28, 8));
    const otherUser = await touchStudyStreak('user-b', new Date(2026, 8, 28, 8));

    expect(first).toMatchObject({ current: 1, best: 1 });
    expect(sameDay).toEqual(first);
    expect(nextDay).toMatchObject({ current: 2, best: 2 });
    expect(otherUser).toMatchObject({ current: 1, best: 1 });
  });

  it('restarts current streak after a missed day and preserves best streak', async () => {
    await touchStudyStreak('user-a', new Date(2026, 8, 24));
    await touchStudyStreak('user-a', new Date(2026, 8, 25));

    const afterGap = await touchStudyStreak('user-a', new Date(2026, 8, 27));

    expect(afterGap).toMatchObject({ current: 1, best: 2 });
  });
});
