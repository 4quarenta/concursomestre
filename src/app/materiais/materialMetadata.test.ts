import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildMaterialMetadata, buildMaterialsDirectoryMetadata } from './materialMetadata';
import type { PublicMaterialDetail } from './materialServerData';

const material = {
  id: 'mat-1', slug: 'guia-de-estudo', title: 'Guia de estudo', description: null, format: 'PDF',
  pageCount: 42, year: 2026, publicAuthorName: null, coverUrl: null, previewUrl: null, hasAsset: true,
  offer: { mode: 'not_for_sale', amountMinor: null, currency: null, available: false },
  path: '/materiais/guia-de-estudo', updatedAt: null, canonicalPath: '/materiais/guia-de-estudo', marketplacePath: '/marketplace',
  taxonomies: [], breadcrumbs: [], readiness: { status: 'READY', reasonCodes: [] },
  listingReadiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.invalid_definition'] },
} satisfies PublicMaterialDetail;

afterEach(() => vi.unstubAllEnvs());

describe('public Material metadata and launch policy', () => {
  it('keeps the persisted self canonical and PRELAUNCH noindex', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRELAUNCH');
    const metadata = buildMaterialMetadata(material);
    expect(metadata.alternates?.canonical).toBe('/materiais/guia-de-estudo');
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('indexes a READY Material only in a controlled PRODUCTION simulation', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRODUCTION');
    expect(buildMaterialMetadata(material).robots).toBeUndefined();
    expect(buildMaterialMetadata({ ...material, readiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.protected'] } }).robots)
      .toMatchObject({ index: false, follow: true });
  });

  it('keeps directory facets noindex with the clean canonical', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRODUCTION');
    for (const params of [{ busca: 'direito' }, { pagina: '2' }, { ordem: 'preco' }, { coupon: 'x' }]) {
      const metadata = buildMaterialsDirectoryMetadata(params);
      expect(metadata.alternates?.canonical).toBe('/materiais');
      expect(metadata.robots).toMatchObject({ index: false, follow: true });
    }
  });

  it('keeps metadata server-owned and the legacy route redirect-only', () => {
    const detail = readFileSync(resolve(process.cwd(), 'src/app/materiais/[slug]/page.tsx'), 'utf8');
    const legacy = readFileSync(resolve(process.cwd(), 'src/app/material/[id]/[[...slug]]/page.tsx'), 'utf8');
    expect(detail).not.toMatch(/useDocumentSeo|document\.title|'use client'/);
    expect(detail).toContain('notFound()');
    expect(detail).toContain('permanentRedirect');
    expect(legacy).toContain('permanentRedirect');
    expect(legacy).not.toContain('slugify');
    const marketplaceLayout = readFileSync(resolve(process.cwd(), 'src/app/marketplace/layout.tsx'), 'utf8');
    const marketplacePage = readFileSync(resolve(process.cwd(), 'src/app/marketplace/page.tsx'), 'utf8');
    expect(marketplaceLayout).not.toContain('fallback={null}');
    expect(marketplacePage).not.toContain('useSearchParams');
    expect(marketplacePage).not.toMatch(/!material\.offerMode\s*&&\s*material\.price\s*===\s*0/);
    expect(marketplacePage).not.toMatch(/!m\.offerMode\s*&&\s*m\.price\s*===\s*0/);
  });
});
