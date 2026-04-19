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
  assertApiSuccess: (response: any) => {
    if (response?.success === false) {
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
  ENDPOINTS: {
    questions: {
      list: 'questionsList',
      create: 'questionsCreate',
      update: 'questionsUpdate',
      delete: 'questionsDelete',
      submit: 'questionsAnswer',
      history: 'questionsHistory',
      stats: 'questionsStats',
      toggleSave: 'questionsToggleSave',
      resetAnswers: 'questionsResetAnswers',
    },
  },
}));

import { questionService } from '../index';

describe('questionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unwraps paginated question responses from the official list endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        rows: [
          { id: 1, enunciado: 'Questão 1' },
        ],
        total: 120,
      },
    });

    const result = await questionService.getQuestionPage({ page: 2, limit: 50 });

    expect(mockGet).toHaveBeenCalledWith('questionsList', {
      params: { page: 2, limit: 50 },
    });
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(120);
  });

  it('submits an answer with the backend payload expected by questionsAnswer', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Resposta salva',
      data: {
        new_xp: 250,
        new_level: 3,
      },
    });

    const result = await questionService.submitUserAnswer('user-1', {
      questionId: 9,
      selectedOptionIndex: 2,
      isCorrect: true,
      timestamp: Date.now(),
      timeTaken: 18,
    });

    expect(mockPost).toHaveBeenCalledWith('questionsAnswer', {
      user_id: 'user-1',
      question_id: 9,
      selected_option: 2,
      is_correct: true,
      time_taken: 18,
      simulation_id: null,
    });
    expect(result.success).toBe(true);
    expect(result.newXp).toBe(250);
    expect(result.newLevel).toBe(3);
  });

  it('loads question history through the official endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: [
        {
          questionId: 9,
          selectedOptionIndex: 2,
          isCorrect: true,
          timestamp: 1712100000000,
        },
      ],
    });

    const result = await questionService.getQuestionHistory(9, 'user-1');

    expect(mockGet).toHaveBeenCalledWith('questionsHistory', {
      params: {
        question_id: '9',
        user_id: 'user-1',
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0].questionId).toBe(9);
  });

  it('loads question stats through the official endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        totalAttempts: 30,
        correctCount: 18,
        wrongCount: 12,
        optionDistribution: { '0': 10, '1': 8, '2': 12 },
      },
    });

    const result = await questionService.getQuestionStats(9);

    expect(mockGet).toHaveBeenCalledWith('questionsStats', {
      params: {
        question_id: '9',
      },
    });
    expect(result.totalAttempts).toBe(30);
    expect(result.optionDistribution?.['2']).toBe(12);
  });

  it('updates a question through the official save endpoint with id', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: { id: 33 },
    });

    const payload = { id: 33, enunciado: 'Questão atualizada' } as any;
    const result = await questionService.updateQuestion('33', payload);

    expect(mockPost).toHaveBeenCalledWith('questionsUpdate', {
      ...payload,
      id: '33',
    });
    expect(result.success).toBe(true);
  });

  it('deletes a question through the backend contract that expects query params', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      message: 'Questão excluida',
    });

    const result = await questionService.deleteQuestion(44);

    expect(mockGet).toHaveBeenCalledWith('questionsDelete', {
      params: { id: '44' },
    });
    expect(result.success).toBe(true);
  });

  it('toggles a saved question through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      isSaved: true,
      message: 'Questão salva',
    });

    const result = await questionService.toggleSavedQuestion('user-2', 77);

    expect(mockPost).toHaveBeenCalledWith('questionsToggleSave', {
      user_id: 'user-2',
      question_id: 77,
    });
    expect(result.success).toBe(true);
    expect(result.isSaved).toBe(true);
  });

  it('resets user answers through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      message: 'Respostas limpas com sucesso.',
    });

    const result = await questionService.resetAnswers('user-3');

    expect(mockPost).toHaveBeenCalledWith('questionsResetAnswers', {
      user_id: 'user-3',
    });
    expect(result.success).toBe(true);
  });
});
