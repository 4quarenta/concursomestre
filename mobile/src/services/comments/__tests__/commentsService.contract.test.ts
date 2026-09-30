import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/services/api/client', () => ({
  apiClient: mocks,
}));

import { commentsService } from '@/services/comments/commentsService';

describe('comments service authenticated identity contract', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();
  });

  it('lists comments without sending a client-provided user id', async () => {
    mocks.get.mockResolvedValue({ success: true, data: { items: [] } });

    await commentsService.getComments('question-101', 'user-should-not-be-sent');

    expect(mocks.get).toHaveBeenCalledWith('commentsList', {
      params: { target_id: 'question-101', target_type: 'question' },
    });
  });

  it('sends only the comment content and target to the authenticated API', async () => {
    mocks.post.mockResolvedValue({ success: true, data: { id: 'comment-1' } });

    await commentsService.addComment({
      questionId: '101',
      content: 'Comentário de teste',
      userId: 'user-1',
      userName: 'Nome informado pelo cliente',
      userAvatar: 'https://example.invalid/avatar.png',
      userPlan: 'Elite',
    });

    expect(mocks.post).toHaveBeenCalledWith('commentsHandle', {
      action: 'add',
      question_id: '101',
      content: 'Comentário de teste',
      parent_id: undefined,
      targetType: 'question',
    });
  });

  it('likes through the bearer session instead of a client user id', async () => {
    mocks.post.mockResolvedValue({ success: true, data: { liked: true } });

    await commentsService.likeComment('comment-1', 'user-1');

    expect(mocks.post).toHaveBeenCalledWith('commentsHandle', {
      action: 'like',
      commentId: 'comment-1',
    });
  });

  it('normalizes author ids on comments and nested replies for ownership checks', async () => {
    mocks.get.mockResolvedValue({ success: true, data: { items: [{
      id: 1,
      user_id: 42,
      content: 'Comentário próprio',
      replies: [{ id: 2, userId: '84', text: 'Resposta de outra pessoa' }],
    }] } });

    const comments = await commentsService.getComments('question-101');

    expect(comments[0].userId).toBe('42');
    expect(comments[0].text).toBe('Comentário próprio');
    expect(commentsService.findCommentOwner(comments, '2')).toBe('84');
  });

  it('deletes only through the authenticated comments handler contract', async () => {
    mocks.post.mockResolvedValue({ success: true, data: { success: true } });

    await commentsService.deleteComment('comment-1');

    expect(mocks.post).toHaveBeenCalledWith('commentsHandle', {
      action: 'delete',
      commentId: 'comment-1',
    });
  });
});
