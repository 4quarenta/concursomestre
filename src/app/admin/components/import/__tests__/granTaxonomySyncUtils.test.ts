import { describe, expect, it } from 'vitest';
import { splitGranTaxonomyResponses } from '../granTaxonomySyncUtils';

describe('splitGranTaxonomyResponses', () => {
  it('limits each backend request to the configured page count', () => {
    const pages = Array.from({ length: 10 }, (_, index) => ({ page: index + 1 }));

    expect(splitGranTaxonomyResponses(pages, 4, 1_000_000)).toEqual([
      pages.slice(0, 4),
      pages.slice(4, 8),
      pages.slice(8, 10),
    ]);
  });

  it('starts a new request before the approximate payload limit is exceeded', () => {
    const pages = [
      { page: 1, data: 'a'.repeat(100) },
      { page: 2, data: 'b'.repeat(100) },
      { page: 3, data: 'c'.repeat(100) },
    ];

    const batches = splitGranTaxonomyResponses(pages, 10, 300);

    expect(batches).toHaveLength(3);
    expect(batches.flat()).toEqual(pages);
  });

  it('keeps one oversized page as a valid resumable request', () => {
    const page = { page: 1, data: 'x'.repeat(1_000) };
    expect(splitGranTaxonomyResponses([page], 4, 100)).toEqual([[page]]);
  });
});

