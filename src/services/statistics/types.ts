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
    totalStudyTime: number;
    lastActivity: Date;
    subjectBreakdown: SubjectStatistics[];
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
