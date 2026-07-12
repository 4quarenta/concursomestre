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

const { mockGet, mockPost, mockClearRequestCoalescing } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockClearRequestCoalescing: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
  },
  assertApiSuccess: (response: MockApiResponse & { success?: boolean }) => {
    if (!response?.success) {
      throw new Error('erro');
    }
    return { raw: response };
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
      myAnswers: '/users/me/answers.php',
      notes: '/users/notes.php',
    },
  },
}));

vi.mock('@services/api/requestCoalescer', () => ({
  buildRequestCacheKey: (prefix: string) => prefix,
  withRequestCoalescing: <T,>(_key: string, loader: () => Promise<T>) => loader(),
  clearRequestCoalescing: mockClearRequestCoalescing,
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

  it('carrega respostas do usuario atual sem enviar user_id', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        items: [
          {
            questionId: 21,
            selectedOptionIndex: 0,
            isCorrect: false,
            created_at: '2026-06-08 12:00:00',
          },
        ],
      },
    });

    const answers = await userProgressService.getCurrentUserAnswers(25);

    expect(mockGet).toHaveBeenCalledWith('/users/me/answers.php', {
      params: { limit: 25, range: 'all' },
    });
    expect(answers).toHaveLength(1);
    expect(answers[0].questionId).toBe(21);
    expect(answers[0].isCorrect).toBe(false);
  });

  it('preserva o resumo server-side e o cursor na pagina do usuario autenticado', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        items: [{ questionId: 22, selectedOptionIndex: 1, isCorrect: true }],
        hasMore: true,
        nextCursor: 'cursor-assinado',
        summary: {
          totalAttempts: 1820,
          correct: 1400,
          wrong: 420,
          accuracy: 76.92,
          firstActivityAt: '2026-01-02 08:00:00',
          lastActivityAt: '2026-07-12 12:00:00',
        },
      },
    });

    const page = await userProgressService.getCurrentUserAnswersPage({
      limit: 20,
      range: 'month',
      cursor: 'cursor-anterior',
    });

    expect(mockGet).toHaveBeenCalledWith('/users/me/answers.php', {
      params: { limit: 20, range: 'month', cursor: 'cursor-anterior' },
    });
    expect(page.items).toHaveLength(1);
    expect(page.summary.totalAttempts).toBe(1820);
    expect(page.nextCursor).toBe('cursor-assinado');
    expect(page.hasMore).toBe(true);
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
  it('persists a question note and uses the authoritative response', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        deleted: false,
        note: {
          id: 'note-1',
          itemId: '99',
          type: 'question',
          text: 'Revisar conceito',
          updatedAt: '2026-07-11 12:30:00',
        },
      },
    });

    const note = await userProgressService.saveUserQuestionNote(99, 'Revisar conceito');

    expect(mockPost).toHaveBeenCalledWith('/users/notes.php', {
      questionId: 99,
      text: 'Revisar conceito',
    });
    expect(mockClearRequestCoalescing).toHaveBeenCalledWith('user-progress:question-notes');
    expect(note).toMatchObject({ id: 'note-1', questionId: 99, text: 'Revisar conceito' });
  });

  it('treats an empty note as an idempotent delete', async () => {
    mockPost.mockResolvedValueOnce({ success: true, data: { deleted: true, note: null } });

    await expect(userProgressService.saveUserQuestionNote(99, '')).resolves.toBeNull();
  });
});
