import { afterEach, describe, expect, it } from 'vitest';
import productionPageMap from '../../../config/seo/seo-production-page-map.v1.json';
import { buildBlogTaxonomyMetadata } from './blogTaxonomyMetadata';
import type { PublicBlogTaxonomy } from '@services/blog';

const taxonomy = (
  type: 'category' | 'tag',
  status: 'READY' | 'NOT_READY' = 'READY',
  articleCount = status === 'READY' ? 1 : 0,
): PublicBlogTaxonomy => ({
  id: 1,
  type,
  label: type === 'category' ? 'Editais' : 'Nordeste',
  slug: type === 'category' ? 'editais' : 'nordeste',
  kind: type === 'tag' ? 'region' : null,
  description: null,
  imageUrl: null,
  articleCount,
  lastPublishedAt: status === 'READY' ? '2026-08-20T10:00:00-03:00' : null,
  canonicalPath: type === 'category' ? '/blog/categoria/editais' : '/blog/tag/nordeste',
  readiness: {
    status,
    reasonCodes: status === 'READY' ? [] : ['instance_readiness.publication_blocked'],
  },
});

describe('blog taxonomy metadata', () => {
  afterEach(() => { delete process.env.SEO_LAUNCH_MODE; });
  it('keeps category self canonical and fail-closes in PRELAUNCH', () => {
    process.env.SEO_LAUNCH_MODE = 'PRELAUNCH';
    const metadata = buildBlogTaxonomyMetadata(taxonomy('category'));
    expect(metadata.alternates?.canonical).toBe('/blog/categoria/editais');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  it('indexes only READY categories in PRODUCTION and keeps functional variants noindex', () => {
    process.env.SEO_LAUNCH_MODE = 'PRODUCTION';
    expect(buildBlogTaxonomyMetadata(taxonomy('category')).robots).toBeUndefined();
    expect(buildBlogTaxonomyMetadata(taxonomy('category', 'NOT_READY')).robots).toMatchObject({ index: false });
    expect(buildBlogTaxonomyMetadata(taxonomy('category'), true).robots).toMatchObject({ index: false, follow: true });
  });

  it('keeps tags permanently NOINDEX in PRODUCTION', () => {
    process.env.SEO_LAUNCH_MODE = 'PRODUCTION';
    const metadata = buildBlogTaxonomyMetadata(taxonomy('tag', 'READY', 100));
    expect(metadata.alternates?.canonical).toBe('/blog/tag/nordeste');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(productionPageMap.families.find((family) => family.familyId === 'blog_tag')).toMatchObject({
      familyEligibility: 'PERMANENT_NOINDEX', targetProductionIndexability: 'NOINDEX', sitemapTarget: 'EXCLUDE',
    });
  });
});
