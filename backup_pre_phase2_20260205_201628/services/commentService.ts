
import { Comment } from '../types';

export const commentService = {
    /**
     * Recursively adds a reply to a comment tree.
     */
    addReplyToComments: (comments: Comment[], parentId: string, newReply: Comment): Comment[] => {
        return comments.map(c => {
            if (c.id === parentId) {
                return { ...c, replies: [...c.replies, newReply] };
            } else if (c.replies && c.replies.length > 0) {
                return { ...c, replies: commentService.addReplyToComments(c.replies, parentId, newReply) };
            }
            return c;
        });
    },

    /**
     * Recursively likes a comment in a tree.
     */
    likeCommentInTree: (comments: Comment[], commentId: string): Comment[] => {
        return comments.map(c => {
            if (c.id === commentId) {
                const isLiked = c.isLiked || false;
                return {
                    ...c,
                    likes: isLiked ? c.likes - 1 : c.likes + 1,
                    isLiked: !isLiked
                };
            } else if (c.replies && c.replies.length > 0) {
                return { ...c, replies: commentService.likeCommentInTree(c.replies, commentId) };
            }
            return c;
        });
    },

    /**
     * Recursively finds the owner (userId) of a comment.
     */
    findCommentOwner: (comments: Comment[], commentId: string): string | null => {
        for (const c of comments) {
            if (c.id === commentId) return c.userId;
            if (c.replies && c.replies.length > 0) {
                const found = commentService.findCommentOwner(c.replies, commentId);
                if (found) return found;
            }
        }
        return null;
    }
};
