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
  error?: string;
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
  assertApiSuccess: (response: MockApiResponse) => {
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
  readApiData: (response: MockApiResponse, fallback: unknown) => {
    if (response?.data !== undefined) {
      return response.data;
    }

    return response ?? fallback;
  },
  readApiErrorMessage: (response: MockApiResponse, fallback = '') => {
    if (typeof response?.error === 'string') {
      return response.error;
    }

    if (typeof response?.message === 'string' && response?.success === false) {
      return response.message;
    }

    return fallback;
  },
  ENDPOINTS: {
    questions: {
      list: 'questionsList',
      v2List: 'v2/questions/list.php',
      v2Show: 'v2/questions/show.php',
      v2Answer: 'v2/questions/answer.php',
      v2AdminShow: 'v2/admin/questions/show.php',
      show: 'questionsShow',
      create: 'questionsCreate',
      examImport: 'questionsExamImport',
      bulkImport: 'questionsBulkImport',
      multiBatchImport: 'questionsMultiBatchImport',
      update: 'questionsUpdate',
      delete: 'questionsDelete',
      submit: 'questionsAnswer',
      history: 'questionsHistory',
      stats: 'questionsStats',
      toggleSave: 'questionsToggleSave',
      resetAnswers: 'questionsResetAnswers',
      editorialFeedback: 'questions/editorial-feedback.php',
    },
  },
}));

vi.mock('@services/api/requestCoalescer', () => ({
  buildRequestCacheKey: (prefix: string) => prefix,
  withRequestCoalescing: <T,>(_key: string, loader: () => Promise<T>) => loader(),
}));

import { questionService } from '../index';

type QuestionUpdatePayload = Parameters<typeof questionService.updateQuestion>[1];

describe('questionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unwraps paginated question responses from the public v2 list endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        items: [
          {
            id: 1,
            statementPreview: 'Questao 1',
            type: 'single_choice',
            difficulty: 'Medio',
            publication: { status: 'published', visibility: 'public' },
            userState: {
              answered: true,
              isSaved: true,
              selectedOptionId: 81,
              selectedOptionIndex: 2,
            },
          },
        ],
        pageInfo: { limit: 50, total: 137, hasMore: true, nextCursor: 'cursor-2' },
      },
    });

    const result = await questionService.getQuestionPage({ page: 2, limit: 50 });

    expect(mockGet).toHaveBeenCalledWith('v2/questions/list.php', {
      params: {
        page: 2,
        limit: 50,
        publication_scope: 'public',
        publish_status: 'published',
      },
    });
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(137);
    expect(result.pageInfo).toEqual({ limit: 50, total: 137, hasMore: true, nextCursor: 'cursor-2' });
    expect(result.rows[0].resposta).toBe(-1);
    expect(result.rows[0].isSaved).toBe(true);
    expect(result.rows[0].userAnswer).toEqual({
      selectedOptionId: 81,
      selectedOptionIndex: 2,
    });
  });

  it('maps the public v2 practice batch without exposing the answer key', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        items: [
          {
            id: 8,
            content: {
              statement: '<p>Enunciado completo</p>',
              statementClean: 'Enunciado completo',
              supportText: 'Texto de apoio',
              reference: '',
            },
            contexts: [{
              id: 12,
              type: 'shared',
              body: 'Texto compartilhado',
              reference: 'Fonte oficial',
              assets: [{ tempId: 'ctx_img', type: 'image', usage: 'context', url: '/context.png' }],
              questionNumbers: [8, 9],
            }],
            assets: [{ tempId: 'statement_img', type: 'image', usage: 'statement', url: '/statement.png' }],
            filters: {
              subjects: [{ id: 4, label: 'Português', slug: 'portugues' }],
              topics: [{ id: 5, label: 'Interpretação', slug: 'interpretacao' }],
              examBoards: [{ id: 6, label: 'IBFC', slug: 'ibfc' }],
              organizations: [{ id: 7, label: 'PM-PB', slug: 'pm-pb' }],
              roles: [{ id: 8, label: 'Soldado', slug: 'soldado' }],
              years: [{ id: 9, label: '2018', slug: '2018' }],
            },
            type: 'single_choice',
            difficulty: 'medium',
            alternatives: [
              {
                id: 'alt_a',
                tempId: 'alt_a',
                order: 1,
                label: 'A',
                text: 'Alternativa A [image:alt_img]',
                assets: [{ tempId: 'alt_img', type: 'image', usage: 'alternative', url: '/alt.png' }],
              },
              { id: 'alt_b', tempId: 'alt_b', order: 2, label: 'B', text: 'Alternativa B' },
            ],
            examSummary: [{ id: 44, name: 'IBFC - 2018 - PM-PB - Soldado', year: 2018 }],
            engagement: { commentsCount: 3 },
            editorial: [
              { type: 'teacher_comment', title: '', body: 'Comentario editorial', status: 'published' },
              { type: 'detailed_analysis', title: '', body: 'Analise editorial', status: 'published' },
            ],
            publication: { status: 'published', visibility: 'public' },
            stats: { totalAttempts: 2, correctCount: 1, wrongCount: 1 },
            userState: { answered: false, isSaved: true },
          },
        ],
        pageInfo: { limit: 20, total: 1, hasMore: false, nextCursor: null },
      },
    });

    const result = await questionService.getQuestionPage({ content_scope: 'practice' });

    expect(result.rows[0]).toEqual(expect.objectContaining({
      id: 8,
      enunciado: '<p>Enunciado completo</p>',
      introText: 'Texto de apoio',
      isSaved: true,
      resposta: -1,
      commentsCount: 3,
      provaId: 44,
    }));
    expect(result.rows[0].itens).toHaveLength(2);
    expect(result.rows[0].itens[0].assets).toHaveLength(1);
    expect(result.rows[0].contexts).toEqual([
      expect.objectContaining({ id: 12, body: 'Texto compartilhado', questionNumbers: [8, 9] }),
    ]);
    expect(result.rows[0].assuntos?.map((item) => item.nome)).toEqual(['Português', 'Interpretação']);
    expect(result.rows[0].bancas?.[0]).toEqual(expect.objectContaining({ nome: 'IBFC', sigla: 'IBFC' }));
    expect(result.rows[0].orgaos?.[0]).toEqual(expect.objectContaining({ nome: 'PM-PB', sigla: 'PM-PB' }));
    expect(result.rows[0].cargos?.[0]).toEqual(expect.objectContaining({ nome: 'Soldado', descricao: 'Soldado' }));
    expect(result.rows[0].anos).toEqual([2018]);
    expect(result.rows[0].provas?.[0]).toEqual(expect.objectContaining({ id: 44, nome: 'IBFC - 2018 - PM-PB - Soldado' }));
    expect(result.rows[0].teacherComment).toBe('Comentario editorial');
    expect(result.rows[0].detailedComment).toBe('Analise editorial');
    expect(result.rows[0].hasTeacherComment).toBe(true);
    expect(result.rows[0].hasDetailedComment).toBe(true);
    expect(result.rows[0].comments).toBeNull();
    expect(result.rows[0]).not.toHaveProperty('answer');
  });

  it('submits an answer with the v2 alternative identifier contract', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Resposta salva',
      data: {
        new_xp: 250,
        new_level: 3,
        answer: {
          selectedOptionIndex: 2,
          correctOptionIndex: 1,
          isCorrect: false,
        },
      },
    });

    const result = await questionService.submitUserAnswer({
      questionId: 9,
      selectedOptionIndex: 2,
      timestamp: Date.now(),
      timeTaken: 18,
    });

    expect(mockPost).toHaveBeenCalledWith('v2/questions/answer.php', {
      questionId: 9,
      selectedAlternativeId: 'C',
      idempotencyKey: expect.any(String),
      timeTaken: 18,
      simulationId: null,
    });
    expect(result.success).toBe(true);
    expect(result.newXp).toBe(250);
    expect(result.newLevel).toBe(3);
    expect(result.answer).toEqual({
      selectedOptionIndex: 2,
      correctOptionIndex: 1,
      isCorrect: false,
    });
  });

  it('preserves the card alternative id and idempotency key across a retry', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        answer: {
          selectedOptionIndex: 1,
          correctOptionIndex: 0,
          isCorrect: false,
        },
      },
    });

    await questionService.submitUserAnswer({
      questionId: 8,
      selectedOptionIndex: 1,
      selectedAlternativeId: 'legacy_q8_alt_b',
      idempotencyKey: 'answer-retry-q8-0001',
      timestamp: Date.now(),
      timeTaken: 7,
    });

    expect(mockPost).toHaveBeenCalledWith('v2/questions/answer.php', {
      questionId: 8,
      selectedAlternativeId: 'legacy_q8_alt_b',
      idempotencyKey: 'answer-retry-q8-0001',
      timeTaken: 7,
      simulationId: null,
    });
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

  it('loads and persists editorial feedback for teacher comments and detailed analysis', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        feedback: {
          teacher: 'like',
          detailed: null,
        },
        counts: {
          teacher: { likes: 3, dislikes: 1 },
          detailed: { likes: 0, dislikes: 0 },
        },
      },
    });

    const loaded = await questionService.getEditorialFeedback(9);

    expect(mockGet).toHaveBeenCalledWith('questions/editorial-feedback.php', {
      params: {
        question_id: '9',
      },
    });
    expect(loaded.feedback.teacher).toBe('like');
    expect(loaded.counts.teacher.likes).toBe(3);

    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        feedback: {
          teacher: 'dislike',
          detailed: null,
        },
        counts: {
          teacher: { likes: 2, dislikes: 2 },
          detailed: { likes: 0, dislikes: 0 },
        },
      },
    });

    const saved = await questionService.setEditorialFeedback(9, 'teacher', 'dislike');

    expect(mockPost).toHaveBeenCalledWith('questions/editorial-feedback.php', {
      question_id: '9',
      content_type: 'teacher',
      value: 'dislike',
    });
    expect(saved.feedback.teacher).toBe('dislike');
    expect(saved.counts.teacher.dislikes).toBe(2);
  });

  it('updates a question through the official save endpoint with id', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: { id: 33 },
    });

    const payload = { id: 33, enunciado: 'Questão atualizada' } as QuestionUpdatePayload;
    const result = await questionService.updateQuestion('33', payload);

    expect(mockPost).toHaveBeenCalledWith(
      'questionsUpdate',
      expect.objectContaining({
        id: '33',
        content: expect.objectContaining({
          statement: 'Questão atualizada',
        }),
        publication: expect.objectContaining({
          status: 'published',
          visibility: 'public',
        }),
      }),
    );
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
      xpGain: 3,
      new_xp: 1203,
      new_level: 2,
      message: 'Questão salva',
    });

    const result = await questionService.toggleSavedQuestion('user-2', 77);

    expect(mockPost).toHaveBeenCalledWith('questionsToggleSave', {
      user_id: 'user-2',
      question_id: 77,
    });
    expect(result.success).toBe(true);
    expect(result.isSaved).toBe(true);
    expect(result.xpGain).toBe(3);
    expect(result.newXp).toBe(1203);
    expect(result.newLevel).toBe(2);
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

  it('publishes an imported exam and unwraps the backend exam record', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Prova publicada.',
      data: {
        success: true,
        exam: {
          id: 501,
          nome: 'ENEM - INEP (2025)',
          ano: 2025,
          caderno: 'Tipo C - Azul',
          tipoCaderno: 'Tipo C',
          corCaderno: 'Azul',
        },
      },
    });

    const result = await questionService.createImportedExam({
      focus: { name: 'ENEM', slug: 'enem' },
      exam: {
        title: 'ENEM - INEP (2025)',
        year: 2025,
        caderno: 'Tipo C - Azul',
        tipoCaderno: 'Tipo C',
        corCaderno: 'Azul',
      },
    });

    expect(mockPost).toHaveBeenCalledWith(
      'questionsExamImport',
      expect.objectContaining({
        exam: expect.objectContaining({
          caderno: 'Tipo C - Azul',
          tipoCaderno: 'Tipo C',
          corCaderno: 'Azul',
        }),
      }),
      { timeout: 30000 },
    );
    expect(result.success).toBe(true);
    expect(result.exam).toEqual(expect.objectContaining({
      id: 501,
      caderno: 'Tipo C - Azul',
      tipoCaderno: 'Tipo C',
      corCaderno: 'Azul',
    }));
  });

  it('unwraps imported exam aliases returned by bulk import', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        count: 0,
        published_exam: {
          prova_id: 777,
          title: 'Analista - TJSP (2026)',
          year: 2026,
          bookletType: 'Tipo B',
          bookletColor: 'Amarelo',
        },
      },
    });

    const result = await questionService.createImportedQuestionBatch({
      focus: { name: 'Tribunais', slug: 'tribunais' },
      exam: {
        publishedExamId: 777,
        title: 'Analista - TJSP (2026)',
        bookletType: 'Tipo B',
        bookletColor: 'Amarelo',
      },
      contexts: [],
      questions: [],
      requireExistingExam: true,
    });

    expect(mockPost).toHaveBeenCalledWith(
      'questionsBulkImport',
      expect.any(FormData),
      { timeout: 300000 },
    );
    expect(result.exam).toEqual(expect.objectContaining({
      prova_id: 777,
      bookletType: 'Tipo B',
      bookletColor: 'Amarelo',
    }));
  });

  it('publishes imported questions and their exam even when the review card is a draft', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: { count: 1, created: [] },
    });

    await questionService.createImportedQuestionBatch({
      focus: { name: 'Policial', slug: 'policial' },
      exam: {
        title: 'IBFC - 2018 - PM-PB - Soldado',
        publishStatus: 'draft',
        visibilityStatus: 'internal',
      },
      contexts: [],
      questions: [{
        tempId: 'q_1',
        source: { origin: 'exam', examId: null, questionNumber: 1, contextTempId: null, sourcePage: null },
        content: { statement: 'Assinale a alternativa correta.', statementClean: 'Assinale a alternativa correta.', supportText: '', reference: '' },
        assets: [],
        filters: { subjects: [], topics: [], subtopics: [], examBoards: [], organizations: [], roles: [], careers: [], years: [], levels: [], examTypes: [] },
        type: 'single_choice',
        difficulty: 'medium',
        alternatives: [{ tempId: 'alt_a', order: 1, label: 'A', text: 'Alternativa A.', textClean: 'Alternativa A.', assets: [] }],
        answer: { mode: 'single', raw: 'A', correctAlternativeTempIds: ['alt_a'] },
        editorial: [],
        publication: { status: 'draft', visibility: 'private', scheduledAt: null },
        review: { required: true, status: 'pending', reasons: ['coleta_externa_requer_revisao'] },
      }],
    });

    const formData = mockPost.mock.calls[0][1] as FormData;
    const sentPayload = JSON.parse(String(formData.get('payload')));

    expect(sentPayload.exam).toEqual(expect.objectContaining({
      publishStatus: 'published',
      statusEditorial: 'published',
      visibilityStatus: 'public',
    }));
    expect(sentPayload.questions[0].publication).toEqual(expect.objectContaining({
      status: 'published',
      visibility: 'public',
      scheduledAt: null,
    }));
    expect(sentPayload.questions[0].review).toEqual(expect.objectContaining({
      required: true,
      status: 'pending',
    }));
  });

  it('normalizes imported question numbers and published exam id aliases from bulk import', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        count: 1,
        exam: {
          published_exam_id: 888,
          nome: 'IBFC - 2018 - PM-PB - Soldado',
          ano: 2018,
        },
        created: [
          {
            id: 1234,
            enunciado: 'Questao criada',
            tipo: 'multipla_escolha',
            dificuldade: 1,
            itens: [],
            resposta: 1,
            bancas: [],
            orgaos: [],
            cargos: [],
            assuntos: [],
            anos: [2018],
            source_question_number: '64',
          },
        ],
      },
    });

    const result = await questionService.createImportedQuestionBatch({
      focus: { name: 'Policial', slug: 'policial' },
      exam: {
        publishedExamId: 888,
        title: 'IBFC - 2018 - PM-PB - Soldado',
      },
      contexts: [],
      questions: [],
      requireExistingExam: true,
    });

    expect(result.exam).toEqual(expect.objectContaining({
      published_exam_id: 888,
    }));
    expect(result.created?.[0]).toEqual(expect.objectContaining({
      questionNumber: '64',
      question_number: '64',
      number: '64',
      sourceQuestionNumber: '64',
      source_question_number: '64',
    }));
  });

  it('publishes independent exam batches through one administrative request', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Publicacao em lote concluida.',
      data: {
        count: 2,
        skippedDuplicateCount: 1,
        itemFailures: [],
        batches: [
          { clientKey: 'gran:501', count: 1, created: [{ source_question_number: '12' }] },
          { clientKey: 'gran:601', count: 1, created: [{ source_question_number: '4' }] },
        ],
      },
    });

    const result = await questionService.createImportedQuestionMultiBatch([
      { clientKey: 'gran:501', payload: { exam: { externalId: '501' }, focus: { name: 'Policial' }, contexts: [], questions: [] } },
      { clientKey: 'gran:601', payload: { exam: { externalId: '601' }, focus: { name: 'Bombeiro' }, contexts: [], questions: [] } },
    ]);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      'questionsMultiBatchImport',
      expect.objectContaining({ schemaVersion: 'question-import.v2', batches: expect.any(Array) }),
      { timeout: 300000 },
    );
    const sentPayload = mockPost.mock.calls[0][1] as { batches: Array<{ payload: { exam: Record<string, unknown> } }> };
    expect(sentPayload.batches[0].payload.exam).toEqual(expect.objectContaining({
      publishStatus: 'published',
      statusEditorial: 'published',
      visibilityStatus: 'public',
    }));
    expect(result).toEqual(expect.objectContaining({ success: true, count: 2, skippedDuplicateCount: 1 }));
    expect(result.batches).toHaveLength(2);
  });
});
