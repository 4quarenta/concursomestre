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

import { readApiData } from '@/lib/browserApi';
import { requestAuthenticatedApi } from '@/lib/authSession';

export interface SubjectStatistics {
  accuracyRate: number;
  averageTime: number;
  correctAnswers: number;
  subject: string;
  totalQuestions: number;
  wrongAnswers: number;
}

export interface UserStatistics {
  accuracyRate: number;
  bestStreak: number;
  correctAnswers: number;
  currentStreak: number;
  lastActivity: string;
  questionStudyTime: number;
  readingStudyTime: number;
  subjectBreakdown: SubjectStatistics[];
  totalQuestionsAnswered: number;
  totalStudyTime: number;
  userId: string;
  wrongAnswers: number;
}

const createUserStatisticsFallback = (userId: string): UserStatistics => ({
  accuracyRate: 0,
  bestStreak: 0,
  correctAnswers: 0,
  currentStreak: 0,
  lastActivity: '',
  questionStudyTime: 0,
  readingStudyTime: 0,
  subjectBreakdown: [],
  totalQuestionsAnswered: 0,
  totalStudyTime: 0,
  userId,
  wrongAnswers: 0,
});

export const statisticsService = {
  async getUserStatistics(userId: string): Promise<UserStatistics> {
    const response = await requestAuthenticatedApi<any>(`statistics/user/${encodeURIComponent(userId)}`, {
      method: 'GET',
    });

    const payload = readApiData<Partial<UserStatistics>>(response, {});
    const fallback = createUserStatisticsFallback(userId);

    return {
      ...fallback,
      ...payload,
      subjectBreakdown: Array.isArray(payload.subjectBreakdown)
        ? payload.subjectBreakdown
        : fallback.subjectBreakdown,
    };
  },
};

export default statisticsService;
