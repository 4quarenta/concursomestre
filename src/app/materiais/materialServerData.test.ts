import { describe, expect, it } from 'vitest';
import { parsePublicMaterialDetail, parsePublicMaterialDirectory, toMarketplaceMaterial } from './materialServerData';

const base = {
  id: 'mat-1', slug: 'guia-de-estudo', title: 'Guia de estudo', description: 'Conteúdo público.',
  format: 'PDF', pageCount: 42, year: 2026, publicAuthorName: 'Equipe pública',
  coverUrl: 'https://cdn.example.com/capa.webp', previewUrl: 'https://cdn.example.com/preview.pdf',
  hasAsset: true, offer: { mode: 'paid', amountMinor: 2990, currency: 'BRL', available: true },
  path: '/materiais/guia-de-estudo', updatedAt: '2026-08-21T12:00:00Z',
};

describe('public material server contract', () => {
  it('accepts only persisted canonical Material summaries', () => {
    const result = parsePublicMaterialDirectory({
      items: [base, { ...base, slug: 'outro', path: '/materiais/guia-de-estudo' }, { ...base, slug: 'Guia' }],
      pageInfo: { page: 1, pages: 1, limit: 24, total: 1 }, scope: 'materials',
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].path).toBe('/materiais/guia-de-estudo');
  });

  it('keeps only public allowlisted fields and safe stable URLs', () => {
    const result = parsePublicMaterialDetail({
      ...base, canonicalPath: base.path, marketplacePath: '/marketplace',
      taxonomies: [{ id: 2, slug: 'direito', name: 'Direito', relationType: 'discipline', path: '/disciplinas/direito', providerId: 'SECRET' }],
      breadcrumbs: [{ label: 'Materiais', canonicalPath: '/materiais', admin: 'SECRET' }],
      readiness: { status: 'READY', reasonCodes: [] }, listingReadiness: { status: 'READY', reasonCodes: [] },
      storagePath: 'PRIVATE', signedDownloadUrl: 'https://cdn.example.com/full.pdf?token=PRIVATE', purchaseId: 'PRIVATE',
    });
    expect(result && !('redirectSlug' in result) ? result.taxonomies[0] : null).toEqual({ id: 2, slug: 'direito', name: 'Direito', relationType: 'discipline', path: '/disciplinas/direito' });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });

  it('rejects dangerous public asset URLs defensively', () => {
    for (const previewUrl of ['javascript:blocked', 'data:text/html,x', 'file:///tmp/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://user:pass@example.com/x', 'https://cdn.example.com/x?token=secret']) {
      const result = parsePublicMaterialDirectory({ items: [{ ...base, previewUrl }], pageInfo: { page: 1, pages: 1, limit: 24, total: 1 } });
      expect(result.items[0].previewUrl, previewUrl).toBeNull();
    }
  });

  it('supports one-hop aliases and does not create a marketplace listing identity', () => {
    expect(parsePublicMaterialDetail({ redirectSlug: 'guia-de-estudo' })).toEqual({ redirectSlug: 'guia-de-estudo' });
    const mapped = toMarketplaceMaterial(parsePublicMaterialDirectory({ items: [base], pageInfo: { page: 1, pages: 1, limit: 24, total: 1 } }).items[0]);
    expect(mapped.canonicalPath).toBe('/materiais/guia-de-estudo');
    expect(mapped.authorId).toBe('');
  });
});
