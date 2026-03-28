/**
 * useStatistics Hook
 * Custom hook for accessing statistics functionality
 */

import { useCallback } from 'react';
import { useStatistics as useStatisticsContext } from '../context/StatisticsContext';

export const useStatistics = () => {
    const context = useStatisticsContext();

    const getQuestionStats = useCallback((questionId: number) => {
        return context.questionStats.get(questionId);
    }, [context.questionStats]);

    const getUserAccuracy = useCallback(() => {
        if (!context.userStats) return 0;
        return context.userStats.accuracyRate;
    }, [context.userStats]);

    const getSubjectStats = useCallback((subject: string) => {
        if (!context.userStats) return null;
        return context.userStats.subjectBreakdown.find(s => s.subject === subject);
    }, [context.userStats]);

    return {
        ...context,
        getQuestionStats,
        getUserAccuracy,
        getSubjectStats,
    };
};

export default useStatistics;
