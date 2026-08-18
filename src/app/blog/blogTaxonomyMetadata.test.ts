import { describe, expect, it } from 'vitest';
import { buildUnpromotedBlogTaxonomyMetadata } from './blogTaxonomyMetadata';

describe('unpromoted blog taxonomy metadata', () => {
  it('keeps a self canonical but cannot index before quality promotion', () => {
    const metadata = buildUnpromotedBlogTaxonomyMetadata({
      title: 'Direito', description: 'Artigos de Direito.', path: '/blog/tag/direito',
    });
    expect(metadata.alternates?.canonical).toBe('/blog/tag/direito');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });
});
