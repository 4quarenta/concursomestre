/**
 * useCommentActions Hook
 * Provides comment-related actions with optimistic updates
 */

import { useState, useCallback } from 'react';
import { useComments } from '../context/CommentsContext';
import type { QuestaoComentario } from '../types';

export const useCommentActions = () => {
    const { addComment, likeComment, reportComment } = useComments();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Add comment with loading state
    const handleAddComment = useCallback(async (
        commentData: Omit<QuestaoComentario, 'id' | 'createdAt'>
    ) => {
        setIsSubmitting(true);
        setError(null);

        try {
            await addComment(commentData);
            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to add comment';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsSubmitting(false);
        }
    }, [addComment]);

    // Like comment with optimistic update
    const handleLikeComment = useCallback(async (commentId: string) => {
        setError(null);

        try {
            await likeComment(commentId);
            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to like comment';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        }
    }, [likeComment]);

    // Report comment
    const handleReportComment = useCallback(async (
        commentId: string,
        reason: string
    ) => {
        setIsSubmitting(true);
        setError(null);

        try {
            await reportComment(commentId, reason);
            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to report comment';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsSubmitting(false);
        }
    }, [reportComment]);

    // Clear error
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        handleAddComment,
        handleLikeComment,
        handleReportComment,
        isSubmitting,
        error,
        clearError,
    };
};

export default useCommentActions;
