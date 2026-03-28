/**
 * Comments Feature Types
 */

import { QuestaoComentario } from '../../../types';

export interface CommentsContextType {
    // Data - comments organized by question ID
    commentsByQuestion: Record<string, QuestaoComentario[]>;

    // Actions
    addComment: (comment: Omit<QuestaoComentario, 'id' | 'createdAt'>) => Promise<void>;
    likeComment: (commentId: string) => Promise<void>;
    reportComment: (commentId: string, reason: string) => Promise<void>;

    // Helpers
    getCommentsForQuestion: (questionId: string) => QuestaoComentario[];
    getCommentCount: (questionId: string) => number;
}

export type { QuestaoComentario };
