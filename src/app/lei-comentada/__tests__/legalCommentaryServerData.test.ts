import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildLawDetailServerUrl,
  buildLegalHomeServerUrl,
  fetchLawDetailForServerTest,
  fetchLegalHomeSnapshot,
  resolveLegalCommentaryModuleAvailability,
} from '../legalCommentaryServerData';
import {
  createProtectedLawPayload,
  PROTECTED_LAW_SENTINELS,
} from '@services/legal-commentary/__tests__/protectedLawFixture';

const homePayload = {
  success: true,
  data: {
    areas: [{ id: 'penal', slug: 'penal', name: 'Direito Penal' }],
    lawsByArea: [{
      area: { id: 'penal', slug: 'penal', name: 'Direito Penal' },
      laws: [{ id: '1', slug: 'codigo-penal', title: 'Código Penal' }],
    }],
    mostAccessed: [],
    favoriteLaws: [],
    recentlyStudied: [],
    recentlyUpdated: [],
    totals: { laws: 1, articles: 361, commentedArticles: 20, updatedRecently: 0 },
  },
};

const lawPayload = {
  success: true,
  data: {
    id: '1',
    slug: 'codigo-penal',
    title: 'Código Penal',
    articles: [{ id: 'art-1', number: 'Art. 1º', text: 'Não há crime sem lei anterior.' }],
  },
};

describe('Lei Comentada SSR data', () => {
  it('builds anonymous public endpoint URLs', () => {
    expect(buildLegalHomeServerUrl('https://example.test/api/').toString())
      .toBe('https://example.test/api/legal-commentary/list.php');
    expect(buildLawDetailServerUrl('codigo-penal', 'https://example.test/api/').toString())
      .toBe('https://example.test/api/legal-commentary/detail.php?slug=codigo-penal');
  });

  it('unwraps the catalog and law detail for server rendering', async () => {
    const homeFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => homePayload });
    const lawFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => lawPayload });

    const home = await fetchLegalHomeSnapshot({
      fetchImpl: homeFetch as typeof fetch,
      apiBaseUrl: 'https://example.test/api/',
    });
    const law = await fetchLawDetailForServerTest(
      'codigo-penal',
      lawFetch as typeof fetch,
      'https://example.test/api/',
    );

    expect(home.lawsByArea[0].laws[0].title).toBe('Código Penal');
    expect(law?.articles[0].text).toContain('Não há crime');
    expect(homeFetch).toHaveBeenCalledOnce();
    expect(lawFetch).toHaveBeenCalledOnce();
  });

  it('keeps the server route as the data owner instead of a client-only shell', () => {
    const listPage = readFileSync(resolve(process.cwd(), 'src/app/lei-comentada/page.tsx'), 'utf8');
    const detailPage = readFileSync(resolve(process.cwd(), 'src/app/lei-comentada/[slug]/page.tsx'), 'utf8');

    expect(listPage).not.toContain("'use client'");
    expect(listPage).toContain('await fetchLegalHomeSnapshot()');
    expect(listPage).toContain('<StructuredData');
    expect(listPage).toContain('buildStructuredDataGraph');
    expect(detailPage).not.toContain("'use client'");
    expect(detailPage).toContain('await fetchLawDetailForServer(slug)');
    expect(detailPage).toContain('generateMetadata');
    expect(detailPage).toContain('notFound()');
  });

  it('removes protected editorial before initial props and RSC serialization', async () => {
    const lawFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: createProtectedLawPayload() }),
    });
    const law = await fetchLawDetailForServerTest(
      'lei-seguranca',
      lawFetch as typeof fetch,
      'https://example.test/api/',
    );
    const initialProps = JSON.stringify({ initialLaw: law });

    PROTECTED_LAW_SENTINELS.forEach((sentinel) => expect(initialProps).not.toContain(sentinel));
    expect(initialProps).toContain('Texto legal publico.');
    expect(lawFetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('returns null for a missing law detail payload so the route can raise a hard 404', async () => {
    const lawFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, message: 'Lei nao encontrada.' }),
    });

    const law = await fetchLawDetailForServerTest(
      'lei-inexistente',
      lawFetch as typeof fetch,
      'https://example.test/api/',
    );

    expect(law).toBeNull();
    expect(lawFetch).toHaveBeenCalledOnce();
  });

  it('resolves module availability from the same public feature flag used by the route gate', () => {
    expect(resolveLegalCommentaryModuleAvailability({
      features: { annotatedLawsEnabled: true },
    })).toBe(true);
    expect(resolveLegalCommentaryModuleAvailability({
      features: { annotatedLawsEnabled: false },
    })).toBe(false);
    expect(resolveLegalCommentaryModuleAvailability(null)).toBe(false);
  });

  it('keeps law semantics out of the removed parallel SEO route', () => {
    expect(existsSync(resolve(process.cwd(), 'src/app/@seo/default.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/app/@seo/lei-comentada/page.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/app/@seo/lei-comentada/[slug]/page.tsx'))).toBe(false);
  });
});
