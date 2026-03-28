/**
 * Questions Context - Wrapper around DataContext
 * Provides a cleaner API for question-related functionality
 */

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useData } from '../../../../context/DataContext';
import type { QuestionsContextType, QuestionFilters } from '../types';

const QuestionsContext = createContext<QuestionsContextType | undefined>(undefined);

interface QuestionsProviderProps {
    children: ReactNode;
}

/**
 * QuestionsProvider - Wraps DataContext to provide question-specific API
 * This is a non-breaking wrapper that allows gradual migration
 */
export const QuestionsProvider: React.FC<QuestionsProviderProps> = ({ children }) => {
    // Get data from existing DataContext
    const { questions, userAnswers, submitAnswer } = useData();

    // Create value object with memoization
    const value = useMemo<QuestionsContextType>(() => ({
        // Data
        questions,
        userAnswers,

        // Actions
        submitAnswer,

        // Filters - placeholder for now, will be implemented later
        filters: {
            keyword: '',
            subject: 'All',
            difficulty: 'All',
            agency: 'All',
            year: 'All',
            level: 'All',
            topic: 'All',
            role: 'All',
            modality: 'All',
            onlySaved: false,
            hasTeacherComment: false,
            hasDetailedComment: false,
            excludeCanceled: false,
            excludeOutdated: false,
            excludeAnswered: false,
        },
        setFilters: () => { }, // Placeholder
    }), [questions, userAnswers, submitAnswer]);

    return (
        <QuestionsContext.Provider value={value}>
            {children}
        </QuestionsContext.Provider>
    );
};

/**
 * useQuestions Hook
 * Access questions context from any component
 * 
 * @example
 * const { questions, submitAnswer } = useQuestions();
 */
export const useQuestions = (): QuestionsContextType => {
    const context = useContext(QuestionsContext);
    if (!context) {
        throw new Error('useQuestions must be used within QuestionsProvider');
    }
    return context;
};

export default QuestionsProvider;
