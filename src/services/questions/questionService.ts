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

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData, readApiErrorMessage } from '@services/api';
import { buildRequestCacheKey, withRequestCoalescing } from '@services/api/requestCoalescer';
import type { ExamFileAttachment, ExamFileKind, Question, QuestionStats, UserAnswer } from 'types';
import { isQuestionPubliclyVisible, withQuestionPublicationAliases } from './questionPublication';

type QuestionListResult = {
  rows: Question[];
  total: number;
};

type SubmitAnswerResult = {
  success: boolean;
  message?: string;
  newXp?: number;
  newLevel?: number;
};

type QuestionCreateResponse = {
  question?: Question;
  id?: string | number;
};

type ImportedQuestionBatchPayload = {
  exam: Record<string, unknown>;
  focus: Record<string, unknown>;
  contexts: Array<Record<string, unknown>>;
  questions: Question[];
  requireExistingExam?: boolean;
  require_existing_exam?: boolean;
};

type ImportedExamPayload = {
  exam: Record<string, unknown>;
  focus: Record<string, unknown>;
};

type ImportedQuestionBatchResponse = {
  exam?: Record<string, unknown>;
  prova?: Record<string, unknown>;
  count?: number;
  created?: Question[];
  duplicatesSkipped?: Array<Record<string, unknown>>;
  duplicates_skipped?: Array<Record<string, unknown>>;
  skippedDuplicateCount?: number;
  skipped_duplicate_count?: number;
  newTaxonomies?: Array<Record<string, unknown>>;
};

type ToggleSavedQuestionResponse = {
  isSaved?: boolean;
  is_saved?: boolean;
  message?: string;
  xpGain?: number;
  xp_gain?: number;
  newXp?: number;
  new_xp?: number;
  newLevel?: number;
  new_level?: number;
};

type ToggleSavedQuestionResult = {
  success: boolean;
  isSaved?: boolean;
  message?: string;
  xpGain?: number;
  newXp?: number;
  newLevel?: number;
};

export type QuestionEditorialFeedbackKind = 'teacher' | 'detailed';
export type QuestionEditorialFeedbackValue = 'like' | 'dislike';

export type QuestionEditorialFeedbackSnapshot = {
  feedback: Record<QuestionEditorialFeedbackKind, QuestionEditorialFeedbackValue | null>;
  counts: Record<QuestionEditorialFeedbackKind, {
    likes: number;
    dislikes: number;
  }>;
};

type QuestionFilters = Record<string, string | number | boolean | undefined | null>;

type QuestionPageResponse = {
  rows?: Question[];
  total?: number;
};

type SubmitAnswerApiResponse = {
  new_xp?: number;
  new_level?: number;
};

const getUserAnswerUserId = (answer: UserAnswer): string | null => {
  if (!('userId' in answer)) {
    return null;
  }

  const userId = answer.userId;
  return typeof userId === 'string' && userId.trim() ? userId : null;
};

const toRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' ? value as Record<string, unknown> : null
);

const EMPTY_EDITORIAL_FEEDBACK_SNAPSHOT: QuestionEditorialFeedbackSnapshot = {
  feedback: {
    teacher: null,
    detailed: null,
  },
  counts: {
    teacher: {
      likes: 0,
      dislikes: 0,
    },
    detailed: {
      likes: 0,
      dislikes: 0,
    },
  },
};

const normalizeEditorialFeedbackValue = (value: unknown): QuestionEditorialFeedbackValue | null => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'like' || normalized === 'dislike' ? normalized : null;
};

const readEditorialFeedbackCounts = (value: unknown) => {
  const record = toRecord(value) || {};
  return {
    likes: Number(record.likes || 0) || 0,
    dislikes: Number(record.dislikes || 0) || 0,
  };
};

const normalizeEditorialFeedbackSnapshot = (value: unknown): QuestionEditorialFeedbackSnapshot => {
  const record = toRecord(value) || {};
  const feedbackRecord = toRecord(record.feedback) || {};
  const countsRecord = toRecord(record.counts) || {};

  return {
    feedback: {
      teacher: normalizeEditorialFeedbackValue(feedbackRecord.teacher),
      detailed: normalizeEditorialFeedbackValue(feedbackRecord.detailed),
    },
    counts: {
      teacher: readEditorialFeedbackCounts(countsRecord.teacher),
      detailed: readEditorialFeedbackCounts(countsRecord.detailed),
    },
  };
};

const readImportedExamRecord = (payload: unknown): Record<string, unknown> | undefined => {
  const record = toRecord(payload);
  if (!record) {
    return undefined;
  }

  const directExam = [
    record.exam,
    record.prova,
    record.importedExam,
    record.imported_exam,
    record.createdExam,
    record.created_exam,
    record.publishedExam,
    record.published_exam,
  ]
    .map(toRecord)
    .find(Boolean);
  if (directExam) {
    return directExam;
  }

  const nestedContainers = [
    record.data,
    record.result,
    record.payload,
    record.item,
    record.record,
    record.row,
  ];
  for (const nestedContainer of nestedContainers) {
    const nestedRecord = toRecord(nestedContainer);
    if (nestedRecord && nestedRecord !== record) {
      const nestedExam = readImportedExamRecord(nestedRecord);
      if (nestedExam) {
        return nestedExam;
      }
    }
  }

  const hasExamShape = [
    'id',
    'exam_id',
    'prova_id',
    'publishedExamId',
    'published_exam_id',
    'nome',
    'name',
    'title',
    'examTitle',
    'exam_title',
    'ano',
    'year',
    'caderno',
    'tipoCaderno',
    'bookletType',
    'corCaderno',
    'bookletColor',
  ]
    .some((key) => record[key] !== undefined && record[key] !== null && String(record[key]).trim() !== '');

  return hasExamShape ? record : undefined;
};

const withImportedQuestionAliases = (question: Question): Question => {
  const normalizedQuestion = withQuestionPublicationAliases(question);
  const record = normalizedQuestion as Question & Record<string, unknown>;
  const sourceQuestionNumber = record.questionNumber
    ?? record.question_number
    ?? record.number
    ?? record.sourceQuestionNumber
    ?? record.source_question_number;

  if (sourceQuestionNumber === undefined || sourceQuestionNumber === null || String(sourceQuestionNumber).trim() === '') {
    return normalizedQuestion;
  }

  return {
    ...normalizedQuestion,
    questionNumber: sourceQuestionNumber,
    question_number: sourceQuestionNumber,
    number: sourceQuestionNumber,
    sourceQuestionNumber: sourceQuestionNumber,
    source_question_number: sourceQuestionNumber,
  } as Question;
};

const readExamFileAttachment = (value: unknown, fallbackKind: ExamFileKind): ExamFileAttachment => {
  const record = toRecord(value) || {};
  return {
    kind: String(record.kind || fallbackKind) as ExamFileKind,
    label: String(record.label || ''),
    name: String(record.name || record.fileName || record.file_name || ''),
    url: String(record.url || record.fileUrl || record.file_url || ''),
    mimeType: String(record.mimeType || record.mime_type || ''),
    size: Number(record.size || 0) || undefined,
    uploadedAt: String(record.uploadedAt || record.uploaded_at || ''),
  };
};

/**
 * Fachada oficial do dominio de questoes.
 * Ela conecta pratica, historico, estatisticas e manutencao administrativa ao backend oficial.
 * @since v1.0.0
 */
export const questionService = {
  /**
   * Carrega uma pagina de questoes com total.
   * @since v1.0.0
   */
  async getQuestionPage(filters?: QuestionFilters): Promise<QuestionListResult> {
    const includeUnpublished = Boolean(filters?.includeUnpublished || filters?.includeDrafts || filters?.admin);
    const params = includeUnpublished
      ? filters
      : {
        ...filters,
        publication_scope: 'public',
        publish_status: 'published',
      };

    return withRequestCoalescing(buildRequestCacheKey('questions:list', params), async () => {
      const response = await apiClient.get<QuestionPageResponse | Question[]>(
        ENDPOINTS.questions.list,
        {
          params,
        },
      );

      const payload = readApiData<QuestionPageResponse | Question[]>(response, {});
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.rows)
          ? payload.rows
          : [];
      const normalizedRows = rows.map((row) => withQuestionPublicationAliases(row));
      const visibleRows = includeUnpublished
        ? normalizedRows
        : normalizedRows.filter((row) => isQuestionPubliclyVisible(row));
      const total = Array.isArray(payload) ? visibleRows.length : Number(payload.total || visibleRows.length);

      return {
        rows: visibleRows,
        total,
      };
    }, 2500);
  },

  /**
   * Mantem a compatibilidade com consumidores antigos que esperam apenas a lista.
   * @since v1.0.0
   */
  async getQuestions(filters?: QuestionFilters): Promise<Question[]> {
    const result = await this.getQuestionPage(filters);
    return result.rows;
  },

  /**
   * Carrega uma questao publica isolada.
   * @since v1.0.0
   */
  async getQuestionById(questionId: string | number): Promise<Question> {
    const response = await apiClient.get<Question>(
      ENDPOINTS.questions.show,
      {
        params: {
          id: String(questionId),
        },
      },
    );

    return withQuestionPublicationAliases(readApiData<Question>(response, {} as Question));
  },

  /**
   * Carrega uma questao pelo contrato administrativo de edicao.
   * @since v1.0.0
   */
  async getQuestionForAdminEdit(questionId: string | number): Promise<Question> {
    const normalizedQuestionId = String(questionId);
    return withRequestCoalescing(
      buildRequestCacheKey('questions:admin-edit', { id: normalizedQuestionId }),
      async () => {
        const response = await apiClient.get<Question>(
          ENDPOINTS.questions.edit,
          {
            params: {
              id: normalizedQuestionId,
            },
            timeout: 15000,
          },
        );

        return withQuestionPublicationAliases(readApiData<Question>(response, {} as Question));
      },
      15_000,
    );
  },

  /**
   * Persiste a resposta do usuario e devolve o snapshot de progressao.
   * @since v1.0.0
   */
  async submitUserAnswer(userId: string, answer: UserAnswer): Promise<SubmitAnswerResult> {
    const response = await apiClient.post<SubmitAnswerApiResponse>(
      ENDPOINTS.questions.submit,
      {
        user_id: userId,
        question_id: answer.questionId,
        selected_option: answer.selectedOptionIndex,
        is_correct: answer.isCorrect,
        time_taken: answer.timeTaken || 0,
        simulation_id: (() => {
          const rawSimulationId = answer.simulationId;
          if (typeof rawSimulationId === 'number') return rawSimulationId;
          if (typeof rawSimulationId === 'string' && /^\d+$/.test(rawSimulationId.trim())) {
            return Number(rawSimulationId.trim());
          }
          return null;
        })(),
      },
    );
    const backendErrorMessage = readApiErrorMessage(response, '');
    if (
      typeof backendErrorMessage === 'string'
      && backendErrorMessage.toLowerCase().includes('nenhum campo editavel foi enviado')
    ) {
      return {
        success: true,
        message: 'Resposta ja registrada.',
      };
    }

    const envelope = assertApiSuccess(response, 'Nao foi possivel salvar a resposta.');
    const payload = readApiData<SubmitAnswerApiResponse>(response, {});
    return {
      success: true,
      message: envelope.message,
      newXp: payload.new_xp ?? (typeof envelope.raw.new_xp === 'number' ? envelope.raw.new_xp : undefined),
      newLevel: payload.new_level ?? (typeof envelope.raw.new_level === 'number' ? envelope.raw.new_level : undefined),
    };
  },

  /**
   * Carrega o historico de respostas do usuario para uma questao especifica.
   * @since v1.0.0
   */
  async getQuestionHistory(questionId: string | number, userId?: string): Promise<UserAnswer[]> {
    const response = await apiClient.get<UserAnswer[]>(
      ENDPOINTS.questions.history,
      {
        params: {
          question_id: String(questionId),
          user_id: userId || '',
        },
      },
    );

    const payload = readApiData<UserAnswer[]>(response, []);
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload.map((item) => {
      const legacyItem = item as UserAnswer & {
        selected_option_index?: number | string | null;
        is_correct?: boolean | number | null;
      };
      const selectedOptionIndex = Number(
        item.selectedOptionIndex
        ?? legacyItem.selected_option_index
        ?? 0,
      );
      const rawTimestamp = Number(item.timestamp || 0);

      return {
        ...item,
        selectedOptionIndex: Number.isFinite(selectedOptionIndex) ? selectedOptionIndex : 0,
        isCorrect: Boolean(item.isCorrect ?? legacyItem.is_correct),
        timestamp: rawTimestamp > 0 && rawTimestamp < 10_000_000_000 ? rawTimestamp * 1000 : rawTimestamp,
      };
    });
  },

  /**
   * Carrega as estatisticas agregadas de uma questao.
   * @since v1.0.0
   */
  async getQuestionStats(questionId: string | number): Promise<QuestionStats> {
    const response = await apiClient.get<QuestionStats>(
      ENDPOINTS.questions.stats,
      {
        params: {
          question_id: String(questionId),
        },
      },
    );

    return readApiData<QuestionStats>(response, {
      totalAttempts: 0,
      correctCount: 0,
      wrongCount: 0,
      optionDistribution: {},
    });
  },

  /**
   * Carrega likes/dislikes editoriais do comentario do professor e da analise detalhada.
   * @since v1.0.0
   */
  async getEditorialFeedback(questionId: string | number): Promise<QuestionEditorialFeedbackSnapshot> {
    try {
      const response = await apiClient.get<QuestionEditorialFeedbackSnapshot>(
        ENDPOINTS.questions.editorialFeedback,
        {
          params: {
            question_id: String(questionId),
          },
        },
      );

      return normalizeEditorialFeedbackSnapshot(readApiData<QuestionEditorialFeedbackSnapshot>(response, EMPTY_EDITORIAL_FEEDBACK_SNAPSHOT));
    } catch {
      return EMPTY_EDITORIAL_FEEDBACK_SNAPSHOT;
    }
  },

  /**
   * Persiste o like/dislike editorial do usuario autenticado.
   * @since v1.0.0
   */
  async setEditorialFeedback(
    questionId: string | number,
    contentType: QuestionEditorialFeedbackKind,
    value: QuestionEditorialFeedbackValue | null,
  ): Promise<QuestionEditorialFeedbackSnapshot> {
    const response = await apiClient.post<QuestionEditorialFeedbackSnapshot>(
      ENDPOINTS.questions.editorialFeedback,
      {
        question_id: String(questionId),
        content_type: contentType,
        value,
      },
    );

    assertApiSuccess(response, 'Nao foi possivel registrar sua avaliacao.');
    return normalizeEditorialFeedbackSnapshot(readApiData<QuestionEditorialFeedbackSnapshot>(response, EMPTY_EDITORIAL_FEEDBACK_SNAPSHOT));
  },

  /**
   * Bridge legado para usos antigos do servico.
   * @since v1.0.0
   */
  async submitAnswer(answer: UserAnswer): Promise<{ success: boolean; message?: string }> {
    try {
      const userId = getUserAnswerUserId(answer);
      if (!userId) {
        return { success: false, message: 'User ID obrigatorio para salvar resposta.' };
      }

      const result = await this.submitUserAnswer(userId, answer);
      return { success: result.success, message: result.message };
    } catch (error: unknown) {
      return { success: false, message: readApiErrorMessage(error, 'Nao foi possivel salvar a resposta.') };
    }
  },

  /**
   * Cria uma unica questao usando o endpoint oficial de persistencia.
   * @since v1.0.0
   */
  async createQuestion(questionData: Question): Promise<{ success: boolean; question?: Question }> {
    try {
      const normalizedQuestion = withQuestionPublicationAliases(questionData);
      const response = await apiClient.post<QuestionCreateResponse>(
        ENDPOINTS.questions.create,
        normalizedQuestion,
      );

      const envelope = assertApiSuccess<QuestionCreateResponse>(response, 'Nao foi possivel criar a questao.');
      const payload = readApiData<QuestionCreateResponse>(response, {});
      const resolvedId = Number(payload.id ?? envelope.raw.id ?? normalizedQuestion.id) || Number(normalizedQuestion.id);

      return {
        success: true,
        question: payload.question
          ? withQuestionPublicationAliases(payload.question)
          : { ...normalizedQuestion, id: resolvedId },
      };
    } catch {
      return { success: false };
    }
  },

  /**
   * Cria varias questoes preservando o contrato antigo usado pelo app.
   * @since v1.0.0
   */
  async createQuestions(questions: Question[]): Promise<{ success: boolean; count?: number; created?: Question[] }> {
    try {
      let successCount = 0;
      const created: Question[] = [];

      for (const question of questions) {
        const result = await this.createQuestion(question);
        if (result.success && result.question) {
          successCount += 1;
          created.push(result.question);
        }
      }

      return { success: true, count: successCount, created };
    } catch {
      return { success: false };
    }
  },

  /**
   * Envia edital, gabarito ou prova para armazenamento persistente.
   * @since v1.0.0
   */
  async uploadExamFile(file: File, kind: ExamFileKind): Promise<ExamFileAttachment> {
    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('file', file, file.name);

    const response = await apiClient.post<{ file?: ExamFileAttachment }>(
      ENDPOINTS.questions.examFiles,
      formData,
      { timeout: 120000 },
    );
    const envelope = assertApiSuccess<{ file?: ExamFileAttachment }>(response, 'Nao foi possivel enviar o arquivo da prova.');
    const data = readApiData<{ file?: ExamFileAttachment } | ExamFileAttachment>(response, {});
    const uploaded = toRecord(data) && 'file' in (data as Record<string, unknown>)
      ? (data as { file?: ExamFileAttachment }).file
      : data || envelope.raw.file;
    const attachment = readExamFileAttachment(uploaded, kind);

    if (!attachment.url) {
      throw new Error('O backend nao retornou a URL do arquivo.');
    }

    return attachment;
  },

  /**
   * Persiste uma importacao oficial de PDF com prova, contextos e questoes vinculadas.
   * @since v1.0.0
   */
  async createImportedExam(
    payload: ImportedExamPayload,
  ): Promise<{ success: boolean; message?: string; exam?: Record<string, unknown> }> {
    try {
      const response = await apiClient.post<{ exam?: Record<string, unknown> }>(
        ENDPOINTS.questions.examImport,
        payload,
        { timeout: 30000 },
      );

      const envelope = assertApiSuccess<{ exam?: Record<string, unknown> }>(response, 'Nao foi possivel salvar a prova.');
      const data = readApiData<{ exam?: Record<string, unknown>; prova?: Record<string, unknown> } | Record<string, unknown>>(response, {});
      const exam = readImportedExamRecord(data) || readImportedExamRecord(envelope.raw);

      return {
        success: true,
        message: envelope.message,
        exam,
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: readApiErrorMessage(error, 'Nao foi possivel salvar a prova.'),
      };
    }
  },

  /**
   * Persiste uma importacao oficial de PDF com prova, contextos e questoes vinculadas.
   * @since v1.0.0
   */
  async createImportedQuestionBatch(
    payload: ImportedQuestionBatchPayload,
    proofPdf?: File | null,
  ): Promise<{
    success: boolean;
    message?: string;
    count?: number;
    created?: Question[];
    exam?: Record<string, unknown>;
    duplicatesSkipped?: Array<Record<string, unknown>>;
    skippedDuplicateCount?: number;
    newTaxonomies?: Array<Record<string, unknown>>;
  }> {
    try {
      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));
      if (proofPdf) {
        formData.append('proof_pdf', proofPdf, proofPdf.name);
      }

      const response = await apiClient.post<ImportedQuestionBatchResponse>(
        ENDPOINTS.questions.bulkImport,
        formData,
        { timeout: 300000 },
      );

      const envelope = assertApiSuccess<ImportedQuestionBatchResponse>(response, 'Nao foi possivel importar a prova.');
      const raw = envelope.raw as ImportedQuestionBatchResponse;
      const data = readApiData<ImportedQuestionBatchResponse>(response, {} as ImportedQuestionBatchResponse);
      const created = Array.isArray(data.created)
        ? data.created.map((question) => withImportedQuestionAliases(question))
        : [];

      return {
        success: true,
        count: Number(data.count ?? raw.count ?? created.length),
        created,
        exam: readImportedExamRecord(data) || readImportedExamRecord(raw),
        duplicatesSkipped: data.duplicatesSkipped ?? data.duplicates_skipped ?? raw.duplicatesSkipped ?? raw.duplicates_skipped ?? [],
        skippedDuplicateCount: Number(data.skippedDuplicateCount ?? data.skipped_duplicate_count ?? raw.skippedDuplicateCount ?? raw.skipped_duplicate_count ?? 0),
        newTaxonomies: data.newTaxonomies ?? raw.newTaxonomies,
      };
    } catch (error: unknown) {
      const message = error instanceof Error && error.message === 'Network Error'
        ? 'O servidor interrompeu a importacao antes de responder. Verifique o limite de upload/tempo do PHP ou reduza imagens muito grandes no lote.'
        : readApiErrorMessage(error, 'Nao foi possivel importar a prova.');

      return {
        success: false,
        message,
        count: 0,
        created: [],
        duplicatesSkipped: [],
        skippedDuplicateCount: 0,
        newTaxonomies: [],
        exam: undefined,
      };
    }
  },

  /**
   * Atualiza uma questao usando o endpoint oficial de update.
   * @since v1.0.0
   */
  async updateQuestion(id: string, questionData: Question): Promise<{ success: boolean; question?: Question }> {
    try {
      const normalizedQuestion = withQuestionPublicationAliases(questionData);
      const response = await apiClient.post<Question>(
        ENDPOINTS.questions.update,
        { ...normalizedQuestion, id },
      );

      assertApiSuccess(response, 'Nao foi possivel atualizar a questao.');
      return {
        success: true,
        question: { ...normalizedQuestion, id: Number(id) || Number(normalizedQuestion.id) } as Question,
      };
    } catch {
      return { success: false };
    }
  },

  /**
   * Exclui uma questao usando o contrato real do backend.
   * @since v1.0.0
   */
  async deleteQuestion(id: string | number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.get(
        ENDPOINTS.questions.delete,
        { params: { id: String(id) } },
      );

      const envelope = assertApiSuccess(response, 'Nao foi possivel excluir a questao.');
      return {
        success: true,
        message: envelope.message,
      };
    } catch (error: unknown) {
      return { success: false, message: readApiErrorMessage(error, 'Nao foi possivel excluir a questao.') };
    }
  },

  /**
   * Alterna o estado salvo de uma questao para o usuario atual.
   * @since v1.0.0
   */
  async toggleSavedQuestion(userId: string, questionId: string | number): Promise<ToggleSavedQuestionResult> {
    try {
      const response = await apiClient.post<ToggleSavedQuestionResponse>(
        ENDPOINTS.questions.toggleSave,
        {
          user_id: userId,
          question_id: questionId,
        },
      );

      const envelope = assertApiSuccess<ToggleSavedQuestionResponse>(response, 'Nao foi possivel atualizar os salvos.');
      const payload = readApiData<ToggleSavedQuestionResponse>(response, {});
      const raw = toRecord(envelope.raw) || {};
      const resolvedSaved = payload.isSaved ?? payload.is_saved ?? raw.isSaved ?? raw.is_saved;
      const xpGain = Number(payload.xpGain ?? payload.xp_gain ?? raw.xpGain ?? raw.xp_gain);
      const newXp = Number(payload.newXp ?? payload.new_xp ?? raw.newXp ?? raw.new_xp);
      const newLevel = Number(payload.newLevel ?? payload.new_level ?? raw.newLevel ?? raw.new_level);

      return {
        success: true,
        isSaved: typeof resolvedSaved === 'boolean' ? resolvedSaved : undefined,
        message: payload.message || envelope.message,
        xpGain: Number.isFinite(xpGain) ? xpGain : undefined,
        newXp: Number.isFinite(newXp) ? newXp : undefined,
        newLevel: Number.isFinite(newLevel) ? newLevel : undefined,
      };
    } catch (error: unknown) {
      return { success: false, message: readApiErrorMessage(error, 'Nao foi possivel atualizar os salvos.') };
    }
  },

  /**
   * Limpa o progresso de respostas do usuario atual.
   * @since v1.0.0
   */
  async resetAnswers(userId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.post(
        ENDPOINTS.questions.resetAnswers,
        { user_id: userId },
      );

      const envelope = assertApiSuccess(response, 'Nao foi possivel limpar as respostas.');

      return {
        success: true,
        message: envelope.message,
      };
    } catch (error: unknown) {
      return { success: false, message: readApiErrorMessage(error, 'Nao foi possivel limpar as respostas.') };
    }
  },
};

export default questionService;
