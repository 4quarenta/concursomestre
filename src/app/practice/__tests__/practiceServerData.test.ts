import { describe, expect, it, vi } from 'vitest';
import {
  buildPracticeServerUrl,
  fetchPracticeInitialQuestions,
  mapPracticeServerPayload,
} from '../practiceServerData';

const payload = {
  success: true,
  data: {
    items: [
      {
        id: 42,
        source: { origin: 'platform' },
        content: {
          statement: 'Qual alternativa está correta?',
          statementClean: 'Qual alternativa está correta?',
          supportText: 'Texto de apoio indexável.',
          reference: '',
        },
        assets: [],
        contexts: [],
        filters: {
          subjects: [{ id: 1, label: 'Português', slug: 'portugues' }],
          topics: [],
          subtopics: [],
          examBoards: [],
          organizations: [],
          roles: [],
          careers: [],
          years: [2026],
          levels: [],
          examTypes: [],
        },
        type: 'single_choice',
        difficulty: 'medium',
        alternatives: [
          { id: 'a', order: 1, label: 'A', text: 'Primeira alternativa.' },
          { id: 'b', order: 2, label: 'B', text: 'Segunda alternativa.' },
        ],
        publication: { status: 'published', visibility: 'public' },
        stats: { totalAttempts: 4, correctCount: 3, wrongCount: 1 },
        engagement: { commentsCount: 2 },
      },
    ],
    pageInfo: { limit: 10, total: 137, hasMore: true, nextCursor: 'cursor-2' },
  },
};

describe('practice SSR data', () => {
  it('maps the public API envelope into complete question cards', () => {
    const result = mapPracticeServerPayload(payload);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({
      id: 42,
      enunciado: 'Qual alternativa está correta?',
      introText: 'Texto de apoio indexável.',
      commentsCount: 2,
    });
    expect(result.questions[0].itens).toHaveLength(2);
    expect(result.total).toBe(137);
    expect(result.pageInfo).toEqual({ limit: 10, total: 137, hasMore: true, nextCursor: 'cursor-2' });
  });

  it('builds a public practice query and scopes a highlighted question', () => {
    const url = buildPracticeServerUrl(
      { materia: 'Português', questionId: '42' },
      'https://example.test/api/',
    );

    expect(url.pathname).toBe('/api/v2/questions/list.php');
    expect(url.searchParams.get('content_scope')).toBe('practice');
    expect(url.searchParams.get('publication_scope')).toBe('public');
    expect(url.searchParams.get('materia')).toBe('Português');
    expect(url.searchParams.get('questionIds')).toBe('42');
  });

  it('keeps the page renderable when the backend is unavailable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    const result = await fetchPracticeInitialQuestions({
      fetchImpl,
      apiBaseUrl: 'https://example.test/api/',
    });

    expect(result).toEqual({
      questions: [],
      total: 0,
      pageInfo: { limit: 10, total: 0, hasMore: false, nextCursor: null },
    });
  });
});
