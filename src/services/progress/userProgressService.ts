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

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';
import { buildRequestCacheKey, clearRequestCoalescing, withRequestCoalescing } from '@services/api/requestCoalescer';
import type { UserAnswer, UserNote } from '@types';

type QuestionNoteRecord = {
  id?: number | string;
  itemId?: number | string;
  text?: string;
  type?: string;
  updatedAt?: string;
};

type QuestionNotesResponse = {
  notes?: QuestionNoteRecord[];
};

type QuestionNoteMutationResponse = {
  deleted?: boolean;
  note?: QuestionNoteRecord | null;
};

const SECONDS_TIMESTAMP_LIMIT = 10_000_000_000;

const normalizeEpochTimestamp = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value < SECONDS_TIMESTAMP_LIMIT ? value * 1000 : value;
};

const parseTimestampCandidate = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number') {
    return normalizeEpochTimestamp(value);
  }

  if (value instanceof Date) {
    return normalizeEpochTimestamp(value.getTime());
  }

  if (typeof value !== 'string') {
    return 0;
  }

  const trimmedValue = value.trim();
  if (trimmedValue === '') {
    return 0;
  }

  const numericValue = Number(trimmedValue);
  if (Number.isFinite(numericValue)) {
    return normalizeEpochTimestamp(numericValue);
  }

  const normalizedDateValue = /^\d{4}-\d{2}-\d{2}\s+\d{2}:/.test(trimmedValue)
    ? trimmedValue.replace(' ', 'T')
    : trimmedValue;
  const parsedTimestamp = Date.parse(normalizedDateValue);

  return Number.isFinite(parsedTimestamp) ? parsedTimestamp : 0;
};

const parseBooleanCandidate = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value !== 'string') {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  return ['1', 'true', 'sim', 'yes', 'correct', 'correto', 'certo'].includes(normalizedValue);
};

const normalizeQuestionNoteRecord = (note: QuestionNoteRecord): UserNote | null => {
  const questionId = Number(note.itemId);
  if (!Number.isFinite(questionId) || questionId <= 0) {
    return null;
  }

  return {
    id: String(note.id || ''),
    questionId,
    text: typeof note.text === 'string' ? note.text : '',
    timestamp: typeof note.updatedAt === 'string' ? parseTimestampCandidate(note.updatedAt) || Date.now() : Date.now(),
  };
};

const normalizeUserAnswerRecord = (answer: unknown): UserAnswer | null => {
  if (!answer || typeof answer !== 'object') {
    return null;
  }

  const record = answer as Record<string, unknown>;
  const questionId = Number(record.questionId ?? record.question_id ?? record.itemId ?? record.item_id);
  if (!Number.isFinite(questionId) || questionId <= 0) {
    return null;
  }

  const timestamp = [
    record.timestamp,
    record.submittedAt,
    record.submitted_at,
    record.answeredAt,
    record.answered_at,
    record.answerDate,
    record.answer_date,
    record.answeredDate,
    record.answered_date,
    record.dataResposta,
    record.data_resposta,
    record.respondidoEm,
    record.respondido_em,
    record.completedAt,
    record.completed_at,
    record.finishedAt,
    record.finished_at,
    record.createdAt,
    record.created_at,
    record.updatedAt,
    record.updated_at,
    record.date,
    record.data,
  ]
    .map(parseTimestampCandidate)
    .find((candidate) => candidate > 0) || 0;
  const selectedOptionIndex = Number(
    record.selectedOptionIndex
    ?? record.selected_option_index
    ?? record.answerIndex
    ?? record.answer_index
    ?? record.selectedIndex
    ?? record.selected_index
    ?? -1,
  );
  const timeTaken = Number(record.timeTaken ?? record.time_taken ?? record.time_spent ?? 0);

  return {
    ...(record as Partial<UserAnswer>),
    questionId,
    selectedOptionIndex: Number.isFinite(selectedOptionIndex) ? selectedOptionIndex : -1,
    isCorrect: parseBooleanCandidate(record.isCorrect ?? record.is_correct ?? record.correct ?? record.acertou),
    timestamp,
    simulationId: typeof record.simulationId === 'string'
      ? record.simulationId
      : typeof record.simulation_id === 'string'
        ? record.simulation_id
        : undefined,
    timeTaken: Number.isFinite(timeTaken) && timeTaken > 0 ? timeTaken : undefined,
  } as UserAnswer;
};

const extractUserAnswerRecords = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.answers,
    record.userAnswers,
    record.user_answers,
    record.rows,
    record.items,
  ];

  return candidates.find(Array.isArray) as unknown[] | undefined || [];
};

/**
 * Reune o progresso persistido do usuário em uma fachada unica e previsivel.
 */
export const userProgressService = {
  /**
   * Carrega as respostas já persistidas do usuário, aceitando tanto o contrato
   * padrao do `Response::success` quanto arrays crus por compatibilidade.
   */
  async getUserAnswers(userId: string): Promise<UserAnswer[]> {
    return withRequestCoalescing(buildRequestCacheKey('user-progress:answers', { userId }), async () => {
      const response = await apiClient.get<unknown>(ENDPOINTS.users.answers, {
        params: { user_id: userId },
      });

      const payload = readApiData<unknown>(response, []);
      return extractUserAnswerRecords(payload)
        .map(normalizeUserAnswerRecord)
        .filter((answer): answer is UserAnswer => Boolean(answer));
    }, 15000);
  },

  /**
   * Carrega e normaliza as anotacoes de questões do usuário.
   * Notas de outros tipos ficam fora daqui para manter o contrato do app.
   */
  async getUserQuestionNotes(userId: string): Promise<UserNote[]> {
    return withRequestCoalescing(buildRequestCacheKey('user-progress:question-notes', { userId }), async () => {
      const response = await apiClient.get<unknown>(ENDPOINTS.users.notes, {
        params: { userId },
      });

      const payload = readApiData<QuestionNotesResponse>(response, {});
      const notes = Array.isArray(payload?.notes)
        ? payload.notes
        : [];

      return notes
        .filter((note) => note?.type === 'question')
        .map(normalizeQuestionNoteRecord)
        .filter((note): note is UserNote => Boolean(note));
    }, 15000);
  },

  /**
   * Saves the note remotely and returns the backend representation. The empty
   * string is the official idempotent delete instruction.
   */
  async saveUserQuestionNote(questionId: number, text: string): Promise<UserNote | null> {
    const response = await apiClient.post<unknown>(ENDPOINTS.users.notes, {
      questionId,
      text,
    });
    const envelope = assertApiSuccess<QuestionNoteMutationResponse>(response, 'Nao foi possivel salvar a anotacao.');
    const payload = readApiData<QuestionNoteMutationResponse>(envelope.raw, {});
    clearRequestCoalescing('user-progress:question-notes');

    return payload.deleted || !payload.note
      ? null
      : normalizeQuestionNoteRecord(payload.note);
  },
};

export default userProgressService;
