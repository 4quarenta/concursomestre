import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildLawDetailServerUrl,
  buildLegalHomeServerUrl,
  fetchLawDetailForServerTest,
  fetchLegalHomeSnapshot,
} from '../legalCommentaryServerData';

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
    expect(listPage).toContain('application/ld+json');
    expect(detailPage).not.toContain("'use client'");
    expect(detailPage).toContain('await fetchLawDetailForServer(slug)');
    expect(detailPage).toContain('generateMetadata');
  });
});
