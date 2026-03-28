/**
 * Statistics Feature Types
 */

export interface UserStatistics {
    userId: string;
    totalQuestionsAnswered: number;
    correctAnswers: number;
    wrongAnswers: number;
    accuracyRate: number;
    currentStreak: number;
    bestStreak: number;
    totalStudyTime: number; // in minutes
    lastActivity: Date;
    subjectBreakdown: SubjectStatistics[];
}

export interface SubjectStatistics {
    subject: string;
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    accuracyRate: number;
    averageTime: number; // in seconds
}

export interface QuestionStatistics {
    questionId: number;
    totalAttempts: number;
    correctCount: number;
    wrongCount: number;
    accuracyRate: number;
    averageTimeSpent: number; // in seconds
    difficultyRating: number; // 1-5 scale
    optionDistribution: Record<string, number>; // optionId -> count
}

export interface PlatformStatistics {
    totalUsers: number;
    activeUsers: number; // last 30 days
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
    // User Statistics
    userStats: UserStatistics | null;

    // Question Statistics
    questionStats: Map<number, QuestionStatistics>;

    // Platform Statistics
    platformStats: PlatformStatistics | null;

    // Actions
    fetchUserStatistics: (userId: string) => Promise<void>;
    fetchQuestionStatistics: (questionId: number) => Promise<void>;
    fetchPlatformStatistics: () => Promise<void>;
    updateUserStatistics: (userId: string) => Promise<void>;
}
