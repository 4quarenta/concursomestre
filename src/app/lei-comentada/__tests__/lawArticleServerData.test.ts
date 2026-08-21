import { describe, expect, it, vi } from 'vitest';
import { publicRoutes } from '@services/routes/publicRoutes';
import { parsePublicLawArticleDetail, fetchPublicLawArticleForTest } from '../lawArticleServerData';

const payload = {
  law: { id: 1, slug: 'constituicao-federal', title: 'Constituição Federal', shortTitle: 'CF', number: '1988', year: '1988', status: 'published', officialUrl: 'https://planalto.gov.br/lei', sourceName: 'Planalto', updatedAt: '2026-08-20' },
  article: { id: 5, lawId: 1, sectionId: 2, slug: 'artigo-5-a', number: '5º-A', title: null, officialText: 'Texto oficial.', officialStatus: 'active', officialAnchor: 'art5a', updatedAt: '2026-08-20', blocks: [{ id: 1, uid: 'caput', kind: 'caput', label: 'Art. 5º-A', text: 'Texto oficial.', parentUid: null, anchor: null, sortOrder: 0 }] },
  section: null,
  navigation: { previous: null, next: null },
  canonicalPath: '/lei-comentada/constituicao-federal/artigo-5-a',
  breadcrumbs: [{ label: 'Lei Comentada', path: '/lei-comentada' }],
  readiness: { status: 'READY', reasonCodes: [] },
  editorial: { commentaryAvailable: false, protectedContentIncluded: false },
};

describe('public law article server contract', () => {
  it('accepts persisted law/article identity and rejects a mismatched canonical', () => {
    expect(parsePublicLawArticleDetail(payload)).toMatchObject({ canonicalPath: payload.canonicalPath, readiness: { status: 'READY' } });
    expect(parsePublicLawArticleDetail({ ...payload, canonicalPath: '/lei-comentada/outra/artigo-5-a' })).toBeNull();
  });

  it('accepts only an internal one-hop canonical redirect', () => {
    expect(parsePublicLawArticleDetail({ redirectPath: payload.canonicalPath })).toEqual({ redirectPath: payload.canonicalPath });
    expect(parsePublicLawArticleDetail({ redirectPath: 'https://evil.example' })).toBeNull();
  });

  it('uses one read endpoint request for one cold fetch', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: payload }), { status: 200 }));
    const result = await fetchPublicLawArticleForTest('constituicao-federal', 'artigo-5-a', fetchImpl as typeof fetch, 'http://api.test/api/');
    expect(result).toMatchObject({ canonicalPath: payload.canonicalPath });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('builds only the authorized article route', () => {
    expect(publicRoutes.laws.article('constituicao-federal', 'artigo-5-a')).toBe(payload.canonicalPath);
  });
});
