import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { readApiData } from '@/services/api/response';
import type { UserStatistics } from '@/types/statistics';

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Estatisticas de estudo consumidas pelo dashboard mobile.
 * @since v1.0.0
 */
export const statisticsService = {
  async getUserStatistics(userId: string): Promise<UserStatistics> {
    const response: any = await apiClient.get<any>(`${ENDPOINTS.statistics.user}/${userId}`, {
      params: { _: Date.now() },
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
      userId: String(payload?.userId || payload?.user_id || userId),
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
