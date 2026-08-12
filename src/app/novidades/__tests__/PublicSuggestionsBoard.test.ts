import { describe, expect, it } from 'vitest';
import { applyPublicSuggestionVote } from '../PublicSuggestionsBoard';
import type { PublicSuggestion } from '@services/support/supportService';

const suggestion: PublicSuggestion = {
  id: 31,
  type: 'suggestion',
  reason: 'Melhorar filtros',
  details: 'Organizar os filtros por hierarquia.',
  status: 'read',
  product_status: 'approved',
  platform_version: '1.0.0',
  created_at: '2026-08-11 12:00:00',
  likes: 4,
  dislikes: 1,
  score: 3,
  user_vote: null,
};

describe('PublicSuggestionsBoard', () => {
  it('applies and removes an optimistic vote without duplicating counts', () => {
    const liked = applyPublicSuggestionVote(suggestion, 'like');
    expect(liked).toMatchObject({ likes: 5, dislikes: 1, score: 4, user_vote: 'like' });

    const removed = applyPublicSuggestionVote(liked, null);
    expect(removed).toMatchObject({ likes: 4, dislikes: 1, score: 3, user_vote: null });
  });

  it('moves a vote from like to dislike', () => {
    const liked = { ...suggestion, likes: 5, user_vote: 'like' as const };
    expect(applyPublicSuggestionVote(liked, 'dislike')).toMatchObject({
      likes: 4,
      dislikes: 2,
      score: 2,
      user_vote: 'dislike',
    });
  });
});

