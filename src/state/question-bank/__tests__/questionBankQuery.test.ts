import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getQuestionPage } = vi.hoisted(() => ({
  getQuestionPage: vi.fn(),
}));

vi.mock('@services/questions', () => ({
  questionService: { getQuestionPage },
}));

import {
  buildQuestionBankFilterSignature,
  canAdvanceQuestionBankCursor,
  fetchQuestionBankPage,
} from '../questionBankQuery';

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

  it('keeps a stable server-filter signature while pagination changes', () => {
    const firstPage = buildQuestionBankFilterSignature({
      subject: 'Informática',
      hasTeacherComment: true,
      limit: 20,
      cursor: 'first-cursor',
    });
    const nextPage = buildQuestionBankFilterSignature({
      hasTeacherComment: true,
      subject: 'Informática',
      limit: 50,
      cursor: 'next-cursor',
    });

    expect(nextPage).toBe(firstPage);
    expect(buildQuestionBankFilterSignature({ subject: 'Informática' })).not.toBe(firstPage);
  });
  it('only advances pagination when the response adds rows and changes the cursor', () => {
    expect(canAdvanceQuestionBankCursor({
      requestedCursor: 'cursor-1',
      nextCursor: 'cursor-2',
      hasMore: true,
      uniqueLoadedCount: 20,
    })).toBe(true);

    expect(canAdvanceQuestionBankCursor({
      requestedCursor: 'cursor-1',
      nextCursor: 'cursor-1',
      hasMore: true,
      uniqueLoadedCount: 20,
    })).toBe(false);

    expect(canAdvanceQuestionBankCursor({
      requestedCursor: 'cursor-1',
      nextCursor: 'cursor-2',
      hasMore: true,
      uniqueLoadedCount: 0,
    })).toBe(false);
  });
});
