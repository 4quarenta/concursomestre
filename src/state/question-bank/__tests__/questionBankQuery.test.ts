import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getQuestionPage } = vi.hoisted(() => ({
  getQuestionPage: vi.fn(),
}));

vi.mock('@services/questions', () => ({
  questionService: { getQuestionPage },
}));

import { fetchQuestionBankPage } from '../questionBankQuery';

describe('question bank query', () => {
  beforeEach(() => {
    getQuestionPage.mockReset();
    getQuestionPage.mockResolvedValue({
      rows: [{ id: 8, enunciado: 'Questao completa', itens: [] }],
      total: 1,
      pageInfo: { limit: 10, hasMore: false, nextCursor: null },
    });
  });

  it('always requests the complete practice contract used by question cards', async () => {
    const result = await fetchQuestionBankPage({
      limit: 10,
      content_scope: 'list',
    });

    expect(getQuestionPage).toHaveBeenCalledWith({
      limit: 10,
      content_scope: 'practice',
    });
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
