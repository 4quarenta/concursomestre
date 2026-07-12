/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockApiResponse = {
  data?: unknown;
  success?: boolean;
  message?: string;
} | null | undefined;

const { mockGet, mockPost, mockCreateReport } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockCreateReport: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
  },
  assertApiSuccess: (response: MockApiResponse) => {
    if (!response?.success) {
      throw new Error(response?.message || 'erro');
    }

    return {
      success: true,
      message: response?.message,
      data: response?.data,
      raw: response,
    };
  },
  readApiData: (response: MockApiResponse, fallback: unknown) => {
    if (response?.data !== undefined) {
      return response.data;
    }

    return response ?? fallback;
  },
  ENDPOINTS: {
    comments: {
      list: 'commentsList',
      create: 'commentsHandle',
      delete: 'commentsHandle',
      handle: 'commentsHandle',
    },
    users: {
      comments: 'users/comments.php',
      myComments: 'users/me/comments.php',
    },
  },
}));

vi.mock('@services/reports', () => ({
  reportsService: {
    createReport: mockCreateReport,
  },
}));

import { commentService } from '../index';

describe('commentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads comments for a target with the official params', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        items: [
        { id: 'com-1', text: 'Comentário', replies: [] },
        ],
      },
    });

    const comments = await commentService.getComments('123', 'user-1');

    expect(mockGet).toHaveBeenCalledWith('commentsList', {
      params: {
        target_id: '123',
        user_id: 'user-1',
      },
    });
    expect(comments[0].id).toBe('com-1');
  });

  it('loads user comments through the official user endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: [
        { id: 'com-2', questionId: 7, text: 'Meu comentário', replies: [] },
      ],
    });

    const comments = await commentService.getUserComments('user-7');

    expect(mockGet).toHaveBeenCalledWith('users/comments.php', {
      params: { user_id: 'user-7' },
    });
    expect(comments[0].id).toBe('com-2');
  });

  it('loads current user comments without sending user_id', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        items: [
          { id: 'com-me', questionId: 8, text: 'Meu comentario recente', replies: [] },
        ],
      },
    });

    const comments = await commentService.getCurrentUserComments(10);

    expect(mockGet).toHaveBeenCalledWith('users/me/comments.php', {
      params: { limit: 10, range: 'all' },
    });
    expect(comments[0].id).toBe('com-me');
  });

  it('preserva o total agregado de comentarios sem baixar o historico', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        items: [],
        summary: { totalComments: 57 },
      },
    });

    const page = await commentService.getCurrentUserCommentsPage({ limit: 1, range: 'week' });

    expect(mockGet).toHaveBeenCalledWith('users/me/comments.php', {
      params: { limit: 1, range: 'week' },
    });
    expect(page.items).toHaveLength(0);
    expect(page.totalComments).toBe(57);
  });

  it('creates a comment through commentsHandle', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'com-9',
      },
    });

    const comment = await commentService.addComment({
      questionId: '88',
      content: 'Novo comentário',
      userId: 'user-1',
      userName: 'Teste',
      targetType: 'question',
    });

    expect(mockPost).toHaveBeenCalledWith('commentsHandle', {
      action: 'add',
      question_id: '88',
      user_id: 'user-1',
      user_name: 'Teste',
      content: 'Novo comentário',
      parent_id: undefined,
      targetType: 'question',
      gamification_event: 'comment_submitted',
      notification_event: 'comment_published',
    });
    expect(comment.id).toBe('com-9');
  });

  it('likes a comment through commentsHandle', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
    });

    const result = await commentService.likeComment('com-10', 'user-1');

    expect(mockPost).toHaveBeenCalledWith('commentsHandle', {
      action: 'like',
      commentId: 'com-10',
      userId: 'user-1',
      gamification_event: 'comment_like_received',
      notification_event: 'comment_like_received',
    });
    expect(result.success).toBe(true);
  });

  it('toggles local comment likes without double-counting', () => {
    const comments = [
      {
        id: 'com-1',
        userId: 'user-1',
        userName: 'Teste',
        text: 'Comentario',
        date: 'Agora',
        likes: 1,
        isLiked: false,
        replies: [
          {
            id: 'reply-1',
            userId: 'user-2',
            userName: 'Outro',
            text: 'Resposta',
            date: 'Agora',
            likes: 2,
            isLiked: true,
            replies: [],
          },
        ],
      },
    ];

    const liked = commentService.likeCommentInTree(comments, 'com-1');
    expect(liked[0]).toEqual(expect.objectContaining({
      likes: 2,
      isLiked: true,
    }));

    const unlikedReply = commentService.likeCommentInTree(liked, 'reply-1');
    expect(unlikedReply[0].replies[0]).toEqual(expect.objectContaining({
      likes: 1,
      isLiked: false,
    }));
  });

  it('deletes a comment through commentsHandle', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
    });

    const result = await commentService.deleteComment('com-11', 'user-2');

    expect(mockPost).toHaveBeenCalledWith('commentsHandle', {
      action: 'delete',
      commentId: 'com-11',
      userId: 'user-2',
    });
    expect(result.success).toBe(true);
  });

  it('preserves the duplicate flag when the same user already reported the comment', async () => {
    mockCreateReport.mockResolvedValueOnce({
      id: 'rep-1',
      message: 'Duplicate report',
      duplicate: true,
    });

    const result = await commentService.reportComment('com-12', 'spam', 'Duplicate', 'user-3');

    expect(result).toEqual(expect.objectContaining({
      success: true,
      duplicate: true,
    }));
  });

  it('reports a comment through the reports endpoint', async () => {
    mockCreateReport.mockResolvedValueOnce({
      id: 'rep-1',
      message: 'Denúncia registrada',
    });

    const result = await commentService.reportComment('com-12', 'spam', 'Conteúdo suspeito', 'user-3');

    expect(mockCreateReport).toHaveBeenCalledWith({
      reporterId: 'user-3',
      targetType: 'comment',
      targetId: 'com-12',
      reason: 'spam',
      details: 'Conteúdo suspeito',
    });
    expect(result.success).toBe(true);
    expect(result.message).toBe('Denúncia registrada');
  });
});
