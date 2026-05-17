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
      comments: 'usersComments',
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
      data: [
        { id: 'com-1', text: 'Comentário', replies: [] },
      ],
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

    expect(mockGet).toHaveBeenCalledWith('usersComments', {
      params: { user_id: 'user-7' },
    });
    expect(comments[0].id).toBe('com-2');
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
    });
    expect(result.success).toBe(true);
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
