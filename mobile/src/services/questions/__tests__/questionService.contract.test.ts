import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/services/api/client', () => ({
  apiClient: mocks,
}));

import { questionService } from '@/services/questions/questionService';

describe('question service production pagination contract', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();
  });

  it('serializes the web-compatible filters and keeps the requested page size', async () => {
    mocks.get.mockResolvedValue({
      success: true,
      data: {
        rows: [{ id: 101 }],
        total: 1000,
        page: 2,
        perPage: 100,
        pages: 10,
      },
    });

    const result = await questionService.getQuestionPage({
      page: 2,
      limit: 100,
      subject: ['Direito Constitucional', 'Direito Penal'],
      topic: ['Controle'],
      agency: ['CESPE'],
      role: ['Analista'],
      year: [2024, 2025],
      hasTeacherComment: true,
      hasDetailedComment: true,
      excludeAnswered: true,
      examMode: true,
    });

    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledWith('questions/list.php', {
      params: {
        page: 2,
        limit: 100,
        subject: 'Direito Constitucional,Direito Penal',
        topic: 'Controle',
        agency: 'CESPE',
        role: 'Analista',
        year: '2024,2025',
        hasTeacherComment: true,
        hasDetailedComment: true,
        excludeAnswered: true,
        exam_mode: true,
      },
    });
    expect(result).toEqual({
      rows: [{ id: 101 }],
      total: 1000,
      page: 2,
      perPage: 100,
      pages: 10,
    });
  });

  it('performs one bounded request instead of downloading the full result set', async () => {
    mocks.get.mockResolvedValue({
      success: true,
      data: {
        rows: Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })),
        total: 1000,
        page: 1,
        perPage: 100,
        pages: 10,
      },
    });

    const result = await questionService.getQuestionPage({ page: 1, limit: 100 });

    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(result.rows).toHaveLength(100);
    expect(result.total).toBe(1000);
    expect(result.pages).toBe(10);
  });

  it('keeps the compatibility alias bounded at 50 items', async () => {
    mocks.get.mockResolvedValue({
      success: true,
      data: { rows: [], total: 0, page: 1, perPage: 50, pages: 0 },
    });

    await questionService.getAllQuestions(200);

    expect(mocks.get).toHaveBeenCalledWith('questions/list.php', {
      params: { page: 1, limit: 50 },
    });
  });

  it('resolves answer history from the authenticated session instead of a client user id', async () => {
    mocks.get.mockResolvedValue({
      success: true,
      data: [],
    });

    await questionService.getQuestionHistory(101);

    expect(mocks.get).toHaveBeenCalledWith('questionsHistory', {
      params: { question_id: '101' },
    });
  });

  it('toggles saved questions through the bearer token without sending a client user id', async () => {
    mocks.post.mockResolvedValue({
      success: true,
      data: { isSaved: true },
    });

    await questionService.toggleSavedQuestion('legacy-client-user', 101);

    expect(mocks.post).toHaveBeenCalledWith('questionsToggleSave', {
      question_id: 101,
    });
  });
});
