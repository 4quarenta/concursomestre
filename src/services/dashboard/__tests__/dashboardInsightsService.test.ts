import { describe, expect, it } from 'vitest';
import {
  buildQuestionTimelineData,
  buildSubjectPerformanceDataFromAnswers,
  filterAnswersByRange,
  getRangeStartTimestamp,
  resolveDashboardAnswerTimestamp,
} from '../dashboardInsightsService';
import type { UserAnswer } from '@types';

const makeAnswer = (overrides: Partial<UserAnswer> & Record<string, unknown>): UserAnswer => ({
  questionId: 1,
  selectedOptionIndex: 0,
  isCorrect: true,
  timestamp: 0,
  ...overrides,
} as UserAnswer);

describe('dashboardInsightsService', () => {
  it('filtra respostas do periodo aceitando timestamp em ms, segundos e created_at', () => {
    const now = new Date(2026, 5, 6, 15, 30, 0);
    const todayMorning = new Date(2026, 5, 6, 9, 0, 0).getTime();
    const yesterday = new Date(2026, 5, 5, 18, 0, 0).getTime();
    const answers = [
      makeAnswer({ questionId: 1, timestamp: todayMorning }),
      makeAnswer({ questionId: 2, timestamp: Math.floor(todayMorning / 1000) }),
      makeAnswer({ questionId: 3, timestamp: 0, created_at: '2026-06-06 10:15:00' }),
      makeAnswer({ questionId: 4, timestamp: yesterday }),
    ];

    const filtered = filterAnswersByRange(answers, 'today', now);

    expect(filtered.map((answer) => answer.questionId)).toEqual([1, 2, 3]);
  });

  it('monta a janela semanal movel com 7 dias', () => {
    const now = new Date(2026, 5, 6, 15, 0, 0);
    const saturdayMorning = new Date(2026, 5, 6, 9, 0, 0).getTime();

    const timeline = buildQuestionTimelineData([
      makeAnswer({ questionId: 1, timestamp: Math.floor(saturdayMorning / 1000) }),
    ], 'week', now);

    expect(timeline).toHaveLength(7);
    expect(timeline[0].timestamp).toBe(new Date(2026, 4, 31).getTime());
    expect(timeline[6]).toMatchObject({ questions: 1, correct: 1, wrong: 0 });
  });

  it('usa ultimos 7 dias, 30 dias e 12 meses como recortes moveis', () => {
    const now = new Date(2026, 5, 10, 14, 0, 0);

    expect(getRangeStartTimestamp('week', now)).toBe(new Date(2026, 5, 4).getTime());
    expect(getRangeStartTimestamp('month', now)).toBe(new Date(2026, 4, 12).getTime());
    expect(getRangeStartTimestamp('year', now)).toBe(new Date(2025, 6, 1).getTime());

    expect(buildQuestionTimelineData([], 'week', now)).toHaveLength(7);
    expect(buildQuestionTimelineData([], 'month', now)).toHaveLength(30);
    expect(buildQuestionTimelineData([], 'year', now)).toHaveLength(12);
  });

  it('remove respostas futuras dos recortes ativos sem afetar Tudo', () => {
    const now = new Date(2026, 5, 10, 14, 0, 0);
    const past = new Date(2026, 5, 10, 9, 0, 0).getTime();
    const future = new Date(2026, 5, 10, 18, 0, 0).getTime();
    const answers = [
      makeAnswer({ questionId: 1, timestamp: past }),
      makeAnswer({ questionId: 2, timestamp: future }),
    ];

    expect(filterAnswersByRange(answers, 'today', now).map((answer) => answer.questionId)).toEqual([1]);
    expect(filterAnswersByRange(answers, 'all', now).map((answer) => answer.questionId)).toEqual([1, 2]);
  });

  it('usa materias das respostas filtradas antes de cair no agregado geral', () => {
    const metrics = buildSubjectPerformanceDataFromAnswers([
      makeAnswer({ questionId: 1, subjectName: 'Direito Constitucional', isCorrect: true }),
      makeAnswer({ questionId: 2, subject_name: 'Direito Constitucional', isCorrect: false }),
      makeAnswer({ questionId: 3, materia: 'Informatica', isCorrect: true }),
      makeAnswer({
        questionId: 4,
        assuntos: [{ nome: 'Direito Penal', materia: true }],
        isCorrect: true,
      }),
    ]);

    expect(metrics).toEqual([
      {
        name: 'Direito Constitucional',
        total: 2,
        correct: 1,
        wrong: 1,
        accuracy: 50,
      },
      {
        name: 'Informatica',
        total: 1,
        correct: 1,
        wrong: 0,
        accuracy: 100,
      },
      {
        name: 'Direito Penal',
        total: 1,
        correct: 1,
        wrong: 0,
        accuracy: 100,
      },
    ]);
  });

  it('resolve timestamp por campos legados do backend', () => {
    const secondsTimestamp = Math.floor(new Date(2026, 5, 6, 8, 0, 0).getTime() / 1000);
    const timestamp = resolveDashboardAnswerTimestamp(makeAnswer({
      timestamp: 0,
      answered_at: String(secondsTimestamp),
    }));

    expect(timestamp).toBe(secondsTimestamp * 1000);
  });

  it('aceita aliases comuns de data enviados pelo backend', () => {
    const timestamp = resolveDashboardAnswerTimestamp(makeAnswer({
      timestamp: 0,
      data_resposta: '06/06/2026 11:20',
    }));

    expect(timestamp).toBe(new Date(2026, 5, 6, 11, 20).getTime());
  });

  it('mantem o grafico Tudo preenchido mesmo com respostas sem timestamp', () => {
    const timeline = buildQuestionTimelineData([
      makeAnswer({ questionId: 1, timestamp: 0, isCorrect: true }),
      makeAnswer({ questionId: 2, timestamp: 0, isCorrect: false }),
    ], 'all');

    expect(timeline).toEqual([
      {
        date: 'Sem data',
        questions: 2,
        correct: 1,
        wrong: 1,
        timestamp: 0,
      },
    ]);
  });
});
