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
} | null | undefined;

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
  },
  readApiData: (response: MockApiResponse, fallback: unknown) => {
    if (response?.data !== undefined) {
      return response.data;
    }

    return response ?? fallback;
  },
  ENDPOINTS: {
    users: {
      answers: '/users/answers.php',
      notes: '/users/notes.php',
    },
  },
}));

import { userProgressService } from '../index';

describe('userProgressService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carrega respostas do usuário pelo endpoint oficial de answers', async () => {
    const timestampInSeconds = 1712000000;
    mockGet.mockResolvedValueOnce({
      success: true,
      data: [
        {
          question_id: '12',
          selected_option_index: '1',
          is_correct: '1',
          timestamp: timestampInSeconds,
        },
      ],
    });

    const answers = await userProgressService.getUserAnswers('user-1');

    expect(mockGet).toHaveBeenCalledWith('/users/answers.php', {
      params: { user_id: 'user-1' },
    });
    expect(answers).toHaveLength(1);
    expect(answers[0].questionId).toBe(12);
    expect(answers[0].selectedOptionIndex).toBe(1);
    expect(answers[0].isCorrect).toBe(true);
    expect(answers[0].timestamp).toBe(timestampInSeconds * 1000);
  });

  it('aceita payload de respostas encapsulado e preserva a materia da questao', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        answers: [
          {
            questionId: 20,
            selectedOptionIndex: 2,
            isCorrect: true,
            created_at: '2026-06-08 12:00:00',
            subjectName: 'Direito Penal',
            assuntos: [
              {
                id: 5,
                nome: 'Direito Penal',
                materia: true,
              },
            ],
          },
        ],
      },
    });

    const answers = await userProgressService.getUserAnswers('user-1');

    expect(answers).toHaveLength(1);
    expect(answers[0].subjectName).toBe('Direito Penal');
    expect(answers[0].assuntos?.[0]?.nome).toBe('Direito Penal');
  });

  it('normaliza apenas notas de questões no endpoint oficial de notes', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      notes: [
        {
          id: 1,
          itemId: 99,
          type: 'question',
          text: 'Revisar pegadinha da banca',
          updatedAt: '2026-04-02 10:00:00',
        },
        {
          id: 2,
          itemId: 13,
          type: 'material',
          text: 'Nota de material',
          updatedAt: '2026-04-02 10:05:00',
        },
      ],
    });

    const notes = await userProgressService.getUserQuestionNotes('user-2');

    expect(mockGet).toHaveBeenCalledWith('/users/notes.php', {
      params: { userId: 'user-2' },
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      id: '1',
      questionId: 99,
      text: 'Revisar pegadinha da banca',
    });
    expect(typeof notes[0].timestamp).toBe('number');
  });
});
