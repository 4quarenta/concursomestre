/**
 * Bank Analysis (Raio-X) Feature Types
 */

export interface ExamBoardPattern {
    boardId: string;
    boardName: string;
    totalQuestions: number;
    commonTopics: string[];
    difficultyDistribution: {
        easy: number;
        medium: number;
        hard: number;
    };
    questionTypes: {
        multipleChoice: number;
        trueOrFalse: number;
    };
    trends: {
        topic: string;
        frequency: number;
        trend: 'increasing' | 'decreasing' | 'stable';
    }[];
}

export interface BankAnalysis {
    boardId: string;
    boardName: string;
    totalQuestions: number;
    userPerformance: {
        attempted: number;
        correct: number;
        accuracy: number;
    };
    patterns: ExamBoardPattern;
    recommendations: {
        focusAreas: string[];
        studyPlan: string[];
        weakTopics: string[];
    };
    insights: {
        title: string;
        description: string;
        impact: 'high' | 'medium' | 'low';
    }[];
}

export interface AnalyticsData {
    timeSpent: number;
    questionsPerDay: number;
    accuracyTrend: number[];
    topicMastery: Record<string, number>;
    streakDays: number;
}
