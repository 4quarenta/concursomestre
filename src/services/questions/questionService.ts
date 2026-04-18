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

import { requestAuthenticatedApi } from '@/lib/authSession';
import {
  assertApiSuccess,
  readApiData,
  requestApi,
} from '@/lib/browserApi';
import type { Question, QuestionStats, SimulationSession, UserAnswer } from '@/types';

export type QuestionListFilters = Record<string, string | number | boolean | null | undefined>;

export type QuestionListResult = {
  rows: Question[];
  total: number;
};

export type SubmitAnswerResult = {
  message?: string;
  newLevel?: number;
  newXp?: number;
  success: boolean;
};

type SaveSimulationResult = {
  id?: string;
  message?: string;
  success: boolean;
};

const QUESTION_ENDPOINTS = {
  list: 'questionsList',
  show: 'questions/show.php',
  submit: 'questionsAnswer',
  stats: 'questionsStats',
  history: 'questionsHistory',
  toggleSave: 'questionsToggleSave',
  resetAnswers: 'questionsResetAnswers',
  simulationCreate: 'simulationsCreate',
} as const;

const appendQueryParam = (params: URLSearchParams, key: string, value: unknown) => {
  if (value === undefined || value === null || value === '' || value === 'All') {
    return;
  }

  if (Array.isArray(value)) {
    value
      .filter((item) => item !== undefined && item !== null && String(item).trim() !== '')
      .forEach((item) => params.append(key, String(item)));
    return;
  }

  params.set(key, String(value));
};

const buildEndpointWithQuery = (endpoint: string, filters?: QuestionListFilters) => {
  const params = new URLSearchParams();

  Object.entries(filters || {}).forEach(([key, value]) => {
    appendQueryParam(params, key, value);
  });

  const query = params.toString();
  return query ? `${endpoint}?${query}` : endpoint;
};

const readRows = (payload: any): Question[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  if (Array.isArray(payload?.questions)) {
    return payload.questions;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
};

const readTotal = (payload: any, rows: Question[], response: any): number => {
  const rawTotal = payload?.total
    ?? payload?.pagination?.total
    ?? response?.total
    ?? response?.pagination?.total
    ?? rows.length;

  const total = Number(rawTotal);
  return Number.isFinite(total) ? total : rows.length;
};

const normalizeSimulationId = (simulationId: UserAnswer['simulationId']) => {
  if (typeof simulationId === 'number') {
    return simulationId;
  }

  if (typeof simulationId === 'string' && /^\d+$/.test(simulationId.trim())) {
    return Number(simulationId.trim());
  }

  return null;
};

export const questionService = {
  async getQuestionPage(filters?: QuestionListFilters): Promise<QuestionListResult> {
    const response = await requestApi<any>(
      buildEndpointWithQuery(QUESTION_ENDPOINTS.list, filters),
      { method: 'GET' },
    );

    const payload = readApiData<any>(response, {});
    const rows = readRows(payload);

    return {
      rows,
      total: readTotal(payload, rows, response),
    };
  },

  async getQuestions(filters?: QuestionListFilters): Promise<Question[]> {
    const result = await this.getQuestionPage(filters);
    return result.rows;
  },

  async getQuestionById(questionId: string | number): Promise<Question> {
    const response = await requestApi<any>(
      buildEndpointWithQuery(QUESTION_ENDPOINTS.show, { id: String(questionId) }),
      { method: 'GET' },
    );

    return readApiData<Question>(response, {} as Question);
  },

  async submitUserAnswer(userId: string, answer: UserAnswer): Promise<SubmitAnswerResult> {
    const response = await requestAuthenticatedApi<any>(QUESTION_ENDPOINTS.submit, {
      method: 'POST',
      body: {
        user_id: userId,
        question_id: answer.questionId,
        selected_option: answer.selectedOptionIndex,
        is_correct: answer.isCorrect,
        time_taken: answer.timeTaken || 0,
        simulation_id: normalizeSimulationId(answer.simulationId),
      },
    });

    const envelope = assertApiSuccess(response, 'Nao foi possivel salvar a resposta.');
    const payload = readApiData<any>(response, {});

    return {
      success: true,
      message: envelope.message,
      newXp: payload?.new_xp ?? envelope.raw?.new_xp,
      newLevel: payload?.new_level ?? envelope.raw?.new_level,
    };
  },

  async getQuestionHistory(questionId: string | number, userId?: string): Promise<UserAnswer[]> {
    const response = await requestAuthenticatedApi<any>(
      buildEndpointWithQuery(QUESTION_ENDPOINTS.history, {
        question_id: String(questionId),
        user_id: userId || '',
      }),
      { method: 'GET' },
    );

    const payload = readApiData<any>(response, []);
    return Array.isArray(payload) ? payload : [];
  },

  async getQuestionStats(questionId: string | number): Promise<QuestionStats> {
    const response = await requestApi<any>(
      buildEndpointWithQuery(QUESTION_ENDPOINTS.stats, { question_id: String(questionId) }),
      { method: 'GET' },
    );

    return readApiData<QuestionStats>(response, {
      totalAttempts: 0,
      correctCount: 0,
      wrongCount: 0,
      optionDistribution: {},
    });
  },

  async toggleSavedQuestion(
    userId: string,
    questionId: string | number,
  ): Promise<{ isSaved?: boolean; message?: string; success: boolean }> {
    const response = await requestAuthenticatedApi<any>(QUESTION_ENDPOINTS.toggleSave, {
      method: 'POST',
      body: {
        user_id: userId,
        question_id: questionId,
      },
    });

    const envelope = assertApiSuccess<{ isSaved?: boolean }>(
      response,
      'Nao foi possivel atualizar as questoes salvas.',
    );
    const payload = readApiData<{ isSaved?: boolean }>(response, {});

    return {
      success: true,
      isSaved: payload?.isSaved ?? envelope.raw?.isSaved,
      message: envelope.message,
    };
  },

  async resetAnswers(userId: string): Promise<{ message?: string; success: boolean }> {
    const response = await requestAuthenticatedApi<any>(QUESTION_ENDPOINTS.resetAnswers, {
      method: 'POST',
      body: {
        user_id: userId,
      },
    });

    const envelope = assertApiSuccess(response, 'Nao foi possivel limpar as respostas.');

    return {
      success: true,
      message: envelope.message,
    };
  },

  async saveSimulation(simulation: SimulationSession): Promise<SaveSimulationResult> {
    const response = await requestAuthenticatedApi<any>(QUESTION_ENDPOINTS.simulationCreate, {
      method: 'POST',
      body: simulation,
    });

    const envelope = assertApiSuccess(response, 'Nao foi possivel salvar o simulado.');

    return {
      success: true,
      id: envelope.raw?.data?.id || envelope.raw?.id,
      message: envelope.message,
    };
  },
};

export default questionService;
