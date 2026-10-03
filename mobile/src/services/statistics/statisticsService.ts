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

import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { readApiData } from '@/services/api/response';
import type { SubjectStatistics, StatisticsTimelinePoint, UserStatistics } from '@/types/statistics';

export type StatisticsPeriod = 'dia' | 'semanal' | 'mensal';

export interface StudySessionInput {
  practiceSeconds: number;
  simulationSeconds?: number;
  readingSeconds?: number;
  startedAt: string;
  endedAt: string;
  sourceContext?: Record<string, unknown>;
}

const ANSWER_PAGE_SIZE = 50;

const normalizeAnswerTimestamp = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  if (typeof value !== 'string' || !value.trim()) return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }
  const normalized = /^\d{4}-\d{2}-\d{2}\s+\d{2}:/.test(value)
    ? value.replace(' ', 'T')
    : value;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isCorrectAnswer = (value: unknown): boolean =>
  value === true || value === 1 || ['1', 'true', 'sim', 'yes'].includes(String(value).toLowerCase());

const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const buildTimelinePoint = (date: Date, period: StatisticsPeriod): StatisticsTimelinePoint => ({
  label: period === 'dia'
    ? `${String(date.getHours()).padStart(2, '0')}h`
    : period === 'semanal'
      ? date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
      : String(date.getDate()),
  questions: 0,
  correct: 0,
  wrong: 0,
  timestamp: date.getTime(),
  subjectBreakdown: [],
});

const timelineDateKey = (date: Date, period: StatisticsPeriod): string => (
  period === 'dia'
    ? `${localDateKey(date)}-${Math.floor(date.getHours() / 3)}`
    : localDateKey(date)
);

const resolveAnswerSubject = (answer: any): string => {
  const directName = answer?.subjectName || answer?.subject_name || answer?.subject || answer?.materia;
  if (typeof directName === 'string' && directName.trim()) return directName.trim();

  const topics = Array.isArray(answer?.assuntos) ? answer.assuntos : [];
  const subject = topics.find((topic: any) => topic?.meta_materia || topic?.materia)
    || topics.find((topic: any) => topic?.name || topic?.nome);
  const name = subject?.name || subject?.nome || subject?.subject;
  return typeof name === 'string' && name.trim() ? name.trim() : 'Geral';
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Estatisticas de estudo consumidas pelo dashboard mobile.
 * @since v1.0.0
 */
export const statisticsService = {
  async recordStudySession(input: StudySessionInput): Promise<UserStatistics> {
    const response: any = await apiClient.post<any>(ENDPOINTS.statistics.studySession, {
      practice_seconds: Math.max(0, Math.floor(input.practiceSeconds)),
      simulation_seconds: Math.max(0, Math.floor(input.simulationSeconds || 0)),
      reading_seconds: Math.max(0, Math.floor(input.readingSeconds || 0)),
      started_at: input.startedAt,
      ended_at: input.endedAt,
      source_context: input.sourceContext || {},
    });
    const payload = readApiData<any>(response, {});
    const statistics = payload?.statistics || payload;
    return {
      userId: String(statistics?.userId || statistics?.user_id || ''),
      totalQuestionsAnswered: toNumber(statistics?.totalQuestionsAnswered ?? statistics?.total_questions_answered, 0),
      correctAnswers: toNumber(statistics?.correctAnswers ?? statistics?.correct_answers, 0),
      wrongAnswers: toNumber(statistics?.wrongAnswers ?? statistics?.wrong_answers, 0),
      accuracyRate: toNumber(statistics?.accuracyRate ?? statistics?.accuracy_rate, 0),
      currentStreak: toNumber(statistics?.currentStreak ?? statistics?.current_streak, 0),
      bestStreak: toNumber(statistics?.bestStreak ?? statistics?.best_streak, 0),
      questionStudyTime: toNumber(statistics?.questionStudyTime ?? statistics?.question_study_time, 0),
      readingStudyTime: toNumber(statistics?.readingStudyTime ?? statistics?.reading_study_time, 0),
      totalStudyTime: toNumber(statistics?.totalStudyTime ?? statistics?.total_study_time, 0),
      lastActivity: String(statistics?.lastActivity || statistics?.last_activity || ''),
      subjectBreakdown: [],
      timeline: [],
    };
  },

  /**
   * Usa o resumo autoritativo do historico de respostas e calcula materias
   * a partir das respostas recentes, como o dashboard web.
   */
  async getCurrentUserAnswerSnapshot() {
    const response: any = await apiClient.get<any>(ENDPOINTS.users.currentAnswers, {
      params: { limit: ANSWER_PAGE_SIZE, range: 'all' },
    });
    const payload = readApiData<any>(response, {});
    const summary = payload?.summary || {};
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.answers)
        ? payload.answers
        : [];
    const subjects = new Map<string, { totalQuestions: number; correctAnswers: number; wrongAnswers: number; accuracyRate: number }>();

    for (const answer of items) {
      const subject = resolveAnswerSubject(answer);
      const metric = subjects.get(subject) || {
        totalQuestions: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        accuracyRate: 0,
      };
      metric.totalQuestions += 1;
      if (isCorrectAnswer(answer?.isCorrect ?? answer?.is_correct ?? answer?.correct)) {
        metric.correctAnswers += 1;
      } else {
        metric.wrongAnswers += 1;
      }
      metric.accuracyRate = Math.round((metric.correctAnswers / metric.totalQuestions) * 100);
      subjects.set(subject, metric);
    }

    const total = toNumber(summary.totalAttempts ?? summary.total_attempts, 0);
    const correct = toNumber(summary.correct ?? summary.correct_count, 0);
    const wrong = toNumber(summary.wrong ?? summary.wrong_count, Math.max(0, total - correct));
    return {
      summary: {
        totalQuestionsAnswered: total,
        correctAnswers: correct,
        wrongAnswers: wrong,
        accuracyRate: toNumber(summary.accuracy, total > 0 ? (correct / total) * 100 : 0),
      },
      subjectBreakdown: Array.from(subjects, ([subject, metric]) => ({ subject, ...metric }))
        .sort((left, right) => right.totalQuestions - left.totalQuestions),
    };
  },

  /**
   * Monta a serie do grafico com respostas reais do endpoint autenticado do usuario.
   * A API entrega historico paginado; todos os cursores do periodo sao consumidos.
   */
  async getCurrentUserQuestionTimeline(period: StatisticsPeriod) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const points = period === 'dia'
      ? Array.from({ length: 8 }, (_, index) => {
          const date = new Date(today);
          date.setHours(index * 3);
          return buildTimelinePoint(date, period);
        })
      : Array.from({ length: period === 'semanal' ? 7 : 30 }, (_, index) => {
          const date = new Date(today);
          const dayCount = period === 'semanal' ? 7 : 30;
          date.setDate(today.getDate() - (dayCount - index - 1));
          return buildTimelinePoint(date, period);
        });
    const pointByDate = new Map(
      points.map((point) => [timelineDateKey(new Date(point.timestamp || 0), period), point]),
    );
    const subjectMetricsByPoint = new Map<StatisticsTimelinePoint, Map<string, SubjectStatistics>>();

    let cursor: string | null = null;
    const seenCursors = new Set<string>();
    do {
      const response: any = await apiClient.get<any>(ENDPOINTS.users.currentAnswers, {
        params: {
          limit: ANSWER_PAGE_SIZE,
          range: period === 'dia' ? 'today' : period === 'semanal' ? 'week' : 'month',
          ...(cursor ? { cursor } : {}),
        },
      });
      const payload = readApiData<any>(response, {});
      const items = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.answers)
          ? payload.answers
          : [];

      for (const answer of items) {
        const timestamp = normalizeAnswerTimestamp(
          answer?.timestamp ?? answer?.answeredAt ?? answer?.answered_at ?? answer?.createdAt ?? answer?.created_at,
        );
        if (!timestamp) continue;
        const point = pointByDate.get(timelineDateKey(new Date(timestamp), period));
        if (!point) continue;
        point.questions += 1;
        const correct = isCorrectAnswer(answer?.isCorrect ?? answer?.is_correct ?? answer?.correct);
        if (correct) {
          point.correct += 1;
        } else {
          point.wrong += 1;
        }
        const subjectName = resolveAnswerSubject(answer);
        const subjectMetrics = subjectMetricsByPoint.get(point) || new Map<string, SubjectStatistics>();
        const subjectMetric = subjectMetrics.get(subjectName) || {
          subject: subjectName,
          totalQuestions: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          accuracyRate: 0,
        };
        subjectMetric.totalQuestions += 1;
        if (correct) subjectMetric.correctAnswers += 1;
        else subjectMetric.wrongAnswers += 1;
        subjectMetric.accuracyRate = Math.round(
          (subjectMetric.correctAnswers / subjectMetric.totalQuestions) * 100,
        );
        subjectMetrics.set(subjectName, subjectMetric);
        subjectMetricsByPoint.set(point, subjectMetrics);
      }

      const nextCursor = typeof payload?.nextCursor === 'string' && payload.nextCursor.trim()
        ? payload.nextCursor
        : null;
      if (payload?.hasMore === true) {
        if (!nextCursor) {
          throw new Error('O historico informou mais respostas, mas nao retornou o cursor da proxima pagina.');
        }
        if (seenCursors.has(nextCursor)) {
          throw new Error('O historico de respostas retornou uma pagina repetida. Tente novamente.');
        }
        seenCursors.add(nextCursor);
        cursor = nextCursor;
      } else {
        cursor = null;
      }
    } while (cursor);

    points.forEach((point) => {
      point.subjectBreakdown = Array.from(subjectMetricsByPoint.get(point)?.values() || [])
        .sort((left, right) => right.totalQuestions - left.totalQuestions);
    });

    return points;
  },

  async getUserStatistics(userId: string): Promise<UserStatistics> {
    const normalizedUserId = String(userId || '').trim();
    if (!normalizedUserId) {
      throw new Error('Sessao sem identificador de usuario. Faca login novamente.');
    }

    const response: any = await apiClient.get<any>(ENDPOINTS.statistics.user, {
      params: { user_id: normalizedUserId, _: Date.now() },
    });

    const payload = readApiData<any>(response, {});
    const subjectRows = Array.isArray(payload?.subjectBreakdown)
      ? payload.subjectBreakdown
      : Array.isArray(payload?.subject_breakdown)
        ? payload.subject_breakdown
        : [];
    const timelineRows = Array.isArray(payload?.timeline)
      ? payload.timeline
      : Array.isArray(payload?.timelineData)
        ? payload.timelineData
        : Array.isArray(payload?.questionTimeline)
          ? payload.questionTimeline
          : [];

    return {
      userId: String(payload?.userId || payload?.user_id || normalizedUserId),
      totalQuestionsAnswered: toNumber(payload?.totalQuestionsAnswered ?? payload?.total_questions_answered, 0),
      correctAnswers: toNumber(payload?.correctAnswers ?? payload?.correct_answers, 0),
      wrongAnswers: toNumber(payload?.wrongAnswers ?? payload?.wrong_answers, 0),
      accuracyRate: toNumber(payload?.accuracyRate ?? payload?.accuracy_rate, 0),
      currentStreak: toNumber(payload?.currentStreak ?? payload?.current_streak, 0),
      bestStreak: toNumber(payload?.bestStreak ?? payload?.best_streak, 0),
      questionStudyTime: toNumber(payload?.questionStudyTime ?? payload?.question_study_time, 0),
      readingStudyTime: toNumber(payload?.readingStudyTime ?? payload?.reading_study_time, 0),
      totalStudyTime: toNumber(payload?.totalStudyTime ?? payload?.total_study_time, 0),
      lastActivity: String(payload?.lastActivity || payload?.last_activity || ''),
      subjectBreakdown: subjectRows.map((row: any) => ({
        subject: String(row?.subject || row?.name || 'Sem materia'),
        totalQuestions: toNumber(row?.totalQuestions ?? row?.total_questions, 0),
        correctAnswers: toNumber(row?.correctAnswers ?? row?.correct_answers, 0),
        wrongAnswers: toNumber(row?.wrongAnswers ?? row?.wrong_answers, 0),
        accuracyRate: toNumber(row?.accuracyRate ?? row?.accuracy_rate, 0),
      })),
      timeline: timelineRows.map((row: any) => ({
        label: String(row?.label || row?.date || row?.name || '--'),
        questions: toNumber(row?.questions ?? row?.totalQuestions ?? row?.total_questions, 0),
        correct: toNumber(row?.correct ?? row?.correctAnswers ?? row?.correct_answers, 0),
        wrong: toNumber(row?.wrong ?? row?.wrongAnswers ?? row?.wrong_answers, 0),
        timestamp: toNumber(row?.timestamp, 0) || undefined,
      })),
    };
  },
};

export default statisticsService;
