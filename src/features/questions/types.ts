/**
 * Questions Feature Types
 */

import { Question, UserAnswer } from '../../../types';

export interface QuestionFilters {
    keyword: string;
    subject: string;
    difficulty: string;
    agency: string;
    year: string;
    level: string;
    topic: string;
    role: string;
    modality: string;
    onlySaved: boolean;
    hasTeacherComment: boolean;
    hasDetailedComment: boolean;
    excludeCanceled: boolean;
    excludeOutdated: boolean;
    excludeAnswered: boolean;
}

export interface QuestionsContextType {
    // Data
    questions: Question[];
    userAnswers: UserAnswer[];

    // Actions
    submitAnswer: (answer: UserAnswer) => void;

    // Filters
    filters: QuestionFilters;
    setFilters: (filters: QuestionFilters) => void;
}

export type { Question, UserAnswer };
