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

/**
 * Tipagens oficiais do dominio de estatisticas.
 * Centralizadas fora de `src/features` para apoiar a migracao final.
 */
export interface UserStatistics {
    userId: string;
    totalQuestionsAnswered: number;
    correctAnswers: number;
    wrongAnswers: number;
    accuracyRate: number;
    currentStreak: number;
    bestStreak: number;
    questionStudyTime: number;
    readingStudyTime: number;
    totalStudyTime: number;
    lastActivity: string;
    subjectBreakdown: SubjectStatistics[];
}

export interface StudySessionPayload {
    practiceSeconds: number;
    simulationSeconds: number;
    readingSeconds: number;
    startedAt?: string;
    endedAt?: string;
    sourceContext?: Record<string, unknown>;
}

export interface StudySessionResult {
    sessionId: string;
    questionStudyTime: number;
    readingStudyTime: number;
    totalStudyTime: number;
    statistics: UserStatistics;
}

export interface SubjectStatistics {
    subject: string;
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    accuracyRate: number;
    averageTime: number;
}

export interface QuestionStatistics {
    questionId: number;
    totalAttempts: number;
    correctCount: number;
    wrongCount: number;
    accuracyRate: number;
    averageTimeSpent: number;
    difficultyRating: number;
    optionDistribution: Record<string, number>;
}

export interface PlatformStatistics {
    totalUsers: number;
    activeUsers: number;
    totalQuestions: number;
    totalAnswers: number;
    averageAccuracy: number;
    popularSubjects: Array<{
        subject: string;
        questionCount: number;
        attemptCount: number;
    }>;
    topPerformers: Array<{
        userId: string;
        userName: string;
        score: number;
        accuracy: number;
    }>;
}

export interface StatisticsContextType {
    userStats: UserStatistics | null;
    questionStats: Map<number, QuestionStatistics>;
    platformStats: PlatformStatistics | null;
    fetchUserStatistics: (userId: string) => Promise<void>;
    fetchQuestionStatistics: (questionId: number) => Promise<void>;
    fetchPlatformStatistics: () => Promise<void>;
    updateUserStatistics: (userId: string) => Promise<void>;
}
