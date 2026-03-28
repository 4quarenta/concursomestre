/**
 * Comment Service
 * Handles all comment-related operations with helper methods
 */

import { apiClient, ENDPOINTS } from '@core/api';
import type { ApiResponse } from '@core/api/types';
import type { QuestaoComentario } from 'types';

export const commentService = {
    /**
     * Get comments for a question
     */
    async getComments(questionId: string): Promise<QuestaoComentario[]> {
        try {
            const response = await apiClient.get<ApiResponse<QuestaoComentario[]>>(
                ENDPOINTS.comments.list,
                { params: { question_id: questionId } }
            );
            return response.data.data || [];
        } catch (error) {
            console.error('Error fetching comments:', error);
            return [];
        }
    },

    /**
     * Add a new comment
     */
    async addComment(commentData: {
        questionId: string;
        content: string;
        userId: string;
        userName: string;
        parentId?: string;
        targetType?: 'question' | 'material';
    }): Promise<QuestaoComentario> {
        const response = await apiClient.post<ApiResponse<{ id: string }>>(
            ENDPOINTS.comments.create,
            {
                action: 'add',
                question_id: commentData.questionId,
                user_id: commentData.userId,
                user_name: commentData.userName,
                content: commentData.content,
                parent_id: commentData.parentId,
                targetType: commentData.targetType || 'question'
            }
        ) as unknown as ApiResponse<{ id: string }>;

        if (!response.success || !response.data) {
            throw new Error(response.message || 'Falha ao criar comentário');
        }

        const newComment: QuestaoComentario = {
            id: response.data.id,
            userId: commentData.userId,
            userName: commentData.userName,
            userPlan: 'Gratuito', // Poderia vir do contexto, mas 'Gratuito' é safe fallback
            text: commentData.content,
            date: 'Agora',
            likes: 0,
            replies: [],
            isLiked: false
        };

        return newComment;
    },

    /**
     * Like a comment
     */
    async likeComment(commentId: string): Promise<{ success: boolean }> {
        const response = await apiClient.post<ApiResponse>(
            ENDPOINTS.comments.like,
            { action: 'like', comment_id: commentId }
        );
        // apiClient já retorna response.data — response é diretamente o JSON do PHP
        return { success: (response as any).success };
    },

    /**
     * Report a comment
     */
    async reportComment(
        commentId: string,
        reason: string
    ): Promise<{ success: boolean }> {
        const response = await apiClient.post<ApiResponse>(
            ENDPOINTS.comments.report,
            { action: 'report', comment_id: commentId, reason }
        );
        // apiClient já retorna response.data — response é diretamente o JSON do PHP
        return { success: (response as any).success };
    },

    /**
     * Deletar um comentário
     * O backend espera: action, commentId (camelCase), userId (para verificação de propriedade)
     */
    async deleteComment(commentId: string, userId?: string): Promise<{ success: boolean }> {
        const response = await apiClient.post<ApiResponse>(
            ENDPOINTS.comments.delete,
            { action: 'delete', commentId, userId }
        );
        // apiClient já retorna response.data — response é diretamente o JSON do PHP
        return { success: (response as any).success };
    },

    // ============================================
    // HELPER METHODS (for local state management)
    // ============================================

    /**
     * Add reply to comments tree (local helper)
     */
    addReplyToComments(
        comments: QuestaoComentario[],
        parentId: string,
        newReply: QuestaoComentario
    ): QuestaoComentario[] {
        return comments.map((comment) => {
            if (comment.id === parentId) {
                return {
                    ...comment,
                    replies: [newReply, ...(comment.replies || [])],
                };
            }
            if (comment.replies && comment.replies.length > 0) {
                return {
                    ...comment,
                    replies: this.addReplyToComments(comment.replies, parentId, newReply),
                };
            }
            return comment;
        });
    },

    /**
     * Like comment in tree (local helper)
     */
    likeCommentInTree(comments: QuestaoComentario[], commentId: string): QuestaoComentario[] {
        return comments.map((comment) => {
            if (comment.id === commentId) {
                return { ...comment, likes: comment.likes + 1 };
            }
            if (comment.replies && comment.replies.length > 0) {
                return {
                    ...comment,
                    replies: this.likeCommentInTree(comment.replies, commentId),
                };
            }
            return comment;
        });
    },

    /**
     * Find comment owner in tree (local helper)
     */
    findCommentOwner(comments: QuestaoComentario[], commentId: string): string | null {
        for (const comment of comments) {
            if (comment.id === commentId) {
                return comment.userId;
            }
            if (comment.replies && comment.replies.length > 0) {
                const found = this.findCommentOwner(comment.replies, commentId);
                if (found) return found;
            }
        }
        return null;
    },

    /**
     * Delete comment from tree (local helper)
     */
    deleteCommentFromTree(comments: QuestaoComentario[], commentId: string): QuestaoComentario[] {
        return comments.filter(comment => {
            if (comment.id === commentId) {
                return false;
            }
            if (comment.replies && comment.replies.length > 0) {
                comment.replies = this.deleteCommentFromTree(comment.replies, commentId);
            }
            return true;
        });
    },
};

export default commentService;
