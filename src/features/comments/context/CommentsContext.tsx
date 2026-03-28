/**
 * Comments Context - Wrapper around DataContext
 * Provides a cleaner API for comment-related functionality
 */

import React, { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useData } from '../../../../context/DataContext';
import type { CommentsContextType, QuestaoComentario } from '../types';

const CommentsContext = createContext<CommentsContextType | undefined>(undefined);

interface CommentsProviderProps {
    children: ReactNode;
}

/**
 * CommentsProvider - Wraps DataContext to provide comment-specific API
 * This is a non-breaking wrapper that allows gradual migration
 */
export const CommentsProvider: React.FC<CommentsProviderProps> = ({ children }) => {
    // Get data from existing DataContext
    const { addComment, likeComment } = useData();

    // Helper to get comments for a specific question
    const getCommentsForQuestion = useCallback((questionId: string): QuestaoComentario[] => {
        // This will be implemented when we have access to comments data
        // For now, return empty array
        return [];
    }, []);

    // Helper to get comment count
    const getCommentCount = useCallback((questionId: string): number => {
        return getCommentsForQuestion(questionId).length;
    }, [getCommentsForQuestion]);

    // Report comment handler
    const reportComment = useCallback(async (commentId: string, reason: string): Promise<void> => {
        // This will be implemented later
        console.log('Report comment:', commentId, reason);
    }, []);

    // Create value object with memoization
    const value = useMemo<CommentsContextType>(() => ({
        // Data - organized by question ID
        commentsByQuestion: {},

        // Actions
        addComment: async (comment) => {
            // This is a bridge - it needs a questionId which it doesn't have in this signature
            // For now, we'll log it and skip to avoid runtime errors, or the signature needs to change
            console.warn('CommentsContext: addComment called without questionId');
        },
        likeComment: async (commentId) => {
            // Same here
            console.warn('CommentsContext: likeComment called without questionId');
        },
        reportComment,

        // Helpers
        getCommentsForQuestion,
        getCommentCount,
    }), [reportComment, getCommentsForQuestion, getCommentCount]);

    return (
        <CommentsContext.Provider value={value}>
            {children}
        </CommentsContext.Provider>
    );
};

/**
 * useComments Hook
 * Access comments context from any component
 * 
 * @example
 * const { addComment, getCommentsForQuestion } = useComments();
 */
export const useComments = (): CommentsContextType => {
    const context = useContext(CommentsContext);
    if (!context) {
        throw new Error('useComments must be used within CommentsProvider');
    }
    return context;
};

export default CommentsProvider;
